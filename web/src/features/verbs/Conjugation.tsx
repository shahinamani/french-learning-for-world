/**
 * Conjugation practice, straight from the table.
 *
 * Every answer writes a review-log row against the concept behind that tense,
 * exactly as a flashcard does — so a conjugation mistake reaches Progress and
 * weak points through the same path, and the two sections agree about what a
 * learner is weak at.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useApp, useUserId } from '../../app-context';
import { loadVerb, loadTenseNames, type Verb, type VerbTense, type TenseNames } from '../../lib/verbs';
import { appendReview, getCardState } from '../../lib/db';
import { emptyState, loadScheduler, SCHEDULER_ID, type Grade } from '../../lib/scheduler';
import { checkAnswer } from '../../lib/answer';
import type { ReviewRow } from '../../lib/types';
import { Icon } from '../../components/Icon';
import { NextActivity } from '../../components/NextActivity';
import { useSidePanel } from '../../components/SidePanel';
import { fr as frText } from '../../lib/typography';
import { reflexivePronoun, verbLabel } from '../../lib/pronominal';
import { WithAccentBar } from '../../components/AccentBar';
import { pick } from '../../lib/exams';
import { Num } from '../../components/Num';

function newId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const b = new Uint8Array(16); globalThis.crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export function ConjugationDrill() {
  const { t, settings } = useApp();
  const userId = useUserId();
  const panel = useSidePanel();
  const [params, setParams] = useSearchParams();
  const wanted = params.get('verb') ?? '';
  const tenseId = params.get('tense') ?? 'present';
  const index = Math.max(0, Number(params.get('i') ?? 0) | 0);

  const [verb, setVerb] = useState<Verb | null | undefined>(undefined);
  const [engine, setEngine] = useState<Awaited<ReturnType<typeof loadScheduler>> | null>(null);
  const [value, setValue] = useState('');
  const [result, setResult] = useState<null | { correct: boolean; accentsOnly: boolean; expected: string }>(null);
  const [right, setRight] = useState(0);
  const shownAt = useRef(Date.now());

  // The session id belongs in the URL, exactly as it does for flashcards. Held
  // in a ref it was regenerated on every reload, so one sitting became two
  // sessionIds and "time studied" — which docs/03 defines as a grouping over
  // session_id — silently split in half.
  const sessionParam = params.get('s');
  const sessionId = useRef(sessionParam ?? newId());
  useEffect(() => {
    if (sessionParam) { sessionId.current = sessionParam; return; }
    const p = new URLSearchParams(params);
    p.set('s', sessionId.current);
    setParams(p, { replace: true });
  }, [sessionParam, params, setParams]);
  const input = useRef<HTMLInputElement>(null);

  const [names, setNames] = useState<TenseNames>({});
  useEffect(() => { loadTenseNames().then(setNames).catch(() => {}); }, []);
  useEffect(() => { loadScheduler().then(setEngine); }, []);
  useEffect(() => {
    let live = true;
    loadVerb(decodeURIComponent(wanted))
      .then((v) => { if (live) setVerb(v); })
      .catch(() => { if (live) setVerb(null); });
    return () => { live = false; };
  }, [wanted]);
  useEffect(() => { setValue(''); setResult(null); shownAt.current = Date.now(); input.current?.focus(); }, [index]);

  const tense: VerbTense | undefined = verb?.tenses.find((x) => x.id === tenseId);

  const submit = useCallback(async () => {
    if (!verb || !tense || !engine || result) return;
    const expected = tense.forms[index] ?? '';
    // The other spelling French accepts for this exact person, if there is
    // one. Marking « essaye » wrong would teach a learner that a correct
    // form is incorrect.
    const check = checkAnswer(value, expected, [tense.accepted?.[index] ?? '']);
    setResult({ ...check, expected });
    if (check.correct) setRight((n) => n + 1);

    const now = Date.now();
    // A typed answer maps onto the same four grades: right and fast is Easy,
    // right is Good, right but for accents is Hard, wrong is Again.
    const took = now - shownAt.current;
    const grade: Grade = !check.correct ? 1 : check.accentsOnly ? 2 : took < 4000 ? 4 : 3;
    const cardKey = `conj:${verb.infinitive}:${tense.id}:${index}`;
    const before = (await getCardState(userId, cardKey)) ?? emptyState();
    const after = engine.review(before, grade, now);
    const row: ReviewRow = {
      id: newId(), userId, sessionId: sessionId.current, reviewedAt: now,
      cardKey, itemType: 'verb_form', conceptIds: tense.conceptId ? [tense.conceptId] : [],
      direction: 'native-fr',
      promptShown: {
        front: `${verb.pronominal
          ? `${verb.persons[index]} ${reflexivePronoun(index, tense.forms[index] ?? '')}`
          : verb.persons[index]} — ${verbLabel(verb)} (${tense.id})`,
        level: verb.level, type: 'verb_form',
      },
      response: value, isCorrect: check.correct, grade, durationMs: took,
      stateBefore: before.state, stateAfter: after.state,
      stabilityBefore: before.stability, stabilityAfter: after.stability,
      difficultyBefore: before.difficulty, difficultyAfter: after.difficulty,
      elapsedDays: after.elapsedDays, scheduledDays: after.scheduledDays,
      dueBefore: before.dueAt, dueAfter: after.dueAt,
      scheduler: SCHEDULER_ID, paramsHash: engine.paramsHash, client: 'web',
    };
    await appendReview(row, after);
  }, [verb, tense, engine, result, value, index, userId]);

  const next = () => {
    const p = new URLSearchParams(params);
    p.set('i', String(index + 1));
    setParams(p, { replace: true });
  };

  if (verb === undefined || !engine) return <div className="page"><div className="skeleton skeleton--title" /></div>;
  if (verb === null || !tense) {
    return (
      <div className="page"><div className="empty" data-testid="drill-missing">
        <div className="empty__icon"><Icon name="alert" size={34} /></div>
        <p className="empty__title">{t('loadFailed')}</p>
        <Link className="btn btn--primary" to="/learn/verbs">{t('verbs')}</Link>
      </div></div>
    );
  }

  if (index >= verb.persons.length) {
    return (
      <div className="page"><div className="empty" data-testid="drill-done">
        <div className="empty__icon"><Icon name="check" size={34} /></div>
        <p className="empty__title">{t('sessionDone')}</p>
        <p className="empty__body"><Num>{right} / {verb.persons.length}</Num></p>
        <div className="row gap-2 wrap" style={{ justifyContent: 'center', marginBlockStart: 'var(--space-5)' }}>
          <Link className="btn btn--primary" to={`/learn/verbs/${encodeURIComponent(verb.infinitive)}`}>{t('back')}</Link>
          <button className="chip chip--link" data-testid="drill-concept" onClick={() => panel.open(`concept:${tense.conceptId}`)}>
            {t('conceptRecord')} <Icon name="chevron" size={12} />
          </button>
        </div>
      </div>
      {/* A drill is a review of verb forms, so `review` is what was just done —
          which keeps the panel from offering the due queue straight back when
          there is anything else worth doing. */}
      <NextActivity justDid="review" />
      </div>
    );
  }

  const label = pick(names[tense.id] ?? {}, settings.ui).text;
  return (
    <div className="page page--session">
      <div className="rail" role="progressbar" aria-valuemin={0} aria-valuemax={verb.persons.length} aria-valuenow={index} aria-label={t('practiseTense')}>
        <span className="rail__fill" style={{ width: `${(index / verb.persons.length) * 100}%` }} />
      </div>
      <p className="session-count"><Num testId="drill-count">{index + 1} / {verb.persons.length}</Num></p>

      <article className="card card--raised flashcard">
        <div className="tags">
          <span className={`chip chip--${verb.level.toLowerCase()}`}>{verb.level}</span>
          <span className="chip">{frText(label)}</span>
        </div>
        <p className="flashcard__word" lang="fr" dir="ltr">
          {/* « je me — se souvenir ». The pronoun is part of the prompt, not
              part of the expected answer: a learner typing "souviens" is right,
              and asking them to type the pronoun too would mark correct French
              wrong. */}
          <span className="article">
            {verb.pronominal
              ? `${verb.persons[index]} ${reflexivePronoun(index, tense.forms[index] ?? '')}`
              : verb.persons[index]}
          </span>{frText(verbLabel(verb))}
        </p>
        <form onSubmit={(e) => { e.preventDefault(); if (result) next(); else void submit(); }}>
          <WithAccentBar inputRef={input} onInsert={setValue}>
            <label className="field" style={{ marginBlockStart: 'var(--space-5)' }}>
              <span className="field__label">{t('yourAnswer')}</span>
              <input ref={input} id="drill-answer" className="input" lang="fr" dir="ltr" autoComplete="off"
                     autoCapitalize="off" autoCorrect="off" spellCheck={false}
                     data-testid="drill-input" value={value} readOnly={!!result}
                     aria-invalid={result ? !result.correct : undefined}
                     onChange={(e) => setValue(e.target.value)} />
            </label>
          </WithAccentBar>
          {result && (
            <div className={`alert alert--${result.correct ? (result.accentsOnly ? 'warning' : 'success') : 'danger'}`}
                 role="status" data-testid="drill-result" style={{ marginBlockStart: 'var(--space-3)' }}>
              <div className="alert__body">
                {result.correct
                  ? (result.accentsOnly ? t('accentsOnly', { a: result.expected }) : t('correct'))
                  : t('answerIs', { a: result.expected })}
              </div>
            </div>
          )}
        </form>
      </article>

      <div className="actions">
        <div className="actions-in">
          {!result ? (
            <button className="reveal" data-testid="drill-check" onClick={() => void submit()}>{t('check')}</button>
          ) : (
            <button className="reveal" data-testid="drill-next" onClick={next}>{t('next')}</button>
          )}
        </div>
      </div>
    </div>
  );
}
