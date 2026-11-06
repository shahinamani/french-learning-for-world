/**
 * Themes and free resources (owner request 2026-11-06):
 *
 *   /app/themes          every theme; those seen in the learner's exam first
 *   /app/themes/:id      one theme: words, verbs, expressions, exam evidence
 *   /app/resources       the free-resources catalogue, filterable
 *
 * The data model and its honesty rules are in lib/topics.ts.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { ArrowUpRight, Layers } from 'lucide-react';
import { useApp, useUserId } from '../../app-context';
import { useTarget } from '../../lib/exam-targets';
import {
  loadTopics, loadTopic, loadResources, matches, levelsFor, examLabel, TOPIC_LEVELS, RESOURCE_KINDS,
  type TopicSummary, type Topic, type TopicWord, type FreeResource, type ResourceKind,
} from '../../lib/topics';
import type { Level } from '../../lib/types';
import type { Dict } from '../../lib/i18n';
import { ErrorState } from '../../components/Search';
import { pick } from '../../lib/exams';
import '../../lib/locales/en/topicsEn';   // registers its English (lazy group)

type T = ReturnType<typeof useApp>['t'];
type Ui = ReturnType<typeof useApp>['settings']['ui'];

/** The theme's name in the interface language; French is always shown too. */
const localName = (n: TopicSummary['names'], ui: Ui) => pick(n, ui).text;
/** A meaning in the interface language where one exists, else English, with
 *  the language it is actually in (never French: French is the headword). */
const gloss = (x: { en: string; fa?: string | null }, ui: Ui) => pick({ en: x.en, fa: x.fa ?? undefined }, ui);

function Loading({ label }: { label: string }) {
  return (
    <div className="page" aria-busy="true">
      <span className="u-hidden-visually">{label}</span>
      <div className="skeleton skeleton--title" /><div className="skeleton skeleton--text" />
    </div>
  );
}

