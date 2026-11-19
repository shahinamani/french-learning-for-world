/** Two pages from one data load (redesign v1, REDESIGN-v1.md §6):
 *  `today` — one next action, a few ways in, weak points;
 *  `path`  — the level × skill map, which used to crowd Today. */
import '../lib/locales/en/todayEn';   // registers its English (lazy group)
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useApp, useUserId } from '../app-context';
import { loadContent } from '../lib/content';
import { loadMaterial, cellState, type Material } from '../lib/material';
import { counts, weakPoints, type Counts, type ConceptStat } from '../lib/progress';
import { SavedWordsCard, WeekCard } from '../components/aside';
import { WeekCard, PageWithAside, TipCard, ExamSectionCard, WeakPointsCard, PlanCard } from '../components/aside';
import { Icon } from '../components/Icon';
import { ErrorState } from '../components/Search';
import type { Card, Concept, Level } from '../lib/types';
import { Localised } from '../components/Localised';
import { DataNotice } from '../components/DataNotice';
import { BackupReminder } from '../components/BackupReminder';
import { useTarget } from '../lib/exam-targets';
import { readPlan, savePlan, minutesOf, nextStep, dayOf, type Plan, type Step } from '../lib/plan';
import type { ConceptName, Lesson } from '../features/grammar/lessons';
import type { ReadingText } from '../features/reader/types';

/** What the readiness card counts. Every number is something the learner did
 *  here; none is a prediction. */
type Ready = { textsAnswered: number; textsTotal: number; drafts: number };

/** Build today's three steps from what exists, or reuse today's plan. */
async function planFor(userId: string, level: Level | null, c: Counts, weak: ConceptStat[], byId: Map<string, Concept>, now: number, t: (k: 'tdStepCards' | 'tdStepCardsNew' | 'tdStepLesson' | 'tdStepText', v?: Record<string, string | number>) => string): Promise<{ plan: Plan; ready: Ready; unfinished: { to: string; title: string; sub: string }[] }> {
  const [{ loadLessons }, { loadReading }, store, letters] = await Promise.all([
    import('../features/grammar/lessons'), import('../features/reader/data'),
    import('../features/reader/store'), import('../features/letters/store'),
  ]);
  const empty: { lessons: Lesson[]; concepts: Map<string, ConceptName> } = { lessons: [], concepts: new Map() };
  const [lessonData, texts, results, drafts] = await Promise.all([
    loadLessons().catch(() => empty),
    loadReading().catch(() => [] as ReadingText[]),
    store.resultsForUser(userId).catch(() => []),
    letters.draftsFor(userId).catch(() => []),
  ]);
  const answered = new Set(results.map((r) => r.itemId));
  const atLevel = (l: string | null) => !level || l === level;
  const ready: Ready = {
    textsAnswered: texts.filter((x) => atLevel(x.level) && answered.has(x.id)).length,
    textsTotal: texts.filter((x) => atLevel(x.level)).length,
    drafts: drafts.filter((d) => d.text.trim().length > 0).length,
  };
  const unfinished = drafts.filter((d) => d.text.trim().length > 0).slice(0, 2).map((d) => ({
    to: `/app/writing/${d.taskId.split('.')[1] ?? 'formal'}/${d.taskId}`, title: d.taskId.split('.').slice(2).join(' ') || d.taskId,
    sub: `${d.text.trim().split(/\s+/).length} / 160`,
  }));

  const existing = readPlan(userId, now);
  if (existing) return { plan: existing, ready, unfinished };

  const steps: Step[] = [];
  const n = c.due + Math.min(c.fresh, 20);
  if (n > 0) steps.push({ kind: 'cards', to: '/app/cards', title: c.due > 0 ? t('tdStepCards', { n }) : t('tdStepCardsNew', { n }), minutes: Math.max(1, Math.round(n * 0.4)), done: false });
  // The lesson: the weak point's own lesson if one exists, else the first
  // lesson at the exam's level, else the first lesson there is.
  const weakLesson = weak.map((w) => lessonData.lessons.find((l) => l.conceptId === w.conceptId)).find(Boolean);
  const lesson = weakLesson ?? lessonData.lessons.find((l) => atLevel(l.level)) ?? lessonData.lessons[0];
  if (lesson) {
    const name = byId.get(lesson.conceptId)?.name ?? lessonData.concepts.get(lesson.conceptId)?.name;
    steps.push({ kind: 'lesson', to: `/app/grammar/${encodeURIComponent(lesson.id)}`, title: t('tdStepLesson'), fr: name?.fr ?? lesson.conceptId, minutes: 8, done: false });
  }
  // The text: the first at the exam's level not yet answered, else any unanswered.
  const text = texts.find((x) => atLevel(x.level) && !answered.has(x.id)) ?? texts.find((x) => !answered.has(x.id));
  if (text) steps.push({ kind: 'text', to: `/app/reading/${text.id}`, title: t('tdStepText'), fr: text.title.fr ?? text.id, minutes: Math.max(2, Math.round(text.readingTime.seconds / 60) + 3), done: false });
  const plan: Plan = { day: dayOf(now), steps };
  savePlan(userId, plan);
  return { plan, ready, unfinished };
}

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

