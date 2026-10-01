/**
 * Folding a LABEL for comparison, in any of the four interface languages.
 *
 * This is not `web/src/lib/fold.ts` and must never replace it. That one folds
 * FRENCH for answer checking and search: it expands œ/æ and is deliberately
 * tuned to what a learner types into a French answer box. This one exists only
 * so a test can ask "do these two labels read as the same label?" across
 * English, French, Persian and Arabic.
 *
 * The first version of this check, in concept-names-distinct.test.js, ended
 * with `.replace(/[^a-z0-9']+/g, ' ')` — an ASCII character class, which is
 * docs/lessons.md #7, in a test written the same day #7 was written up. Every
 * Arabic and Persian string folded to the empty string:
 *
 *     foldLabel('العربية')  ->  ''      foldLabel('فارسی')  ->  ''
 *
 * Extended to four languages unchanged, it would have reported every Arabic
 * label as colliding with every other, and been switched off inside a week.
 *
 * What has to happen for Persian and Arabic specifically, none of which NFD or
 * NFC does on its own:
 *
 *   - ZWNJ (U+200C) is the Persian half-space. It is INVISIBLE. `می‌رود` and
 *     `میرود` differ by one codepoint and look the same to anyone who does not
 *     read Persian, which is everyone in this loop.
 *   - Arabic kaf ك (U+0643) and yeh ي (U+064A) versus Persian keheh ک (U+06A9)
 *     and farsi yeh ی (U+06CC). Different codepoints, near-identical glyphs.
 *   - Tatweel ـ (U+0640) is decoration and carries no meaning.
 *   - Harakat (fatha, damma, shadda…) are combining marks and optional.
 *   - Arabic-Indic ٠١٢ and extended Arabic-Indic ۰۱۲ are the same digits as 012.
 *   - Bidi controls (U+200E/F, U+202A–E, U+2066–9) are invisible by definition.
 */

const ZERO_WIDTH = /[​-‏‪-‮⁦-⁩ـ﻿]/g;

/** Letterforms that differ by codepoint and not by reading. */
const UNIFY = [
  [/[ك]/g, 'ک'],            // ك -> ک
  [/[يى]/g, 'ی'],      // ي ى -> ی
  [/[ة]/g, 'ه'],            // ة -> ه
  [/[أإآٱ]/g, 'ا'], // أ إ آ ٱ -> ا
  [/[ۀە]/g, 'ه'],
];

/** ٠-٩ and ۰-۹ fold onto 0-9. */
const digits = (s) => s.replace(/[٠-٩۰-۹]/g, (d) => {
  const c = d.codePointAt(0);
  return String(c >= 0x06F0 ? c - 0x06F0 : c - 0x0660);
});

export function foldLabel(s) {
  let out = String(s).normalize('NFKC');
  out = out.replace(ZERO_WIDTH, '');
  for (const [re, to] of UNIFY) out = out.replace(re, to);
  out = digits(out)
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')      // French accents AND Arabic harakat
    .toLowerCase()
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
    .replace(/[’ʼ']/g, "'")
    .replace(/[\p{P}\p{S}]+/gu, ' ')   // punctuation, any script
    .replace(/\s+/gu, ' ')
    .trim();
  return out;
}

export const sameLabel = (a, b) => foldLabel(a) === foldLabel(b);

/** Characters that are invisible and therefore cannot be reviewed by eye. */
export const INVISIBLE = {
  zwnj: /‌/g,          // legitimate in Persian, suspect elsewhere
  zwj: /‍/g,
  bidi: /[‎‏‪-‮⁦-⁩]/g,
  tatweel: /ـ/g,
  nbsp: / /g,
  bom: /﻿/g,
};

/** Script membership, for "is this value actually in the language it claims?" */
export const SCRIPT = {
  arabic: /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/u,
  latin: /[A-Za-zÀ-ɏ]/u,
  /** Letters Persian should not use, because Persian has its own. */
  arabicOnlyInPersian: /[كية]/gu,
};
