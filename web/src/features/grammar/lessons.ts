/**
 * Lesson data and the origin contract.
 *
 * The types below are read off content/lessons.json, not designed. If the file
 * changes shape this file is what must change, and tests/lessons-content.test.js
 * is what notices.
 *
 * ORIGIN. The last step of the loop is "return to the source activity". A
 * learner who met `ne … que` in a text must go back to that text, not to an
 * index. So the origin travels in the address — `?from=<in-app path>` — which
 * is the only place that survives Back, refresh and open-in-new-tab. State held
 * in React would be gone after any of the three.
 *
 * `from` arrives from the address bar, i.e. from anyone who can craft a link,
 * so it is validated before it is ever navigated to: an in-app absolute path
 * and nothing else. With hash routing `navigate()` cannot leave the origin
 * anyway, but "cannot leave" is a property of the router, and a value that is
 * only safe because of what happens to consume it is a value to be checked.
 */
import type { Locale } from '../../lib/types';

type L = Partial<Record<Locale, string>>;

export type LessonQuestion = {
  prompt: L;
  options: string[];
  answer: number;
  temptingWrong: number;
  explanation: { right: L; tempting: L };
};

export type Lesson = {
  id: string;
  conceptId: string;
  nearbyConceptId: string;
  level: string;
  source: string;
  explanation: L;
  simplerExplanation: L;
  examples: { fr: string; fa?: string; en?: string }[];
  difference: L;
  questions: LessonQuestion[];
  /** `null` until a teacher has read it. Nothing here may set it. */
  review?: { teacher?: unknown; owner?: unknown } | null;
};

export type ConceptName = { id: string; parent: string | null; level: string; name: L };

export type LessonData = {
  lessons: Lesson[];
  concepts: Map<string, ConceptName>;
};

let cache: Promise<LessonData> | null = null;

/** Fetched once per page load; a failure is not cached, so Try again works. */
export function loadLessons(): Promise<LessonData> {
  if (!cache) {
    cache = (async () => {
      const [l, c] = await Promise.all([
        fetch('./content/lessons.json').then((r) => { if (!r.ok) throw new Error('lessons'); return r.json(); }),
        fetch('./content/concepts.json').then((r) => { if (!r.ok) throw new Error('concepts'); return r.json(); }),
      ]);
      const concepts = new Map<string, ConceptName>(
        (c.concepts as ConceptName[]).map((x) => [x.id, x]),
      );
      return { lessons: l.lessons as Lesson[], concepts };
    })().catch((e) => { cache = null; throw e; });
  }
  return cache;
}

/** A lesson by its own id, its id without the `lesson:` prefix, or its concept id. */
export function findLesson(lessons: Lesson[], key: string): Lesson | undefined {
  return lessons.find((x) => x.id === key)
    ?? lessons.find((x) => x.id === `lesson:${key}`)
    ?? lessons.find((x) => x.conceptId === key);
}

/** The grouping concept: `gram.past.imparfait` → `gram.past`. */
export function topicOf(concepts: Map<string, ConceptName>, conceptId: string): ConceptName | undefined {
  const own = concepts.get(conceptId);
  return own?.parent ? concepts.get(own.parent) : undefined;
}

/**
 * An in-app path, or null. Rejects anything that is not `/segment…`:
 * protocol-relative `//host`, backslash tricks, schemes, control characters.
 */
export function safeOrigin(raw: string | null | undefined): string | null {
  if (!raw || raw.length > 600) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\\]/.test(raw)) return null;
  if (!/^\/[A-Za-z0-9_-]/.test(raw)) return null;
  if (/^\/[^?#]*:\/\//.test(raw)) return null;
  return raw;
}

/** The address of a lesson, carrying where the learner came from. */
export function lessonPath(idOrConcept: string, from?: string | null): string {
  const base = `/app/grammar/${encodeURIComponent(idOrConcept.replace(/^lesson:/, ''))}`;
  const origin = safeOrigin(from);
  return origin ? `${base}?from=${encodeURIComponent(origin)}` : base;
}
