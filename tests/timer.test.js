import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../app/timer.js';

const NOW = Date.parse('2026-01-01T12:00:00Z');

function fakeStorage(initial = {}) {
  const map = { ...initial };
  return {
    getItem: (k) => (k in map ? map[k] : null),
    setItem: (k, v) => { map[k] = String(v); },
    removeItem: (k) => { delete map[k]; },
  };
}
const throwingStorage = {
  getItem() { throw new Error('site data blocked'); },
  setItem() { throw new Error('quota exceeded'); },
  removeItem() { throw new Error('site data blocked'); },
};

test('presets run from ten minutes to one hour', () => {
  assert.deepEqual([...T.PRESETS_MIN], [10, 15, 20, 30, 45, 60]);
});

test('the hour preset is labelled 1h, not 60m', () => {
  assert.equal(T.presetLabel(60), '1h');
  assert.equal(T.presetLabel(45), '45m');
});

test('the clock crosses from 1:00:00 to 59:59, never 60:00', () => {
  assert.equal(T.formatClock(3600), '1:00:00');
  assert.equal(T.formatClock(3599), '59:59');
  assert.equal(T.formatClock(600), '10:00');
  assert.equal(T.formatClock(5), '0:05');
});

test('the clock never shows a negative time', () => {
  assert.equal(T.formatClock(-90), '0:00');
  assert.equal(T.remainingSeconds(NOW, NOW + 10_000), 0);
});

test('remaining time is unaffected by a tab that stopped being painted', () => {
  const endsAt = NOW + 3600_000;
  // Whether polled every 250ms or not at all, the answer is the distance to
  // the end — this is the whole reason nothing decrements a counter.
  assert.equal(T.remainingSeconds(endsAt, NOW + 1800_000), 1800);
  assert.equal(T.remainingSeconds(endsAt, NOW + 3599_000), 1);
});

test('a running timer is restored after a reload', () => {
  const s = fakeStorage();
  T.saveTimer(NOW + 600_000, 10, s);
  const r = T.restore(NOW + 60_000, s);
  assert.equal(r.state, 'running');
  assert.equal(r.remainingSec, 540);
  assert.equal(r.durationMin, 10);
});

test('a timer whose moment passed while away reports that it finished', () => {
  const s = fakeStorage();
  T.saveTimer(NOW + 600_000, 10, s);
  const r = T.restore(NOW + 900_000, s);
  assert.equal(r.state, 'finishedWhileAway');
  assert.equal(r.durationMin, 10);
  assert.equal(T.readTimer(s), null, 'and clears itself so it reports once');
});

test('anything stored that is not a timer is ignored', () => {
  for (const junk of ['not json', '{}', '[]', '{"endsAt":"soon"}', 'null', '{"durationMin":10}']) {
    assert.equal(T.readTimer(fakeStorage({ [T.TIMER_KEY]: junk })), null, junk);
  }
});

test('a timer that cannot remember itself still runs', () => {
  assert.equal(T.restore(NOW, throwingStorage).state, 'none');
  assert.doesNotThrow(() => T.saveTimer(NOW, 10, throwingStorage));
  assert.doesNotThrow(() => T.clearTimer(throwingStorage));
  assert.doesNotThrow(() => T.writeSoundPreference(true, throwingStorage));
});

test('an unset sound preference follows the system reduced-motion setting', () => {
  assert.equal(T.readSoundPreference(true, fakeStorage()), false);
  assert.equal(T.readSoundPreference(false, fakeStorage()), true);
});

test('an explicit sound choice overrides the system default', () => {
  assert.equal(T.readSoundPreference(true, fakeStorage({ [T.SOUND_KEY]: 'on' })), true);
  assert.equal(T.readSoundPreference(false, fakeStorage({ [T.SOUND_KEY]: 'off' })), false);
});

test('the session finishes whatever the chime does', async () => {
  assert.deepEqual(await T.announceFinish(() => {}), { finished: true, soundPlayed: true });
  assert.deepEqual(await T.announceFinish(async () => {}), { finished: true, soundPlayed: true });
  assert.deepEqual(await T.announceFinish(() => { throw new Error('NotAllowedError'); }),
    { finished: true, soundPlayed: false });
  assert.deepEqual(await T.announceFinish(() => Promise.reject(new Error('blocked'))),
    { finished: true, soundPlayed: false });
  assert.deepEqual(await T.announceFinish(undefined), { finished: true, soundPlayed: false });
});
