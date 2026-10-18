/**
 * What this stream exports. Mounting is the shell's job (it is not owned here):
 *
 *   /app/grammar       →  <GrammarList />
 *   /app/grammar/:id   →  <GrammarLesson />
 *
 * `:id` accepts a lesson id (`ne-que`, `lesson:ne-que`) or a CONCEPT id
 * (`gram.negation.ne-que`), so the old /learn/concept/:id redirect can land
 * here unchanged.
 *
 * To send a learner into a lesson FROM somewhere — a text, an exercise —
 * build the link with `lessonPath(id, currentPath)`. The lesson's last step
 * returns to `currentPath`, and Back, refresh and a new tab all keep it.
 */
export { GrammarList } from './GrammarList';
export { GrammarLesson } from './GrammarLesson';
export { lessonPath, safeOrigin } from './lessons';
