/**
 * The exam-centred pages (redesign v1, owner decision 2026-10-31):
 *
 *   /app/exam                     choose your exam
 *   /app/exam/:target             the exam's overview and official format
 *   /app/exam/:target/:section    one of the four sections (co, ce, pe, po)
 *
 * What these pages state about an exam's format is read from
 * content/exams.json, figure by figure, with the source each was read from.
 * Where the format is not verified, no figure is shown. Where the portal has
 * no practice for a section, the page says so and points to what does exist:
 * the official sample papers and free material from public broadcasters.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { ArrowUpRight, BookOpen, CalendarDays, Ear, Mic, PenLine } from 'lucide-react';
import { useApp, useUserId } from '../../app-context';
import {
  TARGETS, loadExamEntries, papersOf, extraPapersOf, totalMinutes, passingOf, validityOf, targetById, useTarget, SECTIONS, SKILL_OF,
  type ExamEntry, type Paper, type Resource, type SectionKey, type Target,
} from '../../lib/exam-targets';
import { loadPapers, pick, type ExamPaper } from '../../lib/exams';
import type { Dict } from '../../lib/i18n';
import { ErrorState } from '../../components/Search';
import { SECTION_LABEL, practiceFor } from '../app/PortalNav';
import { SectionHead } from '../../components/SectionHead';
import { userKey } from '../../lib/session';
import { readPlan } from '../../lib/plan';
import type { Locale } from '../../lib/types';
import '../../lib/locales/en/todayEn';   // registers its English (lazy group)
import { PageWithAside, AsideCard, ExamSectionCard, WeakPointsCard, PlanCard, TipCard } from '../../components/aside';
import { OfferCard } from '../../components/aside/OfferCard';

const ICON: Record<SectionKey, typeof Ear> = { co: Ear, ce: BookOpen, pe: PenLine, po: Mic };

/** Where the portal can build each skill today, whatever the exam. */
const BUILD: Record<SectionKey, { to: string; label: keyof Dict }[]> = {
  co: [{ to: '/app/cards', label: 'cards' }],
  ce: [{ to: '/app/reading', label: 'shellNavReading' }, { to: '/app/grammar', label: 'grammar' }],
  pe: [{ to: '/app/grammar', label: 'grammar' }, { to: '/app/verbs', label: 'verbs' }],
  po: [{ to: '/app/verbs', label: 'verbs' }, { to: '/app/cards', label: 'cards' }],
};

/** Why a section has no practice here, in words already reviewed for the
 *  landing page. */
const WHY_NOT: Record<SectionKey, keyof Dict | null> = {
  co: 'landingNoListening', ce: null, pe: 'landingNoWriting', po: 'landingNoWriting',
};

function useExamData(target: Target | null) {
  const [entry, setEntry] = useState<ExamEntry | null>(null);
  const [papers, setPapers] = useState<ExamPaper[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!target) return;
    let live = true;
    Promise.all([loadExamEntries(), loadPapers()])
      .then(([entries, p]) => { if (!live) return; setEntry(entries.find((e) => e.id === target.exam) ?? null); setPapers(p); })
      .catch(() => { if (live) setError(true); });
    return () => { live = false; };
  }, [target]);
  return { entry, papers, error };
}

/** The texts (reading) or letter tasks (writing) this portal has at the
 *  exam's level, for the section page's "practise here" list. Counts and
 *  titles come from the content files; a level of null is shown at every level. */
