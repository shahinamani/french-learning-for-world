/**
 * The verb flashcards: one file per level, built by scripts/build-verb-cards.py
 * from the checked conjugation tables.
 *
 * A verb card is a `Card` like the written ones, so the session, the scheduler
 * and the review log treat it the same way. It differs in two places, and both
 * are shown to the learner rather than hidden:
 *   - its meaning is an English Wiktionary gloss that no human has read for
 *     this deck (`glossUnreviewed`);
 *   - its back shows the past and future as forms (« il a parlé », « il
 *     parlera »), not as written example sentences, because nobody has written
 *     2,349 sentences and a generated one would be a claim without substance.
 *
 * The key is the verb index key (`v:être`), the one the Cards workspace already
 * writes history under, so a verb marked there is the same card here. A verb
 * that also has a written card keeps the written one.
 */
import type { Card, Level } from './types';
import { fold } from './fold';

export const CARD_LEVELS: Level[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

type Rec = {
  key: string; rank: number; fr: string; en: string; register?: string;
  past: { fr: string; form: string }; future: { fr: string; form: string };
  fa?: string; prep?: string; construction?: string;
  examples?: Card['examples'];
};

const cache = new Map<Level, Promise<Card[]>>();

export function loadVerbCards(level: Level): Promise<Card[]> {
  let p = cache.get(level);
  if (!p) {
    p = fetch(`./content/verb-cards/${level}.json`)
      .then((r) => { if (!r.ok) throw new Error(`verb-cards ${level}`); return r.json(); })
      .then((doc: { cards: Rec[] }) => doc.cards.map((c): Card => ({
        key: c.key, type: 'verb', level, fr: c.fr,
        meanings: c.fa ? { en: c.en, fa: c.fa } : { en: c.en },
        examples: c.examples ?? [], conceptIds: [],
        // Written sentences replace the bare forms once a level has them.
        forms: c.examples?.length ? undefined : { past: c.past, future: c.future },
        prep: c.prep ?? null, construction: c.construction ?? null,
        register: c.register ?? null,
        glossUnreviewed: true,
      })))
      .catch((e) => { cache.delete(level); throw e; });
    cache.set(level, p);
  }
  return p;
}

/** Written cards first; a verb card whose verb already has a written card is
 *  dropped, matched on the folded key because the two files key être
 *  differently (`v:etre` and `v:être`). */
export function mergeCards(written: Card[], verbs: Card[]): Card[] {
  const have = new Set(written.map((c) => fold(c.key)));
  return [...written, ...verbs.filter((c) => !have.has(fold(c.key)))];
}

/** How many new cards one session introduces. Twenty is a session a learner
 *  finishes; "Keep going" starts the next twenty. */
export const NEW_PER_SESSION = 20;
