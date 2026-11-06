/**
 * The letters section: the two kinds side by side, and the learner's drafts.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useApp, useUserId } from '../../app-context';
import { Icon } from '../../components/Icon';
import { countWords } from './model';
import { draftsFor, type Draft } from './store';
import { KINDS, freeTaskId, type LettersFile } from './types';
import { Fr, NotReady, useLetters, useText } from './ui';
import './letters.css';

export function LettersHome() {
  const [loaded, retry] = useLetters();
  if (loaded.state !== 'ready') return <NotReady loaded={loaded} retry={retry} />;
  return <Home data={loaded.data} />;
}

function Home({ data }: { data: LettersFile }) {
  const { t, settings } = useApp();
  const userId = useUserId();
  const text = useText();
  const [drafts, setDrafts] = useState<Draft[] | null>(null);

  useEffect(() => {
    let live = true;
    draftsFor(userId).then((d) => { if (live) setDrafts(d); }).catch(() => { if (live) setDrafts([]); });
    return () => { live = false; };
  }, [userId]);

  const date = (ms: number) => new Intl.DateTimeFormat(settings.ui, { dateStyle: 'medium' }).format(ms);
  const taskTitle = (taskId: string) => {
    const task = data.tasks.find((x) => x.id === taskId);
    if (task) return text(task.task).text;
    const kind = KINDS.find((k) => freeTaskId(k) === taskId);
    const content = data.kinds.find((k) => k.id === kind);
    return content ? `${t('lwFreeTask')} — ${text(content.name).text}` : taskId;
  };
  const kindOfTask = (taskId: string) => taskId.split('.')[1] ?? '';

  return (
    <div className="lw" data-testid="lw-home">
      <header className="lw-head">
        <h1 className="h2">{t('lwTitle')}</h1>
        <p className="lw-lead" dir="auto">{t('lwLead')}</p>
        <p className="lw-note" dir="auto">{t('lwDraftedNote')}</p>
      </header>

      <ul className="lw-kinds">
        {data.kinds.map((k) => (
          <li key={k.id} className="card lw-kind" data-testid={`lw-kind-${k.id}`}>
            <p className="lw-kind__register">{t(k.register === 'vous' ? 'lwRegisterVous' : 'lwRegisterTu')}</p>
            <h2 className="lw-kind__title"><Fr>{k.name.fr ?? ''}</Fr></h2>
            {settings.ui !== 'fr' && <p className="lw-kind__sub" dir="auto">{text(k.name).text}</p>}
            <p className="lw-kind__desc" dir="auto">{text(k.when).text}</p>
            <div className="lw-kind__actions">
              <Link className="btn btn--primary" to={`/app/writing/${k.id}`}>{t('lwStudy')}</Link>
              <Link className="btn" to={`/app/writing/${k.id}#tasks`}>{t('lwWrite')}</Link>
            </div>
          </li>
        ))}
      </ul>

      <section className="lw-section" aria-labelledby="lw-drafts">
        <h2 id="lw-drafts" className="h3">{t('lwYourDrafts')}</h2>
        {drafts === null ? <div className="skeleton skeleton--text" />
          : drafts.length === 0 ? <p className="lw-note" dir="auto">{t('lwNoDrafts')}</p>
          : (
            <ul className="lw-drafts">
              {drafts.map((d) => {
                const n = countWords(d.text);
                return (
                  <li key={d.taskId} className="lw-draft">
                    <Icon name="micpen" size={20} />
                    <div className="lw-draft__body">
                      <p className="lw-draft__title" dir="auto">{taskTitle(d.taskId)}</p>
                      <p className="lw-meta">
                        <span>{n === 1 ? t('lwWordsOne') : t('lwWords', { n })}</span>
                        <span>{t('lwUpdated', { date: date(d.updatedAt) })}</span>
                      </p>
                    </div>
                    <Link className="btn" to={`/app/writing/${kindOfTask(d.taskId)}/${d.taskId}`}>{t('lwOpenDraft')}</Link>
                  </li>
                );
              })}
            </ul>
          )}
      </section>
    </div>
  );
}
