/**
 * The portal's two navigations: a grouped sidebar from 1024px up, and a
 * five-item bar below it. Which one shows is CSS (display:none removes the
 * other from the accessibility tree), so there is only ever one set of links
 * for assistive technology.
 *
 * Every icon sits inside a link or button that has a visible text label, or
 * carries an aria-label. The Icon itself is aria-hidden; the name belongs to
 * the control.
 */
import { useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router';
import { useApp, useUserId } from '../../app-context';
import { Icon } from '../../components/Icon';
import { BottomSheet } from './BottomSheet';
import {
  CARDS, DISCOVER_GROUP, FOOTER, FREE_GROUP, LEARN_SHEET, MORE_SHEET, PATH, SAVED, TODAY,
  EXAMS, PROGRESS, type NavItem,
} from './nav';

function Link({ it, onNavigate, prefix = 'nav' }: { it: NavItem; onNavigate?: () => void; prefix?: string }) {
  const { t } = useApp();
  return (
    <NavLink to={it.to} className="tab" data-testid={`${prefix}-${it.id}`} onClick={onNavigate}
             end={it.to === '/'}>
      <span className="tab__in"><Icon name={it.icon} /><span>{t(it.label)}</span></span>
    </NavLink>
  );
}

/** Remembered per profile, in the profile's own namespace; every access can throw. */
const openKey = (userId: string) => `flw:u:${userId}:nav:free-open`;
function readOpen(userId: string): boolean {
  try { return localStorage.getItem(openKey(userId)) !== '0'; } catch { return true; }
}
function writeOpen(userId: string, open: boolean) {
  try { localStorage.setItem(openKey(userId), open ? '1' : '0'); } catch { /* private mode */ }
}

export function Sidebar() {
  const { t } = useApp();
  const userId = useUserId();
  const { pathname } = useLocation();
  const [freeOpen, setFreeOpen] = useState(() => readOpen(userId));
  // A page inside the group must never be hidden by the group being collapsed:
  // the learner would be somewhere the navigation cannot show.
  const insideFree = FREE_GROUP.some((i) => pathname.startsWith(i.to));
  const expanded = freeOpen || insideFree;

  return (
    <nav className="sidebar" aria-label={t('shellSections')} data-testid="sidebar">
      <div className="sidebar__main">
        <Link it={TODAY} />
        <Link it={PATH} />

        <div className="nav-group">
          <button className="nav-group__head" aria-expanded={expanded} aria-controls="nav-free"
                  data-testid="nav-free-toggle"
                  onClick={() => { const next = !expanded; setFreeOpen(next); writeOpen(userId, next); }}>
            <span>{t('shellGroupFree')}</span>
            <span className="nav-group__chev" data-open={expanded}><Icon name="chevrondown" size={16} /></span>
          </button>
          <div id="nav-free" hidden={!expanded} data-testid="nav-free">
            {FREE_GROUP.map((i) => <Link key={i.id} it={i} />)}
          </div>
        </div>

        <div className="nav-group">
          <p className="nav-group__head nav-group__head--static">{t('shellGroupDiscover')}</p>
          {DISCOVER_GROUP.map((i) => <Link key={i.id} it={i} />)}
        </div>

        <Link it={EXAMS} />
        <Link it={SAVED} />
        <Link it={PROGRESS} />
      </div>

      <div className="sidebar__foot">
        {FOOTER.map((i) => <Link key={i.id} it={i} />)}
      </div>
    </nav>
  );
}

type Sheet = null | 'learn' | 'more';

/** امروز · یادگیری · مرور · ذخیره‌ها · بیشتر — exactly five. */
export function MobileBar() {
  const { t } = useApp();
  const { pathname } = useLocation();
  const [sheet, setSheet] = useState<Sheet>(null);
  const opener = useRef<HTMLElement | null>(null);
  const openSheet = (which: Exclude<Sheet, null>) => (e: { currentTarget: HTMLElement }) => {
    opener.current = e.currentTarget; setSheet(which);
  };
  const close = () => setSheet(null);
  const inLearn = LEARN_SHEET.some((i) => pathname.startsWith(i.to) && i !== CARDS);
  const inMore = MORE_SHEET.some((i) => pathname.startsWith(i.to)) || pathname === '/account' || pathname === '/about';

  const sheetItems = sheet === 'learn' ? LEARN_SHEET : [...MORE_SHEET, ...FOOTER];
  return (
    <>
      <nav className="tabs" aria-label={t('shellQuickNav')} data-testid="mobile-bar">
        <NavLink to={TODAY.to} className="tab" data-testid="mbar-today">
          <span className="tab__in"><Icon name={TODAY.icon} /><span>{t('today')}</span></span>
        </NavLink>
        <button className={`tab${inLearn ? ' active' : ''}`} aria-haspopup="dialog" data-testid="mbar-learn"
                aria-current={inLearn ? 'page' : undefined} onClick={openSheet('learn')}>
          <span className="tab__in"><Icon name="learn" /><span>{t('learn')}</span></span>
        </button>
        <NavLink to={CARDS.to} className="tab" data-testid="mbar-review">
          <span className="tab__in"><Icon name={CARDS.icon} /><span>{t('shellNavReview')}</span></span>
        </NavLink>
        <NavLink to={SAVED.to} className="tab" data-testid="mbar-saved">
          <span className="tab__in"><Icon name={SAVED.icon} /><span>{t('shellNavSavedShort')}</span></span>
        </NavLink>
        <button className={`tab${inMore ? ' active' : ''}`} aria-haspopup="dialog" data-testid="mbar-more"
                aria-current={inMore ? 'page' : undefined} onClick={openSheet('more')}>
          <span className="tab__in"><Icon name="more" /><span>{t('shellNavMore')}</span></span>
        </button>
      </nav>

      <BottomSheet open={sheet !== null} onOpenChange={(o) => { if (!o) close(); }}
                   title={sheet === 'learn' ? t('shellSheetLearn') : t('shellSheetMore')} testId="nav-sheet" returnFocusTo={opener}>
        <ul className="sheet__list">
          {sheetItems.map((i) => (
            <li key={i.id}><Link it={i} onNavigate={close} prefix="sheet" /></li>
          ))}
        </ul>
      </BottomSheet>
    </>
  );
}
