/**
 * Exercise — the §16 component: question, input, check, an EXPLANATORY answer,
 * retry, continue.
 *
 * Right/wrong is not the product. The reason is. So after a check this shows
 *   - why the right answer is right, always; and
 *   - when the learner picked the TEMPTING wrong answer, why that one is wrong,
 *     because that is the mistake they were about to keep making.
 * If they picked a wrong answer nobody wrote a note for, it says so instead of
 * inventing one: "no note was written for your choice" is true, a plausible
 * paragraph is not.
 *
 * It knows nothing about grammar. Its caller hands it ReactNodes for the
 * reasons, so a listening item or a verb drill can use it unchanged.
 *
 * Five states, each with a next action (a state with no way forward is a named
 * rejection reason in the blueprint): ready, loading, error, offline, empty,
 * finished. `ready` is the question itself.
 *
 * Accessibility, in the order it was decided:
 *   - the options are native radios in a fieldset, so arrow keys, Space and
 *     the group name come from the browser and not from code that can drift;
 *   - the form submits on Enter, so the keyboard path is Tab · arrows · Enter;
 *   - after Check, focus MOVES to the feedback. Otherwise a screen-reader user
 *     presses Check and hears nothing;
 *   - right and wrong are never colour alone: every mark is a word, and the
 *     glyph beside it is decoration (aria-hidden).
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useApp } from '../../app-context';
import { fr as frText } from '../../lib/typography';
import './exercise.css';

export type ExerciseResult = {
  /** The option the learner ended on. */
  chosen: number;
  correct: boolean;
  /** How many times they pressed Check on this question. */
  attempts: number;
  /** Right on the first Check. This is what a score should count. */
  firstTry: boolean;
};

export type ExerciseAction = { label: string; onClick: () => void; testId?: string };

export type ExerciseStatus = 'ready' | 'loading' | 'error' | 'offline' | 'empty' | 'finished';

/** Everything but the question: what the non-question states take. */
export type ExerciseStateProps = {
  status: Exclude<ExerciseStatus, 'ready'>;
  /** Each state has a default message; `action` is the way forward. */
  message?: { title?: ReactNode; body?: ReactNode };
  action?: ExerciseAction;
  secondaryAction?: ExerciseAction;
  testId?: string;
};

export type ExerciseQuestionProps = {
  status?: 'ready';

  /** The question. */
  prompt: ReactNode;
  /** A line under the question, typically its translation. */
  hint?: ReactNode;
  /** The choices, as written (French by default). */
  options: string[];
  optionLang?: string;
  /** Index of the right option. */
  answer: number;
  /** Index of the wrong option a learner is most likely to pick, if known. */
  temptingWrong?: number | null;
  whyRight: ReactNode;
  whyTempting?: ReactNode;

  onContinue: (r: ExerciseResult) => void;
  continueLabel?: string;

  testId?: string;
};

export type ExerciseProps = ExerciseQuestionProps | ExerciseStateProps;

export function Exercise(props: ExerciseProps) {
  if (props.status !== undefined && props.status !== 'ready') {
    return <ExerciseState {...(props as ExerciseStateProps)} />;
  }
  return <ExerciseQuestion {...(props as ExerciseQuestionProps)} />;
}

/* ── the four non-question states ─────────────────────────────────────── */

