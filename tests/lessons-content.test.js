/**
 * The six grammar lessons, checked against the whole file.
 *
 * These are content checks, not a teacher's reading. They can tell you that a
 * link resolves, that an answer key is in range, that a Persian string is in
 * Persian script and that no slot was padded — they cannot tell you the French
 * is right, the Persian natural, or the rule well explained. **Nothing here is
 * evidence of review**, and the file's own `reviewNote` says so.
 *
 * Persian and Latin letters: a Persian explanation of a French rule has to
 * name the French form it is talking about. The exception is therefore a FIELD
 * in the data (`quotedInFa`, per lesson), not a loosened rule here: Latin may
 * appear in a Persian string only as one of the listed forms, and every listed
 * form must (a) really occur in that lesson's French and (b) really be used.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const file = read('content/lessons.json');
const lessons = file.lessons;
const concepts = new Map(read('content/concepts.json').concepts.map((c) => [c.id, c]));

const PERSIAN = /[؀-ۿ]/;
const LATIN = /[A-Za-zÀ-ɏŒœ]/;
const SENTENCE_END = /[.!?…»)]$/;
const norm = (s) => s.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ');

/** every Persian-language string of a lesson, with a label for the message */
function faStrings(l) {
  const out = [
    ['explanation.fa', l.explanation.fa],
    ['simplerExplanation.fa', l.simplerExplanation.fa],
    ['difference.fa', l.difference.fa],
  ];
  l.examples.forEach((e, i) => out.push([`examples[${i}].fa`, e.fa]));
  l.questions.forEach((q, i) => {
    out.push([`questions[${i}].prompt.fa`, q.prompt.fa]);
    out.push([`questions[${i}].right.fa`, q.explanation.right.fa]);
    out.push([`questions[${i}].tempting.fa`, q.explanation.tempting.fa]);
  });
  return out;
}

/** the corpus a quoted form must come from: the French and English the lesson shows */
function frCorpus(l) {
  const parts = [l.explanation.fr, l.explanation.en, l.difference.en, l.simplerExplanation.en];
  l.examples.forEach((e) => parts.push(e.fr));
  l.questions.forEach((q) => {
    parts.push(q.prompt.fr, ...q.options, q.explanation.right.en, q.explanation.tempting.en);
  });
  return norm(parts.join(' \n '));
}

test('the file says it is unreviewed, and so does every lesson', () => {
  assert.match(file.reviewNote, /NOT REVIEWED/);
  assert.match(file.reviewNote, /No teacher has read/);
  assert.equal(file.licence, 'CC BY-SA 4.0');
  assert.ok(file.sources.drafted);
  assert.equal(lessons.length, 6, 'the batch is six lessons');
  for (const l of lessons) {
    assert.equal(l.source, 'drafted', `${l.id}: source`);
    assert.ok(file.sources[l.source], `${l.id}: source "${l.source}" is not described in sources`);
  }
});

test('review.teacher is null everywhere: nobody has read this', () => {
  for (const l of lessons) {
    assert.deepEqual(l.review, { owner: null, teacher: null }, `${l.id}: review must be exactly null/null`);
  }
});

test('ids are unique, and conceptId / nearbyConceptId exist in concepts.json', () => {
  assert.equal(new Set(lessons.map((l) => l.id)).size, lessons.length, 'duplicate lesson id');
  assert.equal(new Set(lessons.map((l) => l.conceptId)).size, lessons.length, 'two lessons teach one concept');
  for (const l of lessons) {
    for (const key of ['conceptId', 'nearbyConceptId']) {
      const c = concepts.get(l[key]);
      assert.ok(c, `${l.id}: ${key} "${l[key]}" is not in content/concepts.json`);
      assert.ok(!c.retired, `${l.id}: ${key} "${l[key]}" is retired`);
      assert.ok(!c.isGroup, `${l.id}: ${key} "${l[key]}" is a group, not a concept`);
    }
    assert.notEqual(l.conceptId, l.nearbyConceptId, `${l.id}: a concept is not its own neighbour`);
    assert.equal(l.level, concepts.get(l.conceptId).level, `${l.id}: level differs from the concept's level`);
  }
});

test('every lesson has exactly two examples and three or four questions', () => {
  for (const l of lessons) {
    assert.equal(l.examples.length, 2, `${l.id}: ${l.examples.length} examples`);
    assert.ok(l.questions.length >= 3 && l.questions.length <= 4, `${l.id}: ${l.questions.length} questions`);
  }
});

test('explanations exist in English and Persian (French for the main one), and the simpler one is shorter', () => {
  for (const l of lessons) {
    for (const [name, o, langs] of [
      ['explanation', l.explanation, ['en', 'fa', 'fr']],
      ['simplerExplanation', l.simplerExplanation, ['en', 'fa']],
      ['difference', l.difference, ['en', 'fa']],
    ]) {
      for (const lang of langs) {
        assert.ok(typeof o[lang] === 'string' && o[lang].trim().length > 0, `${l.id}: ${name}.${lang} is empty`);
      }
    }
    // "Short": this opens inside a panel.
    assert.ok(l.explanation.en.length <= 330, `${l.id}: explanation.en is ${l.explanation.en.length} characters, not short`);
    assert.ok(l.simplerExplanation.en.length < l.explanation.en.length,
      `${l.id}: the "simpler" explanation is not shorter than the explanation`);
    assert.ok(l.simplerExplanation.fa.length < l.explanation.fa.length,
      `${l.id}: the Persian "simpler" explanation is not shorter than the explanation`);
  }
});

