/**
 * The continuation shown when a session ends.
 *
 * One recommendation and one reason, with "return to the map" beside it. Three
 * offers would be the map again, which is what a learner already had and what
 * made a forty-minute evening four separate decisions.
 *
 * The decision itself is `lib/next-activity.ts`, which is pure and tested in
 * node. This gathers the inputs, and the gathering is where the rules about
 * side effects live:
 *
 * **Displaying this must not change anything.** Every call below is a read —
 * `counts`, `weakPoints`, `loadMaterial`, `loadPapers`, `attemptsFor`. Nothing
 * writes a review, touches a schedule, or marks the profile as started. A panel
 * that altered the weakness model by being rendered would corrupt the record of
 * anyone who merely looked at a screen.
 *
 * **It must be right AFTER the session, not before it.** It reads on mount, and
 * the screens it appears on mount only once the session is over — the flashcard
 * rating awaits `appendReview` before advancing, so the counts it reads already
 * include the last card. `justDid` is passed by the screen rather than guessed
 * from the route, because only the screen knows what was actually finished.
 *
 * **It never starts anything.** Every outcome is a link the learner presses.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useApp, useUserId } from '../app-context';
import { loadContent } from '../lib/content';
import { loadMaterial } from '../lib/material';
import { loadPapers } from '../lib/exams';
import { attemptsFor } from '../lib/exams';
import { counts, conceptStats, weakPoints } from '../lib/progress';
import { chooseNext, type ActivityKind, type Suggestion } from '../lib/next-activity';
import { Icon } from './Icon';

type Props = {
  /** What the learner has just finished, so it is not offered straight back. */
  justDid?: ActivityKind | null;
};

export function NextActivity({ justDid = null }: Props) {
  const { t } = useApp();
  const userId = useUserId();
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      // Each source is allowed to fail on its own. A learner with blocked site
      // data has no review log and no attempts, and should still be offered a
      // paper — so one unreadable source must not take the whole panel down.
      const [content, material, papers] = await Promise.all([
        loadContent().catch(() => null),
        loadMaterial().catch(() => new Map()),
        loadPapers().catch(() => []),
      ]);
      const cards = content?.cards ?? [];
      const concepts = (content?.concepts ?? [])
        .filter((c) => !c.isGroup && !c.retired)
        .map((c) => ({ id: c.id, level: c.level }));

      const [c, weak, stats] = await Promise.all([
        counts(userId, cards, Date.now()).catch(() => null),
        weakPoints(userId).catch(() => []),
        conceptStats(userId).catch(() => new Map()),
      ]);

      const attempts = new Map<string, number>();
      for (const p of papers) attempts.set(p.id, attemptsFor(userId, p.id).length);

      // The LEVEL is derived from everything reviewed, not only from the weak
      // concepts: a learner who is accurate at B1 has no weak B1 concepts, and
      // deriving from `weak` alone would read them as a beginner.
      const reviewed = [...stats.values()].map((s) => ({ conceptId: s.conceptId, reviews: s.reviews }));

      if (!live) return;
      setSuggestion(chooseNext({
        counts: c, weak, reviewed, material, concepts, papers, attempts, justDid,
      }));
    })();
    return () => { live = false; };
    // `justDid` is in the dependency list so a screen that changes what it has
    // just finished gets a fresh answer rather than a stale one.
  }, [userId, justDid]);

  if (!suggestion) {
    return (
      <section className="next" data-testid="next-activity" aria-busy="true">
        <div className="skeleton skeleton--text" />
      </section>
    );
  }

  const { title, why } = describe(suggestion, t);

  return (
    <section className="next" data-testid="next-activity"
             data-kind={suggestion.kind} aria-labelledby="next-h">
      <h2 id="next-h" className="eyebrow">{t('nextHeading')}</h2>
      <p className="next__title" data-testid="next-title">{title}</p>
      <p className="next__why" data-testid="next-why">{why}</p>
      <div className="next__actions">
        {suggestion.kind !== 'none' && (
          // `start` rather than the recommendation again: a screenshot showed
          // "Sit a practice paper" as the title and the same words on the
          // button under it. It is also a key every locale already has, so the
          // one word a learner presses is in their language even where the
          // sentence above it is not yet.
          <Link className="btn btn--primary" to={suggestion.to} data-testid="next-go"
                aria-label={title}>
            {t('start')}
          </Link>
        )}
        {/* Always present, in every state, including while the panel is
            deciding. A learner who wants to choose for themselves must never
            have to wait for a recommendation to finish loading. */}
        <Link className="btn" to="/learn" data-testid="next-map">
          {t('nextToMap')} <Icon name="chevron" size={14} />
        </Link>
      </div>
    </section>
  );
}

/** The one sentence, and the reason under it. Kept beside the component rather
 *  than in the pure module so that module stays free of the dictionary. */
function describe(s: Suggestion, t: ReturnType<typeof useApp>['t']): { title: string; why: string } {
  switch (s.kind) {
    case 'review':
      return s.repeat
        ? { title: t('nextReviewAgain', { n: s.count }), why: t('nextReviewAgainWhy') }
        : { title: t('nextReview', { n: s.count }), why: t('nextReviewWhy') };
    case 'concept':
      return {
        title: t('nextConcept'),
        why: t('nextConceptWhy', { pct: s.accuracyPct, n: s.cards }),
      };
    case 'exam':
      return {
        title: t('nextExam'),
        why: s.levelKnown
          ? t('nextExamWhy', { level: s.level, n: s.questions })
          : t('nextExamWhyUnknown', { level: s.level, n: s.questions }),
      };
    case 'new-cards':
      return { title: t('nextNewCards', { n: s.count }), why: t('nextNewCardsWhy') };
    default:
      return { title: t('nextNothing'), why: t('nextNothingWhy') };
  }
}
