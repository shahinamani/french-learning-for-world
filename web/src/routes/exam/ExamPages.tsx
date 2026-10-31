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
import { ArrowUpRight, BookOpen, Ear, Mic, PenLine } from 'lucide-react';
import { useApp, useUserId } from '../../app-context';
import {
  TARGETS, loadExamEntries, papersOf, extraPapersOf, totalMinutes, passingOf, validityOf, targetById, useTarget, SECTIONS, SKILL_OF,
  type ExamEntry, type Paper, type SectionKey, type Target,
} from '../../lib/exam-targets';
import { loadPapers, pick, type ExamPaper } from '../../lib/exams';
import type { Dict } from '../../lib/i18n';
import { ErrorState } from '../../components/Search';
import { SECTION_LABEL, practiceFor } from '../app/PortalNav';

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
    <div className="page exam-page">
      <header className="exam-head">
        <h1 className="exam-title">{t('shellExamChoose')}</h1>
        <p className="exam-lede">{t('shellExamChooseLede')}</p>
      </header>
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
    return (
      <div className="page exam-page" data-testid={`exam-section-${sectionKey}`}>
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
          ) : (
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

        {free.length > 0 && (
          <section className="exam-block" aria-labelledby="sec-free">
            <h2 id="sec-free" className="exam-block__h">{t('shellExamFreeElsewhere')}</h2>
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
          </section>
        )}
      </div>
    );
  }

  // Overview.
  const total = verified ? totalMinutes(entry, target) : 0;
  // One row per official paper: DALF C2's two combined papers each serve two
  // sections, and are listed once, under the first section they serve.
  const seen = new Set<string>();
  const rows = SECTIONS.filter((k) => {
    const code = official?.[k]?.code;
    if (!code) return true;
    if (seen.has(code)) return false;
    seen.add(code); return true;
  });
  const passing = verified ? passingOf(entry, target) : null;
  const validity = verified ? validityOf(entry) : null;
  const caveat = entry.structure.caveat
    ? (typeof entry.structure.caveat === 'string' ? entry.structure.caveat : pick(entry.structure.caveat, ui).text) : null;
  return (
    <div className="page exam-page" data-testid="exam-overview">
      <header className="exam-head">
        <h1 className="exam-title">{target.label}</h1>
        <p className="exam-fr" lang="fr" dir="ltr">{entry.fullName}</p>
        <p className="exam-lede">{entry.owner}{verified && total > 0 ? `. ${t('shellExamTotal', { minutes: total })}.` : '.'}</p>
      </header>

      {!verified && <p className="exam-notice" data-testid="exam-not-verified">{t('shellExamNotVerified')}</p>}

      <section aria-labelledby="ov-sections">
        <h2 id="ov-sections" className="exam-block__h">{rows.length === 4 ? t('shellExamSections') : t('shellExamFormat')}</h2>
        <ol className="exam-sections">
          {rows.map((k) => {
            const p = official?.[k];
            const I = ICON[k];
            const n = bySection[k].length;
            return (
              <li key={k}>
                <Link to={`/app/exam/${target.id}/${k}`} className="exam-sec" data-testid={`exam-sec-${k}`}>
                  <span className="exam-sec__icon" aria-hidden="true"><I className="size-5" /></span>
                  <span className="exam-sec__name">
                    <span>{name(p, k)}</span>
                    {frName(p) && ui !== 'fr' && <span className="exam-sec__fr" lang="fr" dir="ltr">{frName(p)}</span>}
                  </span>
                  <span className="exam-sec__facts">{verified && p ? facts(p, t).join(' · ') : ''}</span>
                  <span className={n > 0 ? 'exam-sec__here' : 'exam-sec__here exam-sec__here--none'}>
                    {n > 0 ? t('shellExamQuestions', { n: bySection[k].reduce((m, x) => m + x.items.length, 0) }) : t('shellExamSoon')}
                  </span>
                </Link>
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

      {verified && (passing || entry.structure.scoring?.scale || validity) && (
        <section className="exam-block" aria-labelledby="ov-pass">
          <h2 id="ov-pass" className="exam-block__h">{t('shellExamPassing')}</h2>
          <ul className="exam-facts exam-facts--prose">
            {passing?.overall && <li>{passing.overall}</li>}
            {passing?.perPaper && <li>{passing.perPaper}</li>}
            {entry.structure.scoring?.scale && <li>{entry.structure.scoring.scale}</li>}
            {validity && <li>{validity}</li>}
          </ul>
        </section>
      )}

      {officialPages.length > 0 && (
        <section className="exam-block" aria-labelledby="ov-official">
          <h2 id="ov-official" className="exam-block__h">{t('shellExamOfficial')}</h2>
          <ul className="exam-rows">
            {officialPages.map((r) => (
              <li key={r.url}>
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="exam-row">
                  <span className="exam-row__name" lang={r.lang}>{r.title}</span>
                  <span className="exam-row__meta">{r.publisher}<ArrowUpRight className="size-4" aria-hidden="true" /></span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

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
    </div>
  );
}
