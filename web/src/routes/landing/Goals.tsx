/**
 * "Learning for my goal": a pre-selected, editable choice.
 *
 * Pre-selected because an empty choice is a form, and a visitor who does
 * nothing should still see something real. Editable because the default is a
 * guess. Not persisted: choosing a goal here is reading, and reading stores
 * nothing (walk.mjs asserts a stranger who looked is still a stranger).
 *
 * What it lists is the real material that fits each goal TODAY, chosen by a
 * person — see GOAL_ITEMS. It is not a recommendation engine and the note under
 * it says so, because the product's path page is a placeholder and a list that
 * looked like a plan would be a promise.
 */
import { useId, useState } from 'react';
import { Link } from 'react-router';
import { Icon } from '../../components/Icon';
import type { Dict } from '../../lib/i18n';
import { DEFAULT_GOAL, GOALS, GOAL_ITEMS, type Goal, type Kind } from './data';
import type { CopyLocale, Tx } from './types';

const LABEL: Record<Goal, keyof Dict> = {
  life: 'landingGoalLife', work: 'landingGoalWork', travel: 'landingGoalTravel',
  university: 'landingGoalUniversity', exam: 'landingGoalExam',
};
const ABOUT: Record<Goal, keyof Dict> = {
  life: 'landingGoalLifeAbout', work: 'landingGoalWorkAbout', travel: 'landingGoalTravelAbout',
  university: 'landingGoalUniversityAbout', exam: 'landingGoalExamAbout',
};
export const TYPE: Record<Kind, { label: keyof Dict; icon: string }> = {
  reading: { label: 'landingTypeReading', icon: 'textpage' },
  dialogue: { label: 'landingTypeDialogue', icon: 'book' },
  exam: { label: 'landingTypeExam', icon: 'examsheet' },
  cards: { label: 'landingTypeCards', icon: 'stackedcards' },
  verbs: { label: 'landingTypeVerbs', icon: 'bookclock' },
};

export function Goals({ tx, locale }: { tx: Tx; locale: CopyLocale }) {
  const [goal, setGoal] = useState<Goal>(DEFAULT_GOAL);
  const name = useId();
  const items = GOAL_ITEMS[goal];

  return (
    <div className="lp-goal" data-testid="landing-goal">
      <fieldset className="lp-goal__choices">
        <legend className="lp-goal__legend">{tx('landingGoalLegend')}</legend>
        <div className="lp-goal__chips">
          {GOALS.map((g) => (
            <label key={g} className="lp-chip">
              <input type="radio" name={name} value={g} checked={goal === g}
                     onChange={() => setGoal(g)} className="lp-chip__input" />
              <span className="lp-chip__face">{tx(LABEL[g])}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="lp-goal__result" aria-live="polite">
        <p className="lp-goal__about">{tx(ABOUT[goal])}</p>
        <h3 className="lp-goal__start">{tx('landingGoalStartWith')}</h3>
        <ul className="lp-goal__list">
          {items.map((it) => (
            <li key={it.id} className="lp-goal__item">
              <Link to={it.to} className="lp-goal__link">
                <span className="lp-goal__icon"><Icon name={TYPE[it.kind].icon} size={20} /></span>
                <span className="lp-goal__text">
                  <span className="lp-goal__title" lang="fr">{it.fr}</span>
                  <span className="lp-goal__meta">
                    {tx(TYPE[it.kind].label)}
                    {locale !== 'fr' && <> · <span lang="en">{it.en}</span></>}
                  </span>
                </span>
                {it.kind !== 'verbs' && <span className={`chip chip--${it.level.toLowerCase()}`}>{it.level}</span>}
                <Icon name="chevron" size={18} />
              </Link>
            </li>
          ))}
        </ul>
        <p className="lp-goal__note">{tx('landingGoalNote')}</p>
      </div>
    </div>
  );
}
