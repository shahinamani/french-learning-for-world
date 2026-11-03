/**
 * The study timer's panel, opened from the clock in the top bar.
 *
 * A ring shows the time left and empties as it runs; under it the five
 * durations the owner chose (2026-11-02), a start button and the chime
 * switch. Loaded only when the panel opens, so the top bar stays light.
 */
import { useApp } from '../app-context';
import { Icon } from './Icon';
import { PRESETS } from '../lib/timer';

type Props = {
  clock: string;
  running: boolean;
  /** 0–1: the share of the chosen time still left. */
  left: number;
  selected: number;
  onSelect: (m: number) => void;
  onStart: () => void;
  onStop: () => void;
};

const R = 52;
const C = 2 * Math.PI * R;

export default function TimerPanel({ clock, running, left, selected, onSelect, onStart, onStop }: Props) {
  const { t, settings, update } = useApp();
  return (
    <div className="tp">
      <header className="tp__head">
        <span className="tp__title"><Icon name="timer" size={18} /> {t('timer')}</span>
        <button type="button" className={`tp__sound${settings.sound ? ' is-on' : ''}`} aria-pressed={settings.sound}
                data-testid="timer-sound" onClick={() => update({ sound: !settings.sound })}>
          <Icon name={settings.sound ? 'sound' : 'mute'} size={16} />
          <span>{settings.sound ? t('soundOn') : t('soundOff')}</span>
        </button>
      </header>

      <div className="tp__dial" aria-hidden="true">
        <svg viewBox="0 0 120 120" width="148" height="148">
          <circle className="tp__track" cx="60" cy="60" r={R} />
          <circle className="tp__arc" cx="60" cy="60" r={R}
                  strokeDasharray={C} strokeDashoffset={C * (1 - Math.max(0, Math.min(1, left)))}
                  transform="rotate(-90 60 60)" />
        </svg>
        <div className="tp__time">
          <b dir="ltr">{clock}</b>
          <span>{running ? t('shellTimerRunning') : t('minutes', { n: selected })}</span>
        </div>
      </div>

      <div className="tp__presets" role="group" aria-label={t('timer')}>
        {PRESETS.map((m) => (
          <button key={m} type="button" className="tp__preset" aria-pressed={selected === m} disabled={running}
                  data-testid={`preset-${m}`} onClick={() => onSelect(m)}>
            <b>{m}</b><span>{t('shellTimerMin')}</span>
          </button>
        ))}
      </div>

      <div className="tp__actions">
        <button type="button" className="tp__start" data-testid="timer-start" onClick={running ? onStop : onStart}>
          <Icon name={running ? 'pause' : 'play'} size={16} /> {running ? t('pause') : t('start')}
        </button>
        <button type="button" className="tp__reset" onClick={onStop}>{t('reset')}</button>
      </div>
      <p className="tp__note">{settings.sound ? t('shellTimerChimeNote') : t('shellTimerSilentNote')}</p>
    </div>
  );
}
