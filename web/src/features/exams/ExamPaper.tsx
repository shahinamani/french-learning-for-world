/**
 * One paper: what it is, how it differs from the real thing, and start or
 * resume. Resuming is offered rather than assumed — a learner who left a paper
 * running an hour ago and comes back to a timer at 00:00 has been robbed of an
 * attempt, so an expired attempt is shown as expired and a new one is a
 * separate, deliberate choice.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router';
import { useApp, useUserId } from '../../app-context';
import { loadPapers, attemptsFor, saveAttempt, remainingMs, isExpired,
         type ExamPaper as Paper, type Attempt } from '../../lib/exams';
import { formatClock } from '../../lib/timer';
import { newId } from '../../lib/session';
import { Icon } from '../../components/Icon';
import { ErrorState } from '../../components/Search';
import { fr as frText } from '../../lib/typography';

export function ExamPaperRoute() {
  const { paperId = '' } = useParams();
  const { t, settings } = useApp();
  const userId = useUserId();
  const navigate = useNavigate();
  const [paper, setPaper] = useState<Paper | null | undefined>(undefined);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    let live = true;
    loadPapers()
      .then((ps) => { if (live) setPaper(ps.find((p) => p.id === decodeURIComponent(paperId)) ?? null); })
      .catch(() => { if (live) setError(true); });
    return () => { live = false; };
  }, [paperId]);

  useEffect(() => { setAttempts(attemptsFor(userId, decodeURIComponent(paperId))); }, [userId, paperId]);

  if (error) return <ErrorState onRetry={() => location.reload()} />;
  if (paper === undefined) return <div className="page"><div className="skeleton skeleton--title" /></div>;
  if (paper === null) {
    return (
      <div className="page"><div className="empty" data-testid="paper-missing">
        <div className="empty__icon"><Icon name="alert" size={34} /></div>
        <p className="empty__title">{t('paperNotFound')}</p>
        <Link className="btn btn--primary" to="/practise/exams">{t('exams')}</Link>
      </div></div>
    );
  }

  const now = Date.now();
  const live = attempts.find((a) => !a.submittedAt && !isExpired(a, now));
  const done = attempts.filter((a) => a.submittedAt);
  const name = paper.name[settings.ui] ?? paper.name.en ?? paper.id;

  const start = () => {
    const attemptId = newId();
    const a: Attempt = {
      attemptId, paperId: paper.id, startedAt: now,
      endsAt: now + paper.minutes * 60_000,
      answers: {}, submittedAt: null, loggedAt: null,
    };
    saveAttempt(userId, a);
    navigate(`/practise/exams/${encodeURIComponent(paper.id)}/sit?a=${attemptId}`);
  };

  return (
    <div className="page">
      <Link className="back" to="/practise/exams"><Icon name="chevron" size={16} /> {t('exams')}</Link>
      <h1 className="h2" lang={settings.ui === 'fr' ? 'fr' : undefined}>
        {settings.ui === 'fr' ? frText(name) : name}
      </h1>

      <div className="row gap-2 wrap" style={{ marginBlockEnd: 'var(--space-4)' }}>
        <span className={`chip chip--${paper.level.toLowerCase()}`}>{paper.level}</span>
        <span className="chip">{paper.code}</span>
        <span className="muted">{t('minutes', { n: paper.minutes })} · {t('questions', { n: paper.items.length })}</span>
      </div>

      {/* What the real paper is, and how this differs. A learner should never
          have to guess whether they have just sat a mock of the real length. */}
      <section className="card" aria-labelledby="ex-real" data-testid="paper-official">
        <h2 id="ex-real" className="eyebrow">{t('theRealPaper')}</h2>
        <dl className="facts">
          <dt>{t('duration')}</dt><dd>{t('minutes', { n: paper.official.minutes })}</dd>
          <dt>{t('marks')}</dt><dd>{paper.official.marks}</dd>
        </dl>
        <p className="muted">{paper.official.passNote}</p>
        <p className="muted"><strong>{t('thisPractice')}</strong> {paper.practiceNote}</p>
        <p className="muted">{t('source')}: {paper.official.source}</p>
      </section>

      {live && (
        <section className="card card--raised" aria-labelledby="ex-resume" data-testid="resume-card">
          <h2 id="ex-resume" className="eyebrow">{t('attemptInProgress')}</h2>
          <p>{t('timeLeft', { c: formatClock(Math.ceil(remainingMs(live, now) / 1000)) })}</p>
          <Link className="btn btn--primary" data-testid="resume"
                to={`/practise/exams/${encodeURIComponent(paper.id)}/sit?a=${live.attemptId}`}>
            {t('resume')}
          </Link>
        </section>
      )}

      {!live && (
        <button className="btn btn--primary btn--block" data-testid="start-exam" onClick={start}>
          {t('startExam', { n: paper.minutes })}
        </button>
      )}

      {done.length > 0 && (
        <section aria-labelledby="ex-past" style={{ marginBlockStart: 'var(--space-5)' }}>
          <h2 id="ex-past" className="eyebrow">{t('yourAttempts')}</h2>
          <ul className="rows" data-testid="past-attempts">
            {done.map((a) => (
              <li key={a.attemptId}>
                <Link className="row row--link"
                      to={`/practise/exams/${encodeURIComponent(paper.id)}/results?a=${a.attemptId}`}>
                  <span>{new Date(a.submittedAt as number).toLocaleDateString()}</span>
                  <Icon name="chevron" size={16} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
