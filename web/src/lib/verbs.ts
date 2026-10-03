/**
 * Verbs, in two pieces, because 2,389 paradigms are not one request.
 *
 * The whole set is 2.87 MiB of JSON. Sending that to open a verb list would be
 * twenty times the entire JavaScript budget, so it is split the way a learner's
 * session splits:
 *
 *   verbs-index.json      every verb, one line each — 71 KiB gzipped. The list
 *                         and the search read this and nothing else.
 *   verbs/<level>.json    the paradigms, by CEFR level, 34–82 KiB gzipped each,
 *                         fetched when a learner opens a verb at that level.
 *
 * Those two numbers were 26 and "24–52" in this comment until 2026-10-02, and
 * had been wrong for several commits: the index grew when glosses were added
 * and nobody re-measured. A comment stating a measured size is a claim, and a
 * claim nothing checks goes stale silently — `tests/glosses.test.js` now fails
 * if the index passes 90 KiB gzipped, so the next person is told rather than
 * trusting this paragraph.
 *
 * Sharded by level rather than by letter because that is what a session
 * follows: somebody working at B1 opens B1 verbs and never touches C2's
 * paradigms. Sharding by first letter would spread one session across every
 * shard and cache none of it usefully.
 *
 * Tense names live in `content/tense-names.json`, once, because a tense is
 * called the same thing whatever verb it belongs to. In the old 14-verb file
 * each name was repeated fourteen times; at this size it would have been
 * repeated 2,389 times, and nobody could have reviewed the Arabic.
 */
import type { Level, Locale } from './types';

export type VerbTense = {
  id: string;
  mood: string;
  /** False for the passé simple and the imperfect subjunctive: a learner reads
   *  them and is never asked to write them, so no drill offers them. */
  produced: boolean;
  /** The concept this tense exercises, so a wrong answer reaches the weakness
   *  model. Null for the read-only tenses: nothing drills them, so nothing can
   *  be weak at them, and a wrong id would be worse than none. */
  conceptId: string | null;
  forms: string[];
  /** A second spelling French also accepts, per person, empty where there is
   *  only one: « essaye » beside « essaie », « martelle » beside « martèle ».
   *  A drill that refuses these marks a correct learner wrong. */
  accepted?: string[];
};

export type Verb = {
  infinitive: string; key: string; level: Level; rank: number;
  group: string; pattern: string; irregular: boolean;
  /** « il faut », « il pleut » — a third person and nothing else. */
  impersonal: boolean;
  auxiliary: 'avoir' | 'être';
  meanings: Partial<Record<Locale, string>>;
  participles: { past: string; present: string };
  imperative: string[] | null;
  persons: string[];
  tenses: VerbTense[];
  provenance: string;
  licence: string;
  /** "wiktionary-en" for the 2,373 taken from the source as-is, "teacher" for
   *  the handful a French teacher has ruled on — which is what lets the page
   *  stop calling those unreviewed. */
  glossProvenance: 'wiktionary-en' | 'teacher' | null;
  /** A lemma that is also a common word of another part of speech. « fier » the
   *  verb and « fier » the adjective are different words, and a learner
   *  meeting one needs telling that the other exists. */
  homograph: string | null;
  /** soutenu / standard / familier / argotique.
   *
   *  **Null means nobody has said, which is NOT the same as "standard".** It
   *  cannot be derived, and that was measured: 89% of the verbs carry no
   *  register label anywhere in their Wiktionary senses, and the spoken/written
   *  frequency skew does not separate the labelled from the unlabelled well
   *  enough to stand in — 26% of unlabelled verbs are as spoken-skewed as the
   *  median informal one. A default pretending to be a judgement is how
   *  « souvenir » went unmarked for 51 verbs. */
  register: 'soutenu' | 'standard' | 'familier' | 'argotique' | null;
  /** "teacher" where a person ruled; "derived" where it came from a label on
   *  the leading Wiktionary sense, which is a draft and not a reading. */
  registerProvenance: 'teacher' | 'derived' | null;
  /** False where a learner should recognise the verb and not be drilled on
   *  producing it: `argotique` at any level, `familier` at A1 or A2.
   *
   *  A `familier` verb IS produced from B1, with its register shown — the
   *  A1/A2 block exists so nobody learns « bosser » as if it were
   *  « travailler », and withholding it later would teach a French nobody
   *  speaks. */
  produce: boolean;
  /** Set when every sense Wiktionary records is labelled vulgar, so the page can
   *  say why it shows no meaning instead of rendering an empty line that looks
   *  like a bug. Null for every other verb. */
  glossWithheld: 'explicit' | null;
  /** True for the 51 verbs that exist only with a reflexive pronoun. The
   *  headword is then « se souvenir », not « souvenir », and every row of the
   *  table carries the pronoun. */
  pronominal: boolean;
  /** « se souvenir » / « s'évanouir ». Null unless `pronominal`. */
  headword: string | null;
  /** Something a learner should be told about this verb — an accepted
   *  alternative spelling, a defective paradigm, a point still unsettled. */
  notes: string | null;
};

