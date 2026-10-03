/**
 * The reflexive pronoun, for the verbs that cannot be used without one.
 *
 * « souvenir » was shown as a bare infinitive, glossed "to remember", and
 * conjugated « je souviens » on every row of its table. That is not French.
 * The verb exists only as « se souvenir », and a learner reading our table
 * would have written « je souviens » in an exam having learned it from us —
 * the teaching-something-false failure this product is built not to have.
 *
 * Forty-four of the 2,389 verbs are pronominal-only. Roughly five hundred more
 * have a pronominal sense among others — « trouver » and « se trouver » — and
 * those keep the bare infinitive, because that is correct for them.
 *
 * Elision is decided by the FORM, not by the infinitive: « se souvenir » gives
 * « je me souviens » but « s'en souvenir » is a different construction, and
 * « s'évanouir » gives « je m'évanouis ». The pronoun is chosen against the
 * word it will actually sit in front of.
 */

/** me / te / se, by person index, with nous and vous unchanged. */
const PRONOUN = ['me', 'te', 'se', 'nous', 'vous', 'se'] as const;

/** Elides before a vowel. Not before h: « se hâter » keeps its pronoun, and
 *  « s'habiller » does not, and nothing in the spelling distinguishes the two
 *  h's. No pronominal-only verb in the content begins with h — a check asserts
 *  that stays true, so the day one arrives the suite says so rather than
 *  guessing wrong in silence. */
const VOWEL = /^[aàâäeéèêëiîïoôöuùûüy]/i;

export function reflexivePronoun(personIndex: number, form: string): string {
  const base = PRONOUN[personIndex] ?? '';
  if (base === 'nous' || base === 'vous') return base;
  return VOWEL.test(form.trim()) ? `${base.slice(0, 1)}'` : base;
}

/** « je » + « me » + « souviens » → "je me souviens"; a vowel gives "je m'évanouis". */
export function withPronoun(person: string, personIndex: number, form: string): string {
  const p = reflexivePronoun(personIndex, form);
  return p.endsWith("'") ? `${person} ${p}${form}` : `${person} ${p} ${form}`;
}


/**
 * The name of a verb, as a learner must read it.
 *
 * Every learner-facing surface goes through here. The reason is the defect this
 * file exists for: `souvenir` was fixed on the detail page and in the drill, and
 * the LIST went on printing the bare infinitive for another day, because the
 * fix was applied at call sites and the list was a call site nobody listed.
 * Three surfaces, two fixed, and the learner meets the list first.
 *
 * `infinitive` remains the identifier — the route, the record key, the index
 * lookup. This is only what is shown.
 */
export function verbLabel(v: { infinitive: string; headword?: string | null }): string {
  return v.headword || v.infinitive;
}
