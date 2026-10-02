/**
 * A learner's profile id is permanent, and this is the expensive thing to get
 * wrong.
 *
 * Every review row, card state and setting is keyed to it. When email accounts
 * arrive, an existing learner attaches an address to the profile they already
 * have and keeps every row — but only if the id they were given on their first
 * visit is the id they still have. Regenerate it once and six months of history
 * is orphaned in a store nothing reads any more, and the learner is told
 * nothing, because from the app's point of view they are simply new.
 *
 * So the rule, asserted here rather than remembered: `resolveActiveProfile`
 * creates an id **only** when the browser holds no profile at all. Every other
 * path resolves to one that already exists.
 *
 * The resolution order also matters on a shared laptop:
 *   1. what this TAB selected       (sessionStorage — two tabs, two learners)
 *   2. what this BROWSER last used  (localStorage — survives a restart)
 *   3. the first profile            (a browser that has one but no pointer)
 *   4. create                       (a genuinely new browser)
 *
 * Without step 2, a restart resumed whichever profile was created first, so the
 * second person on a shared machine was silently handed the first person's
 * history — and "they should never be asked who they are" became "they are
 * never asked, and sometimes they are someone else".
 */
import test from 'node:test';
import assert from 'node:assert/strict';

/** A browser's storage, enough of it to drive the module under test. */
function fakeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
    _map: map,
  };
}

function withBrowser(local, session, fn) {
  const g = globalThis;
  const had = { w: g.window, l: g.localStorage, s: g.sessionStorage };
  g.window = {};
  g.localStorage = local;
  g.sessionStorage = session;
  try { return fn(); } finally {
    g.window = had.w; g.localStorage = had.l; g.sessionStorage = had.s;
  }
}

const load = async () => {
  // Fresh module each time: the module must hold no mutable state of its own.
  const m = await import(`../web/src/lib/session.ts?t=${Math.random()}`);
  return m;
};

test('a brand-new browser gets exactly one profile', async () => {
  const local = fakeStorage(), session = fakeStorage();
  const { resolveActiveProfile, listProfiles } = await load();
  const a = withBrowser(local, session, () => resolveActiveProfile());
  const b = withBrowser(local, session, () => resolveActiveProfile());
  assert.equal(a.id, b.id, 'a second resolve created a second id');
  assert.equal(withBrowser(local, session, () => listProfiles()).length, 1);
});

test('the id survives a browser restart — sessionStorage gone, localStorage kept', async () => {
  const local = fakeStorage();
  const { resolveActiveProfile } = await load();
  const first = withBrowser(local, fakeStorage(), () => resolveActiveProfile());
  // A restart: a NEW sessionStorage, the same localStorage.
  const after = withBrowser(local, fakeStorage(), () => resolveActiveProfile());
  assert.equal(after.id, first.id,
    'a restart produced a different id — every review row would be orphaned');
});

test('a restart resumes the profile last used, not the first created', async () => {
  const local = fakeStorage();
  const { resolveActiveProfile, createProfile, setActiveProfileId } = await load();
  const first = withBrowser(local, fakeStorage(), () => resolveActiveProfile());
  const second = withBrowser(local, fakeStorage(), () => {
    const p = createProfile('Second learner');
    setActiveProfileId(p.id);
    return p;
  });
  assert.notEqual(first.id, second.id);
  const after = withBrowser(local, fakeStorage(), () => resolveActiveProfile());
  assert.equal(after.id, second.id,
    'the second person on a shared laptop was handed the first person\'s history');
});

test('two tabs can be two different learners at the same time', async () => {
  const local = fakeStorage();
  const tabA = fakeStorage(), tabB = fakeStorage();
  const { resolveActiveProfile, createProfile, setActiveProfileId } = await load();
  const a = withBrowser(local, tabA, () => resolveActiveProfile());
  const b = withBrowser(local, tabB, () => {
    const p = createProfile('Other');
    setActiveProfileId(p.id);
    return resolveActiveProfile();
  });
  assert.notEqual(a.id, b.id);
  // Tab A must be unaffected by what tab B chose.
  assert.equal(withBrowser(local, tabA, () => resolveActiveProfile()).id, a.id,
    'selecting a profile in one tab changed the other tab');
});

test('every storage key carries the user id, and a missing id throws', async () => {
  const { userKey } = await load();
  assert.equal(userKey('abc', 'settings'), 'flw:u:abc:settings');
  assert.throws(() => userKey('', 'settings'), /without a user id/,
    'a key without a user id is how one learner sees another\'s progress');
});

test('the creation path is the only one that mints an id — proved by removing it', async () => {
  // The control arm: with a profile already in localStorage, resolving must not
  // call createProfile at all. If it ever does, the two ids differ.
  const local = fakeStorage();
  const { resolveActiveProfile, listProfiles } = await load();
  withBrowser(local, fakeStorage(), () => resolveActiveProfile());
  const before = withBrowser(local, fakeStorage(), () => listProfiles()).length;
  for (let i = 0; i < 5; i++) withBrowser(local, fakeStorage(), () => resolveActiveProfile());
  const after = withBrowser(local, fakeStorage(), () => listProfiles()).length;
  assert.equal(after, before, `resolving five times created ${after - before} extra profile(s)`);
});
