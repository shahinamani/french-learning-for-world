/**
 * What happens to a learner's progress, said before they need to know.
 *
 * This product keeps everything in the browser: no account, no server, nothing
 * sent anywhere. That is the right default and it has one sharp edge — clear
 * the browser and six months of review history is gone, with no way back and
 * nobody to ask. A learner who finds that out afterwards does not come back.
 *
 * So it is said on the first visit, before there is anything to lose, and it
 * stays reachable afterwards from Settings. It is not a cookie banner: there is
 * nothing to consent to, so there is no "accept". It is a notice with one
 * dismissal, remembered per profile.
 */
import { useState } from 'react';
import { useApp, useUserId } from '../app-context';
import { userKey } from '../lib/session';
import { hasStarted } from '../lib/started';

const SEEN = 'dataNoticeSeen';

/**
 * Dismissal when storage is unavailable — a private window, or a browser with
 * site data blocked.
 *
 * The first version treated "cannot read storage" as "already seen", to avoid
 * nagging on every paint. That was backwards: the learner whose data will NOT
 * survive the tab is the one who most needs to be told, and was the only one
 * never told. Holding the dismissal in memory gives both — shown once, dismissed
 * for the session, and gone when the tab closes, which is exactly when their
 * progress goes too.
 */
let dismissedInMemory = false;

function storageWorks(): boolean {
  try {
    const probe = 'flw:probe';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return true;
  } catch { return false; }
}

function seen(userId: string): boolean {
  // No usable id and no storage is precisely the blocked-storage learner, who
  // is the one this notice is for. Falling back to "already seen" here is what
  // hid it from them entirely.
  if (!userId || !storageWorks()) return dismissedInMemory;
  try { return localStorage.getItem(userKey(userId, SEEN)) === '1'; }
  catch { return dismissedInMemory; }
}

function remember(userId: string): void {
  dismissedInMemory = true;
  if (!userId || !storageWorks()) return;
  try { localStorage.setItem(userKey(userId, SEEN), '1'); } catch { /* in memory only */ }
}

/** The text itself, used both on first entry and as a permanent section. */
export function DataNoticeBody() {
  const { t } = useApp();
  return (
    <>
      <p>{t('dataStored')}</p>
      <p>{t('dataNotSent')}</p>
      <p><strong>{t('dataClear')}</strong></p>
      <p>{t('dataExport')}</p>
    </>
  );
}

/**
 * Shown once per profile on first entry.
 *
 * It is deliberately absent from the prerendered HTML: prerendering has no
 * storage and no learner, so the component resolves to nothing and the notice
 * appears on hydration. That keeps the prerendered markup deterministic, and it
 * means on a slow connection the page is readable for a moment before the
 * notice arrives. See docs/04-information-architecture.md.
 */
export function DataNotice() {
  const { t } = useApp();
  const userId = useUserId();
  const [dismissed, setDismissed] = useState(() => seen(userId));
  if (dismissed) return null;
  // Not on arrival — but only where waiting is safe, and that qualification is
  // the whole of this comment.
  //
  // The notice is about the durability of a learner's work. Until something has
  // been stored it is a paragraph about nothing, which is how it came to be the
  // first thing a stranger read on the front page. So with working storage it
  // waits for `hasStarted()`: the moment a record is first written — a rating,
  // a drill answer, an exam attempt, an import — and somebody who read a verb
  // table and left is never shown it, because they have nothing to lose.
  //
  // WHERE STORAGE DOES NOT WORK IT CANNOT WAIT. A private window, or a browser
  // with site data blocked, means nothing this learner does tonight will
  // survive the tab — and for them the notice is not premature, it is already
  // overdue. This exact person was hidden from once before, by a first version
  // that read "cannot read storage" as "already seen", and web/e2e/walk.mjs has
  // asserted ever since that they are told. Gating on `hasStarted()` alone
  // reintroduced that fault within the hour, because `hasStarted()` answers
  // false when it cannot read — and the walk caught it.
  //
  // So: defer when storage works, never when it does not. The full text stays
  // permanently in Settings either way.
  if (storageWorks() && !hasStarted()) return null;
  return (
    <section className="card card--raised" data-testid="data-notice"
             aria-labelledby="data-notice-h">
      <h2 id="data-notice-h" className="h3">{t('dataTitle')}</h2>
      <DataNoticeBody />
      <button className="btn btn--primary" data-testid="data-notice-dismiss"
              onClick={() => { remember(userId); setDismissed(true); }}>
        {t('dataUnderstood')}
      </button>
    </section>
  );
}