test('answer keys are in range, options are four and distinct, the tempting one is a different option', () => {
  for (const l of lessons) {
    l.questions.forEach((q, i) => {
      const at = `${l.id} q${i + 1}`;
      assert.equal(q.options.length, 4, `${at}: ${q.options.length} options`);
      assert.equal(new Set(q.options).size, 4, `${at}: duplicate options`);
      for (const o of q.options) assert.ok(typeof o === 'string' && o.trim(), `${at}: empty option`);
      assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4, `${at}: answer ${q.answer} out of range`);
      assert.ok(Number.isInteger(q.temptingWrong) && q.temptingWrong >= 0 && q.temptingWrong < 4,
        `${at}: temptingWrong ${q.temptingWrong} out of range`);
      assert.notEqual(q.temptingWrong, q.answer, `${at}: the tempting wrong answer is the right answer`);
      // A blank means the options are words; no blank means they are sentences.
      const blank = q.prompt.fr.includes('___');
      const sentences = q.options.every((o) => SENTENCE_END.test(o));
      assert.ok(blank !== sentences,
        `${at}: the prompt ${blank ? 'has' : 'lacks'} a blank but the options ${sentences ? 'are' : 'are not'} sentences`);
    });
  }
});

test('every answer comes with a reason, and a reason the tempting one is wrong, in English and Persian', () => {
  for (const l of lessons) {
    l.questions.forEach((q, i) => {
      for (const part of ['right', 'tempting']) {
        for (const lang of ['en', 'fa']) {
          const s = q.explanation[part]?.[lang];
          assert.ok(typeof s === 'string' && s.trim().length > 20,
            `${l.id} q${i + 1}: explanation.${part}.${lang} is missing or a stub`);
        }
      }
      for (const lang of ['fr', 'en', 'fa']) {
        assert.ok(q.prompt[lang]?.trim(), `${l.id} q${i + 1}: prompt.${lang} is empty`);
      }
    });
  }
});

test('Persian is in Persian script', () => {
  for (const l of lessons) {
    for (const [where, s] of faStrings(l)) {
      assert.ok(typeof s === 'string' && s.trim(), `${l.id}: ${where} is empty`);
      assert.match(s, PERSIAN, `${l.id}: ${where} is not in Persian script`);
    }
  }
});

test('no Latin letter in Persian text, except a form the lesson lists in quotedInFa', () => {
  for (const l of lessons) {
    assert.ok(Array.isArray(l.quotedInFa), `${l.id}: quotedInFa missing`);
    // longest first, so "ne … pas" is removed before "ne"
    const quoted = [...new Set(l.quotedInFa)].sort((a, b) => b.length - a.length);
    for (const [where, s] of faStrings(l)) {
      let rest = norm(s);
      for (const q of quoted) rest = rest.split(norm(q)).join(' ');
      const m = rest.match(LATIN);
      assert.equal(m, null, `${l.id}: ${where} has Latin "${m?.[0]}" outside a listed quoted form:\n  ${s}`);
    }
  }
});

test('quotedInFa is not padded: no duplicates, every form is shown in the lesson, every form is used', () => {
  for (const l of lessons) {
    assert.equal(new Set(l.quotedInFa).size, l.quotedInFa.length, `${l.id}: quotedInFa has duplicates`);
    const corpus = frCorpus(l);
    const fa = norm(faStrings(l).map(([, s]) => s).join(' \n '));
    for (const q of l.quotedInFa) {
      assert.ok(corpus.includes(norm(q)), `${l.id}: quoted form "${q}" appears nowhere in the lesson's French or English`);
      assert.ok(fa.includes(norm(q)), `${l.id}: quoted form "${q}" is listed but no Persian text uses it`);
    }
  }
});

test('French example sentences end in a sentence-ending mark and carry no blank', () => {
  for (const l of lessons) {
    l.examples.forEach((e, i) => {
      assert.match(e.fr, SENTENCE_END, `${l.id} example ${i + 1}: "${e.fr}" does not end in . ! ? or …`);
      assert.ok(!e.fr.includes('___'), `${l.id} example ${i + 1}: a worked example has a blank`);
      assert.ok(e.en?.trim(), `${l.id} example ${i + 1}: no English`);
      assert.match(e.fa, PERSIAN, `${l.id} example ${i + 1}: Persian is not Persian`);
      assert.doesNotMatch(e.fa, LATIN, `${l.id} example ${i + 1}: Latin in the Persian translation`);
    });
    l.questions.forEach((q, i) => {
      assert.match(q.prompt.fr, /[.!?…»]$/, `${l.id} q${i + 1}: prompt "${q.prompt.fr}" has no closing mark`);
    });
  }
});

test('the neighbour gets a real difference, not a restatement', () => {
  for (const l of lessons) {
    assert.ok(l.difference.en.length > 120, `${l.id}: the difference is too thin to be a difference`);
    assert.notEqual(norm(l.difference.en), norm(l.explanation.en), `${l.id}: difference is the explanation again`);
  }
});

test('the right answer is not always in the same slot', () => {
  for (const l of lessons) {
    const slots = new Set(l.questions.map((q) => q.answer));
    assert.ok(slots.size >= 2, `${l.id}: every answer is option ${[...slots][0]}`);
  }
});