/** One line per verb: what the list and the search need, and nothing more. */
export type VerbSummary = {
  infinitive: string; key: string; level: Level; rank: number;
  group: string; irregular: boolean; auxiliary: 'avoir' | 'être';
  en: string;
  /** Present only for a pronominal-only verb, so the LIST shows « se souvenir »
   *  too. A learner who reads the wrong headword in the list has already
   *  learned it wrong before they open the verb. */
  headword?: string;
};

export type TenseNames = Record<string, Partial<Record<Locale, string>>>;

const json = async <T,>(path: string, what: string): Promise<T> => {
  const r = await fetch(path);
  if (!r.ok) throw new Error(what);
  return r.json() as Promise<T>;
};

let indexCache: Promise<VerbSummary[]> | null = null;
const shardCache = new Map<Level, Promise<Verb[]>>();
let namesCache: Promise<TenseNames> | null = null;

export function loadVerbIndex(): Promise<VerbSummary[]> {
  if (!indexCache) {
    indexCache = json<{ verbs: VerbSummary[] }>('./content/verbs-index.json', 'verb index')
      .then((d) => d.verbs)
      .catch((e) => { indexCache = null; throw e; });
  }
  return indexCache;
}

export function loadTenseNames(): Promise<TenseNames> {
  if (!namesCache) {
    namesCache = json<{ tenses: TenseNames }>('./content/tense-names.json', 'tense names')
      .then((d) => d.tenses)
      .catch((e) => { namesCache = null; throw e; });
  }
  return namesCache;
}

function loadLevel(level: Level): Promise<Verb[]> {
  let p = shardCache.get(level);
  if (!p) {
    p = json<{ verbs: Verb[] }>(`./content/verbs/${level}.json`, `verbs ${level}`)
      .then((d) => d.verbs)
      .catch((e) => { shardCache.delete(level); throw e; });
    shardCache.set(level, p);
  }
  return p;
}

/**
 * One verb, with its paradigm. Null when the infinitive is not one we ship —
 * which includes the eight withheld on purpose, so a learner following an old
 * link gets the not-found screen rather than an invented conjugation.
 */
let formsCache: Promise<Record<string, string>> | null = null;

/**
 * Every conjugated form back to its infinitive — 82,798 of them, 237 KiB
 * gzipped. Deliberately NOT loaded with the verb list: it is fetched the first
 * time a search finds nothing, which is the only time it can help. A learner
 * typing « allons » should find aller; every other learner should not pay
 * 237 KiB for it.
 */
export function loadVerbForms(): Promise<Record<string, string>> {
  if (!formsCache) {
    formsCache = json<{ forms: Record<string, string> }>('./content/verb-forms.json', 'verb forms')
      .then((d) => d.forms)
      .catch((e) => { formsCache = null; throw e; });
  }
  return formsCache;
}

export async function loadVerb(infinitive: string): Promise<Verb | null> {
  const index = await loadVerbIndex();
  const summary = index.find((v) => v.infinitive === infinitive);
  if (!summary) return null;
  const shard = await loadLevel(summary.level);
  return shard.find((v) => v.infinitive === infinitive) ?? null;
}
