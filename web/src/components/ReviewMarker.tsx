/**
 * What a learner is told about who checked a question.
 *
 * One component for the paper, the sitting and the results screens, because
 * three copies of this logic is three chances for one of them to say something
 * the other two do not. The rule it enforces is single: **only an attributable,
 * current, approving teacher record removes the "not checked by a teacher"
 * line.** Everything else — no record, the author's own approval, a rejection,
 * a record whose fingerprint no longer matches the question — leaves it there,
 * and says why where saying why helps.
 */
import { useApp } from '../app-context';
import { teacherStatus } from '../lib/review-status';
import type { ExamItem } from '../lib/exams';

type Props = { item: ExamItem; className?: string; testId?: string };

export function ReviewMarker({ item, className = 'muted', testId }: Props) {
  const { t } = useApp();
  const status = teacherStatus(item);

  if (status.verified) {
    return (
      <p className={className} data-testid={testId ?? 'review-teacher-checked'}>
        {t('itemTeacherChecked', { who: status.by, credential: status.credential })}
      </p>
    );
  }

  // The owner decided on 2026-11-06 that learners are not shown "not checked
  // by a teacher" lines. The review record is kept; only a positive teacher
  // check is shown.
  void testId;
  return null;
}
