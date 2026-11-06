/**
 * The portal's two navigations: a sidebar from 1024px up, and a five-item bar
 * below it. Which one shows is CSS (display:none removes the other from the
 * accessibility tree), so there is only ever one set of links for assistive
 * technology.
 *
 * Redesign v1 (owner decision 2026-10-31): the portal is organised around the
 * learner's exam. The sidebar opens with an exam switcher; under it are that
 * exam's overview and its four sections, then the tools that build the
 * skills, then progress. Sections with no practice here say "not yet" on the
 * menu itself, so nobody discovers it by clicking.
 */
import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router';
import {
  BookOpen, ChevronDown, ClipboardCheck, Compass, Ear, Home, Layers, LineChart, Mic, PenLine,
  BookA, Clock3, FileText, MoreHorizontal, GraduationCap, Shapes, Library,
} from 'lucide-react';
import { useApp, useUserId } from '../../app-context';
import { Icon } from '../../components/Icon';
import { BottomSheet } from './BottomSheet';
import { ExamSwitcher } from '../../components/ExamSwitcher';
import {
  Sidebar as SidebarRoot, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from '../../components/ui/sidebar';
import { useTarget, SECTIONS, SKILL_OF, type SectionKey, type Target } from '../../lib/exam-targets';
import { loadPapers, type ExamPaper } from '../../lib/exams';
import type { Dict } from '../../lib/i18n';
import { FOOTER, type NavItem } from './nav';

export const SECTION_LABEL: Record<SectionKey, keyof Dict> =
  { co: 'shellExamSecCo', ce: 'shellExamSecCe', pe: 'shellExamSecPe', po: 'shellExamSecPo' };
const SECTION_ICON: Record<SectionKey, typeof Ear> = { co: Ear, ce: BookOpen, pe: PenLine, po: Mic };

/** Practice papers in this portal for a target, by section. */
export function practiceFor(papers: ExamPaper[] | null, target: Target | null) {
  const out: Record<SectionKey, ExamPaper[]> = { co: [], ce: [], pe: [], po: [] };
  if (!papers || !target) return { bySection: out, all: [] as ExamPaper[] };
  const mine = papers.filter((p) => p.exam === target.exam && (!target.level || p.level === target.level));
  for (const k of SECTIONS) out[k] = mine.filter((p) => p.skill === SKILL_OF[k]);
  return { bySection: out, all: mine };
}

function usePapers() {
  const [papers, setPapers] = useState<ExamPaper[] | null>(null);
  useEffect(() => { let live = true; loadPapers().then((p) => { if (live) setPapers(p); }).catch(() => {}); return () => { live = false; }; }, []);
  return papers;
}

/** Remembered per profile, in the profile's own namespace; every access can throw. */
const openKey = (userId: string) => `flw:u:${userId}:nav:free-open`;
function readOpen(userId: string): boolean {
  try { return localStorage.getItem(openKey(userId)) !== '0'; } catch { return true; }
}
function writeOpen(userId: string, open: boolean) {
  try { localStorage.setItem(openKey(userId), open ? '1' : '0'); } catch { /* private mode */ }
}

const SKILLS: { id: string; to: string; icon: typeof Ear; label: keyof Dict }[] = [
  { id: 'cards', to: '/app/cards', icon: Layers, label: 'cards' },
  { id: 'verbs', to: '/app/verbs', icon: Clock3, label: 'verbs' },
  { id: 'grammar', to: '/app/grammar', icon: BookA, label: 'grammar' },
  { id: 'reading', to: '/app/reading', icon: FileText, label: 'shellNavReading' },
  { id: 'writing', to: '/app/writing', icon: PenLine, label: 'shellNavWriting' },
];

export function Sidebar() {
  const { t } = useApp();
  const userId = useUserId();
  const { pathname } = useLocation();
  const [target] = useTarget(userId);
  const papers = usePapers();
  const { bySection, all } = practiceFor(papers, target);
  const [skillsOpen, setSkillsOpen] = useState(() => readOpen(userId));
  const insideSkills = SKILLS.some((i) => pathname.startsWith(i.to));
  const expanded = skillsOpen || insideSkills;
  const notYet = <span className="sb-badge--soon">{t('shellExamSoon')}</span>;

  return (
    <SidebarRoot className="sidebar" aria-label={t('shellSections')} data-testid="sidebar">
      <SidebarHeader><ExamSwitcher /></SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton to="/app/today" icon={<Home />} testId="nav-today">{t('today')}</SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>{target ? `${t('shellExamMy')} · ${target.label}` : t('shellExamMy')}</SidebarGroupLabel>
          <SidebarMenu>
            {target ? (
              <>
                <SidebarMenuItem>
                  <SidebarMenuButton to={`/app/exam/${target.id}`} end icon={<Compass />} testId="nav-exam-overview">
                    {t('shellExamOverview')}
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {SECTIONS.map((k) => {
                  const I = SECTION_ICON[k];
                  const n = bySection[k].length;
                  return (
                    <SidebarMenuItem key={k}>
                      <SidebarMenuButton to={`/app/exam/${target.id}/${k}`} icon={<I />} testId={`nav-exam-${k}`}
                                         badge={n > 0 ? n : notYet}>
                        {t(SECTION_LABEL[k])}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
                <SidebarMenuItem>
                  <SidebarMenuButton to="/app/exams" icon={<ClipboardCheck />} testId="nav-exams"
                                     badge={papers ? all.length || notYet : undefined}>
                    {t('shellExamPapers')}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </>
            ) : (
              <SidebarMenuItem>
                <SidebarMenuButton to="/app/exam" end icon={<GraduationCap />} testId="nav-exam-choose">
                  {t('shellExamChoose')}
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </SidebarGroup>

        {/* Themes and free resources (2026-11-06): what to study for the exam,
            and where to find more of it. */}
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton to="/app/themes" icon={<Shapes />} testId="nav-themes">{t('shellNavThemes')}</SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton to="/app/resources" icon={<Library />} testId="nav-resources">{t('shellNavResources')}</SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <button type="button" className="sb-group-toggle" aria-expanded={expanded} aria-controls="nav-free"
                  data-testid="nav-free-toggle"
                  onClick={() => { const next = !expanded; setSkillsOpen(next); writeOpen(userId, next); }}>
            <span>{t('shellExamBuildSkills')}</span>
            <ChevronDown className="size-4" data-open={expanded} aria-hidden="true" />
          </button>
          <SidebarMenu id="nav-free" hidden={!expanded} data-testid="nav-free">
            {SKILLS.map((i) => (
              <SidebarMenuItem key={i.id}>
                <SidebarMenuButton to={i.to} icon={<i.icon />} testId={`nav-${i.id}`}>{t(i.label)}</SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton to="/app/progress" icon={<LineChart />} testId="nav-progress">{t('progress')}</SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {FOOTER.map((i) => (
            <SidebarMenuItem key={i.id}>
              <SidebarMenuButton to={i.to} icon={<Icon name={i.icon} size={16} />} testId={`nav-${i.id}`} muted>
                {t(i.label)}
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarFooter>
    </SidebarRoot>
  );
}

type Sheet = null | 'exam' | 'learn' | 'more';

function SheetLink({ to, label, onNavigate, testId }: { to: string; label: string; onNavigate: () => void; testId: string }) {
  return (
    <NavLink to={to} className="tab" data-testid={testId} onClick={onNavigate} end>
      <span className="tab__in"><span>{label}</span></span>
    </NavLink>
  );
}

/** Today · My exam · Cards · Learn · More — exactly five (REDESIGN-v1 §4). */
export function MobileBar() {
  const { t } = useApp();
  const userId = useUserId();
  const { pathname } = useLocation();
  const [target] = useTarget(userId);
  const [sheet, setSheet] = useState<Sheet>(null);
  const opener = useRef<HTMLElement | null>(null);
  const openSheet = (which: Exclude<Sheet, null>) => (e: { currentTarget: HTMLElement }) => {
    opener.current = e.currentTarget; setSheet(which);
  };
  const close = () => setSheet(null);
  const inExam = pathname.startsWith('/app/exam');
  const inLearn = ['/app/themes', '/app/verbs', '/app/grammar', '/app/reading', '/app/writing'].some((p) => pathname.startsWith(p));
  const inMore = ['/app/resources', '/app/progress', '/app/path', '/account', '/about'].some((p) => pathname.startsWith(p));

  let items: { to: string; label: string; id: string }[] = [];
  if (sheet === 'exam') {
    items = target
      ? [{ to: `/app/exam/${target.id}`, label: t('shellExamOverview'), id: 'exam-overview' },
         ...SECTIONS.map((k) => ({ to: `/app/exam/${target.id}/${k}`, label: t(SECTION_LABEL[k]), id: `exam-${k}` })),
         { to: '/app/exams', label: t('shellExamPapers'), id: 'exams' },
         { to: '/app/exam', label: t('shellExamSwitch'), id: 'exam-choose' }]
      : [{ to: '/app/exam', label: t('shellExamChoose'), id: 'exam-choose' }];
  } else if (sheet === 'learn') {
    items = [{ to: '/app/themes', label: t('shellNavThemes'), id: 'themes' },
      ...SKILLS.filter((s) => s.id !== 'cards').map((s) => ({ to: s.to, label: t(s.label), id: s.id }))];
  } else if (sheet === 'more') {
    items = [{ to: '/app/resources', label: t('shellNavResources'), id: 'resources' },
      { to: '/app/progress', label: t('progress'), id: 'progress' }, { to: '/app/path', label: t('shellNavPath'), id: 'path' },
      ...FOOTER.map((i: NavItem) => ({ to: i.to, label: t(i.label), id: i.id }))];
  }
  const title = sheet === 'exam' ? (target ? target.label : t('shellExamChoose'))
    : sheet === 'learn' ? t('shellSheetLearn') : t('shellSheetMore');

  return (
    <>
      <nav className="tabs" aria-label={t('shellQuickNav')} data-testid="mobile-bar">
        <NavLink to="/app/today" className="tab" data-testid="mbar-today">
          <span className="tab__in"><Home className="size-5" aria-hidden="true" /><span>{t('today')}</span></span>
        </NavLink>
        <button className={`tab${inExam ? ' active' : ''}`} aria-haspopup="dialog" data-testid="mbar-exam"
                aria-current={inExam ? 'page' : undefined} onClick={openSheet('exam')}>
          <span className="tab__in"><GraduationCap className="size-5" aria-hidden="true" /><span>{t('shellExamMy')}</span></span>
        </button>
        <NavLink to="/app/cards" className="tab" data-testid="mbar-review">
          <span className="tab__in"><Layers className="size-5" aria-hidden="true" /><span>{t('shellNavReview')}</span></span>
        </NavLink>
        <button className={`tab${inLearn ? ' active' : ''}`} aria-haspopup="dialog" data-testid="mbar-learn"
                aria-current={inLearn ? 'page' : undefined} onClick={openSheet('learn')}>
          <span className="tab__in"><BookOpen className="size-5" aria-hidden="true" /><span>{t('learn')}</span></span>
        </button>
        <button className={`tab${inMore ? ' active' : ''}`} aria-haspopup="dialog" data-testid="mbar-more"
                aria-current={inMore ? 'page' : undefined} onClick={openSheet('more')}>
          <span className="tab__in"><MoreHorizontal className="size-5" aria-hidden="true" /><span>{t('shellNavMore')}</span></span>
        </button>
      </nav>

      <BottomSheet open={sheet !== null} onOpenChange={(o) => { if (!o) close(); }}
                   title={title} testId="nav-sheet" returnFocusTo={opener}>
        <ul className="sheet__list">
          {items.map((i) => (
            <li key={i.id}><SheetLink to={i.to} label={i.label} onNavigate={close} testId={`sheet-${i.id}`} /></li>
          ))}
        </ul>
      </BottomSheet>
    </>
  );
}

/** A slim photograph of France at the top of each list page, with the
 *  section's name in French. Study pages (a card, a text, an exam paper)
 *  have none: nothing should sit between the learner and the French.
 *  French as content, the same in every interface language. */
const BANNERS: { match: RegExp; photo: string; size: number; fr: string }[] = [
  { match: /^\/app\/verbs\/?$/, photo: 'bouquinistes', size: 900, fr: 'Les verbes' },
  { match: /^\/app\/grammar\/?$/, photo: 'bookshelves', size: 900, fr: 'La grammaire' },
  { match: /^\/app\/reading\/?$/, photo: 'terrace', size: 900, fr: 'La lecture' },
  { match: /^\/app\/exams\/?$/, photo: 'flag-balcony', size: 900, fr: 'Les sujets d’entraînement' },
  { match: /^\/app\/exam(\/[a-z0-9-]+)?\/?$/, photo: 'flag-balcony', size: 900, fr: 'Mon examen' },
  { match: /^\/app\/themes\/?$/, photo: 'market', size: 900, fr: 'Les thèmes' },
  { match: /^\/app\/resources\/?$/, photo: 'bouquinistes', size: 900, fr: 'Les ressources gratuites' },
  { match: /^\/app\/progress\/?$/, photo: 'montmartre', size: 800, fr: 'Mes progrès' },
  { match: /^\/app\/path\/?$/, photo: 'market', size: 900, fr: 'Mon parcours' },
];

export function RouteBanner() {
  const { pathname } = useLocation();
  const b = BANNERS.find((x) => x.match.test(pathname));
  if (!b) return null;
  return (
    <div className="fr-banner" aria-hidden="true">
      <img src={`photos/${b.photo}-${b.size}.webp`} alt="" width={b.size} height={Math.round(b.size * 0.75)} />
      <span className="fr-banner__shade" />
      <span className="fr-banner__fr" lang="fr" dir="ltr">{b.fr}</span>
    </div>
  );
}
