/**
 * The shell: session rail, top bar with the timer pill, the routed page, and
 * four bottom tabs. Account and About live behind the settings control — at
 * 320 px a fifth tab costs every other tab its label.
 */
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router';
import { useApp, useUserId } from '../app-context';
import { Icon } from './Icon';
import { SidePanel } from './SidePanel';
import { PRESETS, formatClock, remainingSeconds, restore, save, clear, announceFinish, chime } from '../lib/timer';

const TABS = [
  { to: '/learn', icon: 'learn', key: 'learn' },
  { to: '/practise/review', icon: 'practise', key: 'practise' },
  { to: '/progress', icon: 'progress', key: 'progress' },
  { to: '/search', icon: 'search', key: 'search' },
] as const;

export function Shell({ prerenderChild }: { prerenderChild?: ReactNode } = {}) {
  const { t, settings, update } = useApp();
  const userId = useUserId();
  const navigate = useNavigate();
  const location = useLocation();
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
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); navigate('/search'); }
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
      <a className="skip" href="#main">Skip to content</a>

      <header className="bar">
        <div className="bar-in">
          <NavLink to="/learn" className="brand" aria-label={t('appName')}>
            <span className="brand-mark" aria-hidden="true">Fr</span>
            <span className="brand-name">{t('appName')}</span>
          </NavLink>
          <div className="bar-actions">
            <button className={`pill${timer.running ? ' is-running' : ''}`} data-testid="timer-pill"
                    aria-expanded={timerOpen} onClick={() => setTimerOpen((v) => !v)}>
              <Icon name="timer" size={18} />
              <span className="pill-clock" data-testid="timer-clock">{clock}</span>
            </button>
            <NavLink to="/account" className="icon-btn" data-testid="settings-link">
              <Icon name="settings" /><span className="u-hidden-visually">{t('settings')}</span>
            </NavLink>
          </div>
        </div>

        {timerOpen && (
          <section className="timer-panel" aria-label={t('timer')} data-testid="timer-panel">
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
          </section>
        )}
        {finished && (
          <div className="finished" role="status" data-testid="timer-finished">
            <span>{finished === 'away' ? t('timerAway') : finished === 'silent' ? t('timerDoneSilent') : t('timerDone')}</span>
            <button className="btn btn--ghost btn--sm" data-testid="timer-dismiss" onClick={() => setFinished(null)}>
              {t('dismiss')}
            </button>
          </div>
        )}
      </header>

      <main id="main" key={location.pathname}>{prerenderChild ?? <Outlet />}</main>

      <nav className="tabs" aria-label={t('mainNav')}>
        {TABS.map((tab) => (
          <NavLink key={tab.key} to={tab.to} className="tab" data-testid={`tab-${tab.key}`}
                   aria-current={undefined}>
            {({ isActive }) => (
              <span className="tab__in" aria-selected={isActive} role="presentation">
                <Icon name={tab.icon} /><span>{t(tab.key)}</span>
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <SidePanel />
    </div>
  );
}