// ── The list ───────────────────────────────────────────────────────────────
export function TopicList() {
  const { t, settings } = useApp();
  const userId = useUserId();
  const [target] = useTarget(userId);
  const [data, setData] = useState<TopicSummary[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let live = true;
    loadTopics().then((d) => { if (live) setData(d.themes); }).catch(() => { if (live) setError(true); });
    return () => { live = false; };
  }, []);

  if (error) return <ErrorState onRetry={() => location.reload()} />;
  if (!data) return <Loading label={t('tpLoading')} />;

  const ui = settings.ui;
  const inExam = target ? data.filter((x) => x.exams.some((e) => matches(e, target))) : [];
  const rest = data.filter((x) => !inExam.includes(x));

  const grid = (list: TopicSummary[]) => (
    <ul className="topic-grid">
      {list.map((x) => {
        const mine = target && x.exams.some((e) => matches(e, target));
        return (
          <li key={x.id}>
            <Link to={`/app/themes/${x.id}`} className="topic-card" data-testid={`topic-${x.id}`}>
              <span className="topic-card__fr" lang="fr" dir="ltr">{x.names.fr}</span>
              {ui !== 'fr' && <span className="topic-card__local">{localName(x.names, ui)}</span>}
              <span className="topic-card__meta">
                {t('tpCounts', { w: x.counts.words, v: x.counts.verbs, e: x.counts.expressions })}
              </span>
              {mine && <span className="topic-card__badge">{t('tpInExam', { exam: target!.label })}</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="page topic-page dash" data-testid="topics">
      <div className="dash__main">
        <header className="exam-head">
          <h1 className="exam-title">{t('tpTitle')}</h1>
          <p className="exam-lede">{t('tpLede')}</p>
        </header>

        {target ? (
          <section aria-labelledby="tp-mine">
            <h2 id="tp-mine" className="exam-block__h">{t('tpForExam', { exam: target.label })}</h2>
            {inExam.length > 0 ? grid(inExam) : <p className="exam-note" data-testid="topics-none-for-exam">{t('tpForExamNone', { exam: target.label })}</p>}
          </section>
        ) : (
          <p className="exam-note"><Link to="/app/exam">{t('tpChooseExam')}</Link></p>
        )}

        <section aria-labelledby="tp-rest">
          <h2 id="tp-rest" className="exam-block__h">{target ? t('tpOthers') : t('tpAll')}</h2>
          {grid(target ? rest : data)}
        </section>
      </div>

      <aside className="dash__aside">
        <section className="dash-card" aria-labelledby="tp-how">
          <h2 id="tp-how" className="dash-card__title">{t('tpHowTitle')}</h2>
          <p className="exam-note">{t('tpHowBody')}</p>
        </section>
      </aside>
    </div>
  );
}

// ── One theme ──────────────────────────────────────────────────────────────
export function TopicDetail() {
  const { t, settings } = useApp();
  const userId = useUserId();
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const [target] = useTarget(userId);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [error, setError] = useState<'missing' | 'load' | null>(null);
  useEffect(() => {
    let live = true;
    setTopic(null); setError(null);
    loadTopics()
      .then((d) => (d.themes.some((x) => x.id === id) ? loadTopic(id) : Promise.reject(new Error('missing'))))
      .then((x) => { if (live) setTopic(x); })
      .catch((e) => { if (live) setError(e?.message === 'missing' ? 'missing' : 'load'); });
    return () => { live = false; };
  }, [id]);

  // `?level=B1` shows up to B1; `?level=all` everything. The default follows
  // the learner's exam.
  const raw = (params.get('level') ?? '').toUpperCase();
  const chosen: Level | 'ALL' | null = raw === 'ALL' ? 'ALL' : (TOPIC_LEVELS as string[]).includes(raw) ? raw as Level : null;
  const shown: Level[] = chosen === 'ALL' ? TOPIC_LEVELS
    : chosen ? TOPIC_LEVELS.slice(0, TOPIC_LEVELS.indexOf(chosen) + 1) : levelsFor(target);
  const current = chosen ?? (target?.level && (TOPIC_LEVELS as string[]).includes(target.level) ? target.level as Level : 'ALL');

  if (error === 'missing') return (
    <div className="page"><p>{t('tpNotFound')}</p><Link to="/app/themes">{t('tpBack')}</Link></div>
  );
  if (error) return <ErrorState onRetry={() => location.reload()} />;
  if (!topic) return <Loading label={t('tpLoading')} />;

  const ui = settings.ui;
  // A word with no level (not estimated either) is shown at every level:
  // hiding it would be a claim about its difficulty that nobody made.
  const atLevel = <X extends { level: Level | null }>(list: X[]) => list.filter((x) => !x.level || shown.includes(x.level));
  const words = atLevel(topic.words);
  const verbs = atLevel(topic.verbs);
  const expressions = topic.expressions.filter((x) => shown.includes(x.level));
  const cards = [...topic.words, ...topic.verbs].filter((x) => x.key).length;
  const mine = target ? topic.evidence.filter((e) => matches(e, target)) : [];
  const other = topic.evidence.filter((e) => !mine.includes(e));

  const setLevel = (lv: Level | 'ALL') => {
    const next = new URLSearchParams(params);
    next.set('level', lv === 'ALL' ? 'all' : lv);
    setParams(next, { replace: true });
  };

  return (
    <div className="page topic-page dash" data-testid={`topic-page-${topic.id}`}>
      <div className="dash__main">
        <Link to="/app/themes" className="exam-back">{t('tpBack')}</Link>
        <header className="exam-head">
          <h1 className="exam-title" lang="fr" dir="ltr">{topic.names.fr}</h1>
          {ui !== 'fr' && <p className="exam-lede">{localName(topic.names, ui)}</p>}
        </header>

        <nav className="topic-levels" aria-label={t('tpLevel')}>
          {TOPIC_LEVELS.map((lv) => (
            <button key={lv} type="button" onClick={() => setLevel(lv)} aria-pressed={current === lv}
                    className={`chip chip--${lv.toLowerCase()}${current === lv ? ' is-current' : ''}`}
                    data-testid={`topic-level-${lv}`}
                    title={t('tpUpTo', { level: lv })}>{lv}</button>
          ))}
          <button type="button" onClick={() => setLevel('ALL')} aria-pressed={current === 'ALL'}
                  className={`chip${current === 'ALL' ? ' is-current' : ''}`} data-testid="topic-level-all">{t('tpAllLevels')}</button>
        </nav>

        <WordTable title={t('tpWords')} id="tp-words" list={words} t={t} ui={ui} />
        <WordTable title={t('tpVerbs')} id="tp-verbs" list={verbs} t={t} ui={ui} />

        <section className="exam-block" aria-labelledby="tp-expr">
          <h2 id="tp-expr" className="exam-block__h">{t('tpExpressions')} <span className="topic-count">{expressions.length}</span></h2>
          {expressions.length === 0 ? <p className="exam-note">{t('tpNoneAtLevel')}</p> : (
            <ul className="topic-expr">
              {expressions.map((x) => (
                <li key={x.fr}>
                  <span className="topic-expr__fr" lang="fr" dir="ltr">{x.fr}</span>
                  <Gloss x={x} ui={ui} className="topic-expr__tr" />
                  <span className="topic-expr__meta">
                    <span className={`chip chip--${x.level.toLowerCase()}`}>{x.level}</span>
                    {' '}{t(x.use === 'speaking' ? 'tpUseSpeaking' : x.use === 'writing' ? 'tpUseWriting' : 'tpUseBoth')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <aside className="dash__aside">
        {cards > 0 && (
          <section className="dash-card">
            <Link className="btn btn--primary topic-practise" to={`/app/cards?theme=${topic.id}`} data-testid="topic-practise">
              <Layers className="size-4" aria-hidden="true" /> {t('tpPractise')}
            </Link>
            <p className="exam-note">{t('tpPractiseNote', { n: cards })}</p>
          </section>
        )}

        <section className="dash-card" aria-labelledby="tp-ev" data-testid="topic-evidence">
          <h2 id="tp-ev" className="dash-card__title">{t('tpEvidenceTitle')}</h2>
          {topic.evidence.length === 0 && <p className="exam-note">{t('tpEvidenceNone')}</p>}
          {mine.length > 0 && <EvidenceList title={t('tpEvidenceYours')} list={mine} t={t} />}
          {other.length > 0 && <EvidenceList title={mine.length ? t('tpEvidenceOther') : null} list={other} t={t} />}
        </section>

      </aside>
    </div>
  );
}

// The owner decided on 2026-11-06 that learners see no "draft", "unreviewed"
// or "not verified" line. The review state stays in the data (`reviewed`,
// `levelEstimated`, `checked`) and in docs/review/themes.md.
function WordTable({ title, id, list, t, ui }: { title: string; id: string; list: TopicWord[]; t: T; ui: Ui }) {
  return (
    <section className="exam-block" aria-labelledby={id}>
      <h2 id={id} className="exam-block__h">{title} <span className="topic-count">{list.length}</span></h2>
      {list.length === 0 ? <p className="exam-note">{t('tpNoneAtLevel')}</p> : (
        <ul className="topic-words">
          {list.map((w) => (
            <li key={w.key ?? w.fr}>
              <span className="topic-words__fr" lang="fr" dir="ltr">
                {w.article && <span className="topic-words__art">{w.article}{w.article.endsWith('’') || w.article.endsWith("'") ? '' : ' '}</span>}
                {w.fr}
              </span>
              <Gloss x={w} ui={ui} className="topic-words__tr" />
              {w.level && (
                <span className={`chip chip--${w.level.toLowerCase()}`}>{w.level}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Gloss({ x, ui, className }: { x: { en: string; fa?: string | null }; ui: Ui; className: string }) {
  const g = gloss(x, ui);
  return <span className={className} lang={g.locale} dir={g.locale === 'fa' ? 'rtl' : 'ltr'}>{g.text}</span>;
}

function EvidenceList({ title, list, t }: { title: string | null; list: Topic['evidence']; t: T }) {
  return (
    <>
      {title && <h3 className="topic-ev__h">{title}</h3>}
      <ul className="topic-ev">
        {list.map((e, i) => (
          <li key={`${e.source.url}-${e.paper}-${i}`}>
            <span className="topic-ev__exam">{examLabel(e)} · {e.paper}</span>
            <span className="topic-ev__topic" lang="fr" dir="ltr">{e.topic}</span>
            <a href={e.source.url} target="_blank" rel="noopener noreferrer" className="topic-ev__src">
              {e.source.what}<ArrowUpRight className="size-3" aria-hidden="true" />
            </a>
            <span className="exam-note">{t('tpReadOn', { date: e.source.readOn })}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

// ── Free resources ─────────────────────────────────────────────────────────
const KIND_LABEL: Record<ResourceKind, keyof Dict> = {
  'exam-practice': 'rsKindExamPractice', podcast: 'rsKindPodcast', video: 'rsKindVideo', news: 'rsKindNews',
  book: 'rsKindBook', website: 'rsKindWebsite', dictionary: 'rsKindDictionary', app: 'rsKindApp',
};
const LANG_NAME: Record<string, string> = { fr: 'français', en: 'English', 'fr+en': 'français + English' };

export function ResourceList() {
  const { t } = useApp();
  const userId = useUserId();
  const [target] = useTarget(userId);
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<{ checkedOn: string; resources: FreeResource[] } | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let live = true;
    loadResources().then((d) => { if (live) setData(d); }).catch(() => { if (live) setError(true); });
    return () => { live = false; };
  }, []);

  const kind = (RESOURCE_KINDS as string[]).includes(params.get('kind') ?? '') ? params.get('kind') as ResourceKind : null;
  const lvRaw = (params.get('level') ?? '').toUpperCase();
  const level = (TOPIC_LEVELS as string[]).includes(lvRaw) ? lvRaw as Level : null;
  const examOnly = params.get('exam') === '1' && !!target;
  const set = (k: string, v: string | null) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    setParams(next, { replace: true });
  };

  const list = useMemo(() => (data?.resources ?? []).filter((r) =>
    (!kind || r.kind === kind)
    // A resource with no stated level serves every level; one with levels
    // must list the chosen one.
    && (!level || r.levels.length === 0 || r.levels.includes(level))
    && (!examOnly || r.exams.includes(target!.exam))), [data, kind, level, examOnly, target]);

  if (error) return <ErrorState onRetry={() => location.reload()} />;
  if (!data) return <Loading label={t('rsTitle')} />;

  // The learner's own exam first within each type; otherwise catalogue order.
  const mineFirst = (a: FreeResource, b: FreeResource) =>
    Number(!!target && b.exams.includes(target.exam)) - Number(!!target && a.exams.includes(target.exam));
  const byKind = RESOURCE_KINDS.map((k) => [k, list.filter((r) => r.kind === k).sort(mineFirst)] as const).filter(([, l]) => l.length > 0);
  // Levels are shown only where a publisher states them; until one does, a
  // level filter would filter nothing, so it is not offered.
  const anyLevels = data.resources.some((r) => r.levels.length > 0);

  return (
    <div className="page topic-page" data-testid="resources">
      <header className="exam-head">
        <h1 className="exam-title">{t('rsTitle')}</h1>
        <p className="exam-lede">{t('rsLede')}</p>
      </header>

      <div className="rs-filters">
        <nav className="topic-levels" aria-label={t('rsKind')}>
          <button type="button" className={`chip${!kind ? ' is-current' : ''}`} aria-pressed={!kind} onClick={() => set('kind', null)}>{t('rsAllKinds')}</button>
          {RESOURCE_KINDS.filter((k) => data.resources.some((r) => r.kind === k)).map((k) => (
            <button key={k} type="button" className={`chip${kind === k ? ' is-current' : ''}`} aria-pressed={kind === k}
                    onClick={() => set('kind', k)} data-testid={`rs-kind-${k}`}>{t(KIND_LABEL[k])}</button>
          ))}
        </nav>
        {anyLevels && <nav className="topic-levels" aria-label={t('tpLevel')}>
          <button type="button" className={`chip${!level ? ' is-current' : ''}`} aria-pressed={!level} onClick={() => set('level', null)}>{t('rsLevelAny')}</button>
          {TOPIC_LEVELS.map((lv) => (
            <button key={lv} type="button" className={`chip chip--${lv.toLowerCase()}${level === lv ? ' is-current' : ''}`}
                    aria-pressed={level === lv} onClick={() => set('level', lv)}>{lv}</button>
          ))}
        </nav>}
        {target && (
          <label className="rs-exam">
            <input type="checkbox" checked={examOnly} onChange={(e) => set('exam', e.target.checked ? '1' : null)} data-testid="rs-exam-only" />
            {' '}{t('rsForMyExam', { exam: target.label.replace(/ [ABC][12]$/, '') })}
          </label>
        )}
        <p className="exam-note" role="status">{t('rsCount', { n: list.length })}</p>
      </div>

      {list.length === 0 && <p className="exam-note">{t('rsNone')}</p>}

      {byKind.map(([k, rows]) => (
        <section key={k} className="exam-block" aria-labelledby={`rs-${k}`}>
          <h2 id={`rs-${k}`} className="exam-block__h">{t(KIND_LABEL[k])} <span className="topic-count">{rows.length}</span></h2>
          <ul className="rs-grid">
            {rows.map((r) => (
              <li key={r.id} className="rs-card" data-testid={`rs-${r.id}`}>
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="rs-card__title">
                  <span>{r.title}</span><ArrowUpRight className="size-4" aria-hidden="true" />
                </a>
                <span className="rs-card__pub">{r.publisher}</span>
                <p className="rs-card__desc" lang="en" dir="ltr">{r.description}</p>
                <span className="rs-card__meta">
                  <span className={`rs-cost${r.cost === 'free-tier' ? ' rs-cost--tier' : ''}`} title={r.costNote}>
                    {r.cost === 'free' ? t('rsFree') : t('rsFreeTier')}
                  </span>
                  {r.levels.map((lv) => <span key={lv} className={`chip chip--${lv.toLowerCase()}`}>{lv}</span>)}
                  {r.exams.map((e) => <span key={e} className="chip">{examLabel({ exam: e, level: null })}</span>)}
                  <span className="exam-note">{t('rsInLanguage', { lang: LANG_NAME[r.language] ?? r.language })}</span>
                </span>
                {r.cost === 'free-tier' && r.costNote && <span className="exam-note" lang="en" dir="ltr">{r.costNote}</span>}
                {r.licence && <span className="exam-note" lang="en" dir="ltr">{r.licence}</span>}
              </li>
            ))}
          </ul>
        </section>
      ))}

      <footer className="rs-foot">
        <p className="exam-note">{t('rsChecked', { date: data.checkedOn })} {t('rsIndependent')}</p>
      </footer>
    </div>
  );
}
