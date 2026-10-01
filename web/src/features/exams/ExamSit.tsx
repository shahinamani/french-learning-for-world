/**
 * Sitting a paper. Timed, and resumable in the only way that counts: every
 * answer is written to storage as it is given, and the deadline is an absolute
 * moment, so closing the tab and coming back returns the same paper with the
 * time that actually remains.
 *
 * The question index is in the URL (`?q=`), so Back moves a question rather
 * than leaving the exam — and a learner who does leave can paste the URL back.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router';
import { useApp, useUserId } from '../../app-context';
import { loadPapers, loadAttempt, saveAttempt, remainingMs, pick,
         type ExamPaper as Paper, type Attempt } from '../../lib/exams';
import {formatClock } from '../../lib/timer';
import { Icon } from '../../components/Icon';
import { ErrorState } from '../../components/Search';
import { fr as frText } from '../../lib/typography';
import { useTick } from '../../hooks/useTick';

export function ExamSit() {
  const { paperId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const attemptId = params.get('a') ?? '';
  const { t, settings } = useApp();
  const userId = useUserId();
  const navigate = useNavigate();
  useTick(500);

  const [paper, setPaper] = useState<Paper | null | undefined>(undefined);
  const [attempt, setAttempt] = useState<Attempt | null | undefined>(undefined);
  const [error, setError] = useState(false);

  useEffect(() => {
    let live = true;
    loadPapers()
      .then((ps) => { if (live) setPaper(ps.find((p) => p.id === decodeURIComponent(paperId)) ?? null); })
      .catch(() => { if (live) setError(true); });
    return () => { live = false; };
  }, [paperId]);

  useEffect(() => { setAttempt(attemptId ? loadAttempt(userId, attemptId) : null); }, [userId, attemptId]);

  const index = Math.max(0, Number(params.get('q') ?? 0) | 0);
  const left = attempt ? Math.ceil(remainingMs(attempt, Date.now()) / 1000) : 0;

  const submit = useCallback((a: Attempt) => {
    const done = { ...a, submittedAt: Date.now() };
    saveAttempt(userId, done);
    setAttempt(done);
    navigate(`/practise/exams/${encodeURIComponent(paperId)}/results?a=${a.attemptId}`, { replace: true });
  }, [userId, paperId, navigate]);

  // Time up: submit whatever is there. An exam that silently kept accepting
  // answers past the deadline would not be a timed paper.
  useEffect(() => {
    if (!attempt || attempt.submittedAt) return;
    if (remainingMs(attempt, Date.now()) > 0) return;
    submit(attempt);
  }, [attempt, left, submit]);

  const choose = (itemId: string, option: number) => {
    if (!attempt || attempt.submittedAt) return;
    const next = { ...attempt, answers: { ...attempt.answers, [itemId]: option } };
    saveAttempt(userId, next);   // written before the render, not after
    setAttempt(next);
  };

  const go = (i: number) => {
    const p = new URLSearchParams(params);
    p.set('q', String(i));
    setParams(p, { replace: false });
  };

  const answeredCount = useMemo(
    () => (attempt ? Object.keys(attempt.answers).length : 0), [attempt]);

  if (error) return <ErrorState onRetry={() => location.reload()} />;
  if (paper === undefined || attempt === undefined) {
    return <div className="page"><div className="skeleton skeleton--title" /></div>;
  }
  if (paper === null || attempt === null) {
    return (
      <div className="page"><div className="empty" data-testid="sit-missing">
        <div className="empty__icon"><Icon name="alert" size={34} /></div>
        <p className="empty__title">{t('attemptNotFound')}</p>
        <p className="empty__body">{t('attemptNotFoundBody')}</p>
        <Link className="btn btn--primary" to="/practise/exams">{t('exams')}</Link>
      </div></div>
    );
  }
  if (attempt.submittedAt) {
    return (
      <div className="page"><div className="empty" data-testid="sit-already-done">
        <p className="empty__title">{t('attemptFinished')}</p>
        <Link className="btn btn--primary"
              to={`/practise/exams/${encodeURIComponent(paper.id)}/results?a=${attempt.attemptId}`}>
          {t('seeResults')}
        </Link>
      </div></div>
    );
  }

  const item = paper.items[Math.min(index, paper.items.length - 1)];
  if (!item) return <div className="page"><p className="muted">{t('loadFailed')}</p></div>;
  const chosen = attempt.answers[item.id];
  // The label used to be hard-coded to fr-or-en, so a Persian learner got
  // English even once Persian existed. Both go through pick() now, and both
  // report whether what they returned is the learner's language.
  const prompt = pick(item.prompt, settings.ui);
  const label = item.stimulus?.label ? pick(item.stimulus.label, settings.ui) : null;
  const untranslated = !prompt.translated || (label !== null && !label.translated);
  const low = left <= 60;

  return (
    <div className="page page--session">
      <div className="rail" role="progressbar" aria-valuemin={0} aria-valuemax={paper.items.length}
           aria-valuenow={answeredCount} aria-label={t('questionsAnswered')}>
        <span className="rail__fill" style={{ width: `${(answeredCount / paper.items.length) * 100}%` }} />
      </div>

      <div className="exam-bar">
        <p className="session-count" data-testid="exam-count">
          {index + 1} / {paper.items.length}
        </p>
        <p className={`exam-clock${low ? ' is-low' : ''}`} data-testid="exam-clock"
           role="timer" aria-live={low ? 'polite' : 'off'}
           aria-label={t('timeLeft', { c: formatClock(left) })}>
          {formatClock(left)}
        </p>
      </div>

      {item.stimulus && (
        <div className="exam-stimulus" data-testid="exam-stimulus">
          {label && <p className="eyebrow">{settings.ui === 'fr' ? frText(label.text) : label.text}</p>}
          <p lang="fr" dir="ltr" className="exam-text">{frText(item.stimulus.fr)}</p>
        </div>
      )}

      {untranslated && (
        <p className="muted" data-testid="not-translated">{t('notTranslatedHere')}</p>
      )}

      <fieldset className="exam-q">
        <legend className="exam-prompt" data-testid="exam-prompt">
          {settings.ui === 'fr' ? frText(prompt.text) : prompt.text}
        </legend>
        {item.options.map((o, i) => (
          <label key={i} className={`exam-option${chosen === i ? ' is-chosen' : ''}`}>
            <input type="radio" name={item.id} checked={chosen === i}
                   data-testid={`option-${i}`}
                   onChange={() => choose(item.id, i)} />
            <span lang="fr" dir="ltr">{frText(o.fr)}</span>
          </label>
        ))}
      </fieldset>

      <div className="row gap-2 wrap" style={{ marginBlockStart: 'var(--space-4)' }}>
        <button className="btn btn--sm" disabled={index === 0} data-testid="exam-prev"
                onClick={() => go(index - 1)}>{t('previous')}</button>
        <button className="btn btn--sm" disabled={index >= paper.items.length - 1} data-testid="exam-next"
                onClick={() => go(index + 1)}>{t('next')}</button>
        <button className="btn btn--primary btn--sm" data-testid="exam-submit"
                onClick={() => submit(attempt)}>
          {t('submitExam', { n: answeredCount, m: paper.items.length })}
        </button>
      </div>

      <p className="muted" data-testid="exam-resumable">{t('examResumable')}</p>
    </div>
  );
}
