/**
 * The flashcard session. This is the section that exercises everything else:
 * the scheduler, the review log, the concept taxonomy, the timer and the side
 * panel all meet here.
 *
 * Session state lives in the URL (`?i=`, `?concept=`, `?minutes=`) so a
 * learner nine cards in who gets a phone call, or who reloads, or who follows
 * a link and comes back, lands on the same card.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router';
import { useApp, useUserId } from '../../app-context';
import { userKey } from '../../lib/session';
import {restore as restoreTimer, save as saveTimer, formatClock } from '../../lib/timer';
import { loadContent } from '../../lib/content';
import { allCardStates, appendReview, getCardState } from '../../lib/db';
import { emptyState, loadScheduler, GRADES, SCHEDULER_ID, type Grade } from '../../lib/scheduler';
import type { Card, CardState, ReviewRow } from '../../lib/types';
import { Icon } from '../../components/Icon';
import { useSidePanel } from '../../components/SidePanel';
import { ErrorState } from '../../components/Search';
import { fr as frText } from '../../lib/typography';
import { fold } from '../../lib/fold';
import { useTick } from '../../hooks/useTick';
import { Num } from '../../components/Num';
import { Localised } from '../../components/Localised';
import { NextActivity } from '../../components/NextActivity';
import type { Level, Locale } from '../../lib/types';
import { CARD_LEVELS, loadLevelCards, loadWordIndex, mergeCards, NEW_PER_SESSION } from '../../lib/verb-cards';
import { loadVerbIndex } from '../../lib/verbs';
import { useTarget } from '../../lib/exam-targets';
import { requestPersistence } from '../../lib/backup';

const RATING_KEY = { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' } as const;
/** How far a card must be dragged, in pixels, to count as a swipe. */
const SWIPE_AT = 96;

