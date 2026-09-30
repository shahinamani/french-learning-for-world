import type { Card, Concept } from './types';

export type Content = { cards: Card[]; concepts: Concept[]; conceptById: Map<string, Concept> };

let cache: Promise<Content> | null = null;

/** Content is not learner data, so one shared fetch is safe and correct. */
export function loadContent(): Promise<Content> {
  if (!cache) {
    cache = (async () => {
      const [index, concepts] = await Promise.all([
        fetch('./content/decks.json').then(r => { if (!r.ok) throw new Error('decks'); return r.json(); }),
        fetch('./content/concepts.json').then(r => { if (!r.ok) throw new Error('concepts'); return r.json(); }),
      ]);
      const decks = await Promise.all(index.decks.map((d: { file: string }) =>
        fetch(`./content/${d.file}`).then(r => { if (!r.ok) throw new Error(d.file); return r.json(); })));
      const cards: Card[] = decks.flatMap((deck: { cards: Card[] }) => deck.cards);
      const list: Concept[] = concepts.concepts;
      return { cards, concepts: list, conceptById: new Map(list.map(c => [c.id, c])) };
    })().catch((e) => { cache = null; throw e; });
  }
  return cache;
}
