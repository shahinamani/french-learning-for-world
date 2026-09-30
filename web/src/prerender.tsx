/**
 * Build-time prerender of the home route.
 *
 * The point is LCP: a client-rendered bundle cannot paint anything until 118 KB
 * of JavaScript has arrived and run, which at 400 kbps is several seconds. This
 * renders the real components to HTML at build time, so the largest element on
 * the screen is already there at first paint and React hydrates over it.
 *
 * It renders the real Shell and Learn, not a hand-written copy — a copy would
 * drift from the components the moment either changed.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { AppProvider } from './app-context';
import { Shell } from './components/Shell';
import { Learn } from './routes/Learn';

export function render(): string {
  return renderToStaticMarkup(
    <StaticRouter location="/learn">
      <AppProvider>
        <Shell prerenderChild={<Learn />} />
      </AppProvider>
    </StaticRouter>
  );
}
