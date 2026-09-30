// The end-of-session chime, synthesised in the browser.
//
// No audio file is shipped. A sound file would mean bytes to download on a
// phone, a format to support everywhere, and — the reason that actually
// decided it — a licence to verify and record. Two sine tones with a decay
// envelope need none of that, weigh nothing, and work offline.

let ctx = null;

function context() {
  const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  return ctx;
}

/**
 * Browsers only allow audio later if it was primed by a real gesture first.
 * Priming is resuming the context inside the click that starts the timer:
 * inaudible now, and permitted an hour from now.
 */
export async function unlock() {
  const ac = context();
  if (!ac) return false;
  try {
    if (ac.state === 'suspended') await ac.resume();
    return ac.state === 'running';
  } catch { return false; }
}

function tone(ac, startAt, freq, duration, peak) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, startAt);
  // Exponential decay: a struck bell, not a buzzer.
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(peak, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.05);
}

/** Two descending tones, ~1.4s. Throws if audio is unavailable or blocked. */
export async function playChime() {
  const ac = context();
  if (!ac) throw new Error('Web Audio is unavailable');
  if (ac.state === 'suspended') await ac.resume();
  if (ac.state !== 'running') throw new Error('Audio is blocked');
  const t = ac.currentTime;
  tone(ac, t, 880, 1.1, 0.22);          // A5
  tone(ac, t + 0.18, 587.33, 1.25, 0.2); // D5
}
