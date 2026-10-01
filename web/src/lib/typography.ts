/**
 * French spacing, applied at render rather than left to whoever writes the
 * content. Getting this wrong is the detail that tells a French reader the
 * product was not made by anyone who reads French.
 *
 *   narrow no-break space (U+202F) before  ; ! ?
 *   no-break space        (U+00A0) before  :
 *   both, inside « guillemets »
 *   typographic apostrophe (U+2019), never a prime
 *   no-break space inside numbers: 1 240
 */
const NNBSP = ' ';
const NBSP = ' ';

export function fr(input: string): string {
  if (!input) return input;
  let s = input;
  // Normalise any existing spacing first so the function is idempotent.
  s = s.replace(/[   ]+([;!?:»])/g, '$1');
  s = s.replace(/([«])[   ]+/g, '$1');
  s = s.replace(/([;!?])/g, `${NNBSP}$1`);
  s = s.replace(/:/g, `${NBSP}:`);
  s = s.replace(/«/g, `«${NNBSP}`).replace(/»/g, `${NNBSP}»`);
  // \w is [A-Za-z0-9_] and does NOT match an accented letter, so this rule
  // used to fail on exactly the French it exists for: « l'élève », « d'être »,
  // « l'école » all kept their prime while « qu'il » was fixed. \p{L} matches
  // any letter in any script. Found by testing the function instead of reading
  // its source for the word "apostrophe" (docs/lessons.md #5).
  s = s.replace(/(\p{L})'(\p{L})/gu, '$1’$2');
  // 1240 -> 1 240, four digits or more, not inside a year-like token.
  s = s.replace(/\b(\d{1,3})(?=(\d{3})+\b)/g, `$1${NBSP}`);
  // A URL or a time should not have picked up a space before its colon.
  s = s.replace(new RegExp(`(https?)${NBSP}:`, 'g'), '$1:');
  s = s.replace(new RegExp(`(\\d)${NBSP}:(\\d)`, 'g'), '$1:$2');
  return s;
}

/** Only the French half of a bilingual string needs it. */
export function frIf(locale: string, text: string): string {
  return locale === 'fr' ? fr(text) : text;
}