type Material = { texts: { id: string; title: string; level: string | null; minutes: number; mine: boolean }[]; tasks: { id: string; kind: string; title: string; level: string | null; mine: boolean }[] } | null;
function useSectionMaterial(section: SectionKey | null, level: string | null, ui: Locale): Material {
  const [m, setM] = useState<Material>(null);
  useEffect(() => {
    if (section !== 'ce' && section !== 'pe') { setM({ texts: [], tasks: [] }); return; }
    let live = true;
    (async () => {
      const at = (l: string | null) => !level || !l || l === level;
      if (section === 'ce') {
        const { loadReading } = await import('../../features/reader/data');
        const texts = await loadReading().catch(() => []);
        if (live) setM({ texts: texts.map((x) => ({ id: x.id, title: pick(x.title, ui).text, level: x.level, minutes: Math.max(1, Math.round(x.readingTime.seconds / 60)), mine: at(x.level) })).sort((a, b) => Number(b.mine) - Number(a.mine)), tasks: [] });
      } else {
        const { loadLetters } = await import('../../features/letters/data');
        const file = await loadLetters().catch(() => ({ kinds: [], tasks: [] }));
        if (live) setM({ texts: [], tasks: file.tasks.map((x) => ({ id: x.id, kind: x.kind, title: pick(x.task, ui).text, level: x.level, mine: at(x.level) })).sort((a, b) => Number(b.mine) - Number(a.mine)) });
      }
    })().catch(() => { if (live) setM({ texts: [], tasks: [] }); });
    return () => { live = false; };
  }, [section, level, ui]);
  return m;
}

function facts(p: Paper, t: ReturnType<typeof useApp>['t']): string[] {
  const out: string[] = [];
  if (p.minutes) out.push(t('shellExamMinutes', { n: p.minutes }));
  if (p.marks) out.push(t('shellExamMarks', { n: p.marks }));
  if (p.items) out.push(t('shellExamItems', { n: p.items }));
  if (p.exercises) out.push(t('shellExamTasks', { n: p.exercises }));
  return out;
}

// ── Choose your exam ───────────────────────────────────────────────────────
const FAMILY: [Target['family'], keyof Dict][] = [
  ['delf', 'shellExamFamilyDelf'], ['dalf', 'shellExamFamilyDalf'], ['tcf', 'shellExamFamilyTcf'], ['canada', 'shellExamFamilyCanada'],
];

