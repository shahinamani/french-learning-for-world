/**
 * One kind of letter: when to write it, its parts in order with phrases for
 * each, a model with its parts labelled, the easy mistakes, and the tasks.
 */
import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { useApp, useUserId } from '../../app-context';
import { Icon } from '../../components/Icon';
import { countWords } from './model';
import { draftsFor, type Draft } from './store';
import { freeTaskId, type LetterKindContent, type LettersFile } from './types';
import { Fr, Gloss, NotFoundLetter, NotReady, useLetters, useText } from './ui';
import { ExamSectionCard, PageWithAside, TipCard } from '../../components/aside';
import { DraftsCard } from '../../components/aside/DraftsCard';
import { PartsIndexCard } from '../../components/aside/PartsIndexCard';
import './letters.css';

export function KindPage() {
  const { kind } = useParams();
  const [loaded, retry] = useLetters();
  if (loaded.state !== 'ready') return <NotReady loaded={loaded} retry={retry} />;
  const k = loaded.data.kinds.find((x) => x.id === kind);
  if (!k) return <NotFoundLetter />;
  return <Kind k={k} data={loaded.data} />;
}

function Kind({ k, data }: { k: LetterKindContent; data: LettersFile }) {
  const { t } = useApp();
  const userId = useUserId();
  const text = useText();
  const location = useLocation();
  const [labels, setLabels] = useState(true);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const started = new Set((drafts ?? []).map((x) => x.taskId));

  useEffect(() => {
    let live = true;
    draftsFor(userId).then((d) => { if (live) setDrafts(d); }).catch(() => { if (live) setDrafts([]); });
    return () => { live = false; };
  }, [userId]);

  // "Write a letter" on the home page lands on the tasks.
  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }, [location.hash]);

  const partName = (id: string) => k.parts.find((p) => p.id === id)?.name;
  const tasks = data.tasks.filter((x) => x.kind === k.id);
  // This kind's drafts, for the side column: the task's wording, or "free task".
  const draftTitle = (taskId: string) => {
    const task = tasks.find((x) => x.id === taskId);
    return task ? text(task.task).text : `${t('lwFreeTask')} — ${text(k.name).text}`;
  };
  const rows = drafts === null ? null : drafts
    .filter((d) => d.text.trim().length > 0 && (tasks.some((x) => x.id === d.taskId) || d.taskId === freeTaskId(k.id)))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((d) => ({ to: `/app/writing/${k.id}/${d.taskId}`, title: draftTitle(d.taskId), words: countWords(d.text), updatedAt: d.updatedAt }));

  return (
    <PageWithAside className="lw-page" testId={`lw-kind-page-${k.id}`} aside={(
      <>
        <PartsIndexCard parts={k.parts.map((p) => ({ id: p.id, fr: p.name.fr ?? p.id, local: text(p.name).locale === 'fr' ? undefined : text(p.name).text }))} />
        <DraftsCard drafts={rows} />
        <ExamSectionCard section="pe" />
        <TipCard id="writing" />
      </>
    )}>
    <div className="lw">
      <Link className="lw-back" to="/app/writing"><Icon name="chevron" size={16} />{t('lwBackHome')}</Link>
      <header className="lw-head">
        <h1 className="h2"><Fr>{k.name.fr ?? ''}</Fr></h1>
        <Gloss field={k.name} className="lw-lead" />
        <p className="lw-note" dir="auto">{t('lwDraftedNote')}</p>
      </header>

      <section className="lw-section lw-twocol">
        <div>
          <h2 className="h3">{t('lwWhen')}</h2>
          <p dir="auto">{text(k.when).text}</p>
        </div>
        <div>
          <h2 className="h3">{t('lwRegister')}</h2>
          <p dir="auto">{text(k.registerNote).text}</p>
        </div>
      </section>

      <section className="lw-section" aria-labelledby="lw-parts">
        <h2 id="lw-parts" className="h3">{t('lwParts')}</h2>
        <ol className="lw-parts">
          {k.parts.map((p) => (
            <li key={p.id} className="lw-part" id={`lw-part-${p.id}`}>
              <h3 className="lw-part__name"><Fr>{p.name.fr ?? ''}</Fr> <Gloss field={p.name} /></h3>
              <p className="lw-part__purpose" dir="auto">{text(p.purpose).text}</p>
              <ul className="lw-phrases">
                {p.phrases.map((ph) => (
                  <li key={ph.fr}>
                    <Fr className="lw-phrase">{ph.fr}</Fr>
                    <Gloss field={ph} />
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>

      <section className="lw-section" aria-labelledby="lw-model">
        <div className="lw-section__head">
          <h2 id="lw-model" className="h3">{t('lwModel')}</h2>
          <label className="lw-toggle">
            <input type="checkbox" checked={labels} onChange={(e) => setLabels(e.target.checked)} />
            {t('lwShowParts')}
          </label>
        </div>
        <p className="lw-meta">
          <Fr>{k.model.title.fr ?? ''}</Fr>
          {k.model.level && <span>{t('lwModelLevel', { level: k.model.level })}</span>}
        </p>
        <article className={`card lw-letter lw-letter--${k.id}`} lang="fr" data-testid="lw-model">
          {k.model.segments.map((s, i) => (
            <div key={i} className={`lw-seg lw-seg--${s.part}`}>
              {labels && <span className="lw-seg__label" lang={text(partName(s.part)).locale} dir="auto">{text(partName(s.part)).text}</span>}
              <p className="lw-seg__text">{s.text.split('\n').map((line, j) => <span key={j}>{j > 0 && <br />}<Fr>{line}</Fr></span>)}</p>
            </div>
          ))}
        </article>
      </section>

      <section className="lw-section" aria-labelledby="lw-pitfalls">
        <h2 id="lw-pitfalls" className="h3">{t('lwPitfalls')}</h2>
        <ul className="lw-pitfalls">
          {k.pitfalls.map((p, i) => <li key={i} dir="auto">{text(p).text}</li>)}
        </ul>
      </section>

      <section className="lw-section" id="tasks" aria-labelledby="lw-tasks">
        <h2 id="lw-tasks" className="h3">{t('lwTasks')}</h2>
        <ul className="lw-tasks">
          {tasks.map((task) => (
            <li key={task.id} className="card lw-task" data-testid={`lw-task-${task.id}`}>
              {task.level && <p className="lw-meta"><span className="lw-level">{t('lwLevel', { level: task.level })}</span></p>}
              <Fr as="p" className="lw-task__fr">{task.task.fr ?? ''}</Fr>
              <Gloss field={task.task} className="lw-task__gloss" />
              <Link className="btn btn--primary" to={`/app/writing/${k.id}/${task.id}`}>
                {t(started.has(task.id) ? 'lwContinue' : 'lwStart')}
              </Link>
            </li>
          ))}
          <li className="card lw-task lw-task--free">
            <p className="lw-task__title">{t('lwFreeTask')}</p>
            <p className="lw-task__gloss" dir="auto">{t('lwFreeTaskBody')}</p>
            <Link className="btn" to={`/app/writing/${k.id}/${freeTaskId(k.id)}`}>
              {t(started.has(freeTaskId(k.id)) ? 'lwContinue' : 'lwStart')}
            </Link>
          </li>
        </ul>
      </section>
    </div>
    </PageWithAside>
  );
}
