/** Every number here is a query over the review log. Summary first. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useApp, useUserId } from '../app-context';
import { reviewsForUser, allCardStates } from '../lib/db';
import { conceptStats, weekSummary, exportRows, type ConceptStat } from '../lib/progress';
import { loadContent } from '../lib/content';
import type { Concept, ReviewRow } from '../lib/types';
import { Icon } from '../components/Icon';
import { Localised } from '../components/Localised';
import { pick } from '../lib/exams';
import { Num } from '../components/Num';

export function Progress() {
  const { t, settings } = useApp();
  const userId = useUserId();
  const [rows, setRows] = useState<ReviewRow[] | null>(null);
  const [stats, setStats] = useState<ConceptStat[]>([]);
  const [byId, setById] = useState<Map<string, Concept>>(new Map());
  const [week, setWeek] = useState<{ reviews: number; minutes: number; days: number } | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const [r, s, w, content] = await Promise.all([
        reviewsForUser(userId, 500), conceptStats(userId),
        weekSummary(userId, Date.now()), loadContent(),
      ]);
      if (!live) return;
      setRows(r);
      setStats([...s.values()].sort((a, b) => a.accuracy - b.accuracy));
      setWeek(w); setById(content.conceptById);
    })();
    return () => { live = false; };
  }, [userId]);

  const name = (id: string) => {
    const c = byId.get(id);
    return c ? <Localised field={c.name} /> : <>{id}</>;
  };
  /** True when any concept on this screen falls back out of the learner's language. */
  const anyNameUntranslated = () =>
    stats.slice(0, 12).some((s) => {
      const c = byId.get(s.conceptId);
      return c ? !pick(c.name, settings.ui).translated : false;
    });

  const download = async () => {
    if (!rows) return;
    // The card states go with the log. Without them the history arrives on the
    // new device and every card is due-new, because the schedule lives in the
    // states rather than in the log.
    const states = await allCardStates(userId);
    const url = URL.createObjectURL(new Blob([exportRows(rows, states)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'french-learning-progress.json';
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="page">
      <h1 className="h2">{t('progress')}</h1>

      <section className="card" aria-labelledby="week-h">
        <h2 id="week-h" className="eyebrow">{t('thisWeek')}</h2>
        {week === null ? <div className="skeleton skeleton--text" /> : (
          <p className="today__line" data-testid="week-summary">
            {t('reviewsCount', { n: week.reviews })} · <Num>{week.minutes} min</Num> · <Num>{week.days}/7</Num>
          </p>
        )}
      </section>

      <section aria-labelledby="moved-h">
        <h2 id="moved-h" className="h3">{t('whatMoved')}</h2>
        {rows === null && <div className="skeleton skeleton--text" />}
        {rows !== null && stats.length === 0 && (
          <p className="muted" data-testid="progress-empty">{t('weakNone')}</p>
        )}
        {stats.length > 0 && (
          <ul className="rows" data-testid="concept-stats">
            {anyNameUntranslated() && (
              <li className="muted notice-untranslated">{t('notTranslatedName')}</li>
            )}
            {stats.slice(0, 12).map((s) => (
              <li key={s.conceptId}>
                <div className="row">
                  <button className="row__disclose" aria-expanded={open === s.conceptId}
                          data-testid={`disclose-${s.conceptId}`}
                          onClick={() => setOpen(open === s.conceptId ? null : s.conceptId)}>
                    <span>{name(s.conceptId)}</span>
                    <span className="muted"><Num>{Math.round(s.accuracy * 100)} % · {s.reviews}</Num></span>
                    <Icon name="chevron" size={16} />
                  </button>
                  <Link className="btn btn--sm" to={`/practise/review?concept=${encodeURIComponent(s.conceptId)}`}>
                    {t('practiseThis')}
                  </Link>
                </div>
                {open === s.conceptId && rows && (
                  <ul className="sublist" data-testid={`detail-${s.conceptId}`}>
                    {rows.filter((r) => r.conceptIds.includes(s.conceptId)).slice(0, 8).map((r) => (
                      <li key={r.id}>
                        <span lang="fr" dir="ltr">{r.promptShown.front}</span>
                        <span className="muted">
                          {t(['again', 'again', 'hard', 'good', 'easy'][r.grade] as 'good')} ·{' '}
                          {new Date(r.reviewedAt).toLocaleString()} · {Math.round(r.durationMs / 100) / 10}s
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="data-h">
        <h2 id="data-h" className="h3">{t('exportData')}</h2>
        <p className="muted" style={{ marginBlockEnd: 'var(--space-3)' }}>
          {t('reviewsCount', { n: rows?.length ?? 0 })}
        </p>
        <button className="btn" onClick={download} disabled={!rows?.length} data-testid="export">
          {t('exportData')}
        </button>
      </section>
    </div>
  );
}
