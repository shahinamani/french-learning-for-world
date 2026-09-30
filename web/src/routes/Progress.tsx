/** Every number here is a query over the review log. Summary first. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useApp, useUserId } from '../app-context';
import { reviewsForUser } from '../lib/db';
import { conceptStats, weekSummary, exportRows, type ConceptStat } from '../lib/progress';
import { loadContent } from '../lib/content';
import type { Concept, ReviewRow } from '../lib/types';
import { Icon } from '../components/Icon';
import { fr as frText } from '../lib/typography';

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
    return c ? (settings.ui === 'fr' ? frText(c.name.fr) : c.name.en) : id;
  };

  const download = () => {
    if (!rows) return;
    const url = URL.createObjectURL(new Blob([exportRows(rows)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'french-review-log.json';
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
            {t('reviewsCount', { n: week.reviews })} · {week.minutes} min · {week.days}/7
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
            {stats.slice(0, 12).map((s) => (
              <li key={s.conceptId}>
                <div className="row">
                  <button className="row__disclose" aria-expanded={open === s.conceptId}
                          data-testid={`disclose-${s.conceptId}`}
                          onClick={() => setOpen(open === s.conceptId ? null : s.conceptId)}>
                    <span lang={settings.ui === 'fr' ? 'fr' : undefined}>{name(s.conceptId)}</span>
                    <span className="muted">{Math.round(s.accuracy * 100)} % · {s.reviews}</span>
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
