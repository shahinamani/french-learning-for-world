import { useApp } from '../app-context';
import { pick } from '../lib/exams';
import { fr as frText } from '../lib/typography';
import type { Locale } from '../lib/types';

/**
 * Renders a field that may not exist in the learner's language.
 *
 * The first RTL screenshot of the exam paper screen showed English prose inside
 * a Persian page with its full stops moved to the wrong end of each line:
 *
 *     …with at least 5 of 25 on .each
 *     …not a mock paper of the same length .a
 *     8 original questions, not the 4 → "the 4 8 exercises"
 *
 * An English run dropped into an RTL paragraph is resolved by the bidi
 * algorithm against the paragraph's direction, so the trailing punctuation and
 * the digits move. `dir="auto"` resolves the run on its own first-strong
 * character instead, which is right whichever language comes back.
 *
 * It is a component and not a rule in a review checklist for the reason the
 * translator's isolation is one line: a rule applied at call sites is a rule
 * one call site will always miss, and it will be the one added next month.
 * Every place that shows text whose language is not guaranteed goes through
 * here, and the markup cannot be forgotten.
 */
export function Localised(
  { field, className, testId }:
  { field: Partial<Record<Locale, string>> | undefined; className?: string; testId?: string },
) {
  const { settings } = useApp();
  const { text, locale } = pick(field, settings.ui);
  if (!text) return null;
  return (
    <span className={className} lang={locale} dir="auto" data-testid={testId}>
      {locale === 'fr' ? frText(text) : text}
    </span>
  );
}

/** True when nothing in `fields` exists in the learner's language. */
export function anyUntranslated(
  fields: (Partial<Record<Locale, string>> | undefined)[], ui: Locale,
): boolean {
  return fields.some((f) => f && !pick(f, ui).translated);
}
