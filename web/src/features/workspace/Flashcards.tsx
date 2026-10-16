/**
 * The flashcard surface of the workspace: filters, one large card, a row of
 * actions, and a position that always agrees with the filtered set.
 *
 * Everything persistent here goes through the EXISTING scheduler. `Known` and
 * `To review` are FSRS grades written with `appendReview`, in the same
 * transaction shape the ordinary session uses, under the same card keys. There
 * is no second progress store, nothing is overwritten, and a card graded in the
 * ordinary session months ago arrives here already in the right pile.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../app-context';
import { loadContent } from '../../lib/content';
import { loadVerbIndex, type VerbSummary } from '../../lib/verbs';
import { allCardStates, appendReview, getCardState } from '../../lib/db';
import { emptyState, loadScheduler, SCHEDULER_ID, type Grade } from '../../lib/scheduler';
import { newId } from '../../lib/session';
import {
  applyFilters, buildCards, countByLevel, countByMark, jumpTo, markOf,
  WS_LEVELS, type Filter, type Mark, type WsCard,
} from '../../lib/workspace-cards';
import { speak, stop } from '../../lib/speech';
import { loadCardBacks, splitOnForm, type CardBack } from '../../lib/card-backs';
import { fr as frText } from '../../lib/typography';
import { loadTenseNames, type TenseNames } from '../../lib/verbs';
import type { CardState, Level, ReviewRow } from '../../lib/types';
import { Num } from '../../components/Num';
import { Localised } from '../../components/Localised';

export type Corpus = {
  total: number; rich: number; gloss: number;
  /** Cards with a written back, and cards a teacher has checked. Counted
   *  against the whole corpus so the heading cannot overstate the batch. */
  enriched: number; reviewed: number;
};

type Props = {
  /** Chosen in the page's top controls, so Listen obeys them. */
  voiceId: string | null;
  rate: number;
  voiceAvailable: boolean;
  /** So the page heading can state the real size of the corpus. */
  onCorpus: (c: Corpus) => void;
};

