/**
 * `parseExport` against input nobody meant to give it.
 *
 * It is the only parser in this product that reads a file a learner supplies,
 * and restore is the single recovery path there is — clearing site data
 * destroys a review log irrecoverably, so the import is what stands between a
 * new laptop and six months of work. `CHECKLIST.md` listed it as the only
 * untested parser; this is that gap.
 *
 * What these assert is the contract: a bad file produces a NAMED error or a
 * filtered result, never an exception the caller cannot classify, never a
 * silent acceptance of a row that will corrupt a learner's statistics, and
 * never unbounded work.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseExport, exportRows, EXPORT_FORMAT, EXPORT_VERSION,
  MAX_IMPORT_BYTES, MAX_IMPORT_ROWS, MAX_IMPORT_CARDS,
} from '../web/src/lib/export-format.ts';

/** A file this product would itself produce. */
const good = (over = {}) => JSON.stringify({
  format: EXPORT_FORMAT, version: EXPORT_VERSION,
  exportedAt: '2026-10-08T00:00:00.000Z',
  rows: [{ id: 'r1', cardKey: 'v:etre', reviewedAt: 1, grade: 3, conceptIds: ['c.a'] }],
  cards: [{ cardKey: 'v:etre', dueAt: 2, stability: 1, reps: 1 }],
  ...over,
});

/** The error code, or null if it did not throw. */
const codeOf = (text) => {
  try { parseExport(text); return null; } catch (e) { return e.message; }
};

test('a file this product produced round-trips', () => {
  const rows = [{ userId: 'u', id: 'r1', cardKey: 'k', reviewedAt: 5, grade: 3, conceptIds: ['c'] }];
  const states = [{ cardKey: 'k', dueAt: 9, stability: 2, reps: 1 }];
  const out = parseExport(exportRows(rows, states));
  assert.equal(out.rows.length, 1);
  assert.equal(out.cards.length, 1);
  assert.equal(out.version, EXPORT_VERSION);
  assert.ok(!('userId' in out.rows[0]), 'the export must not carry a user id');
});

/* ── Malformed ────────────────────────────────────────────────────────── */

test('input that is not JSON is named, not thrown raw', () => {
  for (const bad of ['', '   ', 'not json', '{', '[1,2', '\0\0\0', '<html></html>']) {
    assert.equal(codeOf(bad), 'notJson', JSON.stringify(bad.slice(0, 12)));
  }
});

test('JSON that is not our object is named', () => {
  for (const bad of ['null', '[]', '"a string"', '42', 'true', '{}', '{"format":"other"}']) {
    assert.equal(codeOf(bad), 'notOurs', bad);
  }
});

test('a version we cannot read is named separately from a foreign file', () => {
  const v = (version) => codeOf(good({ version }));
  assert.equal(v(EXPORT_VERSION + 1), 'version', 'a newer file we cannot understand');
  assert.equal(v(0), 'version');
  assert.equal(v(-1), 'version');
  assert.equal(v('abc'), 'version');
  assert.equal(v(null), 'version');
  assert.equal(v(1), null, 'an older version we can still read');
});

test('missing or wrongly-typed collections degrade to empty, not to a throw', () => {
  for (const over of [{ rows: null }, { rows: 'x' }, { rows: {} }, { cards: 7 }]) {
    const out = parseExport(good(over));
    assert.ok(Array.isArray(out.rows) && Array.isArray(out.cards));
  }
});

/* ── Rows and cards that would poison the record ──────────────────────── */

test('a row missing any required field is dropped', () => {
  const rows = [
    { cardKey: 'k', reviewedAt: 1, conceptIds: [] },                    // no id
    { id: 'a', reviewedAt: 1, conceptIds: [] },                         // no cardKey
    { id: 'b', cardKey: 'k', conceptIds: [] },                          // no reviewedAt
    { id: 'c', cardKey: 'k', reviewedAt: 1 },                           // no conceptIds
    { id: 'd', cardKey: 'k', reviewedAt: 'soon', conceptIds: [] },      // wrong type
    { id: 5, cardKey: 'k', reviewedAt: 1, conceptIds: [] },             // wrong type
    null, undefined, 'a string', 42, [],
  ];
  assert.equal(parseExport(good({ rows })).rows.length, 0);
});

test('Infinity, which JSON can express as 1e400, is not a timestamp', () => {
  const out = parseExport(good({
    rows: [{ id: 'r', cardKey: 'k', reviewedAt: 1e400, conceptIds: [] }],
    cards: [{ cardKey: 'k', dueAt: 1e400 }],
  }));
  assert.equal(out.rows.length, 0, 'Infinity passed Number.isFinite');
  assert.equal(out.cards.length, 0);
});

