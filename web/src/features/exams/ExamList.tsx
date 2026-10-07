/**
 * What can be practised, and — just as important — what cannot.
 *
 * Four examinations are described in `content/exams.json`; only some of their
 * papers can honestly be built today, and the ones that cannot say why rather
 * than being left off the page. A learner preparing for DALF should find out
 * here that we have nothing for them, not by searching and finding silence.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useApp } from '../../app-context';
import { loadPapers, type ExamPaper } from '../../lib/exams';
import { Icon } from '../../components/Icon';
import { ErrorState } from '../../components/Search';
import { fr as frText } from '../../lib/typography';

/** Why a paper is absent. Each reason is a real constraint, named in docs/02
 *  or docs/07, not a placeholder. */
const MISSING: { code: string; exam: string; whyKey: string }[] = [
  { code: 'CO', exam: 'DELF · TCF · TEF', whyKey: 'whyNoListening' },
  { code: 'PE', exam: 'DELF · TCF · TEF', whyKey: 'whyNoWriting' },
  { code: 'PO', exam: 'DELF · TCF · TEF', whyKey: 'whyNoSpeaking' },
  { code: 'DALF', exam: 'C1 · C2', whyKey: 'whyNoDalf' },
  { code: 'TEF', exam: 'A1 · C2', whyKey: 'examStructureUnverified' },
];

export function ExamList() {
  const { t, settings } = useApp();
  const [papers, setPapers] = useState<ExamPaper[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let live = true;
    loadPapers().then((p) => { if (live) setPapers(p); }).catch(() => { if (live) setError(true); });
    return () => { live = false; };
  }, []);

  if (error) return <ErrorState onRetry={() => location.reload()} />;

  const name = (p: ExamPaper) => {
    const n = p.name[settings.ui] ?? p.name.en ?? p.id;
    return settings.ui === 'fr' ? frText(n) : n;
  };

  return (
    <div className="page">
      <h1 className="h2">{t('exams')}</h1>
      <p className="muted">{t('examsIntro')}</p>

      <section aria-labelledby="ex-avail">
        <h2 id="ex-avail" className="eyebrow">{t('examsAvailable')}</h2>
        {papers === null ? (
          <ul className="rows" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <li key={i}><div className="row row--placeholder">
                <span className="skeleton skeleton--text" style={{ width: `${60 - i * 8}%` }} />
              </div></li>
            ))}
          </ul>
        ) : (
          <ul className="rows" data-testid="exam-papers">
            {papers.map((p) => (
              <li key={p.id}>
                <Link className="row row--link" to={`/practise/exams/${encodeURIComponent(p.id)}`}
                      data-testid={`paper-${p.id}`}>
                  <span className={`chip chip--${p.level.toLowerCase()}`}>{p.level}</span>
                  <span>{name(p)}</span>
                  <span className="muted">{t('minutes', { n: p.minutes })} · {t('questions', { n: p.items.length })}</span>
                  <Icon name="chevron" size={16} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="ex-missing" style={{ marginBlockStart: 'var(--space-6)' }}>
        <h2 id="ex-missing" className="eyebrow">{t('examsMissing')}</h2>
        <p className="muted">{t('examsMissingIntro')}</p>
        <ul className="rows" data-testid="exam-missing">
          {MISSING.map((m) => (
            <li key={m.code}>
              <div className="row">
                <span className="chip">{m.code}</span>
                <span className="muted">{m.exam}</span>
                <span>{t(m.whyKey as 'whyNoListening')}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <p className="muted foot-legal" data-testid="exam-independence">{t('examIndependence')}</p>
    </div>
  );
}
