/**
 * "This lesson": its level and topic, the concept it is easily confused with
 * (a link, when that concept has a lesson), how far through the questions the
 * learner is, and the lesson that follows in the library's order.
 */
import '../../lib/locales/en/todayEn';
import { Link } from 'react-router';
import { useApp } from '../../app-context';
import type { Lesson, LessonData } from '../../features/grammar/lessons';
import { lessonPath, topicOf } from '../../features/grammar/lessons';
import { Localised } from '../Localised';
import { Num } from '../Num';
import { AsideCard } from './index';

export function LessonFactsCard({ lesson, data, index, origin }:
  { lesson: Lesson; data: LessonData; index: number; origin: string | null }) {
  const { t } = useApp();
  const topic = topicOf(data.concepts, lesson.conceptId);
  const nearby = data.concepts.get(lesson.nearbyConceptId);
  const nearbyLesson = data.lessons.find((l) => l.conceptId === lesson.nearbyConceptId);
  const at = data.lessons.findIndex((l) => l.id === lesson.id);
  const next = at >= 0 ? data.lessons[at + 1] ?? null : null;
  const total = lesson.questions.length;
  const here = origin ?? undefined;
  return (
    <AsideCard title={t('tdBsThisLesson')} testId="aside-lesson">
      <dl className="aside-facts">
        <dt>{t('tdBsLevel')}</dt><dd><span className={`chip chip--${lesson.level.toLowerCase()}`}>{lesson.level}</span></dd>
        {topic && <><dt>{t('tdBsTopic')}</dt><dd><Localised field={topic.name} /></dd></>}
        <dt>{t('tdBsNearby')}</dt>
        <dd>
          {nearbyLesson
            ? <Link to={lessonPath(nearbyLesson.id, here)} data-testid="aside-nearby">{nearby ? <Localised field={nearby.name} /> : lesson.nearbyConceptId}</Link>
            : nearby ? <Localised field={nearby.name} /> : <span>{lesson.nearbyConceptId}</span>}
        </dd>
        <dt>{t('grlStepPractice')}</dt>
        <dd><Num>{index >= total ? t('tdBsQuestionsDone', { m: total }) : t('grlQuestionOf', { n: index + 1, total })}</Num></dd>
      </dl>
      <div className="session-aside__rail rail" aria-hidden="true">
        <span className="rail__fill" style={{ width: `${total ? (Math.min(index, total) / total) * 100 : 0}%` }} />
      </div>
      <p className="aside-card__facts">{t('tdBsNextLesson')}</p>
      {next
        ? <Link className="aside-card__link" to={lessonPath(next.id, here)} data-testid="aside-next-lesson">
            <Localised field={data.concepts.get(next.conceptId)?.name} /> · {next.level}
          </Link>
        : <p className="muted fine">{t('tdBsLastLesson')}</p>}
    </AsideCard>
  );
}
