/**
 * What `/` shows: the landing page to a stranger, the dashboard to a learner.
 *
 * Two pages, one address, because a returning learner should not be sold to
 * every time they open the site, and a stranger should not be handed somebody
 * else's empty dashboard.
 *
 * The decision is made from `hasStarted()` — a synchronous localStorage flag —
 * and not from the real record, which lives in IndexedDB and is asynchronous.
 * Reading the real record means this component renders BEFORE the answer
 * arrives, so a returning learner would see the landing page flash on every
 * visit. lib/started.ts sets out what the flag is allowed to know (which page)
 * and what it must never be read as (whether there is data).
 *
 * The flag can be wrong, and the asymmetry is deliberate: an unset flag shows
 * the landing page, so a learner whose storage was cleared sees one extra
 * screen with a button on it. The opposite mistake — a stranger shown an empty
 * dashboard — is the one we had, and it is worse.
 *
 * The prerendered HTML is the LANDING page, because that is what a search
 * engine reads and what a stranger sees first. public/boot.js hides it before
 * first paint for a returning learner, so nobody sees the pitch flash past.
 * `started` here is read at render time rather than passed down, because the
 * prerender has no storage at all and must take the stranger's branch.
 */
import { Learn } from './Learn';
import { Landing } from './Landing';
import { hasStarted } from '../lib/started';

export function Home() {
  // Read once per mount, not in state: this is not a value that changes while
  // somebody is looking at the page. The one thing that would change it —
  // starting to study — navigates away from here first.
  return hasStarted() ? <Learn /> : <Landing />;
}