function newId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const b = new Uint8Array(16); globalThis.crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export function FlashcardSession() {
  const { t, settings } = useApp();
  const userId = useUserId();
  const [params, setParams] = useSearchParams();
  const panel = useSidePanel();

  const conceptFilter = params.get('concept');
  const cardFilter = params.get('card');
  // The level whose NEW cards this session introduces. Due cards come from
  // every level the learner has history in, whichever level is chosen.
  const [target] = useTarget(userId);
  const rawLevel = (params.get('level') ?? '').toUpperCase();
  const level: Level = (CARD_LEVELS as string[]).includes(rawLevel) ? rawLevel as Level
    : (target?.level && (CARD_LEVELS as string[]).includes(target.level) ? target.level as Level : 'A1');
  const [levelCount, setLevelCount] = useState<number | null>(null);
  const index = Math.max(0, Number(params.get('i') ?? 0) | 0);
  // The session id is in the URL, so the address alone identifies the session.
  // A reload, a back button, or the same link pasted into a reopened tab all
  // resume the same ordered queue; a link with no id starts a new one.
  const sessionParam = params.get('s');

  // `?minutes=N` time-boxes the session. It starts the SAME timer the pill in
  // the bar drives, so the two can never disagree. The session then holds the
  // end time itself rather than re-reading the timer, because `restore` clears
  // an expired timer so it reports the finish exactly once — two pollers would
  // race and one would miss it.
  const minutesParam = Number(params.get('minutes')) || 0;
  useTick(250);
  const [boxEndsAt, setBoxEndsAt] = useState<number | null>(null);
  const boxStarted = useRef(false);
  useEffect(() => {
    if (!minutesParam || boxStarted.current) return;
    boxStarted.current = true;
    const existing = restoreTimer(userId, Date.now());
    if (existing.state === 'running') { setBoxEndsAt(existing.endsAt); return; }
    const endsAt = Date.now() + minutesParam * 60_000;
    saveTimer(userId, endsAt, minutesParam);
    setBoxEndsAt(endsAt);
  }, [minutesParam, userId]);
  const boxLeft = boxEndsAt === null ? null : Math.max(0, Math.ceil((boxEndsAt - Date.now()) / 1000));
  const timeUp = boxLeft !== null && boxLeft <= 0;

  const [queue, setQueue] = useState<Card[] | null>(null);
  const [states, setStates] = useState<Map<string, CardState>>(new Map());
  const [revealed, setRevealed] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [error, setError] = useState(false);
  const shownAt = useRef<number>(Date.now());
  const sessionId = useRef<string>(newId());
  // The scheduler is fetched when a session opens, not on first paint.
  const [engine, setEngine] = useState<Awaited<ReturnType<typeof loadScheduler>> | null>(null);
  useEffect(() => { let live = true; loadScheduler().then((e) => { if (live) setEngine(e); }); return () => { live = false; }; }, []);

  /**
   * Build the queue — or restore the one already in progress.
   *
   * Rebuilding from scratch on every mount looks right and is wrong: a card
   * just graded Good is no longer due, so the queue shrinks, and the index in
   * the URL then points at a different card. A learner who reloads, or takes a
   * phone call and comes back, silently jumps. The order is therefore fixed
   * when the session starts and kept in sessionStorage — per tab, so two tabs
   * are two sessions, and it survives a reload.
   */
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        // Everything is requested at once: the first card should not wait on
        // four round trips in a row.
        const chosen = loadLevelCards(level);
        const [{ cards: written }, saved, index, words] = await Promise.all([
          loadContent(), allCardStates(userId), loadVerbIndex().catch(() => []), loadWordIndex(), chosen.catch(() => [])]);
        const byKey = new Map(saved.map((s) => [s.cardKey, s as CardState]));
        // Load the chosen level, and every level a reviewed verb belongs to, so
        // a card due today is never missed because its level was not opened.
        const levelOfKey = new Map<string, Level>([...index.map((v) => [v.key, v.level] as [string, Level]), ...words]);
        const levels = new Set<Level>([level]);
        for (const st of saved) { const l = levelOfKey.get(st.cardKey); if (l) levels.add(l); }
        // A link to one card (`?card=`) must find it whatever level is open.
        if (cardFilter) { const l = levelOfKey.get(cardFilter); if (l) levels.add(l); }
        const verbCards = (await Promise.all([...levels].map(loadLevelCards))).flat();
        const cards = mergeCards(written, verbCards);
        if (!live) return;
        setLevelCount(cards.filter((c) => c.level === level).length);
        const now = Date.now();
        const filter = `${conceptFilter ?? ''}|${cardFilter ?? ''}|${level}`;
        // localStorage, not sessionStorage: a reopened tab must be able to
        // resume. Isolation still holds because the key carries the user id,
        // and two learners in two tabs write to different keys entirely.
        const store = (id: string) => userKey(userId, `session:${id}`);

        let restored: Card[] | null = null;
        let sid = sessionParam;
        if (sid) {
          try {
            const raw = localStorage.getItem(store(sid));
            const parsed = raw ? JSON.parse(raw) : null;
            // Six hours: long enough for a day's interruptions, short enough
            // that yesterday's queue is not served as today's.
            if (parsed && parsed.filter === filter && Array.isArray(parsed.keys)
                && now - parsed.startedAt < 6 * 3600_000) {
              const byCard = new Map(cards.map((c) => [c.key, c]));
              const list = parsed.keys.map((k: string) => byCard.get(k)).filter(Boolean) as Card[];
              if (list.length === parsed.keys.length) restored = list;
            }
          } catch { /* private window: fall through and rebuild */ }
        }
        if (restored) sessionId.current = sid!;

        let queueOut = restored;
        if (!queueOut) {
          let pool = cards;
          if (conceptFilter) pool = pool.filter((c) => c.conceptIds.includes(conceptFilter));
          if (cardFilter) pool = pool.filter((c) => c.key === cardFilter);

          // A learner who asks for a concept gets that concept.
          //
          // The scheduled session shows what is due; a concept or a single card
          // is an explicit request, and answering it with "nothing is due right
          // now" is useless — it is most likely to happen straight after
          // getting those cards wrong, which is exactly when someone wants to
          // drill them. Reviewing early is not a problem for the scheduler:
          // FSRS works from elapsed time, so an early review simply produces a
          // shorter next interval.
          const asked = Boolean(conceptFilter || cardFilter);
          const due: Card[] = [], fresh: Card[] = [], early: Card[] = [];
          for (const c of pool) {
            const s = byKey.get(c.key);
            if (!s || s.reps === 0) { if (asked || c.level === level) fresh.push(c); }
            else if (s.dueAt <= now) due.push(c);
            else if (asked) early.push(c);
          }
          due.sort((a, b) => (byKey.get(a.key)!.dueAt) - (byKey.get(b.key)!.dueAt));
          early.sort((a, b) => (byKey.get(a.key)!.dueAt) - (byKey.get(b.key)!.dueAt));
          // New cards are introduced twenty at a time, in frequency order, so
          // a session is something a learner can finish. A concept or a single
          // card asked for by name is not capped.
          queueOut = [...due, ...(asked ? fresh : fresh.slice(0, NEW_PER_SESSION)), ...early];
          sid = sessionId.current;
          try {
            localStorage.setItem(store(sid), JSON.stringify({
              filter, startedAt: now, keys: queueOut.map((c) => c.key),
            }));
          } catch { /* nothing to do; the session just will not survive a reload */ }
          // Put the id in the address so the session is reachable again.
          const next = new URLSearchParams(params);
          next.set('s', sid);
          setParams(next, { replace: true });
        }
        setStates(byKey);
        setQueue(queueOut);
        // A rebuilt queue is a new session. Without this, moving from a
        // concept-filtered session back to the full one can land on the same
        // card at the same index, so neither dependency of the reset below
        // changes and the previous answer stays on screen.
        setRevealed(false);
        shownAt.current = Date.now();
      } catch { if (live) setError(true); }
    })();
    return () => { live = false; };
    // `params`/`setParams` are intentionally not dependencies: this effect
    // writes `s` into them, and depending on them would rebuild in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, conceptFilter, cardFilter, sessionParam, level]);

  const card = queue?.[index] ?? null;
  useEffect(() => { setRevealed(false); shownAt.current = Date.now(); }, [index, card?.key]);

  const stateOf = useCallback((key: string) => states.get(key) ?? emptyState(), [states]);

  const grade = useCallback(async (g: Grade) => {
    if (!card || !queue || !engine) return;
    const now = Date.now();
    const before = await getCardState(userId, card.key) ?? emptyState();
    const after = engine.review(before, g, now);
    const row: ReviewRow = {
      id: newId(), userId, sessionId: sessionId.current, reviewedAt: now,
      cardKey: card.key, itemType: card.type === 'verb' ? 'verb_form' : 'vocab',
      conceptIds: card.conceptIds, direction: 'fr-native',
      promptShown: { front: card.fr, level: card.level, type: card.type },
      response: null, isCorrect: g >= 3, grade: g, durationMs: now - shownAt.current,
      stateBefore: before.state, stateAfter: after.state,
      stabilityBefore: before.stability, stabilityAfter: after.stability,
      difficultyBefore: before.difficulty, difficultyAfter: after.difficulty,
      elapsedDays: after.elapsedDays, scheduledDays: after.scheduledDays,
      dueBefore: before.dueAt, dueAfter: after.dueAt,
      scheduler: SCHEDULER_ID, paramsHash: engine.paramsHash, client: 'web',
    };
    // One transaction: the row and the new card state, or neither.
    await appendReview(row, after);
    // Now there is something to lose: ask the browser to keep it (lib/backup.ts).
    void requestPersistence();
    setStates((m) => new Map(m).set(card.key, after));
    setReviewed((n) => n + 1);
    const next = new URLSearchParams(params);
    next.set('i', String(index + 1));
    setParams(next, { replace: true });   // replace: the back button leaves the session
  }, [card, queue, userId, params, index, setParams, engine]);

  // Swipe, on touch screens only: right is Good, left is Again. A mouse
  // click still just turns the card, and the buttons stay the main way in.
  const [drag, setDrag] = useState(0);
  const start = useRef<{ x: number; id: number } | null>(null);
  const moved = useRef(false);
  const onPointerDown = (e: React.PointerEvent) => {
    moved.current = false;
    if (e.pointerType === 'mouse' || !revealed) return;
    start.current = { x: e.clientX, id: e.pointerId };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!start.current || start.current.id !== e.pointerId) return;
    const dx = e.clientX - start.current.x;
    if (Math.abs(dx) > 8) moved.current = true;
    setDrag(dx);
  };
  const onPointerUp = () => {
    const dx = drag;
    start.current = null; setDrag(0);
    if (dx > SWIPE_AT) void grade(3);
    else if (dx < -SWIPE_AT) void grade(1);
  };

  const goTo = useCallback((i: number) => {
    if (!queue) return;
    const next = new URLSearchParams(params);
    next.set('i', String(Math.max(0, Math.min(queue.length, i))));
    setParams(next, { replace: true });
  }, [queue, params, setParams]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (!card) return;
      const onButton = e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement;
      // Space turns the card either way; Enter only reveals, and leaves a
      // focused button to do its own job.
      if (e.key === ' ') { e.preventDefault(); setRevealed((r) => !r); return; }
      if (e.key === 'Enter' && !revealed && !onButton) { e.preventDefault(); setRevealed(true); return; }
      // The arrows move through the session, in reading direction.
      const rtl = document.documentElement.dir === 'rtl';
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        goTo(index + ((e.key === 'ArrowRight') !== rtl ? 1 : -1));
        return;
      }
      if (revealed && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault(); void grade(Number(e.key) as Grade);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [card, revealed, grade, goTo, index]);

  if (error) return <ErrorState onRetry={() => location.reload()} />;
  // The countdown is shown from the first frame: the timer is already
  // running, and a learner on a slow line should see it while cards load.
  const timebox = minutesParam > 0 && boxLeft !== null ? (
    <p className="session__timebox" data-testid="timebox" role="status">
      {t('timeLeft', { c: formatClock(boxLeft) })}
    </p>
  ) : null;
  if (!queue || !engine) return <>{timebox && <div className="page">{timebox}</div>}<SessionSkeleton /></>;

  if (timeUp) {
    return (
      <div className="page">
        <div className="empty" data-testid="session-timeup">
          <div className="empty__icon"><Icon name="check" size={34} /></div>
          <p className="empty__title">{t('timerDone')}</p>
          <p className="empty__body">{`${t('sessionOfMinutes', { n: minutesParam })} ${t('reviewed', { n: reviewed })}`}</p>
          <Link className="btn btn--primary" to={`/app/cards?level=${level}`}>{t('keepGoing')}</Link>
          <Link className="btn btn--sm" to="/app/today">{t('learn')}</Link>
        </div>
      </div>
    );
  }

  if (!card) {
    // The session is over; drop its snapshot so the next visit builds a fresh
    // queue instead of replaying a finished one.
    try { if (sessionParam) localStorage.removeItem(userKey(userId, `session:${sessionParam}`)); } catch { /* ignore */ }
    return (
      <div className="page">
        <div className="empty" data-testid="session-done">
          <div className="empty__icon"><Icon name="check" size={34} /></div>
          <p className="empty__title">{reviewed > 0 ? t('sessionDone') : t('nothingDue')}</p>
          <p className="empty__body">
            {reviewed > 0 ? `${t('sessionDoneBody')} ${t('reviewed', { n: reviewed })}` : t('nothingDueBody')}
          </p>
          {!conceptFilter && !cardFilter && (
            <Link className="btn btn--primary" to={`/app/cards?level=${level}`}
                  data-testid="session-more">{t('keepGoing')}</Link>
          )}
        </div>
        {!conceptFilter && !cardFilter && <LevelPicker level={level} count={levelCount} />}
        {/* The continuation. `justDid` is passed rather than inferred from the
            route because only this screen knows whether the learner reviewed a
            scheduled queue or a single concept — and the concept case must not
            offer that same concept straight back. The map link lives inside
            the panel, so "return to the map" is still one press from here. */}
        <NextActivity justDid={conceptFilter ? 'concept' : 'review'} />
      </div>
    );
  }

  const meaning = card.meanings[settings.meaning] ?? card.meanings.en ?? '';
  const alt = settings.meaning === 'en' ? card.meanings.fa : card.meanings.en;
  const previews = engine.preview(stateOf(card.key), Date.now());

  const rtlMeaning = settings.meaning === 'fa' || settings.meaning === 'ar';
  const tilt = drag ? Math.max(-1, Math.min(1, drag / SWIPE_AT)) : 0;

  return (
    <div className="page page--session">
      <div className="fc-top">
        <div className="rail" role="progressbar" aria-valuemin={0} aria-valuemax={queue.length}
             aria-valuenow={index} aria-label={t('practise')}>
          <span className="rail__fill" style={{ width: `${(index / Math.max(1, queue.length)) * 100}%` }} />
        </div>
        <p className="session-count"><Num testId="session-count">{index + 1} / {queue.length}</Num></p>
      </div>
      {timebox}
      {!conceptFilter && !cardFilter && index === 0 && <LevelPicker level={level} count={levelCount} />}

      {/* The card turns over like a paper card. Keyed by the card, so the next
          one arrives face up instead of turning back in front of the learner. */}
      <div className="fc-stage">
        <article key={card.key} className="fc" data-testid="flashcard" data-flipped={revealed}
                 style={drag ? { transform: `translateX(${drag}px) rotate(${drag / 24}deg)` } : undefined}
                 onPointerDown={onPointerDown} onPointerMove={onPointerMove}
                 onPointerUp={onPointerUp} onPointerCancel={() => setDrag(0)}>
          {revealed && tilt !== 0 && (
            <span className={`fc__swipe fc__swipe--${tilt > 0 ? 'good' : 'again'}`} style={{ opacity: Math.abs(tilt) }}
                  aria-hidden="true">{t(tilt > 0 ? 'good' : 'again')}</span>
          )}
          <div className="fc__inner">
            <section className="fc__face fc__front" aria-hidden={revealed || undefined}
                     role={revealed ? undefined : 'button'} tabIndex={revealed ? -1 : 0}
                     aria-label={revealed ? undefined : `${card.fr} — ${t('showAnswer')}`}
                     onClick={() => { if (!moved.current) setRevealed(true); }}>
              <div className="fc__meta">
                <span className={`chip chip--${card.level.toLowerCase()}`}>{card.level}</span>
                {card.gender && <span className="chip">{t(card.gender === 'f' ? 'feminine' : 'masculine')}</span>}
                {card.register && <span className="chip" lang="fr" dir="ltr" data-testid="card-register">{card.register}</span>}
              </div>
              <p className="flashcard__word fc__word" lang="fr" dir="ltr">
                {/* The article in the gender's colour: blue le, red la. */}
                {card.article && <span className="article" data-gender={card.gender ?? undefined}>{frText(card.article)}</span>}{frText(card.fr)}
              </p>
              {/* What kind of word this is, and the preposition it takes, on the
                  front: a learner should meet « penser à » as one unit. */}
              <p className="flashcard__pos fc__pos" data-testid="card-pos">
                <span>{t(card.type as 'verb')}</span>
                {card.prep && <> · <bdi lang="fr" dir="ltr">+ {card.prep}</bdi></>}
              </p>
              <p className="fc__hint">{t('shellCardsFlipHint')}</p>
            </section>

            <section className="fc__face fc__back" aria-hidden={!revealed || undefined}
                     onClick={(e) => {
                       // Tap again to turn it back; a button or link on the back keeps its own job.
                       if (moved.current || (e.target as HTMLElement).closest('button, a')) return;
                       setRevealed(false);
                     }}>
              {revealed && (
                <div className="flashcard__answer" data-testid="answer">
                  <header className="fc__head">
                    <p className="fc__headword" lang="fr" dir="ltr">{card.article && `${card.article}${card.article.endsWith("'") ? '' : ' '}`}{frText(card.fr)}
                      {card.prep && <span className="fc__prep"> + {card.prep}</span>}</p>
                    {/* A Wiktionary gloss can run to four senses; the first is
                        the one to learn, the rest are there in small type. */}
                    <div className="flashcard__meaning fc__meaning" lang={settings.meaning}
                         dir={rtlMeaning ? 'rtl' : 'ltr'}>{meaning.split(';')[0]}</div>
                    {meaning.includes(';') && <div className="fc__more" lang={settings.meaning} dir={rtlMeaning ? 'rtl' : 'ltr'}>
                      {meaning.split(';').slice(1).join(';').trim()}</div>}
                    {alt && <div className="flashcard__alt fc__alt" dir={settings.meaning === 'en' ? 'rtl' : 'ltr'}>{alt}</div>}
                    {card.construction && <p className="flashcard__construction fc__construction" lang="fr" dir="ltr"
                                             data-testid="card-construction">{frText(card.construction)}</p>}
                  </header>

                  {/* Past on the left and future on the right, as on a French
                      timeline, whatever the direction of the interface. */}
                  {/* A noun or adjective: its other forms, then one example. */}
                  {(card.plural || card.feminine) && (
                    <p className="fc__forms" lang="fr" dir="ltr" data-testid="card-forms">
                      {card.feminine && <span><em>{t('feminine')}</em> {frText(card.feminine)}</span>}
                      {card.plural && <span><em>{t('shellCardsPlural')}</em> les {frText(card.plural)}</span>}
                    </p>
                  )}
                  {card.examples.some((ex) => ex.tense === 'present') && (
                    <div className="examples examples--one">
                      {card.examples.map((ex) => (
                        <div className="example" key={ex.tense} data-tense="present">
                          <span className="example__label" dir="auto">{t('shellCardsExample')}</span>
                          <div className="example__fr" lang="fr" dir="ltr">{highlight(ex.fr, ex.form)}</div>
                          <div className="example__tr" lang={settings.meaning} dir={rtlMeaning ? 'rtl' : 'ltr'}>
                            {ex.translations[settings.meaning] ?? ex.translations.en}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {(card.examples.some((ex) => ex.tense !== 'present') || card.forms) && (
                    <div className="fc__time" dir="ltr">
                      <div className="fc__axis" aria-hidden="true">
                        <span>{t('past')}</span><i /><b lang="fr">aujourd’hui</b><i /><span>{t('future')}</span>
                      </div>
                      <div className="examples">
                        {card.forms && (['past', 'future'] as const).map((k) => (
                          <div className="example" key={k} data-tense={k} data-testid={`form-${k}`}>
                            <span className="example__label" dir="auto">{t(k)}</span>
                            <div className="example__fr" lang="fr">{highlight(card.forms![k].fr, card.forms![k].form)}</div>
                          </div>
                        ))}
                        {card.examples.filter((ex) => ex.tense !== 'present').map((ex) => (
                          <div className="example" key={ex.tense} data-tense={ex.tense}>
                            <span className="example__label" dir="auto">{t(ex.tense as 'past')} · <b lang="fr">{frText(ex.form)}</b></span>
                            <div className="example__fr" lang="fr">{highlight(ex.fr, ex.form)}</div>
                            <div className="example__tr" lang={settings.meaning} dir={rtlMeaning ? 'rtl' : 'ltr'}>
                              {ex.translations[settings.meaning] ?? ex.translations.en}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {card.conceptIds.length > 0 && <div className="concepts-row">
                    <span className="eyebrow">{t('relatedConcepts')}</span>
                    <div className="row gap-2 wrap">
                      {card.conceptIds.map((id) => (
                        <button key={id} className="chip chip--link" data-testid={`concept-${id}`}
                                onClick={() => panel.open(`concept:${id}`)}>
                          <ConceptName id={id} /> <Icon name="chevron" size={12} />
                        </button>
                      ))}
                    </div>
                  </div>}
                  {card.glossUnreviewed && <p className="fine muted gloss-note" data-testid="gloss-unreviewed">
                    {card.examples.length ? t('shellCardsDraft') : t('glossSource')}</p>}
                </div>
              )}
            </section>
          </div>
        </article>
      </div>

      {/* Move through the session without grading: back to look again, or on. */}
      <nav className="fc-nav" aria-label={t('practise')}>
        <button type="button" className="fc-nav__btn" data-testid="card-prev" disabled={index === 0}
                onClick={() => goTo(index - 1)}>
          <span className="fc-nav__chev fc-nav__chev--back" aria-hidden="true"><Icon name="chevron" size={16} /></span>
          {t('shellCardsPrev')}
        </button>
        <button type="button" className="fc-nav__btn" data-testid="card-next" onClick={() => goTo(index + 1)}>
          {t('shellCardsNext')}
          <span className="fc-nav__chev" aria-hidden="true"><Icon name="chevron" size={16} /></span>
        </button>
      </nav>

      <div className="actions">
        <div className="actions-in">
          {!revealed ? (
            <button className="reveal" data-testid="reveal" onClick={() => setRevealed(true)}>
              {t('showAnswer')} <kbd className="fc__key" aria-hidden="true">{t('shellKeySpace')}</kbd>
            </button>
          ) : GRADES.map((g) => (
            <button key={g} className={`rate rate--${RATING_KEY[g]}`} data-testid={`rate-${g}`}
                    onClick={() => void grade(g)}>
              <kbd className="fc__key" aria-hidden="true">{g}</kbd>
              <span className="rate__name">{t(RATING_KEY[g])}</span>
              <span className="rate__when">{previews[g] === 0 ? t('now') : t('days', { n: previews[g] })}</span>
            </button>
          ))}
        </div>
        {revealed && <p className="fc__swipe-hint">{t('shellCardsSwipeHint')}</p>}
      </div>
    </div>
  );
}

/** The six levels as links. Choosing one starts a session of that level's
 *  new cards; whatever is due from other levels still comes first. */
function LevelPicker({ level, count }: { level: Level; count: number | null }) {
  const { t } = useApp();
  return (
    <nav className="card-levels" aria-label={t('shellCardsLevel')} data-testid="card-levels">
      <div className="row gap-2 wrap">
        {CARD_LEVELS.map((lv) => (
          <Link key={lv} to={`/app/cards?level=${lv}`} data-testid={`card-level-${lv}`}
                className={`chip chip--${lv.toLowerCase()}${lv === level ? ' is-current' : ''}`}
                aria-current={lv === level ? 'true' : undefined}>{lv}</Link>
        ))}
      </div>
      {count !== null && <p className="fine muted">{t('shellCardsCount', { n: count })}</p>}
    </nav>
  );
}

function ConceptName({ id }: { id: string }) {
  const [field, setField] = useState<Partial<Record<Locale, string>> | null>(null);
  useEffect(() => {
    let live = true;
    loadContent().then(({ conceptById }) => {
      const c = conceptById.get(id);
      if (live && c) setField(c.name);
    }).catch(() => {});
    return () => { live = false; };
  }, [id]);
  return field ? <Localised field={field} /> : <>{id}</>;
}

/**
 * Mark the form being taught, with French spacing applied.
 *
 * The slices are formatted individually rather than the whole sentence first,
 * because formatting inserts characters and would move the index the mark is
 * placed at.
 */
/**
 * Find `form` in `sentence`, tolerating a difference in accents, ligatures or
 * Unicode normalisation — and return an index into the ORIGINAL string, so the
 * slices below stay correct.
 *
 * The previous version compared `toLowerCase()` on both sides, which matches
 * only when the content stores the form with byte-identical accents. It happens
 * to hold for all 44 example sentences today; it is one authoring slip or one
 * NFC/NFD mismatch away from failing, and the failure is silent — the taught
 * form simply stops being underlined. `docs/05` says colour is never the only
 * signal and the underline is the other one, so losing it quietly matters.
 */
function findForm(sentence: string, form: string): number {
  if (!form) return -1;
  const exact = sentence.toLowerCase().indexOf(form.toLowerCase());
  if (exact >= 0) return exact;
  // Fold each character separately so a folded index maps back to the original.
  const map: number[] = [];
  let folded = '';
  for (let i = 0; i < sentence.length; i++) {
    const piece = fold(sentence[i] as string);
    for (let k = 0; k < piece.length; k++) map.push(i);
    folded += piece;
  }
  const at = folded.indexOf(fold(form));
  return at < 0 ? -1 : (map[at] ?? -1);
}

/** How many characters of the ORIGINAL sentence the match covers. Folding can
 *  change length (œ becomes oe), so `form.length` is not it. */
function matchLength(sentence: string, at: number, form: string): number {
  const want = fold(form).length;
  let taken = 0;
  for (let n = 0; at + n <= sentence.length; n++) {
    taken = fold(sentence.slice(at, at + n)).length;
    if (taken >= want) return n;
  }
  return form.length;
}

function highlight(sentence: string, form: string) {
  const at = findForm(sentence, form);
  if (at < 0) return frText(sentence);
  return (<>
    {frText(sentence.slice(0, at))}
    <mark className="form">{frText(sentence.slice(at, at + matchLength(sentence, at, form)))}</mark>
    {frText(sentence.slice(at + matchLength(sentence, at, form)))}
  </>);
}

function SessionSkeleton() {
  return (
    <div className="page" data-testid="session-loading">
      <div className="card card--raised flashcard">
        <div className="skeleton skeleton--text" style={{ width: '30%', marginBlockEnd: 'var(--space-4)' }} />
        <div className="skeleton skeleton--title" />
      </div>
    </div>
  );
}
