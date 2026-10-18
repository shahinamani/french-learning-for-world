/**
 * /app/grammar/:id — one lesson, in the order §10 gives:
 *
 *   concept → short explanation in the learner's language → two examples →
 *   the difference from the nearby concept → practice → answer with reason →
 *   return to the source activity
 *
 * The order is the content of the requirement, so it is the order of the page
 * and of the headings, and the walk checks it by reading the headings back.
 *
 * Nothing here is generated. The simpler explanation, the difference, the
 * reasons behind every answer are all fields of content/lessons.json; the
 * "simpler explanation" control swaps one stored field for another.
 *
 * The way back is `?from=`. See lessons.ts for why it lives in the address.
 */
import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { useApp } from '../../app-context';
import { Exercise } from '../exercise/Exercise';
import { Localised, anyUntranslated } from '../../components/Localised';
import { Num } from '../../components/Num';
import { pick } from '../../lib/exams';
import { fr as frText } from '../../lib/typography';
import { findLesson, lessonPath, safeOrigin, type Lesson, type LessonData } from './lessons';
import { PageState, useLessons, useLessonsGate } from './useLessons';
import './grammar.css';

export function GrammarLesson() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const { t } = useApp();
  const [state, retry] = useLessons();
  const gate = useLessonsGate(state, retry);
  const origin = safeOrigin(params.get('from'));
  const backTo = origin ?? '/app/grammar';

  if (gate) return <div className="page grl-page">{gate}</div>;
  if (state.status !== 'ready') return null;

  const lesson = findLesson(state.data.lessons, id);
  if (!lesson) {
    // A concept can exist with no lesson written for it (the old
    // /learn/concept/:id links land here). Say so, and keep the way back.
    return (
      <div className="page grl-page">
        <PageState kind="empty" title={t('grlNoLesson')} body={t('grlNoLessonHelp')}
                   primary={{ label: origin ? t('grlBackToOrigin') : t('grlBackToList'), to: backTo,
                              testId: 'grl-nolesson-back' }}
                   secondary={origin ? { label: t('grlBackToList'), to: '/app/grammar', testId: 'grl-nolesson-list' } : undefined} />
      </div>
    );
  }
  return <LessonView key={lesson.id} lesson={lesson} data={state.data} origin={origin} />;
}

