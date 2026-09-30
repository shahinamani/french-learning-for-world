/**
 * Lives here, not in `lib/timer.ts`, because `timer.ts` must stay importable
 * without React.
 *
 * It was in `timer.ts`, whose other exports are pure functions over numbers and
 * strings. That one `import 'react'` made the whole module unloadable anywhere
 * React is not installed — including the CI `test` job, which installs no web
 * dependencies. The unit tests passed locally only because this container
 * happens to have `web/node_modules`, and went red the moment they ran on a
 * clean runner. A test that depends on something the build step does not have
 * is not testing the build.
 */
import { useEffect, useState } from 'react';

/**
 * A 250 ms tick, for anything that has to re-render against the wall clock.
 * Deliberately NOT a wrapper around `restore`: `restore` clears the timer when
 * it expires so the finish is reported once (the chime must not fire twice),
 * which means a second consumer polling it would race the first and lose.
 * Whoever needs "is it over" holds its own end time and compares it to now.
 */
export function useTick(ms = 250): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
  return tick;
}
