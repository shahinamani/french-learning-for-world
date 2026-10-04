/**
 * Unreviewed is the default, and the Arabic slot is open and empty.
 *
 * The glosses have carried an unreviewed marker since 2026-10-02 and said so on
 * the page. **The exercises carried nothing**, while eight of them — written by
 * a machine, from a machine's own knowledge of French grammar, checked by
 * nobody — were live in the product. That was an inconsistency in the project's
 * own standard, not a difference between the two kinds of content.
 *
 * So: an exercise EARNS the removal of its marker. It does not start without
 * one. `state: "unreviewed"` is what generated content is born with, and only a
 * person reviewing it changes that.
 *
 * And every item carries an Arabic SLOT — present, and `null`. The distinction
 * these checks exist to hold:
 *
 *   "ar": "…"   a person wrote Arabic
 *   "ar": null  the slot exists and nobody has filled it
 *   (absent)    nobody has thought about Arabic at all
 *
 * The shape guard in i18n-four-languages.test.js counts non-empty strings, so
 * it cannot tell the second from the third — it reads both as "ar: HELD". That
 * is why this file exists: Arabic is a launch condition, and a held slot is a
 * backlog item while an absent key is an oversight nobody can see.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const papers = read('content/exam-papers.json');
const items = papers.papers.flatMap((p) => p.items.map((i) => ({ ...i, paper: p.id })));

test('every exercise carries a review marker', () => {
  const bad = [];
  for (const it of items) {
    if (!it.review) { bad.push(`${it.paper}/${it.id}: no review marker`); continue; }
    if (!['unreviewed', 'approved', 'rejected'].includes(it.review.state)) {
      bad.push(`${it.paper}/${it.id}: state ${it.review.state}`);
    }
    // Approved means a person said so, and the record has to name them.
    if (it.review.state === 'approved' && (!it.review.by || !it.review.at)) {
      bad.push(`${it.paper}/${it.id}: approved with no reviewer or date`);
    }
    if (it.review.state === 'unreviewed' && (it.review.by || it.review.at)) {
      bad.push(`${it.paper}/${it.id}: unreviewed yet carries a reviewer`);
    }
  }
  assert.deepEqual(bad, []);
  const by = items.reduce((m, i) => ({ ...m, [i.review.state]: (m[i.review.state] ?? 0) + 1 }), {});
  console.log(`    ${items.length} exercises: ${JSON.stringify(by)}`);
});

test('generated content is born unreviewed, and nothing has earned otherwise yet', () => {
  // When this fails because something is approved, that is the system working —
  // update the count and name who approved it.
  const approved = items.filter((i) => i.review.state === 'approved');
  assert.deepEqual(approved.map((i) => `${i.id} by ${i.review.by}`), [],
    'an item is approved; record who and when, then update this check');
  assert.equal(items.filter((i) => i.review.state === 'unreviewed').length, items.length);
});

test('the file states that unreviewed is the default, in words', () => {
  assert.match(papers.reviewNote, /default for anything generated/i);
  assert.match(papers.reviewNote, /earns/i);
});

test('every item has an Arabic slot, present and empty', () => {
  // Present: so the backlog is visible the day a reviewer appears.
  // Empty: because Arabic is not machine-filled and will not be.
  const missing = [], filled = [];
  for (const it of items) {
    for (const field of ['prompt', 'explain']) {
      if (!it[field]) continue;
      if (!('ar' in it[field])) missing.push(`${it.paper}/${it.id}.${field}`);
      else if (it[field].ar !== null) filled.push(`${it.paper}/${it.id}.${field}`);
    }
    if (it.stimulus && typeof it.stimulus.label === 'object' && it.stimulus.label) {
      if (!('ar' in it.stimulus.label)) missing.push(`${it.paper}/${it.id}.stimulus.label`);
    }
  }
  assert.deepEqual(missing, [],
    'an item has no Arabic slot at all, which reads as nobody having thought about it');
  assert.deepEqual(filled, [],
    'Arabic has been filled in. If a person wrote it, say so here and record the '
    + 'reviewer; if a machine wrote it, remove it — the product claims four languages '
    + 'and machine-filling the fourth is the claim without the substance');
  console.log(`    ${items.length} items, ${items.length * 2} Arabic slots, all open`);
});

test('the Arabic gap is the size the project thinks it is', () => {
  // A number rather than an impression: every exercise in the product is three
  // languages of a four-language claim.
  const three = items.filter((i) => i.prompt?.ar === null && i.explain?.ar === null);
  assert.equal(three.length, items.length,
    `${three.length} of ${items.length} items are three languages of a four-language claim`);
});
