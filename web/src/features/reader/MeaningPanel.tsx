/**
 * The meaning panel: a column beside the text on a wide screen, a bottom sheet
 * on a narrow one. Blueprint section 11's action table is its spec, row by row:
 *
 *   touch a word      → meaning in context + pronunciation → the dictionary
 *   add to my words   → the word AND its sentence, with the source id
 *   what structure    → the related explanation → grammar
 *
 * What it does not do is as deliberate as what it does. A word the text's own
 * glossary has no entry for gets NO meaning — it gets a sentence that says so —
 * because a plausible meaning written here would be a claim nobody checked
 * (AGENTS.md section 2).
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useApp } from '../../app-context';
import { Icon } from '../../components/Icon';
import { Localised } from '../../components/Localised';
import { loadContent } from '../../lib/content';
import { speak, stop } from '../../lib/speech';
import { fr as frText } from '../../lib/typography';
import type { Concept } from '../../lib/types';
import { matchVocab, tokenize, vocabInSentence, wordItemId, type VocabMatch } from './model';
import type { ReadingText, ReadingVocab } from './types';

export type Selection = { phrase: string; sentence: string; seg: number };

type Props = {
  text: ReadingText;
  sel: Selection | null;
  wide: boolean;
  /** itemIds already saved, so the button can say so. */
  saved: Set<string>;
  voiceAvailable: boolean;
  saveFailed: boolean;
  onAdd: (phrase: string, sentence: string) => void;
  onClose: () => void;
};

