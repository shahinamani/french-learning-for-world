import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const exams = JSON.parse(readFileSync(new URL('../content/exams.json', import.meta.url), 'utf8'));
const decks = JSON.parse(readFileSync(new URL('../content/decks.json', import.meta.url), 'utf8'))
  .decks.map((d) => JSON.parse(readFileSync(new URL(`../content/${d.file}`, import.meta.url), 'utf8')));
const cards = decks.flatMap((d) => d.cards);
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const SKILLS = ['listening', 'reading', 'writing', 'speaking', 'general'];
const KINDS = ['exam-body', 'broadcaster', 'institutional', 'open'];
const all = exams.exams.flatMap((e) => e.resources);

test('the four examinations are present, with unique ids', () => {
  const codes = exams.exams.map((e) => e.code);
  assert.deepEqual([...codes].sort(), ['DALF', 'DELF', 'TCF', 'TEF']);
  assert.equal(new Set(exams.exams.map((e) => e.id)).size, 4);
});

test('every examination names the body that administers it', () => {
  // Naming the owner is what makes "we are not them" a checkable statement
  // rather than a disclaimer nobody can act on.
  for (const e of exams.exams) {
    assert.ok(e.owner?.trim(), `${e.code} has no owner`);
    assert.ok(e.fullName?.trim(), `${e.code} has no full name`);
  }
});

test('DELF covers A1–B2 and DALF covers C1–C2', () => {
  const byId = Object.fromEntries(exams.exams.map((e) => [e.id, e]));
  assert.deepEqual(byId.delf.levels, ['A1', 'A2', 'B1', 'B2']);
  assert.deepEqual(byId.dalf.levels, ['C1', 'C2']);
});

test('every declared level is a real CEFR level', () => {
  for (const e of exams.exams) {
    for (const lv of e.levels) assert.ok(LEVELS.includes(lv), `${e.code}: ${lv}`);
    assert.ok(e.levels.length > 0, `${e.code} covers no levels`);
  }
});

test('every link is https — never plain http on a page that teaches trust', () => {
  for (const r of all) {
    assert.match(r.url, /^https:\/\//, `${r.title}: ${r.url}`);
  }
});

test('every link declares a title, publisher, skill and kind', () => {
  for (const r of all) {
    assert.ok(r.title?.trim(), `${r.url}: no title`);
    assert.ok(r.publisher?.trim(), `${r.url}: no publisher`);
    assert.ok(SKILLS.includes(r.skill), `${r.url}: skill ${r.skill}`);
    assert.ok(KINDS.includes(r.kind), `${r.url}: kind ${r.kind}`);
  }
});

test('each examination links to its own body, not only to third parties', () => {
  for (const e of exams.exams) {
    const own = e.resources.filter((r) => r.kind === 'exam-body');
    assert.ok(own.length >= 1, `${e.code} has no link to the examination body itself`);
  }
});

test('each examination offers material for all four tested skills', () => {
  // The examinations test listening, reading, writing and speaking. A portal
  // that only links listening and reading quietly leaves half the exam
  // unprepared for, which is the kind of gap a learner discovers on the day.
  for (const e of exams.exams) {
    for (const skill of ['listening', 'reading', 'writing', 'speaking']) {
      assert.ok(e.resources.some((r) => r.skill === skill), `${e.code}: nothing for ${skill}`);
    }
  }
});

test('the productive skills link to the examination body, not only to free sites', () => {
  // Only the body itself is authoritative about what the written and spoken
  // papers actually ask for.
  for (const e of exams.exams) {
    for (const skill of ['writing', 'speaking']) {
      assert.ok(e.resources.some((r) => r.skill === skill && r.kind === 'exam-body'),
        `${e.code}: no official source for ${skill}`);
    }
  }
});

test('no link points at this project pretending to be an outside source', () => {
  for (const r of all) {
    assert.doesNotMatch(r.url, /french-learning-for-world/, r.url);
  }
});

test('no exam entry claims affiliation, endorsement or a certificate', () => {
  // The single largest legal risk in this feature is a sentence that reads as
  // if the portal were connected to a ministry, or could get someone a
  // diploma. It is cheaper to forbid the words than to argue about them.
  const forbidden = /\b(official partner|in partnership with|accredited|endorsed by|certified by|we issue|obtain your (certificate|diploma)|guaranteed pass)\b/i;
  const text = JSON.stringify(exams.exams);
  assert.doesNotMatch(text, forbidden);
});

test('the disclaimer states independence, trademark use and that nothing is copied', () => {
  const d = exams.disclaimer.toLowerCase();
  for (const phrase of ['independent', 'trademark', 'copied']) {
    assert.ok(d.includes(phrase), `disclaimer does not mention "${phrase}"`);
  }
});

test('a check date is only ever present when links were actually checked', () => {
  // null is the honest value until scripts/check-links.sh has run and passed.
  assert.ok(exams.checkedOn === null || /^\d{4}-\d{2}-\d{2}$/.test(exams.checkedOn),
    `checkedOn must be null or YYYY-MM-DD, got ${JSON.stringify(exams.checkedOn)}`);
});

test('every level that has cards is reachable from at least one examination', () => {
  const covered = new Set(exams.exams.flatMap((e) => e.levels));
  for (const level of new Set(cards.map((c) => c.level))) {
    assert.ok(covered.has(level), `cards exist at ${level} but no examination lists it`);
  }
});

test('no duplicate link within one skill of one examination', () => {
  // The same page may legitimately appear under two skills — an exam body's
  // page describes both the written and the spoken paper — but listing it
  // twice under the same heading is a mistake.
  for (const e of exams.exams) {
    for (const skill of new Set(e.resources.map((r) => r.skill))) {
      const urls = e.resources.filter((r) => r.skill === skill).map((r) => r.url);
      assert.equal(new Set(urls).size, urls.length, `${e.code} repeats a link under ${skill}`);
    }
  }
});

test('a link listed under two skills says something different each time', () => {
  for (const e of exams.exams) {
    const byUrl = new Map();
    for (const r of e.resources) {
      if (!byUrl.has(r.url)) byUrl.set(r.url, new Set());
      byUrl.get(r.url).add(r.title);
    }
    for (const [url, titles] of byUrl) {
      const times = e.resources.filter((r) => r.url === url).length;
      assert.equal(titles.size, times, `${e.code}: ${url} is listed ${times}× with ${titles.size} distinct titles`);
    }
  }
});
