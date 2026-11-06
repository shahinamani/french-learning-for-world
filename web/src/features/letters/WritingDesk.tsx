/**
 * The writing desk: one task, the learner's letter, and what can be checked
 * about its structure while they write.
 *
 * The draft is saved as the learner types (store.ts), only after they have
 * changed something: opening a task stores nothing.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useApp, useUserId } from '../../app-context';
import { Icon } from '../../components/Icon';
import { checkLetter, countWords, type Check } from './model';
import { loadDraft, saveDraft } from './store';
import { freeTaskId, type LetterKind, type LetterKindContent, type LetterTask, type LettersFile } from './types';
import { Fr, Gloss, NotFoundLetter, NotReady, letterFr, useLetters, useText } from './ui';
import './letters.css';

type Key = Parameters<ReturnType<typeof useApp>['t']>[0];

/** Parts that sit on a line of their own: inserting one starts a new paragraph. */
const LINE_PARTS = new Set(['sender', 'recipient', 'placeDate', 'object', 'salutation', 'closing', 'signature']);

export function WritingDesk() {
  const { kind, taskId } = useParams();
  const [loaded, retry] = useLetters();
  if (loaded.state !== 'ready') return <NotReady loaded={loaded} retry={retry} />;
  const k = loaded.data.kinds.find((x) => x.id === kind);
  if (!k || !taskId) return <NotFoundLetter />;
  const task = loaded.data.tasks.find((x) => x.id === taskId && x.kind === k.id);
  if (!task && taskId !== freeTaskId(k.id)) return <NotFoundLetter />;
  return <Desk key={taskId} k={k} task={task ?? null} taskId={taskId} data={loaded.data} />;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'failed';

function Desk({ k, task, taskId }: { k: LetterKindContent; task: LetterTask | null; taskId: string; data: LettersFile }) {
  const { t } = useApp();
  const userId = useUserId();
  const text = useText();
  const area = useRef<HTMLTextAreaElement>(null);
  const [letter, setLetter] = useState('');
  const [ready, setReady] = useState(false);
  const [save, setSave] = useState<SaveState>('idle');
  const [asking, setAsking] = useState(false);
  const pending = useRef<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  // The saved draft, if any. Until it has arrived the editor is read-only, so
  // nothing typed in the first moment can be overwritten by it.
  useEffect(() => {
    let live = true;
    loadDraft(userId, taskId)
      .then((d) => { if (live) { if (d) { setLetter(d.text); setSave('saved'); } setReady(true); } })
      .catch(() => { if (live) { setReady(true); setSave('failed'); } });
    return () => { live = false; };
  }, [userId, taskId]);

  const flush = () => {
    window.clearTimeout(timer.current);
    const value = pending.current;
    if (value === null) return;
    pending.current = null;
    saveDraft(userId, taskId, value).then(() => setSave('saved')).catch(() => setSave('failed'));
  };
  // Leaving the page saves what has not been saved yet.
  useEffect(() => () => flush(), []);   // eslint-disable-line react-hooks/exhaustive-deps

  const change = (value: string) => {
    setLetter(value);
    pending.current = value;
    setSave('saving');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, 600);
  };

  const insert = (phrase: string, part: string) => {
    const el = area.current;
    const start = el?.selectionStart ?? letter.length;
    const end = el?.selectionEnd ?? letter.length;
    let before = letter.slice(0, start);
    const after = letter.slice(end);
    let add = letterFr(phrase);
    if (LINE_PARTS.has(part)) {
      if (before && !before.endsWith('\n\n')) before = before.replace(/\n?$/, '\n\n');
      if (after && !after.startsWith('\n')) add += '\n\n';
    } else if (before && !/[\s(«]$/.test(before)) {
      add = ` ${add}`;
    }
    const next = before + add + after;
    change(next);
    const caret = before.length + add.length;
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(caret, caret); });
  };

  const checks = useMemo(() => checkLetter(k.id, letter), [k.id, letter]);
  const words = countWords(letter);

  return (
    <div className="lw lw--desk" data-testid="lw-desk">
      <Link className="lw-back" to={`/app/writing/${k.id}`}><Icon name="chevron" size={16} />{t('lwBackKind')}</Link>
      <header className="lw-head">
        <p className="lw-kind__register">{t(k.register === 'vous' ? 'lwRegisterVous' : 'lwRegisterTu')}</p>
        <h1 className="h2"><Fr>{k.name.fr ?? ''}</Fr></h1>
      </header>

      <section className="card lw-brief" aria-labelledby="lw-task-h">
        <h2 id="lw-task-h" className="lw-brief__h">
          {t(task ? 'lwTask' : 'lwFreeTask')}
          {task?.level && <span className="lw-level">{t('lwLevel', { level: task.level })}</span>}
        </h2>
        {task
          ? <><Fr as="p" className="lw-task__fr">{task.task.fr ?? ''}</Fr><Gloss field={task.task} className="lw-task__gloss" /></>
          : <p dir="auto">{t('lwFreeTaskBody')}</p>}
      </section>

      <div className="lw-desk">
        <div className="lw-desk__main">
          <div className="lw-tools">
            {letter.trim() === '' && (
              <button type="button" className="btn" disabled={!ready} onClick={() => change(letterFr(k.outline))} title={t('lwOutlineHint')} data-testid="lw-outline">
                {t('lwUseOutline')}
              </button>
            )}
            {letter.trim() !== '' && !asking && (
              <button type="button" className="btn btn--ghost" onClick={() => setAsking(true)}>{t('lwClear')}</button>
            )}
            {asking && (
              <span className="lw-ask" role="group" aria-label={t('lwClearAsk')}>
                <span dir="auto">{t('lwClearAsk')}</span>
                <button type="button" className="btn" onClick={() => { change(''); setAsking(false); area.current?.focus(); }}>{t('lwClearYes')}</button>
                <button type="button" className="btn btn--ghost" onClick={() => setAsking(false)}>{t('lwClearNo')}</button>
              </span>
            )}
          </div>
          <label className="field">
            <span className="field__label">{t('lwEditorLabel')}</span>
            <textarea
              ref={area}
              className="input lw-editor"
              lang="fr"
              dir="ltr"
              spellCheck
              rows={22}
              value={letter}
              readOnly={!ready}
              placeholder={t('lwPlaceholder')}
              onChange={(e) => change(e.target.value)}
              data-testid="lw-editor"
            />
          </label>
          <div className="lw-status">
            <span className="lw-count" data-testid="lw-words">{words === 1 ? t('lwWordsOne') : t('lwWords', { n: words })}</span>
            <span className={`lw-save lw-save--${save}`} role="status" data-testid="lw-save">
              {save === 'saving' ? t('lwSaving') : save === 'saved' ? t('lwSaved') : save === 'failed' ? t('lwSaveFailed') : ''}
            </span>
          </div>
          <p className="lw-note" dir="auto">{t('lwWordsNote')}</p>
          <p className="lw-note" dir="auto">{t('lwPrivacy')}</p>
        </div>

        <aside className="lw-desk__side">
          <section className="card lw-checks" aria-labelledby="lw-checks-h">
            <h2 id="lw-checks-h" className="h3">{t('lwChecks')}</h2>
            <ul className="lw-checklist" data-testid="lw-checks">
              {checks.map((c) => <CheckRow key={c.id} c={c} kind={k.id} />)}
            </ul>
            <p className="lw-note" dir="auto">{t('lwChecksNote')}</p>
          </section>

          <section className="card lw-bank" aria-labelledby="lw-bank-h">
            <h2 id="lw-bank-h" className="h3">{t('lwPhraseBank')}</h2>
            <p className="lw-note" dir="auto">{t('lwPhraseBankHint')}</p>
            {k.parts.map((p) => (
              <details key={p.id} className="lw-bank__part">
                <summary><Fr>{p.name.fr ?? ''}</Fr> <Gloss field={p.name} /></summary>
                <ul className="lw-bank__list">
                  {p.phrases.map((ph) => (
                    <li key={ph.fr}>
                      <button type="button" className="lw-insert" disabled={!ready}
                        onClick={() => insert(ph.fr, p.id)} aria-label={t('lwInsertLabel', { phrase: ph.fr })}>
                        <Fr>{ph.fr}</Fr>
                        <Gloss field={ph} />
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </section>
          <p className="lw-note" dir="auto">{text(k.registerNote).text}</p>
        </aside>
      </div>
    </div>
  );
}

const LABEL: Record<Check['id'], Key> = {
  placeDate: 'lwCkPlaceDate', object: 'lwCkObject', salutation: 'lwCkSalutation', closing: 'lwCkClosing',
  echo: 'lwCkEcho', register: 'lwCkRegister', tone: 'lwCkTone', signature: 'lwCkSignature', placeholders: 'lwCkPlaceholders',
};

/** What to tell the learner about a check that is not met. */
function hintFor(c: Check, kind: LetterKind): Key | null {
  const f = kind === 'formal';
  if (c.state === 'ok') return null;
  switch (c.id) {
    case 'placeDate': return c.state === 'missing' ? 'lwCkPlaceDateMissing' : 'lwCkPlaceDateOptional';
    case 'object': return 'lwCkObjectMissing';
    case 'salutation': return c.state === 'warn' ? 'lwCkSalutationEmail' : f ? 'lwCkSalutationFormalMissing' : 'lwCkSalutationInformalMissing';
    case 'closing': return c.state === 'warn' ? 'lwCkClosingEmail' : f ? 'lwCkClosingFormalMissing' : 'lwCkClosingInformalMissing';
    case 'echo': return 'lwCkEchoWarn';
    case 'register':
      if (c.state === 'warn') return f ? 'lwCkRegisterFormalWarn' : 'lwCkRegisterInformalWarn';
      return f ? 'lwCkRegisterFormalMissing' : 'lwCkRegisterInformalMissing';
    case 'tone': return f ? 'lwCkToneFormalWarn' : 'lwCkToneInformalWarn';
    case 'signature': return f ? 'lwCkSignatureFormalMissing' : 'lwCkSignatureInformalMissing';
    case 'placeholders': return 'lwCkPlaceholdersWarn';
  }
}

const STATE_KEY: Record<Check['state'], Key> = { ok: 'lwStateOk', missing: 'lwStateMissing', warn: 'lwStateWarn' };
const STATE_ICON: Record<Check['state'], string> = { ok: 'check', missing: 'close', warn: 'alert' };

function CheckRow({ c, kind }: { c: Check; kind: LetterKind }) {
  const { t } = useApp();
  const hint = hintFor(c, kind);
  return (
    <li className={`lw-check lw-check--${c.state}`} data-testid={`lw-check-${c.id}`} data-state={c.state}>
      <Icon name={STATE_ICON[c.state]} size={18} />
      <div>
        <p className="lw-check__label">
          <span className="lw-sr">{t(STATE_KEY[c.state])}: </span>{t(LABEL[c.id])}
        </p>
        {hint && <p className="lw-check__hint" dir="auto">{t(hint, { found: (c.found ?? []).join(', ') })}</p>}
      </div>
    </li>
  );
}
