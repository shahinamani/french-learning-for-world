/**
 * The verb side cards: the facts of one loaded verb (group, auxiliary,
 * participles, level — read from the verb file, never derived here), the list
 * of tenses a learner can switch the drill to, and the ten most frequent verbs
 * of the index.
 */
import '../../lib/locales/en/todayEn';
import { Link } from 'react-router';
import { useApp } from '../../app-context';
import type { Verb, VerbSummary, TenseNames } from '../../lib/verbs';
import { fr as frText } from '../../lib/typography';
import { verbLabel } from '../../lib/pronominal';
import { Localised } from '../Localised';
import { AsideCard } from './index';

export function VerbFactsCard({ verb, linkToVerb = false }: { verb: Verb; linkToVerb?: boolean }) {
  const { t } = useApp();
  return (
    <AsideCard title={t('tdBsVerbFacts')} testId="aside-verb-facts">
      <p className="aside-card__lead" lang="fr" dir="ltr">{frText(verbLabel(verb))}</p>
      <dl className="aside-facts">
        <dt>{t('tdBsLevel')}</dt><dd><span className={`chip chip--${verb.level.toLowerCase()}`}>{verb.level}</span></dd>
        <dt>{t('tdBsGroup')}</dt><dd lang="fr" dir="ltr">{verb.group} · {verb.irregular ? t('irregular') : t('regular')}</dd>
        <dt>{t('auxiliary')}</dt><dd lang="fr" dir="ltr">{verb.auxiliary}{verb.auxiliaryAlso && ` / ${verb.auxiliaryAlso}`}</dd>
        <dt>{t('tdBsPastParticiple')}</dt><dd lang="fr" dir="ltr">{frText(verb.participles.past)}</dd>
        <dt>{t('tdBsPresentParticiple')}</dt><dd lang="fr" dir="ltr">{frText(verb.participles.present)}</dd>
      </dl>
      {/* Where a verb takes both auxiliaries, the verb file carries a sentence
          for each; the register and the notes are also the file's own words. */}
      {verb.auxiliaryExamples && (
        <p className="fine" lang="fr" dir="ltr">{Object.values(verb.auxiliaryExamples).join('  ·  ')}</p>
      )}
      {verb.register && verb.register !== 'standard' && <p className="aside-card__facts" lang="fr" dir="ltr">{verb.register}</p>}
      {verb.notes && <p className="fine muted" dir="auto">{verb.notes}</p>}
      {linkToVerb && (
        <Link className="aside-card__link" to={`/app/verbs/${encodeURIComponent(verb.infinitive)}`} data-testid="aside-verb-open">
          {t('tdBsOpenVerb')}
        </Link>
      )}
    </AsideCard>
  );
}

/** Every tense the exam asks a learner to write, as a link into the drill. */
export function TenseLinksCard({ verb, names, current }: { verb: Verb; names: TenseNames; current?: string }) {
  const { t } = useApp();
  const produced = verb.tenses.filter((tn) => tn.produced);
  return (
    <AsideCard title={t('tdBsSwitchTense')} testId="aside-tenses">
      {produced.length === 0 && <p className="muted fine">{t('readNotWritten')}</p>}
      {produced.length > 0 && (
        <ul className="aside-list">
          {produced.map((tn) => (
            <li key={tn.id} aria-current={tn.id === current ? 'true' : undefined} className={tn.id === current ? 'is-here' : undefined}>
              <Link to={`/app/verbs/drill?verb=${encodeURIComponent(verb.infinitive)}&tense=${tn.id}`} data-testid={`aside-tense-${tn.id}`}>
                <Localised field={names[tn.id] ?? {}} />
                <span className="muted" lang="fr" dir="ltr">{tn.mood}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="muted fine">{t('tdBsProducedOnly')}</p>
    </AsideCard>
  );
}

/** The first ten of the verb index, which is sorted by frequency rank. */
export function FrequentVerbsCard({ verbs }: { verbs: VerbSummary[] | null }) {
  const { t } = useApp();
  const top = (verbs ?? []).slice().sort((a, b) => a.rank - b.rank).slice(0, 10);
  return (
    <AsideCard title={t('tdBsFrequentTitle')} testId="aside-frequent">
      {verbs === null && <div className="skeleton skeleton--text" />}
      {top.length > 0 && (
        <ol className="aside-list aside-list--numbered">
          {top.map((v) => (
            <li key={v.infinitive}>
              <Link to={`/app/verbs/${encodeURIComponent(v.infinitive)}`} data-testid={`aside-frequent-${v.infinitive}`}>
                <span lang="fr" dir="ltr">{frText(verbLabel(v))}</span>
                <span className="muted">{v.en ? v.en.split('; ')[0] : v.level}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
      <p className="muted fine">{t('tdBsFrequentBody')}</p>
    </AsideCard>
  );
}
