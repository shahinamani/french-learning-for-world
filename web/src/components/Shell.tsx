/**
 * The portal shell: top bar with the timer pill, the grouped sidebar (from
 * 1024 px), the five-item mobile bar (below it), and the routed page under a
 * breadcrumb and a global search. The route map and the reasons for it are
 * docs/blueprint/CONTRACTS-v0.2.md section 1; the tables are routes/app/nav.ts.
 */
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router';
import { hasStarted } from '../lib/started';
import * as Popover from '@radix-ui/react-popover';
import { useApp, useUserId } from '../app-context';
import { Icon } from './Icon';
import { SidePanel } from './SidePanel';
import { Sidebar, MobileBar } from '../routes/app/PortalNav';
import { TopLine } from '../routes/app/TopLine';
import { PRESETS, TIMER_EVENT, formatClock, remainingSeconds, restore, save, clear, announceFinish, chime } from '../lib/timer';

export function Shell({ prerenderChild }: { prerenderChild?: ReactNode } = {}) {
  const { t, settings, update } = useApp();
  const userId = useUserId();
  const navigate = useNavigate();
  const location = useLocation();
  // The landing page is the only screen where the study chrome is wrong, and it
  // is identified by its route rather than by asking the page: `/` shows the
  // dashboard to somebody who has studied here, and they should keep the timer.
  const onLanding = (location.pathname === '/' || location.pathname === '') && !hasStarted();
  // Persian and Arabic have no portal-navigation copy: the labels are English,
  // and the page says so rather than showing English as if it were theirs.
  const labelsTranslated = settings.ui === 'en' || settings.ui === 'fr';
  const [timerOpen, setTimerOpen] = useState(false);
  const [timer, setTimer] = useState<{ endsAt: number; durationMin: number; running: boolean }>(
    { endsAt: 0, durationMin: 15, running: false });
  const [finished, setFinished] = useState<null | 'done' | 'silent' | 'away'>(null);
  const [clock, setClock] = useState('15:00');
  const [selected, setSelected] = useState(15);
  const finishedOnce = useRef(false);

  // Restored per user, after mount. A timer belonging to another profile in
  // another tab is invisible here because the key carries the user id.
  useEffect(() => {
    const r = restore(userId, Date.now());
    if (r.state === 'running') { setTimer({ endsAt: r.endsAt, durationMin: r.durationMin, running: true }); setSelected(r.durationMin); }
    else if (r.state === 'finishedWhileAway') { setFinished('away'); setSelected(r.durationMin); }
  }, [userId]);

  // Adopt a timer started elsewhere — a `?minutes=N` session in this tab, or
  // another tab of this profile — the moment it is written, not on the next
  // poll. Polling alone left the pill showing its 15:00 default while the
  // session counted down, which is exactly the disagreement this is meant to
  // make impossible.
  useEffect(() => {
    const adopt = () => {
      const r = restore(userId, Date.now());
      if (r.state !== 'running') return;
      finishedOnce.current = false;
      setTimer({ endsAt: r.endsAt, durationMin: r.durationMin, running: true });
      setSelected(r.durationMin);
      setClock(formatClock(remainingSeconds(r.endsAt, Date.now())));
    };
    window.addEventListener(TIMER_EVENT, adopt);
    window.addEventListener('storage', adopt);
    return () => { window.removeEventListener(TIMER_EVENT, adopt); window.removeEventListener('storage', adopt); };
  }, [userId]);

  useEffect(() => {
    const id = setInterval(() => {
      if (!timer.running) {
        // A session started with `?minutes=N` writes the timer to storage. Adopt
        // it, so the pill shows the same countdown the session is running on —
        // and so a second tab of this profile picks it up too.
        const r = restore(userId, Date.now());
        if (r.state === 'running') {
          finishedOnce.current = false;
          setTimer({ endsAt: r.endsAt, durationMin: r.durationMin, running: true });
          setSelected(r.durationMin);
          return;
        }
        setClock(formatClock(selected * 60)); return;
      }
      const left = remainingSeconds(timer.endsAt, Date.now());
      setClock(formatClock(left));
      if (left <= 0 && !finishedOnce.current) {
        finishedOnce.current = true;
        setTimer((s) => ({ ...s, running: false }));
        clear(userId);
        void announceFinish(settings.sound ? chime : undefined)
          .then((o) => setFinished(settings.sound && !o.soundPlayed ? 'silent' : 'done'));
      }
    }, 250);
    return () => clearInterval(id);
  }, [timer, selected, userId, settings.sound]);

  // ⌘K / Ctrl-K from anywhere. Search is a route, so this is a navigation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); navigate('/app/search'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  const start = () => {
    const endsAt = Date.now() + selected * 60_000;
    finishedOnce.current = false;
    setTimer({ endsAt, durationMin: selected, running: true });
    setFinished(null);
    save(userId, endsAt, selected);
    if (settings.sound) void chime().catch(() => {});   // prime audio in the gesture
  };
  const stop = () => { setTimer({ endsAt: 0, durationMin: selected, running: false }); clear(userId); };

  return (
    <div className="shell">
      <a className="skip" href="#main">{t('skipToContent')}</a>

      <header className="bar">
        <div className="bar-in">
          <NavLink to="/app/today" className="brand" aria-label={t('appName')}>
            <span className="brand-mark" aria-hidden="true">Fr</span>
            <span className="brand-name">{t('appName')}</span>
          </NavLink>
          <div className="bar-actions">
            {/* The study timer is hidden on the landing page. A stranger who has
                just arrived and does not yet know what this site is was being
                shown a 15:00 countdown next to the name — furniture from a
                study session they have not started, on the one screen that has
                to explain itself. It returns the moment they are inside.
                Found in a screenshot; no automated check would have called it
                wrong, because a correctly rendered timer is a correct timer. */}
            {!onLanding && (
            <>
            {/* Radix Popover, not a hand-rolled panel. The hand-rolled one had no
                Escape, no close on an outside click and no focus management: you
                could open it, tab straight past it into the page, and never get
                it shut from the keyboard. */}
            <Popover.Root open={timerOpen} onOpenChange={setTimerOpen}>
              <Popover.Trigger asChild>
                <button className={`pill${timer.running ? ' is-running' : ''}`} data-testid="timer-pill">
                  <Icon name="timer" size={18} />
                  <span className="pill-clock" data-testid="timer-clock">{clock}</span>
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content className="timer-panel" data-testid="timer-panel"
                                 aria-label={t('timer')} sideOffset={8} align="end" collisionPadding={8}>
            <div className="presets">
              {PRESETS.map((m) => (
                <button key={m} className="preset" aria-pressed={selected === m} disabled={timer.running}
                        data-testid={`preset-${m}`} onClick={() => setSelected(m)}>{m}m</button>
              ))}
            </div>
            <div className="row gap-2">
              <button className="btn btn--primary btn--sm" data-testid="timer-start"
                      onClick={() => (timer.running ? stop() : start())}>
                {timer.running ? t('pause') : t('start')}
              </button>
              <button className="btn btn--ghost btn--sm" onClick={stop}>{t('reset')}</button>
              <button className="icon-btn" aria-pressed={settings.sound} data-testid="timer-sound"
                      aria-label={settings.sound ? t('soundOn') : t('soundOff')}
                      onClick={() => update({ sound: !settings.sound })}>
                <Icon name={settings.sound ? 'sound' : 'mute'} />
              </button>
            </div>
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
            </>
            )}
            <NavLink to="/account" className="icon-btn" data-testid="settings-link">
              <Icon name="settings" /><span className="u-hidden-visually">{t('settings')}</span>
            </NavLink>
          </div>
        </div>


        {finished && (
          <div className="finished" role="status" data-testid="timer-finished">
            <span>{finished === 'away' ? t('timerAway') : finished === 'silent' ? t('timerDoneSilent') : t('timerDone')}</span>
            <button className="btn btn--ghost btn--sm" data-testid="timer-dismiss" onClick={() => setFinished(null)}>
              {t('dismiss')}
            </button>
          </div>
        )}
      </header>

      <main id="main" key={location.pathname}>
        {!onLanding && <TopLine />}
        {!onLanding && !labelsTranslated && (
          <p className="muted topline__note" data-testid="shell-untranslated">{t('shellUntranslated')}</p>
        )}
        {prerenderChild ?? <Outlet />}
      </main>

      {/* One navigation per width. On the landing page there is no sidebar:
          a stranger has no portal to navigate yet. */}
      {!onLanding && <Sidebar />}
      <MobileBar />

      <SidePanel />
    </div>
  );
}
