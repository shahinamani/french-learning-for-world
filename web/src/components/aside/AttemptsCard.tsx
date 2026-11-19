/**
 * The learner's finished attempts at practice papers, from localStorage
 * (lib/exams.ts keeps one entry per attempt). One paper or all of them; a
 * paper nobody has sat says so rather than showing a zero that looks like a
 * score.
 */
import '../../lib/locales/en/todayEn';   // registers its English (lazy group)
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useApp, useUserId } from '../../app-context';
import { attemptsFor, score, pick, type ExamPaper } from '../../lib/exams';
import { AsideCard } from './index';
import { Num } from '../Num';

type Row = { paper: ExamPaper; finished: number; best: number | null; last: number | null };

export function AttemptsCard({ papers }: { papers: ExamPaper[] | null }) {
  const { t, settings } = useApp();
  const userId = useUserId();
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    if (!papers) return;
    setRows(papers.map((paper) => {
      const done = attemptsFor(userId, paper.id).filter((a) => a.submittedAt);
      const scores = done.map((a) => score(paper, a).correct);
      return {
        paper, finished: done.length,
        best: scores.length ? Math.max(...scores) : null,
        last: done.length ? Math.max(...done.map((a) => a.submittedAt as number)) : null,
      };
    }));
  }, [papers, userId]);
  const sat = rows?.filter((r) => r.finished > 0) ?? [];
  const fmt = (ms: number) => { try { return new Intl.DateTimeFormat(settings.ui, { dateStyle: 'medium' }).format(ms); } catch { return new Date(ms).toISOString().slice(0, 10); } };
  return (
    <AsideCard title={t('tdAsAttemptsTitle')} testId="aside-attempts">
      {rows === null && <div className="skeleton skeleton--text" />}
      {rows !== null && sat.length === 0 && <p className="muted fine">{t('tdAsAttemptsNone')}</p>}
      {sat.length > 0 && (
        <ul className="aside-list aside-attempts">
          {sat.map((r) => (
            <li key={r.paper.id}>
              <Link to={`/app/exams/${encodeURIComponent(r.paper.id)}`}>
                <span className="aside-attempts__name">
                  <span className={`chip chip--${r.paper.level.toLowerCase()}`}>{r.paper.level}</span>
                  {' '}{pick(r.paper.name, settings.ui).text}
                </span>
                <span className="muted aside-attempts__meta">
                  {t('tdAsAttemptsN', { n: r.finished })}
                  {r.best !== null && <> · <Num>{r.best} / {r.paper.items.length}</Num></>}
                  {r.last !== null && <> · {fmt(r.last)}</>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AsideCard>
  );
}
