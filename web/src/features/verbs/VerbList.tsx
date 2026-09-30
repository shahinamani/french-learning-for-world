/** Search any verb. */
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useApp } from '../../app-context';
import { loadVerbs, type Verb } from '../../lib/verbs';
import { Icon } from '../../components/Icon';
import { ErrorState } from '../../components/Search';
import { fr as frText } from '../../lib/typography';
import { fold } from '../../lib/fold';

// Shared with answer checking and the verb filter: three near-copies of this
// had drifted, and none of them handled the œ/æ ligatures.
const norm = fold;

export function VerbList() {
  const { t, settings } = useApp();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const [verbs, setVerbs] = useState<Verb[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let live = true;
    loadVerbs().then((v) => { if (live) setVerbs(v); }).catch(() => { if (live) setError(true); });
    return () => { live = false; };
  }, []);

  const shown = useMemo(() => {
    if (!verbs) return [];
    const n = norm(q.trim());
    if (!n) return verbs;
    return verbs.filter((v) => norm(v.infinitive).includes(n)
      || Object.values(v.meanings).some((m) => m && norm(m).includes(n))
      || v.tenses.some((tn) => tn.forms.some((f) => norm(f).startsWith(n))));
  }, [verbs, q]);

  if (error) return <ErrorState onRetry={() => location.reload()} />;

  return (
    <div className="page">
      <h1 className="h2">{t('verbs')}</h1>
      <p className="muted">{t('verbsIntro')}</p>
      <label className="field">
        <span className="u-hidden-visually">{t('search')}</span>
        <input className="input" type="search" value={q} data-testid="verb-search"
               placeholder={t('verbSearchPlaceholder')}
               onChange={(e) => { const p = new URLSearchParams(params);
                 if (e.target.value) p.set('q', e.target.value); else p.delete('q');
                 setParams(p, { replace: true }); }} />
      </label>

      {verbs === null && (
        <ul className="rows" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => <li key={i}><div className="row row--placeholder"><span className="skeleton skeleton--text" style={{ width: `${55 - i * 6}%` }} /></div></li>)}
        </ul>
      )}
      {verbs !== null && shown.length === 0 && (
        <p className="muted" data-testid="verbs-empty">{t('searchEmpty', { q })}</p>
      )}
      {shown.length > 0 && (
        <ul className="rows" data-testid="verb-list">
          {shown.map((v) => (
            <li key={v.infinitive}>
              <Link className="row row--link" to={`/learn/verbs/${encodeURIComponent(v.infinitive)}`}>
                <span className="row-fr" lang="fr" dir="ltr">{frText(v.infinitive)}</span>
                <span className="muted">{v.meanings[settings.meaning] ?? v.meanings.en}</span>
                {v.irregular && <span className="chip" data-testid={`irr-${v.infinitive}`}>{t('irregular')}</span>}
                <Icon name="chevron" size={16} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
