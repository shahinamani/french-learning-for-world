import { useEffect, useState } from 'react';
/**
 * Study timer. Nothing decrements: starting it records when it ends, and the
 * display is always the distance to that moment. A locked phone or a throttled
 * tab cannot make an hour quietly become ninety minutes.
 *
 * Namespaced per user, because two profiles in two tabs must not share a timer.
 */
import { userKey } from './session';

export const PRESETS = [5, 15, 30, 45, 60] as const;

export type Restored =
  | { state: 'none' }
  | { state: 'running'; endsAt: number; durationMin: number; remainingSec: number }
  | { state: 'finishedWhileAway'; durationMin: number };

const safely = <T,>(fn: () => T, fallback: T): T => { try { return fn(); } catch { return fallback; } };

export const formatClock = (seconds: number): string => {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
};

export const remainingSeconds = (endsAt: number, now: number) =>
  Math.max(0, Math.round((endsAt - now) / 1000));

/** Fired whenever the timer is written or cleared, so the bar picks up a timer
 *  a session started without waiting for the next poll. `storage` covers the
 *  other tabs; this covers this one, which `storage` deliberately does not. */
export const TIMER_EVENT = 'flw:timer';
const announce = () => safely(() => window.dispatchEvent(new Event(TIMER_EVENT)), undefined);

export function save(userId: string, endsAt: number, durationMin: number) {
  safely(() => localStorage.setItem(userKey(userId, 'timer'), JSON.stringify({ endsAt, durationMin })), undefined);
  announce();
}
export function clear(userId: string) {
  safely(() => localStorage.removeItem(userKey(userId, 'timer')), undefined);
  announce();
}
export function restore(userId: string, now: number): Restored {
  const raw = safely(() => localStorage.getItem(userKey(userId, 'timer')), null);
  const parsed = raw ? safely(() => JSON.parse(raw), null) : null;
  if (!parsed || !Number.isFinite(parsed.endsAt) || !Number.isFinite(parsed.durationMin)) return { state: 'none' };
  const remaining = remainingSeconds(parsed.endsAt, now);
  if (remaining <= 0) { clear(userId); return { state: 'finishedWhileAway', durationMin: parsed.durationMin }; }
  return { state: 'running', endsAt: parsed.endsAt, durationMin: parsed.durationMin, remainingSec: remaining };
}

/** The finish never depends on the sound. A blocked chime still finishes. */
export async function announceFinish(play?: () => Promise<void> | void) {
  if (typeof play !== 'function') return { finished: true, soundPlayed: false };
  try { await play(); return { finished: true, soundPlayed: true }; }
  catch { return { finished: true, soundPlayed: false }; }
}

/** Two sine tones. No audio file: no bytes, no format question, no licence. */
export async function chime(): Promise<void> {
  const Ctor = (globalThis as { AudioContext?: typeof AudioContext }).AudioContext;
  if (!Ctor) throw new Error('no audio');
  const ac = new Ctor();
  if (ac.state === 'suspended') await ac.resume();
  if (ac.state !== 'running') throw new Error('audio blocked');
  const tone = (freq: number, at: number, dur: number, peak: number) => {
    const osc = ac.createOscillator(), gain = ac.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(freq, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(at); osc.stop(at + dur + 0.05);
  };
  const t = ac.currentTime;
  tone(880, t, 1.1, 0.22);
  tone(587.33, t + 0.18, 1.25, 0.2);
}

/**
 * A 250 ms tick, for anything that has to re-render against the wall clock.
 * Deliberately NOT a wrapper around `restore`: `restore` clears the timer when
 * it expires so the finish is reported once (the chime must not fire twice),
 * which means a second consumer polling it would race the first and lose.
 * Whoever needs "is it over" holds its own end time and compares it to now.
 */
export function useTick(ms = 250): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
  return tick;
}
