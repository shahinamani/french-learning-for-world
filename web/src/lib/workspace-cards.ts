/**
 * What is actually eligible to be a flashcard, and how the workspace filters it.
 *
 * Kept out of the component so it can be checked without a browser, and
 * because the only interesting decisions here are about the DATA.
 *
 * ## The corpus, counted rather than assumed
 *
 * The written deck is 22 cards and it is NOT the whole corpus — but the verb
 * table is not a flashcard deck either, and calling it one would be the
 * overclaim this project keeps removing. The rule applied here is: a record is
 * a flashcard only if it has a usable front AND a usable back.
 *
 *   - `content/fr-core-a1.json` — 22 written cards: 13 verbs keyed `v:<verb>`
 *     and 9 nouns keyed `n:<noun>`. Four-language meanings, two example
 *     sentences each, concept ids. These are the rich ones.
 *   - `content/verbs-index.json` — 2,387 verbs, of which 2,363 carry an English
 *     gloss and are not marked `glossWithheld`. Front is the headword, back is
 *     that gloss.
 *
 * The 13 verb cards in the deck are the SAME records as 13 of those verbs —
 * the deck reuses the verb key space — so the deck is an overlay, not an
 * addition. Distinct eligible records: 2,363 verbs + 9 nouns = **2,372**, of
 * which 22 are rich. Nothing here invents a card.
 *
 * ## Two things that must not be lost
 *
 * A verb-derived back is a Wiktionary gloss that **no human has read**, and it
 * is marked so the screen can say so. « venir » once shipped glossed "to cum"
 * and that is the standing reminder.
 *
 * A pronominal-only verb is shown by its `headword` — « se souvenir », never
 * « souvenir ». The index carries the field for exactly this reason: a learner
 * who reads the wrong headword has learned it wrong before they open anything.
 * `verbLabel` is the one function that decides, and it is reused here rather
 * than reimplemented.
 */
import type { Card, CardState, Level, Locale } from './types';
import type { VerbSummary } from './verbs';
import { verbLabel } from './pronominal';
import { fold } from './fold';

