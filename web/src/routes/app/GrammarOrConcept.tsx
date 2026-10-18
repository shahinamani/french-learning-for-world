/**
 * /app/grammar/:id — the lesson where one has been written, the concept page
 * everywhere else.
 *
 * There are few lessons and many concepts. A concept without a lesson used to
 * have a page with real content and a button to practise it; sending those
 * learners to a "no lesson yet" screen would trade a working page for a dead
 * end. So the lesson is an upgrade on top of the concept page, not a
 * replacement for it.
 *
 * The choice lives here, in the route layer, so the grammar feature does not
 * import a page from outside itself. Both pages are imported by this module and
 * the module is itself a lazy chunk (see main.tsx).
 *
 * While the lesson index loads nothing is guessed: a skeleton is shown. If it
 * cannot be loaded, the lesson page is rendered, because it owns the honest
 * error and offline states with a Try again.
 */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { GrammarLesson } from '../../features/grammar';
import { findLesson, loadLessons } from '../../features/grammar/lessons';
import { ConceptRoute } from '../Concept';

type Pick = 'loading' | 'lesson' | 'concept';

export function GrammarOrConcept() {
  const { id = '' } = useParams();
  const [pick, setPick] = useState<{ id: string; which: Pick }>({ id, which: 'loading' });

  useEffect(() => {
    let live = true;
    loadLessons()
      .then((d) => { if (live) setPick({ id, which: findLesson(d.lessons, id) ? 'lesson' : 'concept' }); })
      .catch(() => { if (live) setPick({ id, which: 'lesson' }); });
    return () => { live = false; };
  }, [id]);

  if (pick.id !== id || pick.which === 'loading') {
    return <div className="page" data-testid="grammar-resolving"><div className="skeleton skeleton--title" /></div>;
  }
  return pick.which === 'lesson' ? <GrammarLesson /> : <ConceptRoute />;
}
