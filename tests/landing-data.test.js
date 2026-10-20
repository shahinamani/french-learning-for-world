/**
 * The landing page quotes a little real content: one flashcard, four lines of a
 * dialogue, the titles, levels, durations and sources of a handful of items.
 * It holds them in web/src/routes/landing/data.ts rather than importing the
 * content files, because the page is eager and the first load has no room for
 * them. That is only honest if something compares the copy to the original, and
 * this is that something: change the content and this fails until the landing
 * page is brought back into step.
 *
 * Every assertion compares the page's copy to the content file it quotes, and
 * to nothing else.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  PREVIEW_CARD, PREVIEW_DIALOGUE, READING, EXAMS, DIALOGUE, CARDS, READING_LEVELS, GOAL_ITEMS,
} from '../web/src/routes/landing/data.ts';

const load = (p) => JSON.parse(readFileSync(new URL(`../content/${p}`, import.meta.url), 'utf8'));
const cards = load('fr-core-a1.json');
const backs = load('card-backs.json').backs;
const dialogues = load('dialogues.json').dialogues;
const reading = load('reading.json');
const papers = load('exam-papers.json');

test('the preview card is the deck card, with an example from its back', () => {
  const card = cards.cards.find((c) => c.key === PREVIEW_CARD.key);
  assert.ok(card, 'the card exists in the deck');
  assert.equal(card.fr, PREVIEW_CARD.front);
  assert.equal(card.level, PREVIEW_CARD.level);
  assert.equal(card.meanings.en, PREVIEW_CARD.meaning.en);
  assert.equal(card.meanings.fr, PREVIEW_CARD.meaning.fr);
  const ex = backs[PREVIEW_CARD.key].examples.find((e) => e.fr === PREVIEW_CARD.example.fr);
  assert.ok(ex, 'the example sentence is on the card back');
  assert.equal(ex.en, PREVIEW_CARD.example.en);
  assert.ok(PREVIEW_CARD.example.fr.includes(PREVIEW_CARD.example.form),
    'the highlighted form is literally in the sentence');
  assert.equal(cards.licence, 'CC BY-SA 4.0');
  assert.equal(backs[PREVIEW_CARD.key].review.teacher, null, 'the page says "not checked", so it must not be');
});

test('the preview dialogue is the first four lines of its unit, word for word', () => {
  const d = dialogues.find((x) => x.id === PREVIEW_DIALOGUE.id);
  assert.ok(d);
  assert.equal(d.level, PREVIEW_DIALOGUE.level);
  assert.equal(d.title.fr, PREVIEW_DIALOGUE.title.fr);
  assert.equal(d.title.en, PREVIEW_DIALOGUE.title.en);
  PREVIEW_DIALOGUE.lines.forEach((l, i) => {
    assert.equal(l.speaker, d.lines[i].speaker);
    assert.equal(l.fr, d.lines[i].fr);
    assert.equal(l.en, d.lines[i].en);
  });
  assert.equal(DIALOGUE.id, d.id);
  assert.equal(DIALOGUE.fr, d.title.fr);
});

test('every reading item matches reading.json: title, level, duration, source, unreviewed', () => {
  for (const item of Object.values(READING)) {
    const t = reading.texts.find((x) => x.id === item.id);
    assert.ok(t, `${item.id} exists`);
    assert.equal(t.title.fr, item.fr);
    assert.equal(t.title.en, item.en);
    assert.equal(t.level, item.level);
    assert.equal(t.levelBasis, 'author', 'the page says the level was set by the author');
    assert.equal(t.readingTime.seconds, item.seconds);
    assert.equal(t.source.kind, 'original');
    assert.equal(t.source.licence, 'CC BY-SA 4.0');
    assert.equal(t.review.teacher, null);
    assert.equal(item.to, `/app/reading/${item.id}`);
  }
  const levels = reading.texts.map((t) => t.level).sort();
  assert.equal(READING_LEVELS[0], levels[0]);
  assert.equal(READING_LEVELS[1], levels[levels.length - 1]);
});

test('every exam item matches exam-papers.json', () => {
  assert.equal(papers.licence.shortName, 'CC BY-SA 4.0');
  for (const item of Object.values(EXAMS)) {
    const p = papers.papers.find((x) => x.id === item.id);
    assert.ok(p, `${item.id} exists`);
    assert.equal(p.name.en, item.en);
    assert.equal(p.name.fr, item.fr);
    assert.equal(p.level, item.level);
    assert.equal(p.minutes, item.minutes);
    assert.equal(item.to, `/app/exams/${item.id}`);
  }
});

test('the cards item names the real deck', () => {
  assert.equal(cards.id, CARDS.id);
  assert.equal(cards.title.en, CARDS.en);
  assert.equal(cards.title.fr, CARDS.fr);
});

test('every goal has real items, and every link is a route the app declares', () => {
  const main = readFileSync(new URL('../web/src/main.tsx', import.meta.url), 'utf8');
  const routes = new Set([...main.matchAll(/path="([^"]+)"/g)].map((m) => m[1]));
  for (const [goal, items] of Object.entries(GOAL_ITEMS)) {
    assert.ok(items.length >= 2, `${goal} has something to offer`);
    for (const it of items) {
      const [, , first, second] = it.to.split('?')[0].split('/'); // '', 'app', first, second
      assert.ok(routes.has(first) || routes.has(`${first}/:id`) || routes.has(`${first}/:paperId`) || routes.has(`${first}/*`),
        `${goal}: ${it.to} is declared in main.tsx`);
      void second;
    }
  }
  assert.ok(existsSync(new URL('../content/portal-summary.json', import.meta.url)));
});
