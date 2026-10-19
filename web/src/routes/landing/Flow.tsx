/**
 * "One learning, many shapes": a sentence becomes a word, then a card, then a
 * review. Four steps on ONE sentence, so the sequence is the point and not the
 * decoration.
 *
 * Motion rules, because this is the one place the landing page animates on
 * demand: nothing moves until the visitor presses play or picks a step, the
 * sequence runs once and stops, Stop is always there, and under
 * prefers-reduced-motion the CSS removes the movement while the steps still
 * change — the information and the function stay, the motion goes.
 */
import { useEffect, useState } from 'react';
import { Icon } from '../../components/Icon';
import type { Dict } from '../../lib/i18n';
import { fr } from '../../lib/typography';
import { FLOW, PREVIEW_CARD } from './data';
import { Highlighted } from './Preview';
import type { CopyLocale, Tx } from './types';

const STEPS: { icon: string; title: keyof Dict; body: keyof Dict }[] = [
  { icon: 'textpage', title: 'landingFlowTextTitle', body: 'landingFlowTextBody' },
  { icon: 'wordtag', title: 'landingFlowTermTitle', body: 'landingFlowTermBody' },
  { icon: 'stackedcards', title: 'landingFlowFlashTitle', body: 'landingFlowCardBody' },
  { icon: 'chart', title: 'landingFlowReviewTitle', body: 'landingFlowReviewBody' },
];

const STEP_MS = 1700;

export function Flow({ tx, locale }: { tx: Tx; locale: CopyLocale }) {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setStep((s) => {
        if (s >= STEPS.length - 1) { setPlaying(false); return s; }
        return s + 1;
      });
    }, STEP_MS);
    return () => clearInterval(id);
  }, [playing]);

  const play = () => {
    if (playing) { setPlaying(false); return; }
    setStep(0);
    setPlaying(true);
  };
  const meaning = PREVIEW_CARD.meaning[locale === 'fr' ? 'fr' : 'en'];

  return (
    <div className="lp-flow" data-testid="landing-flow">
      <div className="lp-flow__rail">
        <ol className="lp-flow__steps" aria-label={tx('landingFlowSteps')}>
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <button type="button" className="lp-step" data-state={i < step ? 'done' : i === step ? 'now' : 'next'}
                      aria-current={i === step ? 'step' : undefined}
                      onClick={() => { setPlaying(false); setStep(i); }}>
                <span className="lp-step__num" aria-hidden="true">{i + 1}</span>
                <span className="lp-step__text">
                  <span className="lp-step__title">
                    <Icon name={s.icon} size={18} />
                    {tx(s.title)}
                  </span>
                  <span className="lp-step__body">{tx(s.body)}</span>
                </span>
                <span className="u-hidden-visually">{tx('landingFlowStepOf', { n: i + 1, total: STEPS.length })}</span>
              </button>
            </li>
          ))}
        </ol>
        <button type="button" className="btn btn--primary lp-flow__play" onClick={play}
                data-testid="landing-flow-play">
          {playing ? tx('landingFlowStop') : tx('landingFlowPlay')}
        </button>
      </div>

      <div className="lp-flow__stage" aria-live="polite" data-step={step}>
        <div className="lp-flow__bar" aria-hidden="true">
          <span className="lp-flow__fill" data-step={step} />
        </div>

        {step === 0 && (
          <div className="lp-flow__pane" key="text">
            <p className="lp-flow__sentence" lang="fr">{fr(FLOW.sentence)}</p>
          </div>
        )}
        {step === 1 && (
          <div className="lp-flow__pane" key="word">
            <p className="lp-flow__sentence" lang="fr">
              <Highlighted text={FLOW.sentence} form={FLOW.form} />
            </p>
            <p className="lp-flow__pick">
              {tx('landingFlowWordIs', { form: FLOW.form, verb: FLOW.verb })}
            </p>
          </div>
        )}
        {step === 2 && (
          <div className="lp-flow__pane" key="card">
            <div className="lp-flow__mini">
              <p className="lp-flow__mini-word" lang="fr">{FLOW.verb}</p>
              <p className="lp-flow__mini-meaning" lang={locale === 'fr' ? 'fr' : 'en'}>{meaning}</p>
              <p className="lp-flow__mini-ex" lang="fr">
                <Highlighted text={FLOW.sentence} form={FLOW.form} />
              </p>
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="lp-flow__pane" key="review">
            <div className="lp-flow__mini lp-flow__mini--review">
              <p className="lp-flow__mini-word" lang="fr">{FLOW.verb}</p>
              <div className="lp-flow__grades" aria-hidden="true">
                <span className="lp-flow__grade lp-flow__grade--again">{tx('landingCardAgain')}</span>
                <span className="lp-flow__grade lp-flow__grade--easy">{tx('landingCardEasy')}</span>
              </div>
              <p className="lp-flow__mini-meaning">{tx('landingCardAgainResult')}</p>
              <p className="lp-flow__mini-meaning">{tx('landingCardEasyResult')}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