test('conceptIds must be strings, or the weakness model fills with junk keys', () => {
  // progress.conceptStats() uses every entry of conceptIds as a Map key. A
  // number, an object or a nested array becomes "[object Object]" or "1" and is
  // then indistinguishable from a real concept on the progress screen.
  const out = parseExport(good({
    rows: [{ id: 'r', cardKey: 'k', reviewedAt: 1, conceptIds: [{ a: 1 }, 7, ['x'], null, 'c.real'] }],
  }));
  assert.equal(out.rows.length, 1, 'the row itself is salvageable');
  assert.deepEqual(out.rows[0].conceptIds, ['c.real'],
    'only the string ids survive — the rest would become junk concepts');
});

test('a card without a usable key or due date is dropped', () => {
  const cards = [
    { dueAt: 1 }, { cardKey: 'k' }, { cardKey: 5, dueAt: 1 },
    { cardKey: 'k', dueAt: 'tomorrow' }, null, 'x',
  ];
  assert.equal(parseExport(good({ cards })).cards.length, 0);
});

/* ── Hostile ──────────────────────────────────────────────────────────── */

test('__proto__ in the file does not reach Object.prototype', () => {
  const payload = `{"format":${JSON.stringify(EXPORT_FORMAT)},"version":${EXPORT_VERSION},
    "__proto__":{"polluted":"yes"},
    "rows":[{"id":"r","cardKey":"k","reviewedAt":1,"conceptIds":[],"__proto__":{"polluted":"yes"}}],
    "cards":[]}`;
  const out = parseExport(payload);
  assert.equal({}.polluted, undefined, 'Object.prototype was polluted');
  assert.equal(({}).constructor, Object);
  assert.ok(out.rows.length <= 1);
});

test('a constructor key is data, not a constructor', () => {
  const payload = good({ rows: [{ id: 'r', cardKey: 'k', reviewedAt: 1, conceptIds: [], constructor: 'x' }] });
  assert.doesNotThrow(() => parseExport(payload));
});

test('absurd strings are carried or dropped, never executed or expanded', () => {
  const long = 'x'.repeat(200_000);
  const out = parseExport(good({
    rows: [{ id: long, cardKey: long, reviewedAt: 1, conceptIds: [long] }],
  }));
  assert.equal(out.rows.length, 1);
  assert.equal(out.rows[0].id.length, 200_000, 'no truncation that would change a key');
});

/* ── Oversized ────────────────────────────────────────────────────────── */

test('a very large but valid file is parsed in reasonable time', () => {
  const rows = Array.from({ length: 50_000 }, (_, i) =>
    ({ id: `r${i}`, cardKey: 'k', reviewedAt: i, grade: 3, conceptIds: ['c'] }));
  const text = good({ rows });
  const started = Date.now();
  const out = parseExport(text);
  const ms = Date.now() - started;
  assert.equal(out.rows.length, 50_000);
  assert.ok(ms < 10_000, `took ${ms} ms — parsing is not the bottleneck it is claimed to be`);
  console.log(`    50 000 rows (${(text.length / 1e6).toFixed(1)} MB) parsed in ${ms} ms`);
});

test('deeply nested input does not blow the stack', () => {
  // 50 000 levels. JSON.parse is recursive in most engines; if it throws, the
  // contract is that the caller still gets a NAMED error rather than a
  // RangeError escaping to the UI.
  const deep = `{"format":${JSON.stringify(EXPORT_FORMAT)},"version":${EXPORT_VERSION},`
    + `"rows":[],"cards":[],"junk":${'['.repeat(50_000)}${']'.repeat(50_000)}}`;
  const code = codeOf(deep);
  assert.ok(code === null || code === 'notJson',
    `a nesting bomb produced "${code}" — it must be null or a named error`);
});

test('a grade that is present but is not a grade drops its row', () => {
  // progress.conceptStats() does `r.grade >= 3` and `r.grade === 1`. A STRING
  // "4" satisfies the first by coercion, so a hostile or corrupt file can move
  // a learner's accuracy without ever being a valid grade.
  const row = (grade) => ({ id: `r${String(grade)}`, cardKey: 'k', reviewedAt: 1, grade, conceptIds: [] });
  const out = parseExport(good({ rows: [row('4'), row(9), row(-1), row(1.5), row(null), row({}), row(3)] }));
  assert.deepEqual(out.rows.map((r) => r.grade), [3]);
});

test('grade 0 is kept, because the row type has always allowed it', () => {
  // No code writes 0 today, but ReviewRow permits it, so a backup from an older
  // build may carry it. Rejecting it would discard real history on the only
  // path that exists to recover history — the fault this work is preventing.
  const out = parseExport(good({
    rows: [{ id: 'z', cardKey: 'k', reviewedAt: 1, grade: 0, conceptIds: [] }],
  }));
  assert.equal(out.rows.length, 1);
  assert.equal(out.rows[0].grade, 0);
});

