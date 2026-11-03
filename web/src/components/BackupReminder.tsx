/**
 * "Save a copy of your progress", on Today, when it matters: the learner has
 * real history and no recent backup. One button downloads the file; "later"
 * waits a week. See lib/backup.ts.
 */
import { useEffect, useState } from 'react';
import { useApp, useUserId } from '../app-context';
import { allCardStates } from '../lib/db';
import { backupDue, downloadBackup, snoozeBackup } from '../lib/backup';

export function BackupReminder() {
  const { t } = useApp();
  const userId = useUserId();
  const [due, setDue] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    let live = true;
    allCardStates(userId)
      .then((s) => { if (live) setDue(backupDue(userId, s.filter((x) => x.reps > 0).length)); })
      .catch(() => {});
    return () => { live = false; };
  }, [userId]);

  if (done) return <p className="backup-note" role="status" data-testid="backup-done">{t('shellBackupDone')}</p>;
  if (!due) return null;
  return (
    <section className="backup-note" aria-labelledby="backup-h" data-testid="backup-reminder">
      <div>
        <h2 id="backup-h" className="backup-note__title">{t('shellBackupTitle')}</h2>
        <p className="backup-note__body">{t('shellBackupBody')}</p>
      </div>
      <div className="backup-note__actions">
        <button type="button" className="btn btn--primary btn--sm" data-testid="backup-save"
                onClick={async () => { await downloadBackup(userId); setDone(true); }}>{t('shellBackupSave')}</button>
        <button type="button" className="btn btn--ghost btn--sm" data-testid="backup-later"
                onClick={() => { snoozeBackup(userId); setDue(false); }}>{t('shellBackupLater')}</button>
      </div>
    </section>
  );
}
