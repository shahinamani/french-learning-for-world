/**
 * The way back from a grammar lesson is an address, and addresses come from
 * anyone who can craft a link. These pin what `?from=` may be, and that every
 * lesson the content ships can be reached by both of its names.
 *
 * Run against the whole of content/lessons.json, not a fixture: the question
 * "can every real lesson be found by id and by concept id" is only answered by
 * asking it of the real ones.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { safeOrigin, lessonPath, findLesson } from '../web/src/features/grammar/lessons.ts';

const lessons = JSON.parse(readFileSync(new URL('../content/lessons.json', import.meta.url), 'utf8')).lessons;

test('an in-app path, with its query, is a valid origin', () => {
  for (const ok of ['/learn', '/app/reading/text-3?p=2', '/app/grammar?level=B1&q=ne',
                    '/practise/exams/delf-a1-ce/results?a=x']) {
    assert.equal(safeOrigin(ok), ok);
  }
});

test('anything that could leave the app, or is not a path, is not', () => {
  for (const bad of [
    null, undefined, '', 'learn', '//evil.example', '/\\evil.example', 'https://evil.example',
    'javascript:alert(1)', '/a\nb', '/a\u0000b', '/ok://x', ' /learn', '/'.repeat(1) + 'x'.repeat(700),
  ]) {
    assert.equal(safeOrigin(bad), null, `accepted ${JSON.stringify(bad)?.slice(0, 40)}`);
  }
});

test('a lesson link carries the origin, encoded, and drops a bad one', () => {
  assert.equal(lessonPath('lesson:ne-que', '/app/reading/t1?p=2'),
    '/app/grammar/ne-que?from=%2Fapp%2Freading%2Ft1%3Fp%3D2');
  assert.equal(lessonPath('ne-que', '//evil.example'), '/app/grammar/ne-que');
  assert.equal(lessonPath('ne-que'), '/app/grammar/ne-que');
});

test('every shipped lesson is found by its id, its bare id and its concept id', () => {
  assert.ok(lessons.length >= 6, `found ${lessons.length} lessons`);
  for (const l of lessons) {
    assert.equal(findLesson(lessons, l.id)?.id, l.id);
    assert.equal(findLesson(lessons, l.id.replace(/^lesson:/, ''))?.id, l.id);
    assert.equal(findLesson(lessons, l.conceptId)?.id, l.id);
  }
  assert.equal(findLesson(lessons, 'no-such-lesson'), undefined);
});

test('a lesson link round-trips: what lessonPath writes, findLesson reads', () => {
  for (const l of lessons) {
    const slug = decodeURIComponent(lessonPath(l.id).split('/').pop());
    assert.equal(findLesson(lessons, slug)?.id, l.id);
  }
});
