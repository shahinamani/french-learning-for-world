/**
 * The side column every content page carries (redesign v2b, owner 2026-11-19:
 * "no empty space left or right; fill it with practical detail").
 *
 * Each card here is built from the learner's own record or from verified exam
 * data, never from invented figures. A card with nothing to say renders a
 * short honest line, not a blank. All of them are small and lazy-friendly:
 * the pages that use them are lazy chunks already.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useApp, useUserId } from '../../app-context';
import type { Dict } from '../../lib/i18n';
import { useTarget, loadExamEntries, papersOf, type SectionKey, type ExamEntry } from '../../lib/exam-targets';
import { pick } from '../../lib/exams';
import { readPlan, nextStep, minutesOf } from '../../lib/plan';
import { weakPoints, weekSummary, type ConceptStat } from '../../lib/progress';
import { loadContent } from '../../lib/content';
import { Localised } from '../Localised';
import { Icon } from '../Icon';
import type { Concept } from '../../lib/types';

/** One card of the side column. */
export function AsideCard({ title, children, testId, id }: { title: ReactNode; children: ReactNode; testId?: string; id?: string }) {
  const hid = id ?? `aside-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <section className="dash-card aside-card" aria-labelledby={hid} data-testid={testId}>
      <h2 id={hid} className="dash-card__title">{title}</h2>
      {children}
    </section>
  );
}

/** The page's two-column frame: content, then the side column. */
export function PageWithAside({ className, aside, children, testId }: { className?: string; aside: ReactNode; children: ReactNode; testId?: string }) {
  return (
    <div className={`page dash page--aside${className ? ' ' + className : ''}`} data-testid={testId}>
      <div className="dash__main">{children}</div>
      <aside className="dash__aside">{aside}</aside>
    </div>
  );
}

const SEC_LABEL: Record<SectionKey, keyof Dict> = { co: 'shellExamSecCo', ce: 'shellExamSecCe', pe: 'shellExamSecPe', po: 'shellExamSecPo' };

/** "In your exam": the chosen target and the facts of one of its papers. */
export function ExamSectionCard({ section, note }: { section: SectionKey; note?: keyof Dict }) {
  const { t, settings } = useApp();
  const userId = useUserId();
  const [target] = useTarget(userId);
  const [entry, setEntry] = useState<ExamEntry | null>(null);
  useEffect(() => {
    if (!target) return;
    let live = true;
    loadExamEntries().then((es) => { if (live) setEntry(es.find((e) => e.id === target.exam) ?? null); }).catch(() => {});
    return () => { live = false; };
  }, [target]);
  if (!target) {
    return (
      <AsideCard title={t('asideExamTitle')} testId="aside-exam">
        <p className="muted fine">{t('tdNoExam')}</p>
        <Link className="btn btn--sm" to="/app/exam">{t('shellExamChoose')}</Link>
      </AsideCard>
    );
  }
  const paper = entry ? papersOf(entry, target)?.[section] : undefined;
  const facts: string[] = [];
  if (paper?.minutes) facts.push(t('shellExamMinutes', { n: paper.minutes }));
  if (paper?.marks) facts.push(t('shellExamMarks', { n: paper.marks }));
  if (paper?.exercises) facts.push(t('shellExamTasks', { n: paper.exercises }));
  if (paper?.items) facts.push(t('shellExamItems', { n: paper.items }));
  return (
    <AsideCard title={`${t('asideExamTitle')} · ${target.label}`} testId="aside-exam">
      <p className="aside-card__lead">
        <b>{t(SEC_LABEL[section])}</b>
        {paper && <span className="fr-inline" lang="fr" dir="ltr"> · {pick(paper.name, settings.ui).text}</span>}
      </p>
      {entry && !paper && <p className="muted fine">{t('shellExamNotVerified')}</p>}
      {facts.length > 0 && <p className="aside-card__facts">{facts.join(' · ')}</p>}
      {paper?.task && <p className="fine" dir="auto">{paper.task}</p>}
      {note && <p className="muted fine">{t(note)}</p>}
      <Link className="aside-card__link" to={`/app/exam/${target.id}/${section}`}>{t('asideExamOpen')} <Icon name="chevron" size={14} /></Link>
    </AsideCard>
  );
}

/** Words the learner saved from texts: the phrase, where it came from. */
export function SavedWordsCard({ limit = 6 }: { limit?: number }) {
  const { t } = useApp();
  const userId = useUserId();
  const [items, setItems] = useState<{ word: string; sentence?: string }[] | null>(null);
  useEffect(() => {
    let live = true;
    import('../../features/reader/store').then((m) => m.savedForUser(userId)).then((rows) => {
      if (!live) return;
      const words = rows.filter((r) => r.itemId.startsWith('word:')).sort((a, b) => b.savedAt - a.savedAt)
        .map((r) => ({ word: r.itemId.slice(5).split('@')[0] ?? '', sentence: r.context?.sentence }));
      setItems(words);
    }).catch(() => { if (live) setItems([]); });
    return () => { live = false; };
  }, [userId]);
  return (
    <AsideCard title={t('asideSavedTitle')} testId="aside-saved">
      {items === null && <div className="skeleton skeleton--text" />}
      {items !== null && items.length === 0 && <p className="muted fine">{t('asideSavedNone')}</p>}
      {items !== null && items.length > 0 && (
        <>
          <ul className="aside-words">
            {items.slice(0, limit).map((w) => (
              <li key={w.word + (w.sentence ?? '')}>
                <span className="aside-words__fr" lang="fr" dir="ltr">{w.word}</span>
                {w.sentence && <span className="aside-words__ctx" lang="fr" dir="ltr">{w.sentence}</span>}
              </li>
            ))}
          </ul>
          <p className="muted fine">{t('asideSavedCount', { n: items.length })}</p>
          <Link className="aside-card__link" to="/app/reading">{t('shellNavReading')} <Icon name="chevron" size={14} /></Link>
        </>
      )}
    </AsideCard>
  );
}

/** The concepts the learner gets wrong, each one a link into practice. */
export function WeakPointsCard({ limit = 4 }: { limit?: number }) {
  const { t } = useApp();
  const userId = useUserId();
  const [rows, setRows] = useState<ConceptStat[] | null>(null);
  const [byId, setById] = useState<Map<string, Concept>>(new Map());
  useEffect(() => {
    let live = true;
    Promise.all([weakPoints(userId), loadContent()]).then(([w, c]) => { if (live) { setRows(w); setById(c.conceptById); } }).catch(() => { if (live) setRows([]); });
    return () => { live = false; };
  }, [userId]);
  return (
    <AsideCard title={t('toWorkOn')} testId="aside-weak">
      {rows === null && <div className="skeleton skeleton--text" />}
      {rows !== null && rows.length === 0 && <p className="muted fine">{t('weakNone')}</p>}
      {rows !== null && rows.length > 0 && (
        <ul className="aside-list">
          {rows.slice(0, limit).map((w) => {
            const c = byId.get(w.conceptId);
            return (
              <li key={w.conceptId}>
                <Link to={`/app/cards?concept=${encodeURIComponent(w.conceptId)}`}>
                  {c ? <Localised field={c.name} /> : <span>{w.conceptId}</span>}
                  <span className="muted">{Math.round(w.accuracy * 100)} %</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </AsideCard>
  );
}

/** Today's plan and the step that comes next. */
export function PlanCard() {
  const { t } = useApp();
  const userId = useUserId();
  const plan = readPlan(userId);
  const next = plan ? nextStep(plan) : null;
  return (
    <AsideCard title={t('tdPlanTitle')} testId="aside-plan">
      {!plan && <p className="muted fine">{t('asidePlanNone')}</p>}
      {plan && (
        <>
          <p className="aside-card__facts">{t('tdPlanSteps', { n: plan.steps.length, m: minutesOf(plan) })}</p>
          <ol className="aside-steps">
            {plan.steps.map((s, i) => (
              <li key={s.kind} data-done={s.done || undefined}>
                <span className="aside-steps__n">{s.done ? '✓' : i + 1}</span>
                <Link to={s.to}>{s.fr ? <span lang="fr" dir="ltr">{s.fr}</span> : s.title}</Link>
              </li>
            ))}
          </ol>
          {next ? <Link className="btn btn--sm btn--primary" to={next.to}>{t('tdPlanContinue', { n: plan.steps.indexOf(next) + 1 })}</Link>
                : <p className="muted fine">{t('tdPlanAllDone')}</p>}
        </>
      )}
      {!plan && <Link className="btn btn--sm" to="/app/today">{t('today')}</Link>}
    </AsideCard>
  );
}

/** A study tip for this page, from the dictionary: the source line keeps it honest. */
export type TipId = 'reading' | 'writing' | 'cards' | 'verbs' | 'grammar' | 'exam' | 'themes' | 'search' | 'dialogues' | 'path' | 'progress';
export function TipCard({ id }: { id: TipId }) {
  const { t } = useApp();
  const key = `tip${id[0]!.toUpperCase()}${id.slice(1)}` as 'tipReading';
  return (
    <AsideCard title={t(`${key}Title` as 'tipReadingTitle')} testId={`aside-tip-${id}`}>
      <p className="fine" dir="auto">{t(`${key}Body` as 'tipReadingBody')}</p>
    </AsideCard>
  );
}

/** Seven bars, today on the end: how many cards were reviewed each day. */
export function WeekCard() {
  const { t } = useApp();
  const userId = useUserId();
  const [week, setWeek] = useState<Awaited<ReturnType<typeof weekSummary>> | null>(null);
  useEffect(() => {
    let live = true;
    weekSummary(userId, Date.now()).then((w) => { if (live) setWeek(w); }).catch(() => {});
    return () => { live = false; };
  }, [userId]);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    let label = '';
    try { label = new Intl.DateTimeFormat('fr', { weekday: 'narrow' }).format(d); } catch { /* no Intl */ }
    return { key, label, n: week?.byDay.get(key) ?? 0 };
  });
  const max = Math.max(1, ...days.map((d) => d.n));
  return (
    <section className="dash-card week" aria-labelledby="week-h" data-testid="week-card">
      <h2 id="week-h" className="dash-card__title">{t('tdWeek')}</h2>
      <p className="week__total"><b>{week?.reviews ?? 0}</b> {t('tdCards')}</p>
      <div className="week__bars" aria-hidden="true">
        {days.map((d) => (
          <span key={d.key} className="week__bar">
            <i style={{ height: `${Math.max(4, (d.n / max) * 100)}%` }} data-on={d.n > 0 || undefined} />
            <small lang="fr" dir="ltr">{d.label}</small>
          </span>
        ))}
      </div>
      <p className="week__sub">{t('tdDays', { n: week?.days ?? 0 })}</p>
    </section>
  );
}
