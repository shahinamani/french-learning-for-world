/**
 * What this site has for each exam family, counted from the content files at
 * render time: practice papers (content/exam-papers.json), reading texts by
 * level (content/reading), letter kinds (content/letters.json). A family with
 * nothing built says so; no figure here is written by hand.
 */
import '../../lib/locales/en/todayEn';   // registers its English (lazy group)
import { useEffect, useState } from 'react';
import { useApp } from '../../app-context';
import { TARGETS, type Target } from '../../lib/exam-targets';
import { loadPapers } from '../../lib/exams';
import type { Dict } from '../../lib/i18n';
import { AsideCard } from './index';

type Offer = {
  papers: Record<Target['family'], number>;
  textsByLevel: Map<string, number>;
  letterKinds: number;
} | null;

const FAMILY_LABEL: Record<Target['family'], keyof Dict> = {
  delf: 'shellExamFamilyDelf', dalf: 'shellExamFamilyDalf', tcf: 'shellExamFamilyTcf', canada: 'shellExamFamilyCanada',
};
const FAMILIES: Target['family'][] = ['delf', 'dalf', 'tcf', 'canada'];
/** The levels a family is sat at; the TCF and TEF place the candidate instead. */
const LEVELS_OF: Record<Target['family'], string[]> = {
  delf: ['A1', 'A2', 'B1', 'B2'], dalf: ['C1', 'C2'], tcf: [], canada: [],
};

export function OfferCard() {
  const { t } = useApp();
  const [offer, setOffer] = useState<Offer>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      const [{ loadReading }, { loadLetters }] = await Promise.all([
        import('../../features/reader/data'), import('../../features/letters/data'),
      ]);
      const [papers, texts, letters] = await Promise.all([
        loadPapers().catch(() => []), loadReading().catch(() => []),
        loadLetters().catch(() => ({ kinds: [], tasks: [] })),
      ]);
      if (!live) return;
      const count: Record<Target['family'], number> = { delf: 0, dalf: 0, tcf: 0, canada: 0 };
      for (const p of papers) {
        const fam = TARGETS.find((x) => x.exam === p.exam)?.family;
        if (fam) count[fam] += 1;
      }
      const textsByLevel = new Map<string, number>();
      for (const x of texts) if (x.level) textsByLevel.set(x.level, (textsByLevel.get(x.level) ?? 0) + 1);
      setOffer({ papers: count, textsByLevel, letterKinds: letters.kinds.length });
    })().catch(() => { if (live) setOffer({ papers: { delf: 0, dalf: 0, tcf: 0, canada: 0 }, textsByLevel: new Map(), letterKinds: 0 }); });
    return () => { live = false; };
  }, []);

  return (
    <AsideCard title={t('tdAsOfferTitle')} testId="aside-offer">
      {offer === null && <div className="skeleton skeleton--text" />}
      {offer && (
        <ul className="aside-offer">
          {FAMILIES.map((f) => {
            const texts = LEVELS_OF[f].map((lv) => [lv, offer.textsByLevel.get(lv) ?? 0] as const).filter(([, n]) => n > 0);
            const lines: string[] = [];
            if (offer.papers[f] > 0) lines.push(t('tdAsOfferPapers', { n: offer.papers[f] }));
            if (texts.length > 0) lines.push(texts.map(([lv, n]) => t('tdAsOfferTextsAt', { n, level: lv })).join(', '));
            if (f === 'delf' && offer.letterKinds > 0) lines.push(t('tdAsOfferLetters', { n: offer.letterKinds }));
            return (
              <li key={f}>
                <b>{t(FAMILY_LABEL[f])}</b>
                {lines.length > 0 ? <span className="fine">{lines.join(' · ')}</span> : <span className="muted fine">{t('tdAsOfferNone')}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </AsideCard>
  );
}
