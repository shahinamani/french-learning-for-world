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
         type ExamPaper as Paper, type Attempt, type Scored } from '../../lib/exams';
import { appendReview, getCardState } from '../../lib/db';
import { emptyState, loadScheduler, SCHEDULER_ID } from '../../lib/scheduler';
import { loadContent } from '../../lib/content';
import { newId } from '../../lib/session';
import { useSidePanel } from '../../components/SidePanel';
import { Icon } from '../../components/Icon';
import { ErrorState } from '../../components/Search';
import { fr as frText } from '../../lib/typography';
import type { Concept, ReviewRow } from '../../lib/types';

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
  if (paper === undefined || attempt === undefined || !scored) {
    return <div className="page"><div className="skeleton skeleton--title" /></div>;
  }
  if (paper === null || attempt === null) {
    return (
      <div className="page"><div className="empty" data-testid="results-missing">
        <p className="empty__title">{t('attemptNotFound')}</p>
        <Link className="btn btn--primary" to="/practise/exams">{t('exams')}</Link>
      </div></div>
    );
  }

  const label = (id: string) => {
    const c = conceptById.get(id);
    if (!c) return id;
    return settings.ui === 'fr' ? frText(c.name.fr) : c.name.en;
  };
  const weak = scored.byConcept.filter((c) => c.correct < c.total);
  const strong = scored.byConcept.filter((c) => c.correct === c.total);

  return (
    <div className="page">
      <h1 className="h2">{t('yourResult')}</h1>

      <section className="card card--raised" aria-labelledby="r-score">
        <h2 id="r-score" className="eyebrow">{t('score')}</h2>
        <p className="result-score" data-testid="exam-score">
          {scored.correct} / {scored.total}
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
                  <span className="muted">{c.correct} / {c.total}</span>
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
                  <p className="muted">{item.explain[settings.ui] ?? item.explain.en}</p>
                </details>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="row gap-2 wrap" style={{ marginBlockStart: 'var(--space-5)' }}>
        <Link className="btn" to={`/practise/exams/${encodeURIComponent(paper.id)}`}>{t('backToPaper')}</Link>
        <Link className="btn btn--sm" to="/progress">{t('progress')}</Link>
      </div>
    </div>
  );
}
