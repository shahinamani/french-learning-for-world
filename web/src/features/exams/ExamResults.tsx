import { Localised } from '../../components/Localised';
/**
 * Results, as a diagnosis rather than a score.
 *
 * A bare mark out of 28 tells a learner nothing they can act on. What they can
 * act on is which concepts failed, ranked weakest first, each one a link into a
 * session on that concept alone — the same join every other section uses.
 *
 * Submitting also writes one review-log row per question, against the concept
 * ids the question exercises, so an exam feeds the same weakness model as a
 * flashcard and a conjugation drill. That is what makes this a section of the
 * product rather than a quiz bolted on beside it.
 */
import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useApp, useUserId } from '../../app-context';
import { loadPapers, loadAttempt, saveAttempt, score,
         type ExamPaper as Paper, type Attempt, type Scored, pick } from '../../lib/exams';
import { appendReview, getCardState } from '../../lib/db';
import { emptyState, loadScheduler, SCHEDULER_ID } from '../../lib/scheduler';
import { loadContent } from '../../lib/content';
import { newId } from '../../lib/session';
import { useSidePanel } from '../../components/SidePanel';
import { Icon } from '../../components/Icon';
import { ErrorState } from '../../components/Search';
import { fr as frText } from '../../lib/typography';
import type { Concept, ReviewRow } from '../../lib/types';
import { Num } from '../../components/Num';
import { NextActivity } from '../../components/NextActivity';

