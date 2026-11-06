/**
 * What can be said about a letter without understanding it.
 *
 * These are STRUCTURE checks: is there a greeting on its own line, a closing
 * formula, a date, a subject line; does a formal letter slip into tu, does a
 * letter to a friend sound like a letter to the bank. They read the shape of
 * the text and a short list of set phrases. They do not read the French, and
 * the screen says so: a letter can pass every one and be full of mistakes.
 *
 * Kept free of React so tests/letters-model.test.js can run it against the
 * model letters in content/letters.json (AGENTS.md section 3: a check runs
 * against known-good data before it lands).
 */
import type { LetterKind } from './types';

export type CheckId =
  | 'placeDate' | 'object' | 'salutation' | 'closing' | 'echo'
  | 'register' | 'tone' | 'signature' | 'placeholders';

/** ok: found. missing: expected and not there. warn: there, but something to look at. */
export type CheckState = 'ok' | 'missing' | 'warn';

export type Check = { id: CheckId; state: CheckState; found?: string[] };

/** Typed or pasted apostrophes come in two shapes; the checks compare one. */
const norm = (s: string) => s.replace(/[’ʼ`]/g, "'").replace(/[  ]/g, ' ');

/** Words separated by white space: « l'école » is one, « 39 euros » is two.
 *  The exam's own counting rule may differ, and the screen says so. */
export function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/** `\b` is ASCII-only in JavaScript and fails beside « à » or « é »; these are
 *  the same boundary for letters of any script. */
const word = (alternatives: string[], flags = 'giu') =>
  new RegExp(`(?<![\\p{L}'])(?:${alternatives.join('|')})(?![\\p{L}])`, flags);

const MONTHS = 'janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre';
const DATE = new RegExp(`(?<![\\p{L}])le\\s+(?:1er|\\d{1,2})\\s+(?:${MONTHS})(?![\\p{L}])|\\b\\d{1,2}[/.]\\d{1,2}[/.]\\d{2,4}\\b`, 'iu');
const OBJECT = /^\s*objet\s*:/imu;

/** A greeting is a short line of its own that ends in a comma (or « ! » after Salut). */
const FORMAL_GREETING = /^\s*((?:madame|monsieur|mesdames|messieurs|ma[iî]tre|docteur)(?:[\s,]+[\p{L}' -]*)?),\s*$/imu;
const EMAIL_GREETING = /^\s*(bonjour(?:\s+[\p{L}' -]+)?),\s*$/imu;
const INFORMAL_GREETING = /^\s*((?:cher|ch[èe]re|chers|ch[èe]res|salut|coucou|bonjour|hello)(?:\s+[\p{L}' -]+)?)\s*[,!]\s*$/imu;

const FORMAL_CLOSING = /(?:je\s+vous\s+prie|veuillez|recevez|je\s+vous\s+adresse)[^.]*?(?:salutations|sentiments|consid[ée]ration|respect)[^.]*\./iu;
const EMAIL_CLOSING = word(['cordialement', 'bien cordialement', 'bien à vous']);
const INFORMAL_CLOSING = word([
  'bises', 'grosses bises', 'bisous', "je t'embrasse", 'je vous embrasse', 'à bientôt', 'à très bientôt',
  'à très vite', 'à plus', 'amitiés', 'amicalement', 'bien amicalement', 'bien à toi', 'affectueusement',
  'gros bisous', 'je pense à toi',
]);

/** Familiar words that have no place in a letter to an office. */
const TOO_FAMILIAR = word(['salut', 'coucou', 'bises', 'bisous', "je t'embrasse", 'à plus', 'super', 'sympa', 'ça va']);
/** Set phrases that make a letter to a friend sound like one to the bank. */
const TOO_STIFF = word(["je vous prie d'agréer", "veuillez agréer", 'salutations distinguées', 'sentiments respectueux']);

/** The second-person forms. « t' » is elided before a vowel (t'ai, t'embrasse). */
const TU = /(?<![\p{L}'])(?:(?:tu|te|toi|ton|ta|tes)(?![\p{L}'])|t'(?=[\p{L}]))/giu;
const VOUS = word(['vous', 'votre', 'vos']);

const PLACEHOLDER = /\[[^\]\n]{1,80}\]/g;
const HAS_PLACEHOLDER = /\[[^\]\n]{1,80}\]/;

const lines = (text: string) => text.split(/\n/).map((l) => l.trim()).filter(Boolean);

const uniq = (xs: string[]) => [...new Set(xs.map((x) => x.toLowerCase()))];

const strip = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[\s,]+/g, ' ').trim();

/** The greeting as written, without its comma: « Madame, Monsieur ». */
export function greetingOf(kind: LetterKind, text: string): string | null {
  const t = norm(text);
  const re = kind === 'formal' ? FORMAL_GREETING : INFORMAL_GREETING;
  return re.exec(t)?.[1]?.trim() ?? null;
}

/**
 * Run every check that applies to this kind of letter.
 *
 * The list is the same length whatever the text: a check that is not met is
 * `missing`, never absent, so the learner sees what is expected before writing.
 */
export function checkLetter(kind: LetterKind, raw: string): Check[] {
  const text = norm(raw);
  const out: Check[] = [];
  const ls = lines(text);
  const last = ls[ls.length - 1] ?? '';

  // Place and date. Usual in both kinds; in a letter to a friend its absence is not a fault.
  out.push({ id: 'placeDate', state: DATE.test(text) ? 'ok' : kind === 'formal' ? 'missing' : 'warn' });

  if (kind === 'formal') {
    out.push({ id: 'object', state: OBJECT.test(text) ? 'ok' : 'missing' });
  }

  // Greeting.
  const greeting = greetingOf(kind, text);
  if (greeting) out.push({ id: 'salutation', state: 'ok', found: [greeting] });
  else if (kind === 'formal' && EMAIL_GREETING.test(text)) {
    out.push({ id: 'salutation', state: 'warn', found: [EMAIL_GREETING.exec(text)![1]!] });
  } else out.push({ id: 'salutation', state: 'missing' });

  // Closing formula.
  if (kind === 'formal') {
    const closing = FORMAL_CLOSING.exec(text)?.[0];
    if (closing) {
      out.push({ id: 'closing', state: 'ok' });
      // The closing repeats the greeting, between two commas.
      if (greeting) {
        out.push({ id: 'echo', state: strip(closing).includes(strip(greeting)) ? 'ok' : 'warn', found: [greeting] });
      }
    } else {
      const email = text.match(EMAIL_CLOSING);
      out.push(email ? { id: 'closing', state: 'warn', found: uniq(email) } : { id: 'closing', state: 'missing' });
    }
  } else {
    const closing = text.match(INFORMAL_CLOSING);
    out.push(closing ? { id: 'closing', state: 'ok', found: uniq(closing) } : { id: 'closing', state: 'missing' });
  }

  // Register and tone read the learner's words only: the outline's
  // instructions in [brackets] say « vous » to the learner, not to the reader.
  const own = text.replace(PLACEHOLDER, ' ');
  const tu = own.match(TU) ?? [];
  const vous = own.match(VOUS) ?? [];
  if (kind === 'formal') {
    out.push(tu.length ? { id: 'register', state: 'warn', found: uniq(tu) } : { id: 'register', state: vous.length ? 'ok' : 'missing' });
  } else {
    // Vous to a friend is right when writing to several friends at once, so
    // this is a question for the learner, never a fault.
    if (tu.length && !vous.length) out.push({ id: 'register', state: 'ok' });
    else if (vous.length) out.push({ id: 'register', state: 'warn', found: uniq(vous) });
    else out.push({ id: 'register', state: 'missing' });
  }

  // Tone: phrases from the other kind of letter.
  // « Objet : » is matched as a line of its own: « un objet » in a sentence is just a noun.
  const off = [...(own.match(kind === 'formal' ? TOO_FAMILIAR : TOO_STIFF) ?? []),
    ...(kind === 'informal' && OBJECT.test(own) ? ['Objet :'] : [])];
  out.push(off.length ? { id: 'tone', state: 'warn', found: uniq(off) } : { id: 'tone', state: 'ok' });

  // Signature: the last line is a name — short, and not a sentence.
  const signed = ls.length > 1 && last.split(/\s+/).length <= 4 && !/[.,;:!?]$/.test(last) && !HAS_PLACEHOLDER.test(last);
  out.push({ id: 'signature', state: signed ? 'ok' : 'missing' });

  // Brackets left over from the outline.
  const left = text.match(PLACEHOLDER) ?? [];
  out.push(left.length ? { id: 'placeholders', state: 'warn', found: left.slice(0, 3) } : { id: 'placeholders', state: 'ok' });

  return out;
}

/** The note-store key of a learner's draft for a task. */
export const draftKey = (taskId: string) => `draft.${taskId}`;
export const isDraftKey = (itemId: string) => itemId.startsWith('draft.letter.');
export const taskOfDraft = (itemId: string) => itemId.slice('draft.'.length);
