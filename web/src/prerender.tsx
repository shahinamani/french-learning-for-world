/**
 * Build-time prerender of the home route.
 *
 * The point is LCP: a client-rendered bundle cannot paint anything until 118 KB
 * of JavaScript has arrived and run, which at 400 kbps is several seconds. This
 * renders the real components to HTML at build time, so the largest element on
 * the screen is already there at first paint and React hydrates over it.
 *
 * It renders the real Shell and Home, not a hand-written copy — a copy would
 * drift from the components the moment either changed.
 *
 * What gets prerendered is therefore the LANDING page: `hasStarted()` reads
 * localStorage, which does not exist in node, so the stranger's branch is taken
 * — which is correct, because a build has no learner and a crawler is always a
 * stranger. A returning learner loses the prerendered map and sees a skeleton
 * until the bundle arrives; that is the deliberate trade, and the alternative
 * was showing every visitor a study map before they knew what the site was.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { AppProvider } from './app-context';
import { Shell } from './components/Shell';
import { Home } from './routes/Home';

export function render(): string {
  return renderToStaticMarkup(
    <StaticRouter location="/">
      <AppProvider>
        <Shell prerenderChild={<Home />} />
      </AppProvider>
    </StaticRouter>
  );
}