export function ExamChooser() {
  const { t } = useApp();
  const userId = useUserId();
  const [target, choose] = useTarget(userId);
  const navigate = useNavigate();
  return (
    <PageWithAside className="exam-page" aside={<>
      <OfferCard />
      <AsideCard title={t('tdAsWhyTitle')} testId="aside-why"><p className="fine">{t('tdAsWhyBody')}</p></AsideCard>
      <TipCard id="exam" />
    </>}>
      <header className="exam-head">
        <h1 className="exam-title">{t('shellExamChoose')}</h1>
        <p className="exam-lede">{t('shellExamChooseLede')}</p>
      </header>
      <div className="exam-page--choose">
        {FAMILY.map(([f, label]) => (
          <section key={f} className="exam-family" aria-labelledby={`fam-${f}`}>
            <h2 id={`fam-${f}`} className="exam-family__h">{t(label)}</h2>
            <ul className="exam-choices">
              {TARGETS.filter((x) => x.family === f).map((x) => (
                <li key={x.id}>
                  <button type="button" className="exam-choice" aria-pressed={target?.id === x.id}
                          data-testid={`choose-${x.id}`}
                          onClick={() => { choose(x.id); navigate(`/app/exam/${x.id}`); }}>
                    <span className="exam-choice__code">{x.label}</span>
                    {x.level && <span className={`chip chip--${x.level.toLowerCase()}`}>{x.level}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </PageWithAside>
  );
}

// ── Overview and section pages ─────────────────────────────────────────────
export function ExamPage() {
  const { t, settings } = useApp();
  const userId = useUserId();
  const { target: id, section } = useParams();
  const target = targetById(id);
  const [current, choose] = useTarget(userId);
  const { entry, papers, error } = useExamData(target);

  // Opening an exam's address makes it the learner's exam, so the sidebar
  // and the address never disagree.
  useEffect(() => { if (target && current?.id !== target.id) choose(target.id); }, [target, current, choose]);

  const sectionKey = (SECTIONS as string[]).includes(section ?? '') ? (section as SectionKey) : null;
  const official = useMemo(() => (entry && target ? papersOf(entry, target) : null), [entry, target]);
  const { bySection } = practiceFor(papers, target);
  const material = useSectionMaterial(sectionKey, target?.level ?? null, settings.ui);

  if (!target) return <Navigate replace to="/app/exam" />;
  if (section && !sectionKey) return <Navigate replace to={`/app/exam/${target.id}`} />;
  if (error) return <ErrorState onRetry={() => location.reload()} />;
  if (!entry) return <div className="page"><div className="skeleton skeleton--title" /><div className="skeleton skeleton--text" /></div>;

  const ui = settings.ui;
  const name = (p: Paper | undefined, k: SectionKey) => (p ? pick(p.name, ui).text : t(SECTION_LABEL[k]));
  const frName = (p: Paper | undefined) => p?.name.fr ?? null;
  const verified = !!entry.structure.verifiedOn && !!official;
  const officialPages = entry.resources.filter((r) => r.kind === 'exam-body');

  if (sectionKey) {
    const p = official?.[sectionKey];
    const practice = bySection[sectionKey];
    const free = entry.resources.filter((r) => r.skill === SKILL_OF[sectionKey]);
    const why = WHY_NOT[sectionKey];
    const I = ICON[sectionKey];
    const freeList = free.length > 0 && (
      <AsideCard title={t('shellExamFreeElsewhere')} id="sec-free" testId="aside-free">
        <ul className="exam-rows">
          {free.map((r) => (
            <li key={r.url}>
              <a href={r.url} target="_blank" rel="noopener noreferrer" className="exam-row">
                <span className="exam-row__name" lang={r.lang}>{r.title}</span>
                <span className="exam-row__meta">{r.publisher}<ArrowUpRight className="size-4" aria-hidden="true" /></span>
              </a>
            </li>
          ))}
        </ul>
      </AsideCard>
    );
    return (
      <PageWithAside className="exam-page" testId={`exam-section-${sectionKey}`} aside={<>
        <ExamSectionCard section={sectionKey} />
        {freeList}
        <WeakPointsCard />
        <PlanCard />
      </>}>
        <Link to={`/app/exam/${target.id}`} className="exam-back">{target.label}</Link>
        <header className="exam-head exam-head--section">
          <span className="exam-head__icon" aria-hidden="true"><I className="size-6" /></span>
          <div>
            <h1 className="exam-title">{name(p, sectionKey)}</h1>
            {frName(p) && ui !== 'fr' && <p className="exam-fr" lang="fr" dir="ltr">{frName(p)}</p>}
          </div>
        </header>

        <section className="exam-block" aria-labelledby="sec-format">
          <h2 id="sec-format" className="exam-block__h">{t('shellExamFormat')}</h2>
          {verified && p ? (
            <>
              <ul className="exam-facts">{facts(p, t).map((f) => <li key={f}>{f}</li>)}</ul>
              {(p.task || p.minutesNote || p.exercisesNote) && (
                <p className="exam-note">{[p.task, p.minutesNote, p.exercisesNote].filter(Boolean).join('. ')}</p>
              )}
            </>
          ) : <p className="exam-note">{t('shellExamNotVerified')}</p>}
        </section>

        <section className="exam-block" aria-labelledby="sec-here">
          <h2 id="sec-here" className="exam-block__h">{t('shellExamPractiseHere')}</h2>
          {practice.length > 0 ? (
            <ul className="exam-rows">
              {practice.map((x) => (
                <li key={x.id}>
                  <Link to={`/app/exams/${encodeURIComponent(x.id)}`} className="exam-row">
                    <span className="exam-row__name">{pick(x.name, ui).text}</span>
                    <span className="exam-row__meta">{t('shellExamMinutes', { n: x.minutes })} · {t('shellExamQuestions', { n: x.items.length })}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          {material && (['texts', 'tasks'] as const).map((kind) => {
            const all = material[kind];
            const own = all.filter((x) => x.mine), rest = all.filter((x) => !x.mine);
            const row = (x: (typeof all)[number]) => (
              <li key={x.id}>
                <Link to={kind === 'texts' ? `/app/reading/${x.id}` : `/app/writing/${(x as { kind: string }).kind}/${x.id}`} className="exam-row">
                  <span className="exam-row__name" lang={kind === 'texts' ? 'fr' : undefined} dir={kind === 'texts' ? 'ltr' : undefined}>{x.title}</span>
                  <span className="exam-row__meta">{x.level && <span className={`chip chip--${x.level.toLowerCase()}`}>{x.level}</span>}{'minutes' in x && <> {t('shellExamMinutes', { n: x.minutes })}</>}</span>
                </Link>
              </li>
            );
            if (all.length === 0) return null;
            return (
              <div key={kind}>
                {own.length > 0 && <ul className="exam-rows exam-rows--wide" data-testid={`exam-section-${kind}`}>{own.map(row)}</ul>}
                {rest.length > 0 && (
                  <>
                    <h3 className="exam-group__h">{t('tdAsOtherLevels')}</h3>
                    <ul className="exam-rows exam-rows--wide" data-testid={`exam-section-${kind}-other`}>{rest.map(row)}</ul>
                  </>
                )}
              </div>
            );
          })}
          {practice.length === 0 && material && material.texts.every((x) => !x.mine) && material.tasks.every((x) => !x.mine) && (
            <div className="exam-empty">
              <p>{t('shellExamNothingHereYet')}</p>
              {why && <p className="exam-note">{t(why)}</p>}
            </div>
          )}
        </section>

        <section className="exam-block" aria-labelledby="sec-build">
          <h2 id="sec-build" className="exam-block__h">{t('shellExamRelated')}</h2>
          <ul className="exam-links">
            {BUILD[sectionKey].map((b) => <li key={b.to}><Link to={b.to}>{t(b.label)}</Link></li>)}
          </ul>
        </section>

      </PageWithAside>
    );
  }

  return <Overview target={target} entry={entry} verified={verified} official={official} bySection={bySection}
                   officialPages={officialPages} userId={userId} ui={ui} t={t} name={name} frName={frName} />;
}

// ── The overview: the exam, the date, the four sections, what helps ───────
type T = ReturnType<typeof useApp>['t'];

/** The learner's exam date, per profile, in localStorage. `setOn` is the day it
 *  was chosen, so the plan can show the days already behind them. */
type ExamDate = { date: string; setOn: string };
const dateKey = (userId: string) => userKey(userId, 'exam-date');
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseYmd = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1); };
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86_400_000);

function readExamDate(userId: string): ExamDate | null {
  try {
    const raw = localStorage.getItem(dateKey(userId));
    const v = raw ? JSON.parse(raw) as ExamDate : null;
    return v && /^\d{4}-\d{2}-\d{2}$/.test(v.date) ? v : null;
  } catch { return null; }
}
function writeExamDate(userId: string, v: ExamDate | null) {
  try { if (v) localStorage.setItem(dateKey(userId), JSON.stringify(v)); else localStorage.removeItem(dateKey(userId)); } catch { /* private window */ }
}

/** The suggested focus of one day: what the site actually has, in turn, with
 *  every seventh day left for rest and review. */
type Focus = 'cards' | 'reading' | 'letter' | 'rest' | 'exam';
const ROTATION: Focus[] = ['cards', 'reading', 'letter'];
const focusOf = (i: number, last: boolean): Focus => (last ? 'exam' : i % 7 === 6 ? 'rest' : ROTATION[i % 3] ?? 'cards');

/** What the learner has done here, by section. Counts, never predictions. */
type Has = { textsTotal: number; textsAnswered: number; kinds: number; drafts: number } | null;
function useHas(userId: string, level: string | null): Has {
  const [has, setHas] = useState<Has>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      const [{ loadReading }, reader, { loadLetters }, letters] = await Promise.all([
        import('../../features/reader/data'), import('../../features/reader/store'),
        import('../../features/letters/data'), import('../../features/letters/store'),
      ]);
      const [texts, results, file, drafts] = await Promise.all([
        loadReading().catch(() => []), reader.resultsForUser(userId).catch(() => []),
        loadLetters().catch(() => ({ kinds: [], tasks: [] })), letters.draftsFor(userId).catch(() => []),
      ]);
      if (!live) return;
      const answered = new Set(results.map((r) => r.itemId));
      const mine = texts.filter((x) => !level || x.level === level);
      setHas({ textsTotal: mine.length, textsAnswered: mine.filter((x) => answered.has(x.id)).length,
        kinds: file.kinds.length, drafts: drafts.length });
    })().catch(() => { if (live) setHas({ textsTotal: 0, textsAnswered: 0, kinds: 0, drafts: 0 }); });
    return () => { live = false; };
  }, [userId, level]);
  return has;
}

function Countdown({ userId, level, ui, t }: { userId: string; level: string | null; ui: Locale; t: T }) {
  const [saved, setSaved] = useState<ExamDate | null>(() => readExamDate(userId));
  useEffect(() => { setSaved(readExamDate(userId)); }, [userId]);
  const today = parseYmd(ymd(new Date()));
  const todayKey = ymd(today);
  const change = (value: string) => {
    const v = value ? { date: value, setOn: saved?.setOn ?? todayKey } : null;
    writeExamDate(userId, v); setSaved(v);
  };
  const fmtLong = useMemo(() => new Intl.DateTimeFormat(ui, { dateStyle: 'long' }), [ui]);
  const fmtDay = useMemo(() => new Intl.DateTimeFormat(ui, { day: 'numeric' }), [ui]);
  const fmtWeekday = useMemo(() => new Intl.DateTimeFormat(ui, { weekday: 'short' }), [ui]);

  const input = (
    <label className="exam-date">
      <CalendarDays className="size-4" aria-hidden="true" />
      <span>{t('exDate')}</span>
      <input type="date" value={saved?.date ?? ''} min={todayKey} onChange={(e) => change(e.target.value)} data-testid="exam-date" />
      {saved && <button type="button" className="exam-date__clear" onClick={() => change('')}>{t('exDateClear')}</button>}
    </label>
  );

  if (!saved) {
    return (
      <section className="exam-plan exam-plan--empty" aria-labelledby="ov-plan">
        <h2 id="ov-plan" className="exam-block__h">{t('exPlanTitle')}</h2>
        <p className="exam-plan__prompt">{t('exDateSet')}</p>
        {input}
      </section>
    );
  }

  const exam = parseYmd(saved.date);
  const left = daysBetween(today, exam);
  const start = parseYmd(saved.setOn) < today ? parseYmd(saved.setOn) : today;
  const total = daysBetween(start, exam) + 1;
  // Today's plan is the only one plan.ts keeps, so today is the only day that
  // can honestly be marked done. Nothing is claimed about any other day.
  const plan = readPlan(userId);
  const todayDone = !!plan && plan.steps.length > 0 && plan.steps.every((s) => s.done);

  const FOCUS_KEY: Record<Focus, string> = {
    cards: t('exDayCards'), reading: level ? t('exDayReading', { level }) : t('exDayReadingAny'),
    letter: t('exDayLetter'), rest: t('exDayRest'), exam: t('exDayExam'),
  };
  const cell = (i: number) => {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const key = ymd(d);
    const isToday = key === todayKey, past = d < today, last = i === total - 1;
    const f = focusOf(i, last);
    const cls = ['exam-day', isToday && 'exam-day--today', past && 'exam-day--past', last && 'exam-day--exam', isToday && todayDone && 'exam-day--done'].filter(Boolean).join(' ');
    return (
      <li key={key} className={cls} aria-current={isToday ? 'date' : undefined}>
        <span className="exam-day__date"><span className="exam-day__wd">{fmtWeekday.format(d)}</span> <span className="exam-day__n">{fmtDay.format(d)}</span></span>
        <span className="exam-day__focus">{FOCUS_KEY[f]}</span>
        {isToday && todayDone && <span className="exam-day__done">{t('exDayDone')}</span>}
      </li>
    );
  };
  const cells: ReturnType<typeof cell>[] = [];
  if (total <= 21) for (let i = 0; i < total; i++) cells.push(cell(i));
  else {
    for (let i = 0; i < 14; i++) cells.push(cell(i));
    cells.push(<li key="gap" className="exam-day exam-day--gap"><span>{t('exDaysMore', { n: total - 15 })}</span></li>);
    cells.push(cell(total - 1));
  }

  return (
    <section className="exam-plan" aria-labelledby="ov-plan" data-testid="exam-plan">
      <div className="exam-plan__head">
        <div>
          <h2 id="ov-plan" className="exam-block__h">{t('exPlanTitle')}</h2>
          <p className="exam-plan__left" data-testid="exam-days-left">
            {left < 0 ? t('exDatePassed') : left === 0 ? t('exDayExamToday') : t('exDaysLeft', { n: left, date: fmtLong.format(exam) })}
          </p>
        </div>
        {input}
      </div>
      {left >= 0 && <ol className="exam-days" aria-label={t('exPlanTitle')}>{cells}</ol>}
      <p className="exam-note">{t('exPlanNote')}</p>
    </section>
  );
}

function Overview({ target, entry, verified, official, bySection, officialPages, userId, ui, t, name, frName }: {
  target: Target; entry: ExamEntry; verified: boolean; official: Partial<Record<SectionKey, Paper>> | null;
  bySection: Record<SectionKey, ExamPaper[]>; officialPages: Resource[]; userId: string; ui: Locale; t: T;
  name: (p: Paper | undefined, k: SectionKey) => string; frName: (p: Paper | undefined) => string | null;
}) {
  const total = verified ? totalMinutes(entry, target) : 0;
  const passing = verified ? passingOf(entry, target) : null;
  const validity = verified ? validityOf(entry) : null;
  const caveat = entry.structure.caveat
    ? (typeof entry.structure.caveat === 'string' ? entry.structure.caveat : pick(entry.structure.caveat, ui).text) : null;
  const has = useHas(userId, target.level);
  const free = entry.resources.filter((r) => r.kind !== 'exam-body' || r.skill !== 'general');
  const bySkill = SECTIONS.map((k) => [k, free.filter((r) => r.skill === SKILL_OF[k])] as const).filter(([, rs]) => rs.length > 0);
  const general = free.filter((r) => r.skill === 'general');

  const resourceList = (rs: Resource[]) => (
    <ul className="exam-rows">
      {rs.map((r) => (
        <li key={r.url}>
          <a href={r.url} target="_blank" rel="noopener noreferrer" className="exam-row">
            <span className="exam-row__name" lang={r.lang}>{r.title}</span>
            <span className="exam-row__meta">{r.publisher}<ArrowUpRight className="size-4" aria-hidden="true" /></span>
          </a>
        </li>
      ))}
    </ul>
  );

  const hasCell = (k: SectionKey) => {
    const papers = bySection[k];
    const q = papers.reduce((m, x) => m + x.items.length, 0);
    if (k === 'ce') {
      return (
        <>
          <span className="exam-has__line">{!has ? '…' : target.level
            ? t('exHasReading', { m: has.textsTotal, n: has.textsAnswered, level: target.level })
            : t('exHasReadingAny', { m: has.textsTotal, n: has.textsAnswered })}</span>
          {q > 0 && <Link className="exam-has__line" to={`/app/exam/${target.id}/${k}`}>{t('shellExamQuestions', { n: q })}</Link>}
          <Link className="btn btn--sm" to={target.level ? `/app/reading?level=${target.level}` : '/app/reading'} data-testid="exam-practise-ce">{t('exPractise')}</Link>
        </>
      );
    }
    if (k === 'pe') {
      return (
        <>
          <span className="exam-has__line">{!has ? '…' : t('exHasWriting', { m: has.kinds, n: has.drafts })}</span>
          {q > 0 && <Link className="exam-has__line" to={`/app/exam/${target.id}/${k}`}>{t('shellExamQuestions', { n: q })}</Link>}
          <Link className="btn btn--sm" to="/app/writing" data-testid="exam-practise-pe">{t('exPractise')}</Link>
        </>
      );
    }
    return (
      <>
        <span className="exam-has__line exam-has__line--none"><span className="exam-sec__here exam-sec__here--none">{t('shellExamSoon')}</span> {t('exNotOnSite')}</span>
        {q > 0 && <Link className="exam-has__line" to={`/app/exam/${target.id}/${k}`}>{t('shellExamQuestions', { n: q })}</Link>}
        <Link className="btn btn--sm" to={`/app/exam/${target.id}/${k}`} data-testid={`exam-resources-${k}`}>{t('exResources')}</Link>
      </>
    );
  };

  return (
    <div className="page exam-page exam-page--dash" data-testid="exam-overview">
      <SectionHead title={target.label} fr={ui !== 'fr' ? entry.fullName : undefined}
                   lede={<>{entry.owner}{verified && total > 0 ? ` · ${t('shellExamTotal', { minutes: total })}` : ''}</>}
                   aside={<Link to="/app/exam" className="btn btn--sm" data-testid="exam-change">{t('shellExamSwitch')}</Link>} />

      <div className="dash exam-dash">
        <div className="dash__main">
          <Countdown userId={userId} level={target.level} ui={ui} t={t} />

          <section aria-labelledby="ov-sections">
            <h2 id="ov-sections" className="exam-block__h">{t('shellExamSections')}</h2>
            <ol className="exam-table">
              {SECTIONS.map((k) => {
                const p = official?.[k];
                const I = ICON[k];
                return (
                  <li key={k} className="exam-tr" data-testid={`exam-sec-${k}`}>
                    <span className="exam-sec__icon" aria-hidden="true"><I className="size-5" /></span>
                    <Link to={`/app/exam/${target.id}/${k}`} className="exam-sec__name exam-tr__name">
                      <span>{name(p, k)}</span>
                      {frName(p) && ui !== 'fr' && <span className="exam-sec__fr" lang="fr" dir="ltr">{frName(p)}</span>}
                    </Link>
                    <span className="exam-sec__facts exam-tr__facts">{verified && p ? facts(p, t).join(' · ') : t('shellExamNotVerified')}</span>
                    <span className="exam-has">{hasCell(k)}</span>
                  </li>
                );
              })}
            </ol>
            {verified && extraPapersOf(entry).length > 0 && (
              <div className="exam-extra">
                <h3 className="exam-block__h">{t('shellExamOtherSection')}</h3>
                <ul className="exam-facts">
                  {extraPapersOf(entry).map((p) => <li key={p.code}>{pick(p.name, ui).text}: {facts(p, t).join(', ')}</li>)}
                </ul>
              </div>
            )}
          </section>
        </div>

        <aside className="dash__aside">
          <section className="exam-block dash-card" aria-labelledby="ov-pass" data-testid="exam-pass">
            <h2 id="ov-pass" className="exam-block__h">{t('shellExamPassing')}</h2>
            {passing && (passing.overall || passing.perPaper) ? (
              <ul className="exam-facts exam-facts--prose">
                {passing.overall && <li>{passing.overall}</li>}
                {passing.perPaper && <li>{passing.perPaper}</li>}
                {entry.structure.scoring?.scale && <li>{entry.structure.scoring.scale}</li>}
                {validity && <li>{validity}</li>}
              </ul>
            ) : <p className="exam-note">{t('exPassUnknown')}</p>}
            {verified && entry.structure.sources && entry.structure.sources.length > 0 && (
              <details className="exam-sources">
                <summary>{t('shellExamSources')}</summary>
                <ul>
                  {entry.structure.sources.map((s) => (
                    <li key={s.url + s.what}>
                      <a href={s.url} target="_blank" rel="noopener noreferrer">{s.what}</a>
                      <span className="exam-note"> {t('shellExamReadOn', { date: s.readOn })}</span>
                    </li>
                  ))}
                </ul>
                {caveat && <p className="exam-note">{caveat}</p>}
              </details>
            )}
          </section>

          {(officialPages.length > 0 || bySkill.length > 0 || general.length > 0) && (
            <section className="exam-block dash-card" aria-labelledby="ov-free" data-testid="exam-resources">
              <h2 id="ov-free" className="exam-block__h">{t('exResourcesTitle')}</h2>
              {officialPages.length > 0 && (<><h3 className="exam-group__h">{t('shellExamOfficial')}</h3>{resourceList(officialPages)}</>)}
              {bySkill.map(([k, rs]) => (<div key={k}><h3 className="exam-group__h">{t(SECTION_LABEL[k])}</h3>{resourceList(rs)}</div>))}
              {general.length > 0 && (<><h3 className="exam-group__h">{t('exGeneral')}</h3>{resourceList(general)}</>)}
            </section>
          )}

          <section className="exam-block dash-card" aria-labelledby="ov-teacher" data-testid="exam-teacher">
            <h2 id="ov-teacher" className="exam-block__h">{t('exTeacherTitle')}</h2>
            <p className="exam-teacher__p">{t('exTeacherBody')}</p>
            <Link to="/account" className="btn btn--sm">{t('exTeacherExport')}</Link>
            <p className="exam-note">{t('exTeacherNote')}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
