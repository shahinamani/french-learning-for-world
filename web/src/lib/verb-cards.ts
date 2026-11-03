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
      .then((doc: { cards: Rec[] }) => doc.cards.map((c, i, all): Card => ({
        key: c.key, type: 'verb', level, fr: c.fr, pos: i / all.length,
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

// ── Nouns and adjectives (scripts/build-word-cards.py) ───────────────────
type WordRec = {
  key: string; rank: number; type: 'noun' | 'adjective'; fr: string; en: string; fa: string;
  article?: string; gender?: 'm' | 'f' | 'mf' | null; plural?: string; feminine?: string;
  prep?: string; construction?: string;
  example: { fr: string; form: string; en: string; fa: string };
};

const wordCache = new Map<Level, Promise<Card[]>>();

export function loadWordCards(level: Level): Promise<Card[]> {
  let p = wordCache.get(level);
  if (!p) {
    p = fetch(`./content/word-cards/${level}.json`)
      .then((r) => { if (!r.ok) throw new Error(`word-cards ${level}`); return r.json(); })
      .then((doc: { cards: WordRec[] }) => doc.cards.map((c, i, all): Card => ({
        key: c.key, type: c.type, level, fr: c.fr, pos: i / all.length,
        article: c.article ?? null,
        gender: c.gender === 'm' || c.gender === 'f' ? c.gender : null,
        plural: c.plural ?? null, feminine: c.feminine ?? null,
        meanings: { en: c.en, fa: c.fa },
        examples: [{ tense: 'present', form: c.example.form, fr: c.example.fr,
                     translations: { en: c.example.en, fa: c.example.fa } }],
        conceptIds: [], prep: c.prep ?? null, construction: c.construction ?? null,
        glossUnreviewed: true,
      })))
      .catch((e) => { wordCache.delete(level); throw e; });
    wordCache.set(level, p);
  }
  return p;
}

let wordIndex: Promise<Map<string, Level>> | null = null;
/** key → level for every word card, so a due card is found from any level. */
export function loadWordIndex(): Promise<Map<string, Level>> {
  wordIndex ??= fetch('./content/word-cards/index.json')
    .then((r) => (r.ok ? r.json() : {}))
    .then((o: Record<string, Level>) => new Map(Object.entries(o)))
    .catch(() => { wordIndex = null; return new Map(); });
  return wordIndex;
}

/** Verbs and words of one level, interleaved by their place in each list, so
 *  a session of twenty new cards is a mix rather than twenty verbs. */
export async function loadLevelCards(level: Level): Promise<Card[]> {
  const [verbs, words] = await Promise.all([loadVerbCards(level), loadWordCards(level).catch(() => [])]);
  return [...verbs, ...words].sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));
}