test('a row with no grade at all is kept, not silently dropped', () => {
  const out = parseExport(good({
    rows: [{ id: 'nograde', cardKey: 'k', reviewedAt: 1, conceptIds: ['c'] }],
  }));
  assert.equal(out.rows.length, 1, 'an older export without the field is still real history');
});

/* ── Bounds ───────────────────────────────────────────────────────────────
 *
 * "3.9 MB parses in 13 ms" was a SPEED measurement on a laptop and was wrong to
 * read as a safety one. The import path allocates the whole file as a string,
 * then the parsed graph, then writes every row inside one IndexedDB
 * transaction — none of which a 3.9 MB benchmark says anything about on a phone.
 */

test('the limits are stated, and are above any history this app can produce', () => {
  // ~800 bytes per row, measured from exportRows with realistic rows.
  assert.equal(MAX_IMPORT_BYTES, 50 * 1024 * 1024);
  assert.ok(MAX_IMPORT_ROWS >= 100_000, 'the row cap must not cut off a real learner');
  const yearsAtTenADay = MAX_IMPORT_ROWS / (10 * 365);
  assert.ok(yearsAtTenADay > 20, `${yearsAtTenADay.toFixed(0)} years at ten reviews a day`);
});

test('a file over the byte limit is refused before it is parsed', () => {
  // The string is built, not parsed: this asserts the guard fires on length
  // alone, which is what protects the step that would allocate the graph.
  const oversized = `{"format":${JSON.stringify(EXPORT_FORMAT)},"junk":"`
    + 'x'.repeat(MAX_IMPORT_BYTES) + '"}';
  assert.equal(codeOf(oversized), 'tooLarge');
});

test('the byte boundary is exact', () => {
  const pad = (bytes) => {
    const base = `{"format":${JSON.stringify(EXPORT_FORMAT)},"version":${EXPORT_VERSION},"rows":[],"cards":[],"j":""}`;
    return base.replace('"j":""', `"j":"${'x'.repeat(Math.max(0, bytes - base.length))}"`);
  };
  const under = pad(MAX_IMPORT_BYTES - 10);
  assert.ok(under.length <= MAX_IMPORT_BYTES);
  assert.equal(codeOf(under), null, 'a file just under the limit is accepted');
  const over = pad(MAX_IMPORT_BYTES + 100);
  assert.ok(over.length > MAX_IMPORT_BYTES);
  assert.equal(codeOf(over), 'tooLarge', 'a file just over the limit is refused');
});

test('a minified file with too many records is refused on the record cap', () => {
  // The byte cap alone would admit roughly twice as many rows from a minified
  // file, and every row becomes an awaited write inside one transaction.
  const rows = Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => ({ id: `r${i}` }));
  const text = JSON.stringify({ format: EXPORT_FORMAT, version: EXPORT_VERSION, rows, cards: [] });
  assert.ok(text.length < MAX_IMPORT_BYTES, 'this file is under the byte cap, so only the record cap can stop it');
  assert.equal(codeOf(text), 'tooLarge');
});

test('too many card states is refused too', () => {
  const cards = Array.from({ length: MAX_IMPORT_CARDS + 1 }, (_, i) => ({ cardKey: `c${i}`, dueAt: 1 }));
  const text = JSON.stringify({ format: EXPORT_FORMAT, version: EXPORT_VERSION, rows: [], cards });
  assert.equal(codeOf(text), 'tooLarge');
});

test('A LARGE BUT LEGITIMATE HISTORY STILL IMPORTS', () => {
  // The failure that would matter most: a cap that refuses a real backup. This
  // is five years at thirty reviews a day, written the way this app writes it.
  const n = 54_750;
  const rows = Array.from({ length: n }, (_, i) => ({
    id: `01JA5${String(i).padStart(21, '0')}`, cardKey: 'v:se_souvenir',
    reviewedAt: 1760000000000 + i, grade: 3, conceptIds: ['verb.tense.present'],
  }));
  const text = JSON.stringify({ format: EXPORT_FORMAT, version: EXPORT_VERSION, rows, cards: [] });
  const out = parseExport(text);
  assert.equal(out.rows.length, n, 'a five-year history must not be refused');
  console.log(`    ${n} rows (${(text.length / 1e6).toFixed(1)} MB minified) accepted`);
});

test('the limits do not narrow which historical formats are valid', () => {
  // Version 1 still reads, rows without a grade still read, grade 0 still
  // reads. The bounds are about size, and must not have quietly become a
  // stricter schema.
  const old = JSON.stringify({
    format: EXPORT_FORMAT, version: 1,
    rows: [{ id: 'a', cardKey: 'k', reviewedAt: 1, conceptIds: [] },
           { id: 'b', cardKey: 'k', reviewedAt: 2, grade: 0, conceptIds: [] }],
    cards: [{ cardKey: 'k', dueAt: 1 }],
  });
  const out = parseExport(old);
  assert.equal(out.version, 1);
  assert.equal(out.rows.length, 2);
  assert.equal(out.cards.length, 1);
});
