/* Decides, before the first paint, whether this visitor is a stranger.
 *
 * The prerendered index.html contains the LANDING page, because that is the
 * right thing for somebody arriving from a search engine and the only version
 * of this site a crawler reads. A returning learner would therefore see the
 * sales page for as long as it takes 140 KB of JavaScript to arrive and run —
 * every visit, which is exactly what we are trying not to do to them.
 *
 * So: one synchronous read, one attribute on <html>, and a stylesheet rule
 * that hides the landing markup and shows the session skeleton instead. By the
 * time the body is parsed the decision is already made, so nothing flashes.
 *
 * This is a separate FILE and not an inline script because the
 * Content-Security-Policy is `script-src 'self'` with no 'unsafe-inline': an
 * inline script here would be refused by the browser and silently do nothing,
 * which is the failure mode that is hardest to notice.
 *
 * Kept deliberately tiny and dependency-free. It must not grow into logic: the
 * only thing it is allowed to know is which of two markup blocks to reveal.
 */
(function () {
  try {
    if (localStorage.getItem('fmv.started') === '1') {
      document.documentElement.dataset.started = '1';
    }
  } catch (e) {
    /* Private mode or blocked site data throws on read. A stranger is the safe
       wrong answer: one extra screen with a button on it. */
  }
})();
