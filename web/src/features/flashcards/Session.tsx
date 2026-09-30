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

const RATING_KEY = { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' } as const;

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
        const { cards } = await loadContent();
        const saved = await allCardStates(userId);
        const byKey = new Map(saved.map((s) => [s.cardKey, s as CardState]));
        if (!live) return;
        const now = Date.now();
        const filter = `${conceptFilter ?? ''}|${cardFilter ?? ''}`;
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
            if (!s || s.reps === 0) fresh.push(c);
            else if (s.dueAt <= now) due.push(c);
            else if (asked) early.push(c);
          }
          due.sort((a, b) => (byKey.get(a.key)!.dueAt) - (byKey.get(b.key)!.dueAt));
          early.sort((a, b) => (byKey.get(a.key)!.dueAt) - (byKey.get(b.key)!.dueAt));
          queueOut = [...due, ...fresh, ...early];
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
  }, [userId, conceptFilter, cardFilter, sessionParam]);

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
    setStates((m) => new Map(m).set(card.key, after));
    setReviewed((n) => n + 1);
    const next = new URLSearchParams(params);
    next.set('i', String(index + 1));
    setParams(next, { replace: true });   // replace: the back button leaves the session
  }, [card, queue, userId, params, index, setParams, engine]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (!card) return;
      if (!revealed && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); setRevealed(true); return; }
      if (revealed && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault(); void grade(Number(e.key) as Grade);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [card, revealed, grade]);

  if (error) return <ErrorState onRetry={() => location.reload()} />;
  if (!queue || !engine) return <SessionSkeleton />;

  if (timeUp) {
    return (
      <div className="page">
        <div className="empty" data-testid="session-timeup">
          <div className="empty__icon"><Icon name="check" size={34} /></div>
          <p className="empty__title">{t('timerDone')}</p>
          <p className="empty__body">{`${t('sessionOfMinutes', { n: minutesParam })} ${t('reviewed', { n: reviewed })}`}</p>
          <Link className="btn btn--primary" to="/practise/review">{t('keepGoing')}</Link>
          <Link className="btn btn--sm" to="/learn">{t('learn')}</Link>
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
          <Link className="btn btn--primary" to="/learn">{t('learn')}</Link>
        </div>
      </div>
    );
  }

  const meaning = card.meanings[settings.meaning] ?? card.meanings.en ?? '';
  const alt = settings.meaning === 'en' ? card.meanings.fa : card.meanings.en;
  const previews = engine.preview(stateOf(card.key), Date.now());

  return (
    <div className="page page--session">
      <div className="rail" role="progressbar" aria-valuemin={0} aria-valuemax={queue.length}
           aria-valuenow={index} aria-label={t('practise')}>
        <span className="rail__fill" style={{ width: `${(index / Math.max(1, queue.length)) * 100}%` }} />
      </div>
      {minutesParam > 0 && boxLeft !== null && (
        <p className="session__timebox" data-testid="timebox" role="status">
          {t('timeLeft', { c: formatClock(boxLeft) })}
        </p>
      )}
      <p className="session-count" data-testid="session-count">{index + 1} / {queue.length}</p>

      <article className="card card--raised flashcard" data-testid="flashcard">
        <div className="tags">
          <span className={`chip chip--${card.level.toLowerCase()}`}>{card.level}</span>
          <span className="chip">{t(card.type as 'verb')}</span>
          {card.gender && <span className="chip">{t(card.gender === 'f' ? 'feminine' : 'masculine')}</span>}
          {card.prep && <span className="chip chip--prep" lang="fr" dir="ltr">{card.prep}</span>}
        </div>
        <p className="flashcard__word" lang="fr" dir="ltr">
          {card.article && <span className="article">{frText(card.article)}</span>}{frText(card.fr)}
        </p>

        {revealed && (
          <div className="flashcard__answer" data-testid="answer">
            <div className="flashcard__meaning" lang={settings.meaning}
                 dir={settings.meaning === 'fa' || settings.meaning === 'ar' ? 'rtl' : 'ltr'}>{meaning}</div>
            {alt && <div className="flashcard__alt" dir={settings.meaning === 'en' ? 'rtl' : 'ltr'}>{alt}</div>}
            {card.examples.map((ex) => (
              <div className="example" key={ex.tense}>
                <span className="example__label">{t(ex.tense)} · <b lang="fr">{frText(ex.form)}</b></span>
                <div className="example__fr" lang="fr" dir="ltr">{highlight(ex.fr, ex.form)}</div>
                <div className="example__tr" lang={settings.meaning}
                     dir={settings.meaning === 'fa' || settings.meaning === 'ar' ? 'rtl' : 'ltr'}>
                  {ex.translations[settings.meaning] ?? ex.translations.en}
                </div>
              </div>
            ))}
            <div className="concepts-row">
              <span className="eyebrow">{t('relatedConcepts')}</span>
              <div className="row gap-2 wrap">
                {card.conceptIds.map((id) => (
                  <button key={id} className="chip chip--link" data-testid={`concept-${id}`}
                          onClick={() => panel.open(`concept:${id}`)}>
                    <ConceptName id={id} /> <Icon name="chevron" size={12} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </article>

      <div className="actions">
        <div className="actions-in">
          {!revealed ? (
            <button className="reveal" data-testid="reveal" onClick={() => setRevealed(true)}>
              {t('showAnswer')}
            </button>
          ) : GRADES.map((g) => (
            <button key={g} className={`rate rate--${RATING_KEY[g]}`} data-testid={`rate-${g}`}
                    onClick={() => void grade(g)}>
              <span className="rate__name">{t(RATING_KEY[g])}</span>
              <span className="rate__when">{previews[g] === 0 ? t('now') : t('days', { n: previews[g] })}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ConceptName({ id }: { id: string }) {
  const { settings } = useApp();
  const [name, setName] = useState(id);
  useEffect(() => {
    let live = true;
    loadContent().then(({ conceptById }) => {
      const c = conceptById.get(id);
      if (live && c) setName(settings.ui === 'fr' ? frText(c.name.fr) : c.name.en);
    }).catch(() => {});
    return () => { live = false; };
  }, [id, settings.ui]);
  return <>{name}</>;
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
