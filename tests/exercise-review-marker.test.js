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

test('an uncertain item says how sure and what the doubt is', () => {
  // A comment would not survive the round trip through the review tool, so the
  // doubt is a field. Structured because the kinds are reviewed differently:
  // "contested among native speakers" and "a prescriptive rule widely violated"
  // need different judgements from a teacher, and a flagged item is where a
  // reviewer's six minutes are worth most.
  const KINDS = ['contested-usage', 'prescriptive-rule-widely-violated',
                 'register-unsure', 'regional-variation', 'other'];
  const flagged = items.filter((i) => i.uncertain);
  assert.ok(flagged.length >= 2,
    'no item is flagged uncertain. Two of the first eight were written with real '
    + 'doubt, and hiding that until item 90 is the thing this field prevents');
  for (const it of flagged) {
    assert.ok(['low', 'medium'].includes(it.uncertain.confidence), it.id);
    assert.ok(KINDS.includes(it.uncertain.kind), `${it.id}: kind ${it.uncertain.kind}`);
    assert.ok((it.uncertain.doubt || '').length > 80,
      `${it.id}: the doubt must say what the doubt IS, not that there is one`);
    // An item flagged uncertain cannot also be approved without a note saying
    // the doubt was resolved: that is the whole point of flagging it.
    if (it.review.state === 'approved') {
      assert.ok(it.review.note, `${it.id} was approved while flagged uncertain and no note says why`);
    }
  }
  console.log(`    ${flagged.length} of ${items.length} items flagged uncertain: `
    + flagged.map((i) => `${i.id} (${i.uncertain.kind})`).join(', '));
});

test('the answers are not clustered at one position', () => {
  // THE SYSTEMATIC FAULT BATCH ONE FOUND, in itself. The first draft of its
  // twenty items had every answer at position 0 — because writing the correct
  // option first is the convenient way to write an item — so a learner who
  // always picked the first option would have scored 20/20. It teaches the
  // strategy and measures nothing.
  //
  // Found after 20 items rather than after 150, which is the whole argument for
  // drafting in batches.
  const byPaper = {};
  for (const it of items) {
    (byPaper[it.paper] ??= []).push(it.answer);
  }
  const bad = [];
  for (const [paper, answers] of Object.entries(byPaper)) {
    if (answers.length < 8) continue;        // too few to say anything
    const counts = answers.reduce((m, a) => ({ ...m, [a]: (m[a] ?? 0) + 1 }), {});
    const worst = Math.max(...Object.values(counts));
    // A fair set of n items over 4 positions puts about n/4 at each. Half of
    // them at one position is a pattern a learner can exploit.
    if (worst > answers.length / 2) {
      bad.push(`${paper}: ${worst} of ${answers.length} answers at one position `
        + `(${JSON.stringify(counts)})`);
    }
  }
  assert.deepEqual(bad, []);
  for (const [paper, answers] of Object.entries(byPaper)) {
    if (answers.length < 8) continue;
    console.log(`    ${paper}: ${answers.length} items, positions `
      + JSON.stringify(answers.reduce((m, a) => ({ ...m, [a]: (m[a] ?? 0) + 1 }), {})));
  }
});

test('a batch flags what its writer was unsure of', () => {
  // Shahin's instruction: include cases I am NOT sure about and mark them, so
  // disagreement is learned early rather than found at item 90.
  const batch = items.filter((i) => i.paper === 'tcf-b2-structure-2');
  assert.equal(batch.length, 20);
  const flagged = batch.filter((i) => i.uncertain);
  assert.ok(flagged.length >= 2,
    `${flagged.length} of 20 flagged — a batch with no doubt in it is a batch whose `
    + 'doubts were not written down');
  console.log(`    batch one: ${flagged.length} of 20 flagged — `
    + flagged.map((i) => i.id).join(', '));
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

test('every drafted item records the one rule it rests on', () => {
  // **Flagging is blind to confident error.** An item whose writer was unsure
  // carries `uncertain`; an item whose writer was confidently wrong carries
  // nothing — and when several items rest on one wrong rule they fail together,
  // silently. b1-agr-1 to -4 all turn on direct-versus-indirect object: if
  // « se parler » and « se rencontrer » are the wrong way round, four items are
  // wrong at once and no flag would show it.
  const rules = read('content/item-rules.json').rules;
  const drafted = items.filter((i) => /^(b1|b2)-/.test(i.id));
  assert.ok(drafted.length >= 28, `${drafted.length} drafted items`);
  const bad = [];
  for (const it of drafted) {
    if (!it.rule) { bad.push(`${it.id}: no rule`); continue; }
    if (!rules[it.rule]) bad.push(`${it.id}: rule ${it.rule} is not in the registry`);
    else if ((rules[it.rule].says || '').length < 60) bad.push(`${it.rule}: says too little`);
  }
  assert.deepEqual(bad, []);
  // Unused rules are dead weight and a sign a rename went half-done.
  const used = new Set(drafted.map((i) => i.rule));
  assert.deepEqual(Object.keys(rules).filter((r) => !used.has(r)), []);
});

test('the rules carrying several items are named, because that is where a correlated failure lives', () => {
  const drafted = items.filter((i) => i.rule);
  const byRule = {};
  for (const it of drafted) (byRule[it.rule] ??= []).push(it.id);
  const shared = Object.entries(byRule).filter(([, ids]) => ids.length > 1);
  assert.ok(shared.length >= 3,
    'no rule carries more than one item, so either the tagging is too fine to be '
    + 'useful or the batch has no correlated risk at all');
  // The one that prompted the field.
  assert.deepEqual(
    (byRule['pronominal.agreement.pronoun-is-direct-object'] ?? []).sort(),
    ['b1-agr-1', 'b1-agr-2', 'b1-agr-3', 'b1-agr-4']);
  // A rule carrying a correlated risk should say so, so a reviewer reading one
  // item knows what else is at stake.
  const rules = read('content/item-rules.json').rules;
  assert.match(rules['pronominal.agreement.pronoun-is-direct-object'].risk, /fails together/);
  for (const [rule, ids] of shared) {
    console.log(`    ${ids.length} items on ${rule}`);
  }
});

test('the rebalancer refuses to move a reviewed item', () => {
  // Running it after a review would attach a verdict to an item the reviewer
  // did not see — the forged-review fault by a different road, and by a road
  // nobody would watch. Seen refusing: a planted approval, out of position.
  const src = readFileSync(join(root, 'scripts/even-out-answers.py'), 'utf8');
  assert.match(src, /REFUSING/, 'the script does not refuse anything');
  assert.match(src, /approved", "rejected"|"approved", "rejected"/,
    'the refusal must key on a review verdict');
  assert.match(src, /return 2/, 'it must exit non-zero, not warn and continue');
});