export function MeaningPanel({ text, sel, wide, saved, voiceAvailable, saveFailed, onAdd, onClose }: Props) {
  const { t, settings } = useApp();
  const head = useRef<HTMLHeadingElement>(null);
  const [structure, setStructure] = useState(false);
  const [concepts, setConcepts] = useState<Concept[] | null>(null);
  const [spoke, setSpoke] = useState(true);

  // A new selection starts the panel afresh and takes focus, without scrolling:
  // moving focus is allowed to move the learner's eyes, never the page.
  useEffect(() => {
    setStructure(false); setSpoke(true);
    if (sel) head.current?.focus({ preventScroll: true });
    return () => stop();
  }, [sel?.phrase, sel?.seg]);

  const grammarIds = text.relations.grammar;
  useEffect(() => {
    if (!structure || grammarIds.length === 0 || concepts) return;
    let live = true;
    loadContent().then(({ conceptById }) => {
      if (live) setConcepts(grammarIds.map((id) => conceptById.get(id)).filter((c): c is Concept => !!c));
    }).catch(() => { if (live) setConcepts([]); });
    return () => { live = false; };
  }, [structure, grammarIds, concepts]);

  useEffect(() => {
    if (!sel || wide) return;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [sel, wide, onClose]);

  if (!sel && !wide) return null;

  const labelId = 'rd-panel-title';
  const common = {
    id: 'rd-panel',
    className: `rd-panel rd-aside ${wide ? '' : 'rd-aside--sheet'}`,
    'aria-labelledby': labelId,
    'data-testid': 'rd-panel',
    'data-open': sel ? 'true' : 'false',
  } as const;
  const role = wide ? undefined : ({ role: 'dialog', 'aria-modal': false } as const);

  const header = (
    <div className="rd-panel__head">
      <h2 id={labelId} ref={head} tabIndex={-1}>{t('rdPanelTitle')}</h2>
      {sel && (
        <button type="button" className="btn btn--ghost" onClick={onClose} aria-label={t('rdPanelClose')} data-testid="rd-panel-close">
          <Icon name="close" size={18} />
        </button>
      )}
    </div>
  );

  if (!sel) {
    return (
      <aside {...common} {...role}>
        {header}
        <p className="rd-note" dir="auto" data-testid="rd-panel-empty">{t('rdPanelEmpty')}</p>
      </aside>
    );
  }

  // Glossary entries for this selection. A phrase may touch several.
  const inSentence = vocabInSentence(sel.sentence, text.vocabulary);
  const words = tokenize(sel.phrase).filter((k) => k.word).map((k) => k.text);
  const matches: VocabMatch[] = [];
  for (const w of words) {
    const m = matchVocab(w, inSentence);
    if (m && !matches.some((x) => x.item === m.item)) matches.push(m);
  }
  const others = inSentence.filter((v) => !matches.some((m) => m.item === v));
  const itemId = wordItemId(sel.phrase, text.id);
  const isSaved = saved.has(itemId);
  const meaningLocale = settings.meaning;
  const dictionary = `/app/vocabulary?q=${encodeURIComponent(sel.phrase)}`;

  const hear = () => { setSpoke(speak(sel.phrase, null, 0.9)); };

  // The sentence, with the selection marked where it first appears in it.
  const at = sel.sentence.indexOf(sel.phrase);
  const sentenceNode = at < 0 ? frText(sel.sentence) : (
    <>
      {frText(sel.sentence.slice(0, at))}
      <mark>{frText(sel.phrase)}</mark>
      {frText(sel.sentence.slice(at + sel.phrase.length))}
    </>
  );

  return (
    <aside {...common} {...role}>
      {header}
      <p className="rd-panel__word" lang="fr" dir="ltr" data-testid="rd-selected">{frText(sel.phrase)}</p>

      <div className="rd-actions">
        <button type="button" className="btn" onClick={hear} disabled={!voiceAvailable} data-testid="rd-hear">
          <Icon name="sound" size={16} /> {t('rdHear')}
        </button>
        <span className="rd-note" dir="auto">{voiceAvailable && spoke ? t('rdSpeechAid') : t('rdNoVoice')}</span>
      </div>

      <section aria-labelledby="rd-h-sentence">
        <h3 id="rd-h-sentence">{t('rdItsSentence')}</h3>
        <p className="rd-panel__sentence" lang="fr" dir="ltr" data-testid="rd-sentence">{sentenceNode}</p>
      </section>

      <section aria-labelledby="rd-h-meaning" data-testid="rd-meaning">
        <h3 id="rd-h-meaning">{t('rdMeaningHere')}</h3>
        {matches.length === 0 ? (
          <p className="rd-note" dir="auto" data-testid="rd-no-gloss">{t('rdNoGloss')}</p>
        ) : (
          <>
            {matches.map(({ item, kind }) => (
              <div className="rd-gloss" key={item.fr} data-testid="rd-gloss" data-kind={kind}>
                <strong lang="fr" dir="ltr">{frText(item.fr ?? '')}</strong>
                <Localised field={{ en: item.en, fa: item.fa }} locale={meaningLocale} />
                {kind === 'spelling' && <span className="rd-note" dir="auto">{t('rdSpellingMatch')}</span>}
              </div>
            ))}
            <p className="rd-note" dir="auto">{t('rdGlossDrafted')}</p>
          </>
        )}
      </section>

      {others.length > 0 && (
        <section aria-labelledby="rd-h-others">
          <h3 id="rd-h-others">{t('rdGlossedHere')}</h3>
          <ul className="rd-glossed">
            {others.map((v) => <GlossedRow key={v.fr} v={v} textId={text.id} saved={saved} onAdd={onAdd} />)}
          </ul>
        </section>
      )}

      <div className="rd-actions">
        <button type="button" className="btn btn--primary" onClick={() => onAdd(sel.phrase, sel.sentence)}
          disabled={isSaved} aria-pressed={isSaved} data-testid="rd-add-word">
          {isSaved ? t('rdWordAdded') : t('rdAddWord')}
        </button>
        <Link className="btn" to={dictionary} data-testid="rd-dictionary">{t('rdDictionary')}</Link>
        <button type="button" className="btn" aria-expanded={structure} aria-controls="rd-structure"
          onClick={() => setStructure((s) => !s)} data-testid="rd-structure-btn">
          {t('rdWhatStructure')}
        </button>
      </div>
      {isSaved && <p className="rd-ok" dir="auto" role="status" data-testid="rd-saved-note">{t('rdWordAddedNote')}</p>}
      {saveFailed && <p className="rd-bad" dir="auto" role="alert">{t('rdSaveFailed')}</p>}

      {structure && (
        <section id="rd-structure" data-testid="rd-structure">
          {grammarIds.length === 0 ? (
            <p className="rd-note" dir="auto" data-testid="rd-structure-none">{t('rdStructureNone')}</p>
          ) : (
            <ul className="rd-glossed">
              {(concepts ?? []).map((c) => (
                <li key={c.id}>
                  <Localised field={c.name} />
                  <Link className="btn btn--sm" to={`/app/grammar/${c.id}`}>{t('rdStructureOpen')}</Link>
                </li>
              ))}
            </ul>
          )}
          <Link className="btn btn--ghost" to="/app/grammar">{t('rdStructureOpen')}</Link>
        </section>
      )}
    </aside>
  );
}

/** One glossary entry in the same sentence. Adding it saves its headword with its own source sentence. */
function GlossedRow({ v, textId, saved, onAdd }:
  { v: ReadingVocab; textId: string; saved: Set<string>; onAdd: (phrase: string, sentence: string) => void }) {
  const { t, settings } = useApp();
  const done = saved.has(wordItemId(v.fr ?? '', textId));
  return (
    <li>
      <span><strong lang="fr" dir="ltr">{frText(v.fr ?? '')}</strong>{' · '}<Localised field={{ en: v.en, fa: v.fa }} locale={settings.meaning} /></span>
      <button type="button" className="btn btn--sm" disabled={done} onClick={() => onAdd(v.fr ?? '', v.sentenceFromText)}
        aria-label={t('rdAddGlossed', { word: v.fr ?? '' })} data-testid="rd-add-glossed">
        {done ? t('rdWordAdded') : t('rdAddWord')}
      </button>
    </li>
  );
}