function LessonView({ lesson, data, origin }: { lesson: Lesson; data: LessonData; origin: string | null }) {
  const { t, settings } = useApp();
  const navigate = useNavigate();
  const here = useLocation();
  const [simple, setSimple] = useState(false);
  const [index, setIndex] = useState(0);
  const [firstTries, setFirstTries] = useState<boolean[]>([]);

  const concept = data.concepts.get(lesson.conceptId);
  const nearby = data.concepts.get(lesson.nearbyConceptId);
  const nearbyLesson = data.lessons.find((l) => l.conceptId === lesson.nearbyConceptId);
  const nearbyName = nearby ? pick(nearby.name, settings.ui).text : lesson.nearbyConceptId;

  const backTo = origin ?? '/app/grammar';
  const backLabel = origin ? t('grlBackToOrigin') : t('grlBackToList');
  const total = lesson.questions.length;
  const finished = index >= total;

  // Anything shown in the learner's language that is not written in it.
  const missing = anyUntranslated([
    lesson.explanation, simple ? lesson.simplerExplanation : undefined, lesson.difference,
  ], settings.ui) || (finished ? false : anyUntranslated(
    [lesson.questions[index]?.explanation.right, lesson.questions[index]?.explanation.tempting], settings.ui));
  const unreviewed = !lesson.review?.teacher;

  const restart = () => { setIndex(0); setFirstTries([]); };

  return (
    <div className="page grl-page" data-testid="grammar-lesson" data-lesson={lesson.id}>
      <Link className="btn btn--ghost btn--sm grl-back" to={backTo} data-testid="grammar-back">
        ← {backLabel}
      </Link>

      {/* 1 · the concept */}
      <header>
        <div className="row gap-2">
          <span className={`chip chip--${lesson.level.toLowerCase()}`}>{lesson.level}</span>
        </div>
        <h1 className="h2" data-testid="grammar-concept"><Localised field={concept?.name} /></h1>
        {unreviewed && <p className="muted" data-testid="grammar-unreviewed">{t('grlDrafted')}</p>}
        {missing && <p className="muted notice-untranslated" data-testid="grammar-untranslated">{t('grlNotInYourLanguage')}</p>}
      </header>

      {/* 2 · the short explanation, in the learner's language */}
      <section className="card grl-step" aria-labelledby="grl-h-explanation" data-testid="grammar-step-explanation">
        <h2 id="grl-h-explanation" className="eyebrow">{t('grlStepExplanation')}</h2>
        <p className="grl-text" data-testid="grammar-explanation-text" data-variant={simple ? 'simple' : 'full'}
           aria-live="polite">
          <Localised field={simple ? lesson.simplerExplanation : lesson.explanation} />
        </p>
        <button type="button" className="btn btn--ghost btn--sm" aria-pressed={simple}
                onClick={() => setSimple((v) => !v)} data-testid="grammar-simpler">
          {simple ? t('grlFullAgain') : t('grlSimpler')}
        </button>
      </section>

      {/* 3 · two examples */}
      <section className="card grl-step" aria-labelledby="grl-h-examples" data-testid="grammar-step-examples">
        <h2 id="grl-h-examples" className="eyebrow">{t('grlStepExamples')}</h2>
        <ul className="grl-examples">
          {lesson.examples.map((ex, i) => (
            <li key={i} data-testid={`grammar-example-${i}`}>
              <p className="grl-ex__fr" lang="fr" dir="ltr">{frText(ex.fr)}</p>
              <p className="muted"><Localised field={{ fa: ex.fa, en: ex.en }} locale={settings.meaning} /></p>
            </li>
          ))}
        </ul>
      </section>

      {/* 4 · the difference from the nearby concept */}
      <section className="card grl-step" aria-labelledby="grl-h-difference" data-testid="grammar-step-difference">
        <h2 id="grl-h-difference" className="eyebrow">{t('grlStepDifference', { name: nearbyName })}</h2>
        <p className="grl-text" data-testid="grammar-difference-text"><Localised field={lesson.difference} /></p>
        {nearbyLesson && (
          <Link className="btn btn--ghost btn--sm" data-testid="grammar-nearby-link"
                to={lessonPath(nearbyLesson.id, here.pathname + here.search)}>
            {t('grlOpenNearby', { name: nearbyName })}
          </Link>
        )}
      </section>

      {/* 5 · practice, 6 · the answer with its reason, 7 · the way back */}
      <section className="card grl-step" aria-labelledby="grl-h-practice" data-testid="grammar-step-practice">
        <h2 id="grl-h-practice" className="eyebrow">{t('grlStepPractice')}</h2>
        {finished ? (
          <Exercise
            status="finished" testId="grammar-finished"
            message={{
              title: t('grlFinishedTitle'),
              body: t('grlFinishedScore', { n: firstTries.filter(Boolean).length, total }),
            }}
            action={{ label: origin ? t('grlReturnOrigin') : t('grlReturnList'),
                      onClick: () => navigate(backTo), testId: 'grammar-return' }}
            secondaryAction={{ label: t('grlPracticeAgain'), onClick: restart, testId: 'grammar-again' }}
          />
        ) : (
          <>
            <p className="muted" data-testid="grammar-progress">
              <Num>{t('grlQuestionOf', { n: index + 1, total })}</Num>
            </p>
            <Question key={index} q={lesson.questions[index]!}
                      onDone={(firstTry) => { setFirstTries((r) => [...r, firstTry]); setIndex((n) => n + 1); }} />
          </>
        )}
      </section>
    </div>
  );
}

function Question({ q, onDone }: { q: Lesson['questions'][number]; onDone: (firstTry: boolean) => void }) {
  const { settings } = useApp();
  return (
    <Exercise
      testId="grammar-exercise"
      prompt={<span lang="fr" dir="ltr">{frText(q.prompt.fr ?? '')}</span>}
      hint={<Localised field={{ en: q.prompt.en, fa: q.prompt.fa }} locale={settings.meaning} />}
      options={q.options}
      answer={q.answer}
      temptingWrong={q.temptingWrong}
      whyRight={<Localised field={q.explanation.right} />}
      whyTempting={<Localised field={q.explanation.tempting} />}
      onContinue={(r) => onDone(r.firstTry)}
    />
  );
}
