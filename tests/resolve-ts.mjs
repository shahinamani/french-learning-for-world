/**
 * Node's ESM resolver needs a file extension; Vite does not, so the app's
 * source says `from './session'`. Without this hook the unit tests could not
 * import the modules the product actually ships — which is how the whole suite
 * ended up testing `app/` instead of `web/` (docs/lessons.md #6).
 *
 * It only ever adds `.ts` (or `/index.ts`) to a relative specifier that has no
 * extension and does not otherwise resolve. It cannot redirect an import
 * somewhere else, which is the failure this exists to prevent.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) && context.parentURL) {
    const base = new URL(specifier, context.parentURL);
    for (const candidate of [`${base.href}.ts`, `${base.href}.tsx`, `${base.href}/index.ts`]) {
      if (existsSync(fileURLToPath(candidate))) {
        return nextResolve(candidate, context);
      }
    }
  }
  return nextResolve(specifier, context);
}
