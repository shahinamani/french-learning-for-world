/**
 * The dialogues section: a situation, the French, the meaning, and questions
 * that are answered and explained.
 *
 * There is ONE unit. It is complete rather than large, and the section says
 * how many there are instead of implying more — an empty tab advertised as
 * content is the thing this replaces, and a tab with nine half-units would be
 * the same fault at greater length.
 *
 * The audio here is the device's speech synthesiser and the screen says so
 * next to the control. No recording has been obtained under a licence that
 * permits use, and machine speech is not offered as listening practice.
 */
import { useEffect, useState } from 'react';
import { useApp } from '../../app-context';
import { Num } from '../../components/Num';
import { Localised } from '../../components/Localised';
import { fr as frText } from '../../lib/typography';
import { speak, stop } from '../../lib/speech';
import type { Locale } from '../../lib/types';

type Line = { speaker: string; fr: string; fa: string; en: string };
type Question = {
  id: string;
  prompt: Partial<Record<Locale, string>>;
  options: Array<Partial<Record<Locale, string>>>;
  answer: number;
  explain: Partial<Record<Locale, string>>;
};
type Dialogue = {
  id: string; level: string;
  title: Partial<Record<Locale, string>>;
  situation: Partial<Record<Locale, string>>;
  lines: Line[];
  questions: Question[];
};

type Props = { voiceId: string | null; rate: number; voiceAvailable: boolean };

export function Dialogues({ voiceId, rate, voiceAvailable }: Props) {
  const { settings, t } = useApp();
  const [units, setUnits] = useState<Dialogue[] | null>(null);
  /** questionId → the index the learner chose. Retry clears one entry. */
  const [chosen, setChosen] = useState<Record<string, number>>({});

  useEffect(() => {
    let live = true;
    fetch('content/dialogues.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('dialogues'))))
      .then((d) => { if (live) setUnits(d.dialogues as Dialogue[]); })
      .catch(() => { if (live) setUnits([]); });
    return () => { live = false; stop(); };
  }, []);

  if (!units) return <div className="skeleton skeleton--text" data-testid="ws-dialogues-loading" />;
  if (units.length === 0) {
    return (
      <div className="card ws-lead" data-testid="ws-dialogues-empty">
        <p><strong>{t('wsNoDialogues')}</strong></p>
        <p className="muted">{t('wsNoDialoguesWhy')}</p>
      </div>
    );
  }

  const unit = units[0]!;
  return (
    <div className="ws-dlg" data-testid="ws-dialogue">
      <div className="card ws-lead">
        <p className="ws-dlg__count" data-testid="ws-dialogue-count">
          <Num>{units.length}</Num> · {unit.level}
        </p>
        <h2 className="h2"><Localised field={unit.title} /></h2>
        <p className="muted"><Localised field={unit.situation} /></p>
        <p className="fine muted" data-testid="ws-dialogue-speech">{t('wsSpeechAid')}</p>
      </div>

      <div className="card ws-dlg__script">
        {unit.lines.map((line, i) => {
          const sentence = frText(line.fr);
          return (
            <div key={i} className="ws-dlg__line">
              <div className="ws-dlg__who">
                <span className="ws-ex__tense">{frText(line.speaker)}</span>
                <button type="button" className="icon-btn ws-ex__listen"
                        data-testid={`ws-dlg-listen-${i}`}
                        aria-label={`${t('wsListen')} — ${sentence}`}
                        disabled={!voiceAvailable}
                        onClick={() => speak(line.fr, voiceId, rate)}>♪</button>
              </div>
              <p className="ws-ex__fr" lang="fr" dir="ltr">{sentence}</p>
              <p className="ws-ex__fa" lang="fa" dir="rtl">{line.fa}</p>
              {settings.meaning !== 'fa' && (
                <p className="ws-ex__en muted" lang="en" dir="ltr">{line.en}</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="card ws-dlg__questions">
        <h3 className="h3">{t('wsComprehension')}</h3>
        {unit.questions.map((q) => {
          const picked = chosen[q.id];
          const answered = picked !== undefined;
          const right = picked === q.answer;
          return (
            <div key={q.id} className="ws-dlg__q" data-testid={`ws-dlg-q-${q.id}`}>
              <p className="ws-dlg__prompt"><Localised field={q.prompt} /></p>
              <div className="ws-dlg__options">
                {q.options.map((opt, i) => (
                  <button key={i} type="button"
                          className={`ws-chip${answered && i === q.answer ? ' is-right' : ''}`
                            + `${answered && i === picked && !right ? ' is-wrong' : ''}`}
                          data-testid={`ws-dlg-opt-${q.id}-${i}`}
                          aria-pressed={picked === i}
                          disabled={answered}
                          onClick={() => setChosen((c) => ({ ...c, [q.id]: i }))}>
                    <Localised field={opt} />
                  </button>
                ))}
              </div>
              {answered && (
                <div className="ws-dlg__feedback" data-testid={`ws-dlg-feedback-${q.id}`}>
                  <p className={right ? 'ws-dlg__right' : 'ws-dlg__wrong'}>
                    {right ? t('wsCorrect') : t('wsNotQuite')}
                  </p>
                  {/* The explanation is shown either way: a learner who guessed
                      right still needs to know why, and a learner who got it
                      wrong needs it most. */}
                  <p className="ws-usage"><Localised field={q.explain} /></p>
                  {!right && (
                    <button type="button" className="btn btn--sm"
                            data-testid={`ws-dlg-retry-${q.id}`}
                            onClick={() => setChosen((c) => {
                              const next = { ...c }; delete next[q.id]; return next;
                            })}>
                      {t('wsRetry')}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <p className="fine muted" data-testid="ws-dialogue-drafted">{t('wsDrafted')}</p>
      </div>
    </div>
  );
}
