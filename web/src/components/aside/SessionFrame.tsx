/**
 * The three-column frame of a focus-mode session (cards, the verb drill):
 * a side column, the session itself, a side column. From 1280 px the three sit
 * side by side, centred, the card keeping the width it has always had; below
 * that the card comes first and the two columns follow it.
 *
 * Owner, 2026-11-19: on a 1920 px screen the session was a 44 rem column with
 * nothing either side of it. The columns carry the learner's own record of the
 * session and the facts of the card in front of them, never invented numbers.
 */
import type { ReactNode } from 'react';

export function SessionFrame({ left, right, leftLabel, rightLabel, children }:
  { left: ReactNode; right: ReactNode; leftLabel: string; rightLabel: string; children: ReactNode }) {
  return (
    <div className="session3" data-testid="session-frame">
      <aside className="session3__side session3__left" aria-label={leftLabel}>{left}</aside>
      <div className="session3__main">{children}</div>
      <aside className="session3__side session3__right" aria-label={rightLabel}>{right}</aside>
    </div>
  );
}
