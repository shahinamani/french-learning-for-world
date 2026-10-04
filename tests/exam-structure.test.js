/**
 * The exam grid, and whether anybody checked it.
 *
 * `content/exams.json` was the specification for the exam practice and had
 * `checkedOn: null`. `content/exam-papers.json` stated, as official fact, that
 * the TCF language-structures paper is **18 questions in 20 minutes**. It is 18
 * questions in **15**. The figure had never been compared to a source, and the
 * file's own numbers contradicted each other: 25 + 20 + 45 is 90 minutes
 * against the 1 h 25 the exam body states for the three compulsory papers.
 *
 * A candidate practising to a wrong grid prepares for a test that does not
 * exist. These checks are the arithmetic that would have caught it, plus the
 * requirement that every figure name a source and a date.
 *
 * Verified 2026-10-04 against official candidate papers (DELF A1, A2) and an
 * accredited TCF centre; see the `sources` blocks for URLs. France Éducation
 * international's own pages returned Access Denied to an automated fetch, which
 * is recorded there rather than hidden.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const exams = read('content/exams.json');
const papers = read('content/exam-papers.json').papers;

test('the file says when it was checked, and it has been', () => {
  assert.match(exams.checkedOn, /^\d{4}-\d{2}-\d{2}$/,
    'checkedOn is null — the exam grid is unverified and is the specification for the practice');
});

test('a verified structure names its sources with URLs and dates', () => {
  const bad = [];
  for (const e of exams.exams) {
    const s = e.structure;
    assert.ok(s, `${e.id} has no structure block at all`);
    if (!s.verifiedOn) {
      // Unverified is allowed and must be SAID, not filled with a guess.
      assert.match(s.note || '', /NOT VERIFIED/,
        `${e.id} is unverified and does not say so`);
      assert.ok(!s.papers && !s.compulsory,
        `${e.id} is unverified and carries figures anyway`);
      continue;
    }
    if (!Array.isArray(s.sources) || !s.sources.length) bad.push(`${e.id}: no sources`);
    for (const src of s.sources || []) {
      if (!/^https:\/\//.test(src.url || '')) bad.push(`${e.id}: source without a URL`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(src.readOn || '')) bad.push(`${e.id}: source without a read date`);
      if (!src.what) bad.push(`${e.id}: source without a statement of what it confirms`);
    }
  }
  assert.deepEqual(bad, []);
  const verified = exams.exams.filter((e) => e.structure.verifiedOn).map((e) => e.id);
  console.log(`    verified: ${verified.join(', ')} · `
    + `unverified and saying so: ${exams.exams.filter((e) => !e.structure.verifiedOn).map((e) => e.id).join(', ')}`);
});

test('the TCF section durations sum to the total the exam body states', () => {
  // THE ARITHMETIC THAT WOULD HAVE CAUGHT IT. With the wrong 20 minutes this
  // sums to 90 against a stated 85, and nothing in the project compared them.
  const tcf = exams.exams.find((e) => e.id === 'tcf').structure;
  const mins = tcf.compulsory.reduce((a, s) => a + s.minutes, 0);
  const items = tcf.compulsory.reduce((a, s) => a + s.items, 0);
  assert.equal(mins, tcf.compulsoryTotal.minutes, `sections sum to ${mins} minutes`);
  assert.equal(items, tcf.compulsoryTotal.items, `sections sum to ${items} items`);
  assert.equal(mins, 85, 'the compulsory papers are 1 h 25');
  // The specific regression, by name.
  const slg = tcf.compulsory.find((s) => s.code === 'SLG');
  assert.equal(slg.minutes, 15, 'the language-structures paper is 15 minutes, not 20');
  assert.equal(slg.items, 18);
});

test('DALF C2 is a different shape, and the marks still sum to 100', () => {
  // **The guard written for DELF would have been wrong here.** DELF is four
  // papers out of 25 with a 5/25 minimum. DALF C2 is TWO papers out of 50 with
  // a 10/50 minimum — one oral, one written — and C1 is four out of 25 like
  // DELF. Pointing the DELF-shaped check at DALF would have failed a correct
  // grid, so the invariant asserted is the one that actually holds across both:
  // the marks sum to 100 and the per-paper minimum is a tenth of the total.
  const dalf = exams.exams.find((e) => e.id === 'dalf').structure;
  assert.equal(dalf.papers.C1.length, 4);
  assert.equal(dalf.papers.C2.length, 2, 'DALF C2 has two papers, not four');
  for (const [level, ps] of Object.entries(dalf.papers)) {
    const marks = ps.reduce((a, s) => a + s.marks, 0);
    assert.equal(marks, 100, `DALF ${level} sums to ${marks}`);
  }
  assert.match(dalf.passing.C1.perPaper, /5\/25/);
  assert.match(dalf.passing.C2.perPaper, /10\/50/);
  // And the domain choice the 2024 reform removed is recorded as what dates the
  // paper, since the paper carries no date.
  const cpo = dalf.papers.C2.find((s) => s.code === 'CPO');
  assert.match(cpo.domainChoice, /2024 reform removed/);
});

test('every verified grid sums its papers to 100 marks', () => {
  // The invariant that holds across DELF and DALF, at every level, whatever the
  // shape: four papers of 25 or two of 50, the diploma is out of 100.
  for (const e of exams.exams) {
    const ps = e.structure?.papers;
    if (!ps) continue;
    for (const [level, list] of Object.entries(ps)) {
      const marks = list.reduce((a, s) => a + s.marks, 0);
      assert.equal(marks, 100, `${e.id} ${level} sums to ${marks} marks`);
    }
  }
});

test('the DELF marks sum to 100 and the pass figures are the printed ones', () => {
  const delf = exams.exams.find((e) => e.id === 'delf').structure;
  for (const [level, ps] of Object.entries(delf.papers)) {
    const marks = ps.reduce((a, s) => a + s.marks, 0);
    assert.equal(marks, 100, `${level} papers sum to ${marks} marks`);
    assert.equal(ps.length, 4, `${level} has ${ps.length} papers`);
    // DELF only. DALF C2 has two papers out of 50 — see the check above.
  }
  assert.match(delf.passing.overall, /50\/100/);
  assert.match(delf.passing.perPaper, /5\/25/);
});

test('our practice papers do not teach a pace the exam does not allow', () => {
  // Ours gave 20 minutes for 12 items where the real paper gives 15 for 18:
  // 100 seconds a question against 50. A candidate who practises at twice the
  // allowed time has been taught a speed that will fail them.
  const bad = [];
  for (const p of papers) {
    const o = p.official;
    // ONLY where the real question count is known. 25 is the MARKS on a DELF
    // CE paper, not its number of questions — four exercises worth 6+6+6+7,
    // and how many questions that is is not published anywhere I could find.
    // Using marks as an item count made this check call a correct paper wrong,
    // which is the fourth time this week one of my metrics has done that.
    // Against the form we SIMULATE, not the gentler one. The candidate does not
    // choose the form — the centre does — so the computer form's 23 presented
    // items in the same 15 minutes is the pace to be ready for. Measuring
    // against the paper form would pass a practice paper that is 28% too slow.
    if (!o.forms) continue;
    const sim = o.forms[o.forms.weSimulate];
    const realItems = sim.itemsPresented ?? sim.items;
    const realPace = (sim.minutes * 60) / realItems;
    const ourPace = (p.minutes * 60) / p.items.length;
    // Within a quarter of the real pace. Slower than the exam is the dangerous
    // direction; a little faster is harmless practice.
    if (ourPace > realPace * 1.25) {
      bad.push(`${p.id}: ${ourPace.toFixed(0)}s per item against the real ${realPace.toFixed(0)}s`);
    }
  }
  assert.deepEqual(bad, []);
  // And which form we simulate must be said, not left implicit.
  for (const q of papers.filter((x) => x.official.forms)) {
    assert.ok(['paper', 'computer'].includes(q.official.forms.weSimulate),
      `${q.id} does not say which form it simulates`);
    assert.match(q.practiceNote.en, /CENTRE DOES|centre does/,
      `${q.id} does not tell the candidate they cannot choose the form`);
  }
  // And the gap is stated: the DELF papers cannot be checked this way.
  const unknown = papers.filter((p) => p.exam === 'delf').map((p) => p.id);
  assert.ok(unknown.length >= 2,
    'the DELF papers no longer exist — the note below needs rewriting');
  console.log(`    pace checked for tcf-structure; not checkable for ${unknown.join(', ')} `
    + '(question count not published)');
});

test('both TCF forms are recorded, because the centre chooses, not the candidate', () => {
  // The exam body's page gives 76 items on paper and 91 on computer — five extra
  // per skill that do not count toward the score — in the SAME 85 minutes. A
  // project that recorded only the paper form would have built to a pace 20%
  // gentler than the one a candidate may face, with no way to know.
  const f = exams.exams.find((e) => e.id === 'tcf').structure.forms;
  assert.equal(f.paper.presentedItems, 76);
  assert.equal(f.computer.presentedItems, 91);
  assert.equal(f.computer.presentedItems - f.paper.presentedItems, 5 * 3,
    'five extra items per skill across three skills');
  assert.equal(f.paper.minutes, f.computer.minutes,
    'the durations are the same on both forms, which is what makes the computer form faster');
  assert.equal(f.pace.whichWeSimulate, 'computer');
});

test('the primary documents nobody has read are listed as unread', () => {
  // Two PDFs are linked from the exam body's page: "Fiche de présentation du TCF
  // tout public" and "Manuel du candidat TCF". They are the primary source and
  // no figure here has been reconciled against them. That is recorded rather
  // than left as an impression that everything was checked.
  const unread = exams.exams.find((e) => e.id === 'tcf').structure.notRead;
  assert.ok(Array.isArray(unread) && unread.length >= 2);
  for (const doc of unread) {
    assert.equal(doc.status, 'NOT READ');
    assert.ok(doc.why && doc.document);
  }
});

test('every exam has a structure block, verified or explicitly not', () => {
  // The owner's scope ruling: the portal targets every recognised test, and no
  // exam may be quietly absent from what it claims to prepare you for.
  assert.ok(exams.scopeNote && /KNOWN GAP/.test(exams.scopeNote),
    'the scope note must name what is still missing');
  for (const e of exams.exams) {
    assert.ok(e.structure, `${e.id} has no structure block`);
    if (!e.structure.verifiedOn) {
      assert.match(e.structure.note || '', /NOT VERIFIED/, `${e.id} is silent about being unverified`);
      assert.ok(e.structure.note.length > 60, `${e.id} gives no reason`);
    }
  }
  const ids = exams.exams.map((e) => e.id);
  for (const want of ['delf', 'dalf', 'tcf', 'tef', 'tcf-canada', 'tcf-quebec', 'tcf-irn']) {
    assert.ok(ids.includes(want), `${want} is absent from the portal's own claims`);
  }
  console.log(`    ${ids.length} exams · verified: `
    + exams.exams.filter((e) => e.structure.verifiedOn).map((e) => e.id).join(', '));
});

test('result validity and retake rules are recorded, and the portal claims none', () => {
  const v = exams.exams.find((e) => e.id === 'tcf').structure.validity;
  assert.equal(v.resultsValidFor, '2 years');
  assert.equal(v.minimumBetweenSittings, '20 days');
  assert.equal(v.reCorrection.status, 'suspended');
  assert.match(v.portalClaims, /^NONE/,
    'the portal now makes a claim about validity or retakes — check it against these figures');
});

test('every official claim carries a source and a date it was read', () => {
  const bad = [];
  for (const p of papers) {
    const v = p.official?.verified;
    if (!v) { bad.push(`${p.id}: no verification record`); continue; }
    if (!/^https:\/\//.test(v.url || '')) bad.push(`${p.id}: no source URL`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.on || '')) bad.push(`${p.id}: no date`);
    if (!v.what) bad.push(`${p.id}: no statement of what was confirmed`);
  }
  assert.deepEqual(bad, []);
});
