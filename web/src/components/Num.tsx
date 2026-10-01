/**
 * A run of digits and separators, isolated from the paragraph around it.
 *
 * `{index + 1} / {queue.length}` renders as three bare text nodes. Digits are
 * weak and the slash is neutral, so inside a right-to-left paragraph the whole
 * run resolves right-to-left and "1 / 22" is shown as "22 / 1". Found on the
 * Persian flashcard screen; the data was never wrong.
 *
 * This is the same fault `translator()` already prevents for substituted
 * values, and the same reason it lives in one place: a rule applied at call
 * sites is a rule one call site will always miss.
 */
export function Num({ children, className, testId }:
  { children: React.ReactNode; className?: string; testId?: string }) {
  return (
    <span className={className} dir="ltr" style={{ unicodeBidi: 'isolate' }} data-testid={testId}>
      {children}
    </span>
  );
}