export const WS_LEVELS: Level[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export type WsCard = {
  /** The existing card key. `v:etre`, `n:eau` — the same identity the written
   *  deck and the review log already use, so history carries over. */
  key: string;
  level: Level;
  /** The French side. Already the pronominal headword where there is one. */
  front: string;
  /** The answer side: written card meaning, or the verb's English gloss. */
  back: string;
  type: 'verb' | 'noun' | 'adjective';
  /** True when `back` is an unreviewed gloss rather than written card copy. */
  glossUnreviewed: boolean;
  conceptIds: string[];
  /** The written card, when this record has one: examples, other languages. */
  rich: Card | null;
};

/**
 * Build the eligible set. Deck cards win over the index for the same key,
 * because written copy beats a scraped gloss on every axis.
 *
 * `locale` picks the meaning shown for a rich card. A rich card missing the
 * learner's language falls back to English — and the caller is responsible for
 * saying so, which is what `Localised` is for. It is not silently relabelled.
 */
export function buildCards(cards: Card[], verbs: VerbSummary[], locale: Locale): WsCard[] {
  const out = new Map<string, WsCard>();
  /** Folded key → the key actually stored, so an overlay can find its twin. */
  const byFolded = new Map<string, string>();

  for (const v of verbs) {
    if (v.glossWithheld || !v.en) continue;   // no usable back
    out.set(v.key, {
      key: v.key,
      level: v.level,
      front: verbLabel(v),
      back: v.en,
      type: 'verb',
      glossUnreviewed: true,
      conceptIds: [],
      rich: null,
    });
    byFolded.set(fold(v.key), v.key);
  }

  for (const c of cards) {
    const back = c.meanings[locale] ?? c.meanings.en;
    if (!c.fr || !back) continue;             // no usable front or back

    /**
     * The two datasets do not agree on how to key an accented infinitive, and
     * finding that out is the reason this loop is not a plain `set`.
     *
     * The written deck keys être `v:etre`, ASCII-folded. The verb index keys
     * it `v:être`. Thirteen of the deck's fourteen verbs are unaccented, so
     * the schemes look identical until the fourteenth — which is être, the
     * commonest verb in French. Keyed naively, the corpus carried être twice:
     * once as the written card and once as a scraped gloss, each with its own
     * review history, so a learner could mark it known and still meet it as
     * unmarked. docs/lessons.md #10 again: the undeclared belief was *two
     * files about the same verbs key it the same way*.
     *
     * The DECK key wins, because that is the key the ordinary flashcard
     * session has been writing history under all along. Changing to the index
     * key here would orphan every existing review of these 22 cards — which
     * is precisely the overwrite this work was told not to perform.
     */
    const twin = byFolded.get(fold(c.key));
    if (twin && twin !== c.key) out.delete(twin);

    out.set(c.key, {
      key: c.key,
      level: c.level,
      front: c.fr,
      back,
      type: c.type,
      glossUnreviewed: false,
      conceptIds: c.conceptIds,
      rich: c,
    });
    byFolded.set(fold(c.key), c.key);
  }

  // Stable order: level, then the French side. A stable base order is what
  // makes "card 7 of 200" mean the same thing twice, and what shuffle departs
  // from deliberately rather than by accident.
  return [...out.values()].sort((a, b) =>
    WS_LEVELS.indexOf(a.level) - WS_LEVELS.indexOf(b.level)
    || a.front.localeCompare(b.front, 'fr'));
}

/**
 * Which pile a card is in, read from the EXISTING scheduler state.
 *
 * There is no second store and no extra field. The two buttons grade through
 * FSRS exactly as the ordinary session does, and this reads the result back
 * out of the schedule:
 *
 *   never graded                   → 'none'   (Not yet marked)
 *   next due beyond today          → 'known'  (the scheduler put it away)
 *   due today, or already overdue  → 'review' (it is coming back)
 *
 * ## Why not `state.state`
 *
 * The first version of this read FSRS's state enum: 2 (Review) meant known,
 * 1 or 3 (Learning, Relearning) meant review. It was wrong, and the journey
 * check caught it — pressing Known removed the card from the unmarked pile and
 * it arrived in NEITHER of the other two. A card being seen for the first time
 * enters Learning whichever way it is graded, so `state` is identical after
 * Good and after Again. The enum cannot express the question, and reading it
 * was comparing the wrong two things.
 *
 * The horizon is what distinguishes them, because it is what the learner means.
 * Again schedules minutes ahead; Good schedules at least a day. Twelve hours
 * sits between those with room to spare, and it is a deliberate horizon rather
 * than a tuned constant: "the scheduler is not bringing this back today".
 *
 * A consequence worth stating: a card graded Good months ago and now overdue
 * reads as 'To review'. That is correct — it IS due — and it means these piles
 * describe the real schedule rather than a memory of which button was pressed.
 */
export type Mark = 'none' | 'known' | 'review';

/** Beyond this, the scheduler is not bringing the card back today. */
export const KNOWN_HORIZON_MS = 12 * 60 * 60 * 1000;

export function markOf(state: CardState | undefined, now: number): Mark {
  if (!state || state.reps === 0) return 'none';
  return state.dueAt - now > KNOWN_HORIZON_MS ? 'known' : 'review';
}

export type Filter = { mark: Mark | 'all'; levels: Level[]; shuffle: boolean; seed: number };

/**
 * A deterministic shuffle, seeded.
 *
 * `Math.random()` would reshuffle on every React render, so "card 7 of 200"
 * would name a different card each time the component drew — the counts and
 * the position would disagree, which is the one thing the filters must never
 * do. The seed changes only when the learner presses Shuffle.
 */
function shuffled<T>(items: T[], seed: number): T[] {
  const out = items.slice();
  let s = seed || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;    // one standard LCG step
    const j = s % (i + 1);
    // Written out rather than destructured: with noUncheckedIndexedAccess an
    // index read is `T | undefined`, and the swap has to be visibly total.
    const a = out[i] as T;
    const b = out[j] as T;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

/** The filtered, ordered set the card, the counts and the position all read. */
export function applyFilters(
  all: WsCard[],
  marks: Map<string, Mark>,
  f: Filter,
): WsCard[] {
  const levels = new Set(f.levels);
  const kept = all.filter((c) =>
    (levels.size === 0 || levels.has(c.level))
    && (f.mark === 'all' || (marks.get(c.key) ?? 'none') === f.mark));
  return f.shuffle ? shuffled(kept, f.seed) : kept;
}

/** How many eligible records sit at each level, for the level buttons. */
export function countByLevel(all: WsCard[]): Record<Level, number> {
  const out = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 } as Record<Level, number>;
  for (const c of all) out[c.level]++;
  return out;
}

/** How many are in each pile, for the mark filters. */
export function countByMark(all: WsCard[], marks: Map<string, Mark>) {
  const out = { all: all.length, none: 0, known: 0, review: 0 };
  for (const c of all) out[marks.get(c.key) ?? 'none']++;
  return out;
}

/**
 * Clamp a typed card number to the filtered set.
 *
 * One-based, because the label beside it says "7 / 200" and a learner typing
 * what they read must land where they expect. Returns a zero-based index.
 */
export function jumpTo(input: string, total: number): number | null {
  const trimmed = input.trim();
  // `Number('')` is 0, and 0 is an integer, so an empty field used to jump the
  // learner to card 1 — pressing Go with nothing typed moved them. The empty
  // case has to be rejected before the number is looked at, not after.
  if (trimmed === '') return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || total === 0) return null;
  return Math.min(Math.max(n, 1), total) - 1;
}
