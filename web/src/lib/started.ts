/**
 * Has this person started studying here?
 *
 * One flag, and it answers exactly one question: **which page does `/` show** —
 * the landing page for a stranger, or the study dashboard for somebody who has
 * already worked here. It never answers what the data IS. Everything real
 * lives in IndexedDB and is read from there as it always was.
 *
 * Why it cannot be IndexedDB that decides: IndexedDB is asynchronous. By the
 * time it answers, the page has already painted, so a returning learner would
 * see the landing page flash on every single visit. `localStorage` is
 * synchronous, which is the only property being used here.
 *
 * It can be wrong, in both directions, and both are survivable:
 *
 * - **It can be empty when the person has studied** — a private window, a
 *   cleared site, another device, or a profile imported before this flag
 *   existed. They see the landing page once and press one button. That is the
 *   safe wrong answer, and it is why the flag is only ever read as "show the
 *   dashboard", never as "there is no data".
 * - **It can be set when there is nothing** — somebody who rated a card and
 *   then erased their data. The dashboard handles an empty profile already;
 *   that is what its honest-empty states are for.
 *
 * - **Reading or writing can THROW.** Safari in private mode throws on write;
 *   blocked site data throws on read. Both are caught, and a throw means
 *   "stranger", which is the same safe wrong answer.
 *
 * The key is namespaced because this origin may one day host more than this.
 */
const KEY = 'fmv.started';

/**
 * The same answer for this tab when the flag cannot be written.
 *
 * A learner in a private window who rates a card HAS started, and losing that
 * within the session would send them back to the landing page on the next
 * navigation. IndexedDB often still works where localStorage throws, so the
 * work is real even when the shortcut cannot be recorded.
 */
let startedInMemory = false;

/** True only if this person has definitely started. Any doubt answers false. */
export function hasStarted(): boolean {
  if (startedInMemory) return true;
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Called from the places that write a record — and from nowhere else.
 *
 * It is deliberately NOT called when a learner merely opens a page or presses
 * "Start learning". Reading a verb table stores nothing, so somebody who
 * browsed and left is still a stranger, and the privacy notice they have not
 * earned is still not shown to them.
 */
export function markStarted(): void {
  startedInMemory = true;
  try {
    localStorage.setItem(KEY, '1');
    // The boot script sets this before first paint on later visits; setting it
    // now means the privacy notice appears on this screen rather than the next
    // one, which is the moment it first became true.
    document.documentElement.dataset.started = '1';
  } catch {
    /* Private mode, blocked storage. The record itself still went to IndexedDB
       if that worked; only the shortcut is lost, and the cost of losing it is
       one extra landing page. */
  }
}

/** Erasing a profile makes the person a stranger again, which is the truth. */
export function clearStarted(): void {
  startedInMemory = false;
  try {
    localStorage.removeItem(KEY);
    delete document.documentElement.dataset.started;
  } catch {
    /* nothing to undo */
  }
}