export function ExamResults() {
  const { paperId = '' } = useParams();
  const [params] = useSearchParams();
  const attemptId = params.get('a') ?? '';
  const { t, settings } = useApp();
  const userId = useUserId();
  const panel = useSidePanel();

  const [paper, setPaper] = useState<Paper | null | undefined>(undefined);
  const [attempt, setAttempt] = useState<Attempt | null | undefined>(undefined);
  const [scored, setScored] = useState<Scored | null>(null);
  const [conceptById, setConceptById] = useState<Map<string, Concept>>(new Map());
  const [error, setError] = useState(false);

  useEffect(() => {
    let live = true;
    Promise.all([loadPapers(), loadContent()])
      .then(([ps, c]) => {
        if (!live) return;
        setPaper(ps.find((p) => p.id === decodeURIComponent(paperId)) ?? null);
        setConceptById(c.conceptById);
      })
      .catch(() => { if (live) setError(true); });
    return () => { live = false; };
  }, [paperId]);

  useEffect(() => { setAttempt(attemptId ? loadAttempt(userId, attemptId) : null); }, [userId, attemptId]);

  // Score, then write the log — once. `loggedAt` guards it, so reloading the
  // results page or pasting its URL cannot double a learner's history.
  useEffect(() => {
    if (!paper || !attempt || !attempt.submittedAt) return;
    const s = score(paper, attempt);
    setScored(s);
    if (attempt.loggedAt) return;

    let live = true;
    (async () => {
      const engine = await loadScheduler();
      const sessionId = newId();
      for (const item of paper.items) {
        const chosen = attempt.answers[item.id];
        const answered = typeof chosen === 'number';
        const right = answered && chosen === item.answer;
        // Unanswered is not the same as wrong, but in a timed paper it is not
        // evidence of knowing either. Both grade Again; only an answered
        // question records a response.
        const grade = right ? 3 : 1;
        const cardKey = `exam:${paper.id}:${item.id}`;
        const before = (await getCardState(userId, cardKey)) ?? emptyState();
        const after = engine.review(before, grade, Date.now());
        const row: ReviewRow = {
          id: newId(), userId, sessionId, reviewedAt: Date.now(),
          cardKey,
          itemType: paper.skill === 'reading' ? 'reading' : 'grammar',
          conceptIds: item.conceptIds,
          direction: 'fr-native',
          promptShown: { front: item.stimulus?.fr ?? item.prompt.en ?? item.id,
                         level: item.level ?? paper.level, type: item.kind },
          response: answered ? (item.options[chosen]?.fr ?? null) : null,
          isCorrect: answered ? right : null,
          grade, durationMs: 0,
          stateBefore: before.state, stateAfter: after.state,
          stabilityBefore: before.stability, stabilityAfter: after.stability,
          difficultyBefore: before.difficulty, difficultyAfter: after.difficulty,
          elapsedDays: after.elapsedDays, scheduledDays: after.scheduledDays,
          dueBefore: before.dueAt, dueAfter: after.dueAt,
          scheduler: SCHEDULER_ID, paramsHash: engine.paramsHash, client: 'web',
        };
        await appendReview(row, after);
      }
      if (!live) return;
      const marked = { ...attempt, loggedAt: Date.now() };
      saveAttempt(userId, marked);
      setAttempt(marked);
    })().catch(() => { if (live) setError(true); });
    return () => { live = false; };
  }, [paper, attempt, userId]);

  if (error) return <ErrorState onRetry={() => location.reload()} />;

  // ── Which of these is true decides the screen, and the ORDER is the fix ──
  //
  // `!scored` used to sit in the loading condition below, with the not-found
  // branch after it. `scored` is only ever set for a paper AND a submitted
  // attempt, so every case where there is nothing to score — no `?a=` in the
  // URL, an id for an attempt on another device, a malformed stored value, a
  // paper id we do not ship, an attempt the learner never submitted — fell into
  // the first branch and stayed on a loading skeleton for ever. The explanatory
  // state below it was unreachable by URL.
  //
  // A permanent skeleton is not one of the four honest states: it tells a
  // learner "wait" about something that is never going to arrive, and it is
  // indistinguishable from a hung network. Each case now says what happened and
  // offers a way on.

  // Genuinely still loading: the papers and the stored attempt are being read.
  if (paper === undefined || attempt === undefined) {
    return <div className="page" data-testid="results-loading">
      <div className="skeleton skeleton--title" /><div className="skeleton skeleton--text" />
    </div>;
  }

  // A paper id that is not one we ship — a typo, or a link from a build that
  // had different content.
  if (paper === null) {
    return (
      <div className="page"><div className="empty" data-testid="results-no-paper">
        <p className="empty__title">{t('paperNotFound')}</p>
        <Link className="btn btn--primary" to="/practise/exams">{t('exams')}</Link>
      </div></div>
    );
  }

  // No attempt id in the URL, an unknown one, or a stored value that failed
  // `loadAttempt`'s shape check. All three are the same thing to a learner:
  // this result is not on this device.
  if (attempt === null) {
    return (
      <div className="page"><div className="empty" data-testid="results-missing">
        <p className="empty__title">{t('attemptNotFound')}</p>
        <p className="empty__body">{t('attemptNotFoundBody')}</p>
        <Link className="btn btn--primary" to={`/practise/exams/${encodeURIComponent(paper.id)}`}>
          {t('backToPaper')}
        </Link>
        <Link className="btn btn--sm" to="/practise/exams">{t('exams')}</Link>
      </div></div>
    );
  }

  // An attempt that exists and was never submitted. There is nothing to score,
  // and the useful thing is the paper itself rather than an explanation.
  if (!attempt.submittedAt) {
    return (
      <div className="page"><div className="empty" data-testid="results-unfinished">
        <p className="empty__title">{t('attemptInProgress')}</p>
        <Link className="btn btn--primary" data-testid="results-resume"
              to={`/practise/exams/${encodeURIComponent(paper.id)}/sit?a=${encodeURIComponent(attempt.attemptId)}`}>
          {t('resume')}
        </Link>
        <Link className="btn btn--sm" to={`/practise/exams/${encodeURIComponent(paper.id)}`}>
          {t('backToPaper')}
        </Link>
      </div></div>
    );
  }

  // Everything is present; scoring is synchronous in an effect, so this is one
  // paint at most rather than a state a learner waits in.
  if (!scored) {
    return <div className="page" data-testid="results-loading">
      <div className="skeleton skeleton--title" /><div className="skeleton skeleton--text" />
    </div>;
  }

  const label = (id: string) => {
    const c = conceptById.get(id);
    if (!c) return <>{id}</>;
    return <Localised field={c.name} />;
  };
  const weak = scored.byConcept.filter((c) => c.correct < c.total);
  const strong = scored.byConcept.filter((c) => c.correct === c.total);

  return (
    <div className="page">
      <h1 className="h2">{t('yourResult')}</h1>

      <section className="card card--raised" aria-labelledby="r-score">
        <h2 id="r-score" className="eyebrow">{t('score')}</h2>
        <p className="result-score" data-testid="exam-score">
          <Num>{scored.correct} / {scored.total}</Num>
        </p>
        <p className="muted" data-testid="exam-answered">
          {t('answeredOf', { n: scored.answered, m: scored.total })}
        </p>
        {/* Never a pass/fail verdict: this is not the real examination and
            saying otherwise would be a claim we have no standing to make. */}
        <p className="muted">{t('notAnOfficialResult')}</p>
      </section>

      <section aria-labelledby="r-weak" style={{ marginBlockStart: 'var(--space-5)' }}>
        <h2 id="r-weak" className="eyebrow">{t('whatToWorkOn')}</h2>
        {weak.length === 0 ? (
          <p className="muted" data-testid="exam-no-weak">{t('nothingWeak')}</p>
        ) : (
          <ul className="rows" data-testid="exam-weak">
            {weak.map((c) => (
              <li key={c.conceptId}>
                <Link className="row row--link"
                      data-testid={`weak-${c.conceptId}`}
                      to={`/practise/review?concept=${encodeURIComponent(c.conceptId)}`}>
                  <span>{label(c.conceptId)}</span>
                  <Num className="muted">{c.correct} / {c.total}</Num>
                  <Icon name="chevron" size={16} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {strong.length > 0 && (
        <section aria-labelledby="r-strong" style={{ marginBlockStart: 'var(--space-5)' }}>
          <h2 id="r-strong" className="eyebrow">{t('whatWentWell')}</h2>
          <ul className="chips" data-testid="exam-strong">
            {strong.map((c) => (
              <li key={c.conceptId}>
                <button className="chip chip--link"
                        onClick={() => panel.open(`concept:${c.conceptId}`)}>
                  {label(c.conceptId)}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="r-review" style={{ marginBlockStart: 'var(--space-5)' }}>
        <h2 id="r-review" className="eyebrow">{t('everyQuestion')}</h2>
        {paper.items.some((it) => !pick(it.explain, settings.ui).translated) && (
          <p className="muted" data-testid="not-translated">{t('notTranslatedHere')}</p>
        )}
        <ol className="rows" data-testid="exam-review">
          {paper.items.map((item, i) => {
            const chosen = attempt.answers[item.id];
            const answered = typeof chosen === 'number';
            const right = answered && chosen === item.answer;
            return (
              <li key={item.id}>
                <details className="qa" data-testid={`qa-${i}`}>
                  <summary>
                    <span className={`dot dot--${right ? 'good' : answered ? 'bad' : 'skipped'}`} aria-hidden="true" />
                    <span>{i + 1}. {right ? t('correct') : answered ? t('incorrect') : t('notAnswered')}</span>
                  </summary>
                  <p lang="fr" dir="ltr">{frText(item.options[item.answer]?.fr ?? '')} — {t('theAnswer')}</p>
                  {answered && !right && (
                    <p className="muted" lang="fr" dir="ltr">{t('youChose')}: {frText(item.options[chosen]?.fr ?? '')}</p>
                  )}
                  <p className="muted"><Localised field={item.explain} /></p>
                  {/* Beside the explanation, because that is where an unchecked
                      item does its damage: a learner who got it wrong reads this
                      to find out why, and takes it as the answer. */}
                  {item.review?.state !== 'approved' && (
                    <p className="fine muted" data-testid={`unreviewed-${item.id}`}>
                      {t('itemUnreviewed')}
                      {item.uncertain
                        ? <> · <strong>{t('itemUncertain')}</strong>: {item.uncertain.doubt}</>
                        : null}
                    </p>
                  )}
                </details>
              </li>
            );
          })}
        </ol>
      </section>

      {/* The continuation, below the result and above the way back — a learner
          reads their score first and then wants to know what now. `justDid` is
          `exam`, so another paper is not pushed while anything else is
          eligible. */}
      <NextActivity justDid="exam" />

      <div className="row gap-2 wrap" style={{ marginBlockStart: 'var(--space-5)' }}>
        <Link className="btn" to={`/practise/exams/${encodeURIComponent(paper.id)}`}>{t('backToPaper')}</Link>
        <Link className="btn btn--sm" to="/progress">{t('progress')}</Link>
      </div>
    </div>
  );
}
