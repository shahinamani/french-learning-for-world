// Stable, content-derived card keys.
//
// Progress is stored against these, never against a card's position in a file.
// Insert one card at the top of a deck keyed by position and every saved review
// silently points at the wrong word. A key derived from the word itself
// survives reordering, re-sourcing and regeneration of the whole deck.
//
// Accents are stripped and case folded so that correcting "Etre" to "être"
// does not orphan the learner's history for that card.

const PREFIX = Object.freeze({ verb: 'v', noun: 'n', adjective: 'a', phrase: 'p' });

export function normalise(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '')
    .replace(/\s+/g, '-');
}

export function cardKey(type, french) {
  const prefix = PREFIX[type];
  if (!prefix) throw new Error(`unknown card type: ${type}`);
  return `${prefix}:${normalise(french)}`;
}
