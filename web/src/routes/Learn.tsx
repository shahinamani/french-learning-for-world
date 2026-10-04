/** Home: the level × skill map, one pinned session card, and weak points. */
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useApp, useUserId } from '../app-context';
import { loadContent } from '../lib/content';
import { loadMaterial, cellState, type Material } from '../lib/material';
import { counts, weakPoints, type Counts, type ConceptStat } from '../lib/progress';
import { Icon } from '../components/Icon';
import { ErrorState } from '../components/Search';
import type { Card, Concept, Level } from '../lib/types';
import { Localised } from '../components/Localised';
import { DataNotice } from '../components/DataNotice';

const LEVELS: Level[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
/** `label` is an interface key. The column used to show the French abbreviation
 *  (CO, CE, PE, PO, Gr, Voc, Phon) in all four languages, which named the skill
 *  to nobody who did not already know the French. */
/** The skills the taxonomy models. The other four are examined and unmodelled,
 *  so their cells are locked rather than clickable. */
const TAUGHT = ['grammar', 'vocabulary', 'phonetics', 'usage'];

const SKILLS = [
  { key: 'listening', label: 'skillListening' }, { key: 'reading', label: 'skillReading' },
  { key: 'writing', label: 'skillWriting' }, { key: 'speaking', label: 'skillSpeaking' },
  { key: 'grammar', label: 'grammar' }, { key: 'vocabulary', label: 'vocabulary' },
  { key: 'phonetics', label: 'phonetics' }, { key: 'usage', label: 'usage' },
] as const;

export function Learn() {
  const { t } = useApp();
  // Search produces /learn?level=B1. A link whose target ignores its parameter
  // is a broken connection, however well each end works alone.
  const [params, setParams] = useSearchParams();
  const raw = (params.get('level') ?? '').toUpperCase();
  const level = (LEVELS as string[]).includes(raw) ? (raw as Level) : null;
  const userId = useUserId();
  const [data, setData] = useState<{ cards: Card[]; concepts: Concept[] } | null>(null);
  const [material, setMaterial] = useState<Map<string, Material> | null>(null);
  const [c, setC] = useState<Counts | null>(null);
  const [weak, setWeak] = useState<ConceptStat[] | null>(null);
  const [byId, setById] = useState<Map<string, Concept>>(new Map());
  const [error, setError] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const content = await loadContent();
        const [cnt, w, mat] = await Promise.all([
          counts(userId, content.cards, Date.now()),
          weakPoints(userId),
          // 5.8 KiB, generated at build time. The map cannot say what is in a
          // cell without it, and saying the wrong thing is what it did before.
          loadMaterial(),
        ]);
        if (!live) return;
        setMaterial(mat);
        setData({ cards: content.cards, concepts: content.concepts });
        setById(content.conceptById);
        setC(cnt); setWeak(w);
      } catch { if (live) setError(true); }
    })();
    return () => { live = false; };
  }, [userId]);

  if (error) return <ErrorState onRetry={() => location.reload()} />;

  return (
    <div className="page learn">
      {/* First entry, before there is anything to lose. */}
      <DataNotice />
      <aside className="learn__side">
      {/* One pinned card: what to do now, before anything else. */}
      <section className="today card card--raised" aria-labelledby="today-h">
        <h1 id="today-h" className="eyebrow">{t('today')}</h1>
        {c === null ? (
          <div className="skeleton skeleton--title" data-testid="today-loading" />
        ) : c.due + c.fresh === 0 ? (
          <>
            <p className="today__line">{t('nothingDue')}</p>
            <p className="muted">{t('nothingDueBody')}</p>
          </>
        ) : (
          <>
            <p className="today__line" data-testid="today-line">
              {t('sessionOf', { n: c.due + Math.min(c.fresh, 20), m: Math.max(1, Math.round((c.due + Math.min(c.fresh, 20)) * 0.4)) })}
            </p>
            <div className="row gap-2 wrap u-mb-3">
              {[5, 15, 30].map((m) => (
                <Link key={m} className="btn btn--sm" to={`/practise/review?minutes=${m}`}>{t('minutes', { n: m })}</Link>
              ))}
            </div>
            <Link className="btn btn--primary btn--block" to="/practise/review" data-testid="start-session">
              {t('startSession')}
            </Link>
          </>
        )}
      </section>

      <section className="learn__weak" aria-labelledby="weak-h">
        <h2 id="weak-h" className="h3">{t('toWorkOn')}</h2>
        {/* Prerendered: a description of the section, true for every learner,
            and the same size as either thing that replaces it. A one-line
            skeleton let a much larger paragraph appear after hydration and
            become the largest contentful paint at 5.6 s — measured. */}
        {weak === null && <p className="muted" data-testid="weak-intro">{t('weakIntro')}</p>}
        {weak !== null && weak.length === 0 && (
          <p className="muted" data-testid="weak-empty">{t('weakNone')}</p>
        )}
        {weak !== null && weak.length > 0 && (
          <ul className="rows" data-testid="weak-list">
            {weak.filter((w) => !level || byId.get(w.conceptId)?.level === level).slice(0, 5).map((w) => {
              const concept = byId.get(w.conceptId);
              return (
                <li key={w.conceptId}>
                  {/* Straight into practice on that concept, not a generic page. */}
                  <Link className="row row--link" to={`/practise/review?concept=${encodeURIComponent(w.conceptId)}`}>
                    {concept ? <Localised field={concept.name} /> : <span>{w.conceptId}</span>}
                    <span className="muted">{Math.round(w.accuracy * 100)} % · {t('reviewsCount', { n: w.reviews })}</span>
                    <Icon name="chevron" size={16} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      </aside>

      <section className="learn__main" aria-labelledby="map-h">
        <div className="row u-between">
          <h2 id="map-h" className="h3">{t('yourLevel')}</h2>
          {level && (
            <button className="btn btn--sm" data-testid="clear-level"
                    onClick={() => { const p = new URLSearchParams(params); p.delete('level'); setParams(p); }}>
              {t('showingLevel', { level })} · {t('allLevels')}
            </button>
          )}
        </div>
        <div className="map-scroll">
          <table className="map">
            <caption className="u-hidden-visually">{t('yourLevel')}</caption>
            <thead>
              <tr>
                <th scope="col"><span className="u-hidden-visually">{t('yourLevel')}</span></th>
                {SKILLS.map((s) => <th key={s.key} scope="col">{t(s.label)}</th>)}
              </tr>
            </thead>
            <tbody>
              {(level ? [level] : LEVELS).map((lv) => (
                <tr key={lv}>
                  <th scope="row">{lv}</th>
                  {SKILLS.map((s) => {
                    // The grid is 6 levels by 7 skills whatever the data says, so it
                    // renders immediately and is the largest element on the screen
                    // from the first paint. Only the numbers inside wait.
                    //
                    // **What a cell says is now read from the material counts**, not
                    // from whether the LEVEL has flashcards. The old rule showed the
                    // A1 card count in all three A1 cells — including phonetics,
                    // which has none of those cards — and showed a bare dot for every
                    // other cell whether it held 18 exercises or none. Every one of
                    // the 18 clickable cells then led to a page saying "Not built
                    // yet".
                    const cell = data && material
                      ? cellState(data.concepts, material, lv, s.key)
                      : null;
                    const state = cell ? cell.state : (TAUGHT.includes(s.key) ? 'listed' : 'locked');
                    const label = `${lv} ${t(s.label)}`;
                    return (
                      <td key={s.key}>
                        {state === 'locked' ? (
                          <span className="map__cell" data-state="locked"
                                aria-label={`${label} — ${t('notBuilt')}`}>—</span>
                        ) : (
                          <Link className="map__cell" data-state={state} to={`/learn/level/${lv}/${s.key}`}
                                aria-label={cell
                                  ? `${label} — ${cell.withMaterial}/${cell.concepts} ${t('conceptsWithExercises')}`
                                  : label}
                                data-testid={`cell-${lv}-${s.key}`}>
                            {/* The number of concepts that can actually be practised,
                                or a dot where none can. A learner reading "4" and
                                finding four things is the point; the old cell read
                                "22" from a different level's card count. */}
                            {cell && cell.withMaterial > 0 ? `${cell.withMaterial}` : '·'}
                          </Link>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  );
}
