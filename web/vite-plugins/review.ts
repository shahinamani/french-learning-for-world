/**
 * The content review tool. **Development only, and never bundled.**
 *
 * One reviewer, batches of about twenty, on a laptop, for two hours at a
 * stretch. Approve, reject, skip, and a note. No inline editing: the first
 * batch exists to find out what the notes actually look like, and if they turn
 * out to be mostly "change this one word" then editing earns its extra hours.
 *
 * `tests/review-tool-is-dev-only.test.js` was written BEFORE this file, and it
 * constrains the shape:
 *
 *   - `apply: 'serve'`, so Vite never includes it in a build;
 *   - `configureServer` only — no transform, renderChunk or generateBundle;
 *   - nothing under `web/src` may mention the endpoint, so the review screen
 *     cannot live in the application. This plugin serves its own page;
 *   - the endpoint is spelled in exactly one place.
 *
 * **Decisions are not written into the content.** They go to
 * `data/review-decisions.json`, and `scripts/apply-review.py` applies them with
 * the same serialiser the build uses. A Node round-trip of a 2,400-verb JSON
 * file would reformat the whole thing and make every review diff unreadable;
 * worse, two serialisers for one file is how two sources of truth begin.
 *
 * The decisions file is committed, deliberately: who approved what, and when,
 * is exactly the kind of record this project exists to be honest about.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type { Plugin } from 'vite';

/** The one spelling. The guard greps for it. */
const ENDPOINT = '/__review';

type Decision = {
  itemId: string;
  paperId: string;
  verdict: 'approved' | 'rejected' | 'skipped';
  note: string | null;
  by: string;
  at: string;
};

export function reviewTool(root: string): Plugin {
  const decisionsPath = join(root, 'data/review-decisions.json');
  const papersPath = join(root, 'content/exam-papers.json');

  const readDecisions = (): { version: number; decisions: Decision[] } => {
    if (!existsSync(decisionsPath)) return { version: 1, decisions: [] };
    return JSON.parse(readFileSync(decisionsPath, 'utf8'));
  };

  return {
    name: 'flw-review-tool',
    // Vite never includes this in a build. The guard asserts the literal.
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(`${ENDPOINT}/queue`, (_req, res) => {
        // Everything not yet decided, flagged items first: a flagged item is
        // where the reviewer's six minutes are worth most.
        const papers = JSON.parse(readFileSync(papersPath, 'utf8'));
        const decided = new Set(readDecisions().decisions
          .filter((d) => d.verdict !== 'skipped').map((d) => d.itemId));
        const queue = [];
        for (const paper of papers.papers) {
          for (const item of paper.items) {
            if (item.review?.state === 'approved' || decided.has(item.id)) continue;
            queue.push({ ...item, paperId: paper.id, paperName: paper.name?.en ?? paper.id });
          }
        }
        queue.sort((a, b) => Number(Boolean(b.uncertain)) - Number(Boolean(a.uncertain)));
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ queue, decided: decided.size }));
      });

      server.middlewares.use(`${ENDPOINT}/decide`, (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
        let body = '';
        req.on('data', (c) => { body += c; });
        req.on('end', () => {
          try {
            const d = JSON.parse(body) as Decision;
            if (!d.itemId || !['approved', 'rejected', 'skipped'].includes(d.verdict)) {
              res.statusCode = 400; res.end(JSON.stringify({ error: 'bad decision' })); return;
            }
            const file = readDecisions();
            // One decision per item: a reviewer who changes their mind replaces
            // the earlier verdict rather than appending a contradiction.
            file.decisions = file.decisions.filter((x) => x.itemId !== d.itemId);
            file.decisions.push({ ...d, at: new Date().toISOString() });
            mkdirSync(dirname(decisionsPath), { recursive: true });
            writeFileSync(decisionsPath, JSON.stringify(file, null, 1) + '\n');
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ ok: true, decisions: file.decisions.length }));
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: String(e) }));
          }
        });
      });

      server.middlewares.use(ENDPOINT, (req, res, next) => {
        if (req.url && req.url !== '/' && req.url !== '') return next();
        res.setHeader('content-type', 'text/html; charset=utf-8');
        res.end(readFileSync(join(root, 'web/vite-plugins/review.html'), 'utf8'));
      });
    },
  };
}