function ExerciseState(p: ExerciseStateProps) {
  const { t } = useApp();
  const defaults: Record<typeof p.status, string> = {
    loading: t('grlExLoading'), error: t('grlExError'), offline: t('grlExOffline'),
    empty: t('grlExEmpty'), finished: t('grlExFinished'),
  };
  const title = p.message?.title ?? defaults[p.status];
  // An error is announced at once; the others wait their turn.
  const role = p.status === 'error' || p.status === 'offline' ? 'alert' : 'status';
  return (
    <div className={`ex ex-state ex-state--${p.status}`} role={role}
         aria-busy={p.status === 'loading' ? true : undefined}
         data-testid={p.testId ?? 'exercise'} data-state={p.status}>
      {p.status === 'loading' && <div className="skeleton skeleton--text" aria-hidden="true" />}
      <p className="ex-state__title"><strong>{title}</strong></p>
      {p.message?.body && <div className="ex-state__body">{p.message.body}</div>}
      {(p.action || p.secondaryAction) && (
        <div className="ex-actions">
          {p.action && (
            <button type="button" className="btn btn--primary" onClick={p.action.onClick}
                    data-testid={p.action.testId ?? 'exercise-state-action'}>
              {p.action.label}
            </button>
          )}
          {p.secondaryAction && (
            <button type="button" className="btn btn--ghost" onClick={p.secondaryAction.onClick}
                    data-testid={p.secondaryAction.testId ?? 'exercise-state-secondary'}>
              {p.secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── the question ─────────────────────────────────────────────────────── */

function ExerciseQuestion(p: ExerciseQuestionProps) {
  const { t } = useApp();
  const group = useId();
  const [chosen, setChosen] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [firstTry, setFirstTry] = useState<boolean | null>(null);
  const [needChoice, setNeedChoice] = useState(false);
  const feedback = useRef<HTMLDivElement>(null);
  const firstOption = useRef<HTMLInputElement>(null);
  const moveFocus = useRef<'feedback' | 'options' | null>(null);

  // Focus is moved AFTER the render that shows the thing to focus.
  useEffect(() => {
    if (moveFocus.current === 'feedback') feedback.current?.focus();
    if (moveFocus.current === 'options') firstOption.current?.focus();
    moveFocus.current = null;
  });

  const correct = checked && chosen === p.answer;

  const check = () => {
    if (chosen === null) { setNeedChoice(true); return; }
    setNeedChoice(false);
    setChecked(true);
    setAttempts((n) => n + 1);
    if (firstTry === null) setFirstTry(chosen === p.answer);
    moveFocus.current = 'feedback';
  };

  const retry = () => {
    setChosen(null);
    setChecked(false);
    setNeedChoice(false);
    moveFocus.current = 'options';
  };

  const pickedTempting = checked && !correct && p.temptingWrong != null && chosen === p.temptingWrong;
  const optionText = (i: number) => frText(p.options[i] ?? '');

  return (
    <form className="ex" data-testid={p.testId ?? 'exercise'} data-state="ready"
          data-checked={checked ? (correct ? 'right' : 'wrong') : 'no'}
          onSubmit={(e) => { e.preventDefault(); if (!checked) check(); }}>
      <fieldset className="ex-fieldset" disabled={checked}>
        <legend className="ex-prompt" data-testid="exercise-prompt">{p.prompt}</legend>
        {p.hint && <p className="ex-hint muted">{p.hint}</p>}
        <div className="ex-options" role="radiogroup">
          {p.options.map((_, i) => {
            const isAnswer = checked && i === p.answer;
            const isMine = checked && i === chosen;
            const cls = ['ex-opt'];
            if (isAnswer) cls.push('is-answer');
            if (isMine && !correct) cls.push('is-mine-wrong');
            if (!checked && chosen === i) cls.push('is-selected');
            return (
              <label key={i} className={cls.join(' ')} data-testid={`exercise-option-${i}`}>
                <input type="radio" name={group} value={i}
                       ref={i === 0 ? firstOption : undefined}
                       checked={chosen === i}
                       onChange={() => { setChosen(i); setNeedChoice(false); }} />
                <span className="ex-opt__text" lang={p.optionLang ?? 'fr'} dir="ltr">{optionText(i)}</span>
                {/* Words, not colour. The glyph is decoration; the word is the mark. */}
                {isAnswer && (
                  <span className="ex-opt__tag ex-opt__tag--right" data-testid="exercise-tag-answer">
                    <span aria-hidden="true">✓ </span>{t('grlExTheAnswer')}
                  </span>
                )}
                {isMine && !correct && (
                  <span className="ex-opt__tag ex-opt__tag--wrong" data-testid="exercise-tag-mine">
                    <span aria-hidden="true">✗ </span>{t('grlExYours')}
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </fieldset>

      {needChoice && !checked && (
        <p className="ex-need" role="alert" data-testid="exercise-need-choice">{t('grlExChoose')}</p>
      )}

      {!checked && (
        <div className="ex-actions">
          <button type="submit" className="btn btn--primary" data-testid="exercise-check">
            {t('grlExCheck')}
          </button>
        </div>
      )}

      {checked && chosen !== null && (
        <div className={`ex-feedback ${correct ? 'is-right' : 'is-wrong'}`}
             ref={feedback} tabIndex={-1} role="status" aria-live="polite"
             data-testid="exercise-feedback">
          <p className="ex-feedback__verdict" data-testid="exercise-verdict">
            <span aria-hidden="true">{correct ? '✓ ' : '✗ '}</span>
            <strong>{correct ? t('grlExRight') : t('grlExWrong')}</strong>
            {!correct && <>{' '}{t('grlExAnswerIs', { a: optionText(p.answer) })}</>}
          </p>

          {!correct && p.temptingWrong != null && pickedTempting && p.whyTempting && (
            <section className="ex-why ex-why--wrong" data-testid="exercise-why-wrong">
              <h3 className="ex-why__h">{t('grlExWhyWrong', { a: optionText(chosen) })}</h3>
              <p>{p.whyTempting}</p>
            </section>
          )}
          {!correct && !pickedTempting && (
            <p className="muted" data-testid="exercise-no-note">{t('grlExNoNote')}</p>
          )}

          <section className="ex-why ex-why--right" data-testid="exercise-why-right">
            <h3 className="ex-why__h">{t('grlExWhyRight')}</h3>
            <p>{p.whyRight}</p>
          </section>

          <div className="ex-actions">
            {!correct && (
              <button type="button" className="btn btn--ghost" onClick={retry}
                      data-testid="exercise-retry">
                {t('grlExRetry')}
              </button>
            )}
            <button type="button" className="btn btn--primary" data-testid="exercise-continue"
                    onClick={() => p.onContinue({
                      chosen, correct, attempts, firstTry: firstTry === true,
                    })}>
              {p.continueLabel ?? t('grlExContinue')}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
