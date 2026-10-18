/**
 * The text's own comprehension questions, each with its explanation — shown
 * whether the answer was right or wrong, because an explanation shown only
 * after a mistake teaches that a right answer needs none.
 *
 * Question, choice, check, explanation, retry: the Exercise contract (section 4
 * of CONTRACTS-v0.2.md). The score counts the FIRST check of each question; a
 * retry is for understanding, and does not rewrite what happened the first time.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useApp } from '../../app-context';
import { Localised } from '../../components/Localised';
import { Num } from '../../components/Num';
import type { ReadingQuestion } from './types';

type Props = {
  textId: string;
  questions: ReadingQuestion[];
  onFinished: (correct: number, total: number) => void;
  onReread: () => void;
  backSearch: string;
};

export function Quiz({ textId, questions, onFinished, onReread, backSearch }: Props) {
  const { t } = useApp();
  const [picked, setPicked] = useState<Record<string, number>>({});
  /** questionId → the index checked FIRST. Set once, never overwritten. */
  const [first, setFirst] = useState<Record<string, number>>({});
  /** questionId → whether the CURRENT pick has been checked. Retry clears it. */
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const reported = useRef(false);

  const total = questions.length;
  const allChecked = questions.every((q) => first[q.id] !== undefined);
  const correct = questions.filter((q) => first[q.id] === q.answer).length;

  useEffect(() => {
    if (allChecked && !reported.current) { reported.current = true; onFinished(correct, total); }
  }, [allChecked, correct, total, onFinished]);

  return (
    <section className="rd-quiz" aria-labelledby="rd-quiz-h" data-testid="rd-quiz">
      <div>
        <h2 id="rd-quiz-h" className="h2">{t('rdQuizTitle')}</h2>
        <p className="rd-note" dir="auto">{t('rdQuizLead')}</p>
      </div>

      {questions.map((q, i) => {
        const isChecked = !!checked[q.id];
        const choice = picked[q.id];
        const right = isChecked && choice === q.answer;
        return (
          <fieldset className="rd-q" key={q.id} data-testid="rd-question" data-id={q.id}>
            <legend><Localised field={q.prompt} /></legend>
            <p className="rd-q__n" dir="auto"><Num>{t('rdQuestionN', { i: i + 1, n: total })}</Num></p>
            {q.options.map((o, k) => {
              const verdict = isChecked ? (k === q.answer ? 'right' : k === choice ? 'wrong' : undefined) : undefined;
              return (
                <label className="rd-choice" key={k} data-verdict={verdict}>
                  <input type="radio" name={q.id} checked={choice === k} disabled={isChecked}
                    onChange={() => setPicked((p) => ({ ...p, [q.id]: k }))} data-testid="rd-option" />
                  <span><Localised field={o} /></span>
                </label>
              );
            })}
            {!isChecked ? (
              <div>
                <button type="button" className="btn btn--primary" disabled={choice === undefined} data-testid="rd-check"
                  onClick={() => {
                    setChecked((c) => ({ ...c, [q.id]: true }));
                    setFirst((f) => (f[q.id] === undefined ? { ...f, [q.id]: choice as number } : f));
                  }}>
                  {t('rdCheck')}
                </button>
              </div>
            ) : (
              <div role="status" data-testid="rd-feedback">
                <p className={right ? 'rd-ok' : 'rd-bad'}><strong>{right ? t('rdCorrect') : t('rdNotQuite')}</strong></p>
                <p className="rd-why" data-testid="rd-explain"><strong>{t('rdExplanation')}: </strong><Localised field={q.explain} /></p>
                {!right && (
                  <button type="button" className="btn" data-testid="rd-retry-q" style={{ marginBlockStart: 'var(--space-3)' }}
                    onClick={() => {
                      setChecked((c) => ({ ...c, [q.id]: false }));
                      setPicked((p) => { const n = { ...p }; delete n[q.id]; return n; });
                    }}>
                    {t('rdTryAgain')}
                  </button>
                )}
              </div>
            )}
          </fieldset>
        );
      })}

      {allChecked && (
        <div className="rd-done" role="status" data-testid="rd-finished" data-text={textId}>
          <h2>{t('rdFinishedTitle')}</h2>
          <p data-testid="rd-score"><Num>{t('rdFinishedScore', { c: correct, n: total })}</Num></p>
          <p className="rd-note" dir="auto">{t('rdFinishedNext')}</p>
          <div className="rd-actions">
            <Link className="btn btn--primary" to="/app/cards" data-testid="rd-to-cards">{t('rdMyWords')}</Link>
            <button type="button" className="btn" onClick={onReread}>{t('rdReread')}</button>
            <Link className="btn" to={`/app/reading${backSearch}`}>{t('rdBack')}</Link>
          </div>
        </div>
      )}
    </section>
  );
}
