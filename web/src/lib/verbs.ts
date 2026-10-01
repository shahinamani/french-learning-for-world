import type { Level, Locale } from './types';

export type VerbTense = {
  id: string; mood: string;
  /** fa and ar exist in content/verbs.json. A two-language type discarded them. */
  name: Partial<Record<Locale, string>>;
  forms: string[]; conceptId: string;
};
export type Verb = {
  infinitive: string; key: string; level: Level; group: string; irregular: boolean;
  auxiliary: 'avoir' | 'être';
  meanings: Partial<Record<Locale, string>>;
  participles: { past: string; present: string };
  imperative: string[] | null;
  persons: string[];
  tenses: VerbTense[];
  conceptIds: string[];
};

let cache: Promise<Verb[]> | null = null;

export function loadVerbs(): Promise<Verb[]> {
  if (!cache) {
    cache = fetch('./content/verbs.json')
      .then((r) => { if (!r.ok) throw new Error('verbs'); return r.json(); })
      .then((d) => d.verbs as Verb[])
      .catch((e) => { cache = null; throw e; });
  }
  return cache;
}