/** French as content, the same in every interface language. */
const HELLO_FR = 'Bonjour.';
const EVENING_FR = 'Bonsoir.';
const MOT_FR = 'Le mot du jour';

/** Ways into the parts of the portal that exist. The French word is content,
 *  the same in every interface language; the label is the dictionary's. */
const WAYS: { to: string; fr: string; label: 'verbs' | 'shellNavReading' | 'exams' | 'navDialogues' | 'shellNavPath'; testId?: string; icon: string }[] = [
  { to: '/app/verbs/drill', fr: 'les verbes', label: 'verbs', icon: 'bookclock' },
  { to: '/app/reading', fr: 'la lecture', label: 'shellNavReading', icon: 'openbook' },
  { to: '/app/exams', fr: 'les examens', label: 'exams', icon: 'practise' },
  { to: '/app/dialogues', fr: 'les dialogues', label: 'navDialogues', testId: 'go-dialogues', icon: 'textpage' },
  { to: '/app/path', fr: 'le parcours', label: 'shellNavPath', icon: 'path' },
];

export function Learn({ mode = 'today' }: { mode?: 'today' | 'path' }) {
  const { t, settings } = useApp();
  // Search produces /learn?level=B1. A link whose target ignores its parameter
  // is a broken connection, however well each end works alone.
  const [params, setParams] = useSearchParams();
  const raw = (params.get('level') ?? '').toUpperCase();
  const level = (LEVELS as string[]).includes(raw) ? (raw as Level) : null;
  const userId = useUserId();
  const [target] = useTarget(userId);
  const targetLevel = target?.level ?? null;
  const [data, setData] = useState<{ cards: Card[]; concepts: Concept[] } | null>(null);
  const [material, setMaterial] = useState<Map<string, Material> | null>(null);
  const [c, setC] = useState<Counts | null>(null);
  const [weak, setWeak] = useState<ConceptStat[] | null>(null);
  const [byId, setById] = useState<Map<string, Concept>>(new Map());
  const [error, setError] = useState(false);
  const [plan, setPlan] = useState<{ plan: Plan; ready: Ready; unfinished: { to: string; title: string; sub: string }[] } | null>(null);

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
        if (mode === 'today') {
          const lv = targetLevel && (LEVELS as string[]).includes(targetLevel) ? targetLevel as Level : null;
          const p = await planFor(userId, lv, cnt, w, content.conceptById, Date.now(), t as never);
          if (live) setPlan(p);
        }
      } catch { if (live) setError(true); }
    })();
    return () => { live = false; };
    // `t` changes with the interface language; the plan's labels are rebuilt
    // on the next load rather than mid-session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, mode, targetLevel]);

  if (error) return <ErrorState onRetry={() => location.reload()} />;

  const now = new Date();
  const hour = now.getHours();
  let dateFr = '';
  try { dateFr = new Intl.DateTimeFormat('fr', { weekday: 'long', day: 'numeric', month: 'long' }).format(now); } catch { /* no Intl */ }
  // One real card a day, the same all day: the day number picks it.
  const mot = data && data.cards.length ? data.cards[Math.floor(now.getTime() / 86_400_000) % data.cards.length] : null;

  if (mode === 'today') return (
    <div className="page today-page dash">
      <div className="dash__main">
      <header className="today-hello">
        <p className="today-hello__fr" lang="fr" dir="ltr">{hour >= 18 || hour < 5 ? EVENING_FR : HELLO_FR}</p>
        <p className="today-hello__date" lang="fr" dir="ltr">{dateFr}</p>
        <h1 id="today-h" className="today-hello__h">{t('today')}</h1>
      </header>

      {/* One thing to do now, before anything else: today's session, in steps. */}
      <section className="today-main today-plan" aria-labelledby="today-h" data-testid="today-card">
        {c === null || plan === null ? (
          <div className="skeleton skeleton--title" data-testid="today-loading" />
        ) : plan.plan.steps.length === 0 ? (
          <div className="today-main__copy">
            <p className="today-main__line">{t('nothingDue')}</p>
            <p className="today-main__sub">{t('tdPlanNone')}</p>
          </div>
        ) : (
          <>
            <div className="today-plan__head">
              <div>
                <p className="today-plan__label">{t('tdPlanTitle')}{target ? ` · ${target.label}` : ''}</p>
                <p className="today-main__line" data-testid="today-line">{t('tdPlanSteps', { n: plan.plan.steps.length, m: minutesOf(plan.plan) })}</p>
              </div>
              {nextStep(plan.plan) ? (
                <Link className="today-start" to={nextStep(plan.plan)!.to} data-testid="start-session">
                  {plan.plan.steps.some((s) => s.done) ? t('tdPlanContinue', { n: plan.plan.steps.findIndex((s) => !s.done) + 1 }) : t('tdPlanStart')}
                </Link>
              ) : (
                <p className="today-main__sub" data-testid="plan-all-done">{t('tdPlanAllDone')}</p>
              )}
            </div>
            <ol className="today-steps">
              {plan.plan.steps.map((s, i) => (
                <li key={s.kind} data-done={s.done || undefined} data-testid={`plan-step-${s.kind}`}>
                  <Link to={s.to}>
                    <span className="today-steps__n">{s.done ? '✓' : i + 1}</span>
                    <span className="today-steps__body">
                      <span className="today-steps__title">{s.title}</span>
                      {s.fr && <span className="today-steps__fr" lang="fr" dir="ltr">{s.fr}</span>}
                    </span>
                    <span className="today-steps__min">{s.done ? t('tdStepDone') : t('tdStepMin', { n: s.minutes })}</span>
                  </Link>
                </li>
              ))}
            </ol>
            {!target && <p className="today-main__sub">{t('tdNoExam')}</p>}
          </>
        )}
      </section>


      {/* Ways in: the parts of the portal that exist, one line each. */}
      <ul className="today-ways">
        {WAYS.map((w) => (
          <li key={w.to}>
            <Link to={w.to} data-testid={w.testId}>
              <span className="today-ways__icon" aria-hidden="true"><Icon name={w.icon} size={20} /></span>
              <span lang="fr" dir="ltr">{w.fr}</span><span>{t(w.label)}</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="today-grid">
      <section className="learn__weak dash-card" aria-labelledby="weak-h">
        <h2 id="weak-h" className="dash-card__title">{t('toWorkOn')}</h2>
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
                  <Link className="row row--link" to={`/app/cards?concept=${encodeURIComponent(w.conceptId)}`}>
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

      {/* What was left half done: letters in progress. */}
      <section className="dash-card" aria-labelledby="unf-h" data-testid="today-unfinished">
        <h2 id="unf-h" className="dash-card__title">{t('tdContinueTitle')}</h2>
        {plan === null && <div className="skeleton skeleton--text" />}
        {plan !== null && plan.unfinished.length === 0 && <p className="muted">{t('tdNothingUnfinished')}</p>}
        {plan !== null && plan.unfinished.length > 0 && (
          <ul className="rows">
            {plan.unfinished.map((u) => (
              <li key={u.to}>
                <Link className="row row--link" to={u.to}>
                  <span lang="fr" dir="ltr">{u.title}</span><span className="muted">{u.sub}</span><Icon name="chevron" size={16} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      </div>

      <BackupReminder />
      <DataNotice />
      </div>

      {/* The side column: how the week went, the word of the day, the exam. */}
      <aside className="dash__aside" aria-label={t('tdAside')}>
        <WeekCard />
        {target && plan && c && (
          <section className="dash-card" aria-labelledby="ready-h" data-testid="today-ready">
            <h2 id="ready-h" className="dash-card__title">{t('tdReady', { exam: target.label })}</h2>
            <ul className="ready">
              <li><Link to="/app/reading">{t('tdReadyReading', { n: plan.ready.textsAnswered, m: plan.ready.textsTotal })}</Link>
                <span className="rail"><span className="rail__fill" style={{ width: `${plan.ready.textsTotal ? (plan.ready.textsAnswered / plan.ready.textsTotal) * 100 : 0}%` }} /></span></li>
              <li><Link to="/app/writing">{t('tdReadyWriting', { n: plan.ready.drafts })}</Link></li>
              <li><Link to="/app/cards">{t('tdReadyCards', { n: c.learned, m: c.total })}</Link>
                <span className="rail"><span className="rail__fill" style={{ width: `${c.total ? (c.learned / c.total) * 100 : 0}%` }} /></span></li>
              <li><Link to={`/app/exam/${target.id}`}>{t('tdReadyOral')}</Link></li>
            </ul>
            <p className="fine muted">{t('tdReadyNote')}</p>
          </section>
        )}
        <SavedWordsCard />
        {mot && (
          <section className="mot" aria-labelledby="mot-h" data-testid="mot-du-jour">
            <p id="mot-h" className="mot__label" lang="fr" dir="ltr">{MOT_FR}</p>
            <p className="mot__word" lang="fr" dir="ltr">{mot.article ? `${mot.article} ` : ''}{mot.fr}</p>
            <p className="mot__meaning" lang={settings.meaning}
               dir={settings.meaning === 'fa' || settings.meaning === 'ar' ? 'rtl' : 'ltr'}>
              {mot.meanings[settings.meaning] ?? mot.meanings.en}
            </p>
            {mot.examples[0] && <p className="mot__ex" lang="fr" dir="ltr">{mot.examples[0].fr}</p>}
          </section>
        )}

        {/* The learner's exam, or the invitation to choose one. */}
        <Link to={target ? `/app/exam/${target.id}` : '/app/exam'} className="today-exam" data-testid="today-exam">
          <span className="today-exam__label">{t('shellExamMy')}</span>
          <span className="today-exam__name">{target ? target.label : t('shellExamChoose')}</span>
          <span className="today-exam__go">{target ? t('shellExamOverview') : t('shellExamChooseFirst')}</span>
        </Link>
      </aside>
    </div>
  );

  return (
    <PageWithAside className="learn--path path-page" aside={<>
      <TipCard id="path" />
      <ExamSectionCard section="ce" />
      <PlanCard />
      <WeakPointsCard />
    </>}>

      <section className="learn__main" aria-labelledby="map-h">
        <div className="row u-between">
          <h1 id="map-h" className="today-hello__h">{t('yourLevel')}</h1>
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
                          <Link className="map__cell" data-state={state} to={`/app/path/${lv}/${s.key}`}
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

    </PageWithAside>
  );
}
