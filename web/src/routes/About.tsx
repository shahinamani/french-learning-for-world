/**
 * What this is, who it is not, and what it is built from.
 *
 * The sources list is not decoration and not a courtesy. Lexique and the French
 * Wiktionary are both CC BY-SA, and that licence requires attribution — which
 * means attribution a reader of the *product* can find, not a line in a file
 * only a reader of the repository will ever open. It is rendered from
 * `content/attribution.json` rather than written here, so adding a source is a
 * data change and cannot be forgotten in the markup.
 *
 * The independence notice lived only on the exams stub, where a learner who
 * never opens the exams section never saw it. It is a statement about what this
 * project is not, and it belongs on the page that says what it is.
 */
import { useEffect, useState } from 'react';
import { useApp } from '../app-context';
import { Localised } from '../components/Localised';
import type { Locale } from '../lib/types';

type Source = {
  id: string; name: string; url: string;
  licence: string; licenceUrl: string; takenFrom: string;
  usedFor: Partial<Record<Locale, string>>;
};

export function About() {
  const { t } = useApp();
  const [sources, setSources] = useState<Source[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    fetch('./content/attribution.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => { if (live) setSources(d.sources as Source[]); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, []);

  return (
    <div className="page">
      <h1 className="h2">{t('aboutTitle')}</h1>
      <p>{t('aboutWhat')}</p>

      <section className="card" aria-labelledby="ind-h">
        <h2 id="ind-h" className="eyebrow">{t('aboutIndependenceHeading')}</h2>
        <p>{t('examIndependence')}</p>
      </section>

      <section aria-labelledby="src-h" data-testid="about-sources">
        <h2 id="src-h" className="h3">{t('aboutSources')}</h2>
        <p className="muted">{t('aboutSourcesIntro')}</p>
        {failed && <p className="muted" data-testid="about-sources-failed">{t('loadFailed')}</p>}
        {!sources && !failed && <div className="skeleton skeleton--text" />}
        {sources && (
          <ul className="rows">
            {sources.map((s) => (
              <li key={s.id}>
                <div className="row">
                  {/* A project's own name and its licence's formal name are not
                      ours to translate — docs/08 records that rule. */}
                  <a className="row--link" href={s.url} rel="noreferrer noopener" target="_blank">
                    <span lang="fr">{s.name}</span>
                  </a>
                  <a className="chip" href={s.licenceUrl} rel="noreferrer noopener" target="_blank">
                    {s.licence}
                  </a>
                </div>
                <p className="muted">{s.takenFrom}</p>
                <p><Localised field={s.usedFor} /></p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
