/**
 * A learner's letter drafts.
 *
 * They are rows of the shared `notes` store in `lib/db.ts`, keyed
 * [userId, `draft.<taskId>`], so a draft is exported with the learner's other
 * records, imported with them, and erased with them — no new store, no schema
 * change. A draft is the learner's own writing and nothing else: no score, no
 * marks. Erasing the text writes an empty note, which the list does not show.
 */
import { getNote, personalForUser, putNote } from '../../lib/db';
import { draftKey, isDraftKey, taskOfDraft } from './model';

export type Draft = { taskId: string; text: string; updatedAt: number };

export async function loadDraft(userId: string, taskId: string): Promise<Draft | null> {
  const row = await getNote(userId, draftKey(taskId));
  return row ? { taskId, text: row.text, updatedAt: row.updatedAt } : null;
}

export async function saveDraft(userId: string, taskId: string, text: string): Promise<void> {
  await putNote(userId, draftKey(taskId), text);
}

/** Every non-empty draft, newest first. */
export async function draftsFor(userId: string): Promise<Draft[]> {
  const { notes } = await personalForUser(userId);
  return notes
    .filter((n) => isDraftKey(n.itemId) && n.text.trim())
    .map((n) => ({ taskId: taskOfDraft(n.itemId), text: n.text, updatedAt: n.updatedAt }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}
