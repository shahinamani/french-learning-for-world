/**
 * The live product preview: a real flashcard and a real text, in a scene.
 *
 * Both are the product's own content (see data.ts), not a screenshot and not a
 * mock: the card is `v:etre` from the A1 deck, the text is the first four lines
 * of the café dialogue. They are interactive so a stranger can feel the product
 * before committing to it, and they write nothing — grading a card here stores
 * no review, and the card says so.
 *
 * No audio. There is none in the product, so there is no listen button to
 * offer; the text says that rather than leaving a gap where one would be.
 */
import { useId, useState } from 'react';
import { Link } from 'react-router';
import { Icon } from '../../components/Icon';
import { fr } from '../../lib/typography';
import { PREVIEW_CARD, PREVIEW_DIALOGUE } from './data';
import type { CopyLocale, Tx } from './types';

/** The French sentence with its target form picked out, for any sentence that
 *  contains the form literally (the content tests guarantee this one does). */
export function Highlighted({ text, form }: { text: string; form: string }) {
  const at = text.indexOf(form);
  if (at < 0) return <>{fr(text)}</>;
  return (
    <>
      {fr(text.slice(0, at))}
      <mark className="lp-mark">{text.slice(at, at + form.length)}</mark>
      {fr(text.slice(at + form.length))}
    </>
  );
}

export function FlashcardPreview({ tx, locale }: { tx: Tx; locale: CopyLocale }) {
  const [turned, setTurned] = useState(false);
  const [grade, setGrade] = useState<null | 'again' | 'easy'>(null);
  const labelId = useId();
  const ex = PREVIEW_CARD.example;
  const meaning = PREVIEW_CARD.meaning[locale === 'fr' ? 'fr' : 'en'];
  // The English gloss of the example is shown to an English reader. A French
  // reader has the French sentence already and no French "translation" of it
  // exists, so none is invented.
  const gloss = locale === 'fr' ? null : ex.en;

  return (
    <article className="lp-card" aria-labelledby={labelId} data-testid="landing-card">
      <header className="lp-card__head">
        <span className="lp-card__kind">
          <Icon name="stackedcards" size={18} />
          <span id={labelId}>{tx('landingCardLabel')}</span>
        </span>
        <span className="chip chip--a1">{PREVIEW_CARD.level}</span>
      </header>

      <div className="lp-card__stage" key={turned ? 'back' : 'front'} aria-live="polite">
        {!turned ? (
          <>
            <p className="lp-card__word" lang="fr">{PREVIEW_CARD.front}</p>
            <p className="lp-card__hint">{tx('landingCardHint')}</p>
          </>
        ) : (
          <>
            <p className="lp-card__meaning" lang={locale === 'fr' ? 'fr' : 'en'}>{meaning}</p>
            <p className="lp-card__example" lang="fr">
              <Highlighted text={ex.fr} form={ex.form} />
            </p>
            {gloss && <p className="lp-card__gloss">{gloss}</p>}
          </>
        )}
      </div>

      <div className="lp-card__actions">
        <button type="button" className="btn" onClick={() => { setTurned(!turned); setGrade(null); }}
                data-testid="landing-card-turn">
          <Icon name="chevron" size={16} />
          {turned ? tx('landingCardBack') : tx('landingCardTurn')}
        </button>
        {turned && (
          <div className="lp-card__grades" role="group" aria-label={tx('landingCardPreviewOnly')}>
            <button type="button" className="btn lp-grade lp-grade--again" aria-pressed={grade === 'again'}
                    onClick={() => setGrade('again')}>{tx('landingCardAgain')}</button>
            <button type="button" className="btn lp-grade lp-grade--easy" aria-pressed={grade === 'easy'}
                    onClick={() => setGrade('easy')}>{tx('landingCardEasy')}</button>
          </div>
        )}
      </div>

      <p className="lp-card__note" role="status">
        {grade === 'again' ? tx('landingCardAgainResult')
          : grade === 'easy' ? tx('landingCardEasyResult')
          : turned ? tx('landingCardPreviewOnly')
          : tx('landingCardUnchecked')}
      </p>
    </article>
  );
}

export function DialoguePreview({ tx, locale }: { tx: Tx; locale: CopyLocale }) {
  const [showEn, setShowEn] = useState(false);
  const labelId = useId();
  const d = PREVIEW_DIALOGUE;

  return (
    <article className="lp-read" aria-labelledby={labelId} data-testid="landing-dialogue">
      <header className="lp-card__head">
        <span className="lp-card__kind">
          <Icon name="textpage" size={18} />
          <span id={labelId}>{tx('landingDialogueLabel')}</span>
        </span>
        <span className="chip chip--a1">{d.level}</span>
      </header>

      <h3 className="lp-read__title" lang="fr">
        {d.title.fr}
        {locale !== 'fr' && <span className="lp-read__gloss" lang="en"> · {d.title.en}</span>}
      </h3>

      <ol className="lp-read__lines">
        {d.lines.map((l, i) => (
          <li key={i} className="lp-read__line">
            <span className="lp-read__who" lang="fr">{l.speaker}</span>
            <span className="lp-read__fr" lang="fr">{fr(l.fr)}</span>
            {showEn && <span className="lp-read__en" lang="en">{l.en}</span>}
          </li>
        ))}
      </ol>

      <div className="lp-read__foot">
        <button type="button" className="btn btn--sm lp-tap" aria-pressed={showEn}
                onClick={() => setShowEn(!showEn)} data-testid="landing-dialogue-en">
          {showEn ? tx('landingDialogueHideEn') : tx('landingDialogueShowEn')}
        </button>
        <Link className="lp-textlink" to="/app/workspace">{tx('landingDialogueOpen')}</Link>
      </div>
      <p className="lp-card__note">{tx('landingDialogueNoAudio')}</p>
    </article>
  );
}