export function Flashcards({ voiceId, rate, voiceAvailable, onCorpus }: Props) {
  const { profile, settings, t } = useApp();
  const userId = profile.id;

  const [all, setAll] = useState<WsCard[] | null>(null);
  const [states, setStates] = useState<Map<string, CardState>>(new Map());
  const [filter, setFilter] = useState<Filter>(
    { mark: 'all', levels: ['A1', 'A2'], shuffle: false, seed: 1 });
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [jumpValue, setJumpValue] = useState('');
  const [failedToSpeak, setFailedToSpeak] = useState(false);
  const [backs, setBacks] = useState<Map<string, CardBack>>(new Map());
  const [tenseNames, setTenseNames] = useState<TenseNames>({});
  // Sticky across cards on purpose: somebody studying WITH the examples
  // should not have to re-open them on every card.
  const [showExamples, setShowExamples] = useState(false);
  // Loaded the same way the ordinary flashcard session loads it: the
  // scheduler is a lazy chunk, so it is a promise, and marking is disabled
  // until it has arrived rather than silently doing nothing.
  const [engine, setEngine] = useState<Awaited<ReturnType<typeof loadScheduler>> | null>(null);
  useEffect(() => {
    let live = true;
    loadScheduler().then((e) => { if (live) setEngine(e); });
    return () => { live = false; };
  }, []);
  const shownAt = useRef(Date.now());
  const sessionId = useRef(newId());

  // Content and the verb index, then the existing card states in one read.
  useEffect(() => {
    let live = true;
    void (async () => {
      const [content, verbs, rows, cardBacks, tenses] = await Promise.all([
        loadContent(),
        loadVerbIndex().catch(() => [] as VerbSummary[]),
        allCardStates(userId).catch(() => []),
        loadCardBacks(),
        loadTenseNames().catch(() => ({} as TenseNames)),
      ]);
      if (!live) return;
      setBacks(cardBacks);
      setTenseNames(tenses);
      const cards = buildCards(content.cards, verbs, settings.meaning);
      setAll(cards);
      setStates(new Map(rows.map((r) => [r.cardKey, r as CardState])));
      onCorpus({
        total: cards.length,
        rich: cards.filter((c) => c.rich).length,
        gloss: cards.filter((c) => c.glossUnreviewed).length,
        // Counted against the real corpus, not against the batch that was
        // written. Most cards still have only a gloss and the heading says so.
        enriched: cards.filter((c) => cardBacks.has(c.key)).length,
        reviewed: 0,
      });
    })();
    return () => { live = false; };
  }, [userId, settings.meaning, onCorpus]);

  // `now` is held in state and not read inside the memo, so the piles cannot
  // silently re-sort under the learner between renders. It moves when the card
  // states move, which is the only moment a pile can actually change.
  const marks = useMemo(() => {
    const now = Date.now();
    const m = new Map<string, Mark>();
    for (const c of all ?? []) m.set(c.key, markOf(states.get(c.key), now));
    return m;
  }, [all, states]);

  const queue = useMemo(
    () => (all ? applyFilters(all, marks, filter) : []), [all, marks, filter]);
  const levelCounts = useMemo(() => countByLevel(all ?? []), [all]);
  const markCounts = useMemo(() => countByMark(all ?? [], marks), [all, marks]);

  // The position must never point outside the set it is counting. Changing a
  // filter re-clamps rather than leaving "12 / 4" on screen.
  useEffect(() => { setIndex((i) => (queue.length === 0 ? 0 : Math.min(i, queue.length - 1))); },
    [queue.length]);

  const card = queue[index] ?? null;
  useEffect(() => {
    setRevealed(false);
    setFailedToSpeak(false);
    shownAt.current = Date.now();
    stop();                 // never let the previous word talk over this one
  }, [card?.key]);

  // Leaving the tab or the page must not leave speech running.
  useEffect(() => () => stop(), []);

  const listen = useCallback(() => {
    if (!card) return;
    setFailedToSpeak(!speak(card.front, voiceId, rate));
  }, [card, voiceId, rate]);

  /**
   * Two buttons, two FSRS grades, through the ordinary path.
   *
   * `Known` is Easy (4) and `To review` is Again (1) — the two ENDS of the
   * four-grade scale, because a two-way control has no way to express the
   * middle and must not pretend to.
   *
   * This was Good (3) first, on the reasoning that a learner pressing a
   * two-way button means "I got this" rather than "bury it for months". The
   * journey check then found the card leaving the unmarked pile and arriving
   * in neither of the other two, and measuring the scheduler said why: on a
   * first sighting this engine's learning steps are 1, 6 and 10 minutes for
   * Again, Hard and Good, and only Easy leaves learning at all (9 days). Good
   * and Again are therefore indistinguishable ten minutes later, so "Known"
   * was a pile the schedule could not represent.
   *
   * The four-grade session is still there and still the finer instrument. This
   * surface is the coarse one, and it says what it does.
   */
  const mark = useCallback(async (kind: 'known' | 'review') => {
    if (!card || !engine) return;
    const grade: Grade = kind === 'known' ? 4 : 1;
    const now = Date.now();
    const before = (await getCardState(userId, card.key)) ?? emptyState();
    const after = engine.review(before, grade, now);
    const row: ReviewRow = {
      id: newId(), userId, sessionId: sessionId.current, reviewedAt: now,
      cardKey: card.key, itemType: card.type === 'verb' ? 'verb_form' : 'vocab',
      conceptIds: card.conceptIds, direction: 'fr-native',
      promptShown: { front: card.front, level: card.level, type: card.type },
      response: null, isCorrect: grade >= 3, grade, durationMs: now - shownAt.current,
      stateBefore: before.state, stateAfter: after.state,
      stabilityBefore: before.stability, stabilityAfter: after.stability,
      difficultyBefore: before.difficulty, difficultyAfter: after.difficulty,
      elapsedDays: after.elapsedDays, scheduledDays: after.scheduledDays,
      dueBefore: before.dueAt, dueAfter: after.dueAt,
      scheduler: SCHEDULER_ID, paramsHash: engine.paramsHash, client: 'web',
    };
    await appendReview(row, after);
    setStates((m) => new Map(m).set(card.key, after));
    // Advance, because marking is the end of looking at this card.
    setIndex((i) => (i + 1 < queue.length ? i + 1 : i));
  }, [card, userId, engine, queue.length]);

  const go = useCallback((delta: number) => {
    stop();
    setIndex((i) => Math.min(Math.max(i + delta, 0), Math.max(queue.length - 1, 0)));
  }, [queue.length]);

  // Keyboard, on the page rather than the card, so it works wherever focus is
  // — except in a field, where these are characters the learner is typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (!card) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      else if (e.key === 'l' || e.key === 'L') { e.preventDefault(); listen(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [card, go, listen]);

  const toggleLevel = (lv: Level) => setFilter((f) => ({
    ...f,
    levels: f.levels.includes(lv) ? f.levels.filter((x) => x !== lv) : [...f.levels, lv],
  }));

  if (!all) {
    return (
      <div data-testid="ws-loading">
        <div className="skeleton skeleton--title" />
        <div className="skeleton skeleton--text" />
      </div>
    );
  }

  const mine = marks.get(card?.key ?? '') ?? 'none';
  const back = card ? backs.get(card.key) ?? null : null;

  return (
    <div className="ws-cards" data-testid="ws-flashcards">
      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="ws-filters" role="group" aria-label={t('wsFilters')}>
        {([
          ['all', t('wsFilterAll'), markCounts.all],
          ['none', t('wsFilterUnmarked'), markCounts.none],
          ['review', t('wsFilterReview'), markCounts.review],
          ['known', t('wsFilterKnown'), markCounts.known],
        ] as const).map(([value, label, n]) => (
          <button key={value} type="button"
                  className={`ws-chip${filter.mark === value ? ' is-on' : ''}`}
                  aria-pressed={filter.mark === value}
                  data-testid={`ws-filter-${value}`}
                  onClick={() => { setFilter((f) => ({ ...f, mark: value })); setIndex(0); }}>
            {label} <span className="ws-chip__n"><Num>{n}</Num></span>
          </button>
        ))}

        <button type="button" className={`ws-chip${filter.shuffle ? ' is-on' : ''}`}
                aria-pressed={filter.shuffle} data-testid="ws-shuffle"
                onClick={() => {
                  setFilter((f) => ({ ...f, shuffle: !f.shuffle, seed: Date.now() & 0x7fffffff }));
                  setIndex(0);
                }}>
          {filter.shuffle ? t('wsShuffle') : t('wsShuffleOff')}
        </button>
      </div>

      <div className="ws-filters" role="group" aria-label={t('wsLevels')}>
        <span className="ws-filters__label">{t('wsLevels')}</span>
        {WS_LEVELS.map((lv) => (
          <button key={lv} type="button"
                  className={`ws-chip${filter.levels.includes(lv) ? ' is-on' : ''}`}
                  aria-pressed={filter.levels.includes(lv)}
                  data-testid={`ws-level-${lv}`}
                  disabled={levelCounts[lv] === 0}
                  onClick={() => { toggleLevel(lv); setIndex(0); }}>
            {lv} <span className="ws-chip__n"><Num>{levelCounts[lv]}</Num></span>
          </button>
        ))}
      </div>

      {/* ── Jump to a card by number, within the filtered set ───────────── */}
      <form className="ws-jump" data-testid="ws-jump-form"
            onSubmit={(e) => {
              e.preventDefault();
              const to = jumpTo(jumpValue, queue.length);
              if (to !== null) { setIndex(to); setJumpValue(''); }
            }}>
        <label className="ws-jump__label" htmlFor="ws-jump">{t('wsJump')}</label>
        <input id="ws-jump" className="input ws-jump__input" data-testid="ws-jump"
               type="number" min={1} max={Math.max(queue.length, 1)} inputMode="numeric"
               value={jumpValue} onChange={(e) => setJumpValue(e.target.value)} />
        <button type="submit" className="btn" data-testid="ws-jump-go">{t('wsJumpGo')}</button>
      </form>

      {/* ── The card ────────────────────────────────────────────────────── */}
      {card ? (
        <>
          {/* A div with role=button rather than a <button>: the face holds a
              heading and paragraphs, which a button may not contain. The
              handlers and aria below are what a real button would give. */}
          <div className="ws-card" data-testid="ws-card" role="button" tabIndex={0}
               aria-pressed={revealed}
               aria-label={revealed ? t('wsHide') : t('wsReveal')}
               onClick={() => setRevealed((r) => !r)}
               onKeyDown={(e) => {
                 if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setRevealed((r) => !r); }
               }}>
            <div className="ws-card__top">
              <span className="ws-card__level" data-testid="ws-card-level">{card.level}</span>
              {mine !== 'none' && (
                <span className="ws-card__mark" data-testid="ws-card-mark">
                  {mine === 'known' ? t('wsMarkedKnown') : t('wsMarkedReview')}
                </span>
              )}
            </div>

            {/* French, always ltr and in the French face, even on an RTL page. */}
            <p className="ws-card__front" data-testid="ws-card-front" lang="fr" dir="ltr">
              {card.front}
            </p>

            {revealed ? (
              <div className="ws-card__back" data-testid="ws-card-back">
                {/* Progressive disclosure: the meaning alone first, because
                    that is what a learner came to the back of the card for.
                    Three worked examples and a usage note on top of it would
                    be a wall of text at exactly the moment they are trying to
                    recall one word. The examples open on request and stay open
                    across cards, so somebody studying with them does not
                    re-click on every card. */}
                <p className="ws-card__meaning">
                  <Localised field={card.rich ? card.rich.meanings : { en: card.back }}
                             locale={settings.meaning} />
                </p>
                {back && back.fa !== (card.rich?.meanings?.fa ?? '') && settings.meaning !== 'fa' && (
                  <p className="ws-card__fa" lang="fa" dir="rtl" data-testid="ws-card-fa">{back.fa}</p>
                )}
                {back?.pattern === 'impersonal' && (
                  <span className="ws-tagline" data-testid="ws-pattern">{t('wsPatternImpersonal')}</span>
                )}
                {back?.pattern === 'pronominal' && (
                  <span className="ws-tagline" data-testid="ws-pattern">{t('wsPatternPronominal')}</span>
                )}

                {card.glossUnreviewed && !back && (
                  <p className="fine muted" data-testid="ws-card-unreviewed">
                    {t('wsGlossUnreviewed')}
                  </p>
                )}

                {back ? (
                  <>
                    <button type="button" className="btn btn--sm ws-disclose"
                            data-testid="ws-examples-toggle"
                            aria-expanded={showExamples}
                            onClick={(e) => { e.stopPropagation(); setShowExamples((v) => !v); }}>
                      {showExamples ? t('wsHideExamples') : t('wsShowExamples')}
                    </button>

                    {showExamples && (
                      <div className="ws-card__examples" data-testid="ws-examples">
                        {back.examples.map((ex, i) => {
                          // Through the project's French typographer, as every other
                          // French string on screen is: the content files store a straight
                          // apostrophe and `fr()` turns it into U+2019. Applied BEFORE the
                          // split, and to the form too, or the needle stops matching the
                          // haystack and the highlight silently disappears.
                          const sentence = frText(ex.fr);
                          const parts = splitOnForm(sentence, frText(ex.form));
                          return (
                            <div key={`${ex.form}-${i}`} className="ws-ex">
                              <div className="ws-ex__head">
                                {/* A tense label only where there IS a tense.
                                    A noun has none, and labelling one would be
                                    a grammatical claim the word cannot carry. */}
                                {ex.tense && (
                                  <span className="ws-ex__tense" data-testid={`ws-tense-${ex.tense}`}>
                                    <Localised field={tenseNames[ex.tense]} />
                                  </span>
                                )}
                                <button type="button" className="icon-btn ws-ex__listen"
                                        data-testid={`ws-ex-listen-${i}`}
                                        aria-label={`${t('wsListen')} — ${sentence}`}
                                        disabled={!voiceAvailable}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setFailedToSpeak(!speak(ex.fr, voiceId, rate));
                                        }}>
                                  ♪
                                </button>
                              </div>
                              <p className="ws-ex__fr" lang="fr" dir="ltr">
                                {parts
                                  ? <>{parts.before}<mark className="ws-ex__form">{parts.match}</mark>{parts.after}</>
                                  : sentence}
                              </p>
                              <p className="ws-ex__fa" lang="fa" dir="rtl">{ex.fa}</p>
                              {settings.meaning !== 'fa' && (
                                <p className="ws-ex__en muted" lang="en" dir="ltr">{ex.en}</p>
                              )}
                            </div>
                          );
                        })}

                        {back.usage && (
                          <p className="ws-usage" data-testid="ws-usage">
                            <strong>{t('wsUsage')}</strong> {back.usage}
                          </p>
                        )}
                        <p className="fine muted" data-testid="ws-drafted">{t('wsDrafted')}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="fine muted" data-testid="ws-gloss-only">{t('wsGlossOnly')}</p>
                )}
              </div>
            ) : (
              <p className="ws-card__hint muted" data-testid="ws-card-hint">{t('wsRevealHint')}</p>
            )}
          </div>

          {/* ── Actions ─────────────────────────────────────────────────── */}
          <div className="ws-actions">
            <button type="button" className="btn" data-testid="ws-prev"
                    disabled={index === 0} onClick={() => go(-1)}>
              {t('wsPrev')}
            </button>
            <button type="button" className="btn" data-testid="ws-listen"
                    disabled={!voiceAvailable} onClick={listen}
                    title={voiceAvailable ? undefined : t('wsVoiceNoneHelp')}>
              {t('wsListen')}
            </button>
            <button type="button" className="btn btn--gold" data-testid="ws-known"
                    onClick={() => void mark('known')}>
              {t('wsKnown')}
            </button>
            <button type="button" className="btn" data-testid="ws-review"
                    onClick={() => void mark('review')}>
              {t('wsToReview')}
            </button>
            <button type="button" className="btn" data-testid="ws-next"
                    disabled={index >= queue.length - 1} onClick={() => go(1)}>
              {t('wsNext')}
            </button>
            {/* ONE isolate around the whole fraction, not one around each
                number. Isolating them separately still let the paragraph's
                direction order them, so on the Persian page "1 / 507" rendered
                as "507 / 1" — a learner on card 1 of 507 reading that they are
                on card 507 of 1. Found by looking at the screenshot after
                every check had passed, which is how the RTL defects on this
                project keep being found. */}
            <p className="ws-position" data-testid="ws-position" aria-live="polite">
              <Num>{`${index + 1} / ${queue.length}`}</Num>
            </p>
          </div>

          {failedToSpeak && (
            <p className="fine muted" data-testid="ws-speak-failed">{t('wsVoiceNone')}</p>
          )}

          {/* What the two buttons actually write, on screen rather than only in
              a commit message. A learner with review history elsewhere in the
              app deserves to know that these feed the same record and which
              grades they correspond to. */}
          <p className="fine muted" data-testid="ws-mark-mapping">{t('wsMarkMapping')}</p>
        </>
      ) : (
        <div className="card ws-empty" data-testid="ws-empty">
          <p>{t('wsEmptyFiltered')}</p>
          <p className="muted">{t('wsEmptyFilteredHelp')}</p>
        </div>
      )}
    </div>
  );
}
