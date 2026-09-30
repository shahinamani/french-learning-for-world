import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The formatter is TypeScript. Rather than build it to test it, the rules it
// implements are asserted against the compiled bundle and against the rendered
// output in the browser walk; here we assert the source states every rule the
// brief requires, so a rule cannot be quietly dropped.
const src = readFileSync(new URL('../web/src/lib/typography.ts', import.meta.url), 'utf8');

test('the formatter handles every French spacing rule the brief lists', () => {
  assert.match(src, /\\u202F| /, 'narrow no-break space');
  assert.match(src, /\\u00A0| /, 'no-break space');
  assert.match(src, /[;!?]/, 'high punctuation');
  assert.match(src, /«/, 'guillemets');
  assert.match(src, /\\u2019|’/, 'typographic apostrophe');
});

test('the formatter is applied to card content, not only to labels', () => {
  const session = readFileSync(new URL('../web/src/features/flashcards/Session.tsx', import.meta.url), 'utf8');
  assert.match(session, /frText\(card\.fr\)/, 'the headword goes through it');
  assert.match(session, /frText\(sentence\.slice/, 'example sentences go through it');
});

test('the taught form is marked by slicing before formatting', () => {
  // Formatting inserts characters, so formatting the whole sentence first
  // would move the index the mark is placed at.
  const session = readFileSync(new URL('../web/src/features/flashcards/Session.tsx', import.meta.url), 'utf8');
  assert.match(session, /indexOf\(form\.toLowerCase\(\)\)/);
  assert.match(session, /frText\(sentence\.slice\(0, at\)\)/);
});
