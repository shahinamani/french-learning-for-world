/** Every number here is a query over the review log. Summary first.
 *
 *  Redesign v2b (owner, 2026-11-19): at 1920 px the main column held almost
 *  nothing. It now carries four counts, thirty days of bars and a table of
 *  every concept practised; the side column keeps "what moved" and the export.
 *  Nothing here is a prediction: counts of reviews, right answers, days, cards. */
import '../lib/locales/en/todayEn';   // registers its English (lazy group)
import { useEffect, useMemo, useState } from 'react';
import { SectionHead } from '../components/SectionHead';
import { Link } from 'react-router';
import { useApp, useUserId } from '../app-context';
import { reviewsForUser } from '../lib/db';
import { downloadBackup } from '../lib/backup';
import { conceptStats, counts, weekSummary, type ConceptStat, type Counts } from '../lib/progress';
import { loadContent } from '../lib/content';
import type { Concept, ReviewRow } from '../lib/types';
import { Icon } from '../components/Icon';
import { Localised } from '../components/Localised';
import { pick } from '../lib/exams';
import { Num } from '../components/Num';
import { WeaknessCard } from '../features/weakness/WeaknessCard';
import { TipCard } from '../components/aside';

const DAY = 86_400_000;
const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function Progress() {
  const { t, settings } = useApp();
  const userId = useUserId();
  const [rows, setRows] = useState<ReviewRow[] | null>(null);
  const [stats, setStats] = useState<ConceptStat[]>([]);
  const [byId, setById] = useState<Map<string, Concept>>(new Map());
  const [week, setWeek] = useState<{ reviews: number; minutes: number; days: number } | null>(null);
  const [cards, setCards] = useState<Counts | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const [r, s, w, content] = await Promise.all([
        reviewsForUser(userId, 3000), conceptStats(userId),
        weekSummary(userId, Date.now()), loadContent(),
      ]);
      if (!live) return;
      setRows(r);
      setStats([...s.values()].sort((a, b) => a.accuracy - b.accuracy));
      setWeek(w); setById(content.conceptById);
      const c = await counts(userId, content.cards, Date.now());
      if (live) setCards(c);
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

  // The last thirty days, today on the end, from the rows this page loaded.
  const month = useMemo(() => {
    const now = Date.now();
    const start = now - 29 * DAY;
    const byDay = new Map<string, number>();
    let correct = 0;
    for (const r of rows ?? []) {
      if (r.grade >= 3) correct += 1;
      if (r.reviewedAt >= start) { const k = dayKey(r.reviewedAt); byDay.set(k, (byDay.get(k) ?? 0) + 1); }
    }
    const days = Array.from({ length: 30 }, (_, i) => {
      const ms = now - (29 - i) * DAY;
      return { key: dayKey(ms), ms, n: byDay.get(dayKey(ms)) ?? 0 };
    });
    return { days, studied: byDay.size, correct, inMonth: days.reduce((a, d) => a + d.n, 0) };
  }, [rows]);
  const max = Math.max(1, ...month.days.map((d) => d.n));
  const fmtDay = useMemo(() => { try { return new Intl.DateTimeFormat(settings.ui, { day: 'numeric', month: 'short' }); } catch { return null; } }, [settings.ui]);
  const fmtDate = useMemo(() => { try { return new Intl.DateTimeFormat(settings.ui, { dateStyle: 'medium' }); } catch { return null; } }, [settings.ui]);
  const total = rows?.length ?? 0;
  const pct = total ? Math.round((month.correct / total) * 100) : null;

  // The whole record, not the rows this page shows: the old export reused
  // them, so a learner with a longer history got a backup missing its older
  // reviews (found 2026-11-03). lib/backup.ts reads everything.
  const download = () => downloadBackup(userId);

  return (
    <div className="page dash progress-page">
      <div className="dash__main">
      <SectionHead title={t('progress')} fr="Mes progrès" />

      <ul className="stat-tiles" data-testid="progress-tiles">
        <li className="stat-tile">
          <span className="stat-tile__n"><Num>{rows === null ? '…' : total >= 3000 ? `${total}+` : total}</Num></span>
          <span className="stat-tile__l">{t('tdAsStatsReviews')}</span>
        </li>
        <li className="stat-tile">
          <span className="stat-tile__n"><Num>{pct === null ? '—' : `${pct} %`}</Num></span>
          <span className="stat-tile__l">{t('tdAsStatsCorrect')}</span>
          {total > 0 && <span className="stat-tile__sub">{t('tdAsStatsOf', { n: month.correct, m: total })}</span>}
        </li>
        <li className="stat-tile">
          <span className="stat-tile__n"><Num>{rows === null ? '…' : month.studied}</Num></span>
          <span className="stat-tile__l">{t('tdAsStatsDays')}</span>
          <span className="stat-tile__sub">{t('tdAsStatsDaysOf')}</span>
        </li>
        <li className="stat-tile">
          <span className="stat-tile__n"><Num>{cards === null ? '…' : cards.learned}</Num></span>
          <span className="stat-tile__l">{t('tdAsStatsLearned')}</span>
          {cards && <span className="stat-tile__sub">{t('tdAsStatsOf', { n: cards.learned, m: cards.total })}</span>}
        </li>
      </ul>

      <section className="dash-card month" aria-labelledby="month-h" data-testid="progress-month">
        <h2 id="month-h" className="dash-card__title">{t('tdAsMonthTitle')}</h2>
        {rows !== null && month.inMonth === 0 && <p className="muted fine">{t('tdAsMonthNone')}</p>}
        <div className="month__bars" aria-hidden="true">
          {month.days.map((d, i) => (
            <span key={d.key} className="month__bar">
              <i style={{ height: `${Math.max(3, (d.n / max) * 100)}%` }} data-on={d.n > 0 || undefined} />
              <small>{i % 7 === 0 && fmtDay ? fmtDay.format(d.ms) : ''}</small>
            </span>
          ))}
        </div>
        <p className="week__sub">{t('reviewsCount', { n: month.inMonth })}</p>
      </section>

      <section aria-labelledby="concepts-h">
        <h2 id="concepts-h" className="h3">{t('tdAsConceptsTitle')}</h2>
        {rows === null && <div className="skeleton skeleton--text" />}
        {rows !== null && stats.length === 0 && <p className="muted" data-testid="concepts-empty">{t('tdAsConceptsNone')}</p>}
        {stats.length > 0 && (
          <div className="map-scroll">
            <table className="concept-table" data-testid="concept-table">
              <thead>
                <tr>
                  <th scope="col">{t('tdAsColConcept')}</th>
                  <th scope="col" className="num">{t('tdAsColReviews')}</th>
                  <th scope="col" className="num">{t('tdAsColCorrect')}</th>
                  <th scope="col">{t('tdAsColLast')}</th>
                  <th scope="col"><span className="u-hidden-visually">{t('practiseThis')}</span></th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={s.conceptId}>
                    <th scope="row">{name(s.conceptId)}</th>
                    <td className="num"><Num>{s.reviews}</Num></td>
                    <td className="num"><Num>{s.correct} / {s.reviews}</Num> <span className="muted">{Math.round(s.accuracy * 100)} %</span></td>
                    <td>{fmtDate ? fmtDate.format(s.lastSeen) : dayKey(s.lastSeen)}</td>
                    <td><Link className="btn btn--sm" to={`/practise/review?concept=${encodeURIComponent(s.conceptId)}`}>{t('practiseThis')}</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      </div>

      {/* The side column: the week at a glance, what moved, a topic worth a look, the backup. */}
      <aside className="dash__aside">
      <section className="card dash-card" aria-labelledby="week-h">
        <h2 id="week-h" className="eyebrow">{t('thisWeek')}</h2>
        {week === null ? <div className="skeleton skeleton--text" /> : (
          <p className="today__line" data-testid="week-summary">
            {t('reviewsCount', { n: week.reviews })} · <Num>{week.minutes} min</Num> · <Num>{week.days}/7</Num>
          </p>
        )}
      </section>

      <section className="dash-card" aria-labelledby="moved-h">
        <h2 id="moved-h" className="dash-card__title">{t('whatMoved')}</h2>
        {rows === null && <div className="skeleton skeleton--text" />}
        {rows !== null && stats.length === 0 && (
          <p className="muted" data-testid="progress-empty">{t('weakNone')}</p>
        )}
        {stats.length > 0 && (
          <ul className="rows rows--aside" data-testid="concept-stats">
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
                    {/* A count of answers, not a score: the blueprint allows no mastery
                        percentage on a weakness surface. */}
                    <span className="muted">{t('reviewsCount', { n: s.reviews })}</span>
                    <Icon name="chevron" size={16} />
                  </button>
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

      <WeaknessCard />
      <TipCard id="progress" />
      <section className="dash-card" aria-labelledby="data-h">
        <h2 id="data-h" className="h3">{t('exportData')}</h2>
        <p className="muted" style={{ marginBlockEnd: 'var(--space-3)' }}>
          {t('reviewsCount', { n: rows?.length ?? 0 })}
        </p>
        <button className="btn" onClick={download} disabled={!rows?.length} data-testid="export">
          {t('exportData')}
        </button>
      </section>
      </aside>
    </div>
  );
}
