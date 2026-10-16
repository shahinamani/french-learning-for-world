/**
 * The educational back of a card: a meaning, worked examples, and a note.
 *
 * Separate from `content/fr-core-a1.json` and from the verb index because it
 * covers both and neither owns it. It is keyed by the SAME card key the review
 * log uses, so enriching a card cannot move it, renumber it, or detach it from
 * its history — the enrichment is something the card gains, not something it
 * becomes.
 *
 * Lazily fetched, once. A learner who never opens a card back never pays for
 * it, and it is outside the 150 KB first-load budget by construction.
 */
import type { Level } from './types';

/** Tense ids are the ones in `content/tense-names.json`, already in four languages. */
export type BackTense = 'present' | 'passe-compose' | 'futur';

export type BackExample = {
  /** Absent on a non-verb card: a noun has no tense, and labelling one would
   *  be a grammatical claim about a word that cannot carry it. */
  tense?: BackTense;
  /** The conjugated group, as a LITERAL substring of `fr` so the screen can
   *  find and highlight it. Checked by tests/card-backs.test.js. */
  form: string;
  fr: string;
  fa: string;
  en: string;
};

export type CardBack = {
  type: 'verb' | 'noun';
  level: Level;
  /** The Persian meaning of the headword. */
  fa: string;
  article?: string;
  /** `impersonal` and `pronominal` are the verbs that cannot fill three
   *  ordinary slots, and the note says why rather than the slots being faked. */
  pattern?: 'standard' | 'impersonal' | 'pronominal';
  usage?: string;
  source: string;
  examples: BackExample[];
};

export type CardBacks = {
  version: number;
  licence: string;
  reviewNote: string;
  backs: Record<string, CardBack>;
};

let cache: Promise<Map<string, CardBack>> | null = null;

export function loadCardBacks(): Promise<Map<string, CardBack>> {
  if (!cache) {
    cache = fetch('content/card-backs.json')
      .then((r) => {
        if (!r.ok) throw new Error('card-backs');
        return r.json() as Promise<CardBacks>;
      })
      .then((d) => new Map(Object.entries(d.backs)))
      // A missing enrichment file is not a broken app: every card still has
      // its gloss. The screen says "gloss only" for all of them, which is
      // true, rather than showing an error over working content.
      .catch(() => new Map<string, CardBack>());
  }
  return cache;
}

/**
 * Split `fr` around `form` so the conjugated group can be marked.
 *
 * Returns the three pieces, or null when the form is not in the sentence —
 * in which case the caller shows the sentence unmarked rather than guessing.
 * The content test makes that case impossible in shipped data; this is what
 * happens if it ever becomes possible anyway.
 */
export function splitOnForm(fr: string, form: string):
  { before: string; match: string; after: string } | null {
  const at = fr.indexOf(form);
  if (!form || at < 0) return null;
  return { before: fr.slice(0, at), match: fr.slice(at, at + form.length),
           after: fr.slice(at + form.length) };
}

/** Eligible, enriched, reviewed — the three numbers the page reports. */
export type Coverage = { eligible: number; enriched: number; reviewed: number };

/**
 * `reviewed` is 0 and is counted rather than assumed.
 *
 * Nothing in `card-backs.json` carries a review record, because nobody has
 * reviewed any of it. The number is derived here so that the day somebody
 * does, the page moves on its own — and so that "0 reviewed" is a measurement
 * on screen rather than a claim in a document.
 */
export function coverage(eligibleKeys: string[], backs: Map<string, CardBack>): Coverage {
  let enriched = 0;
  for (const k of eligibleKeys) if (backs.has(k)) enriched++;
  return { eligible: eligibleKeys.length, enriched, reviewed: 0 };
}
