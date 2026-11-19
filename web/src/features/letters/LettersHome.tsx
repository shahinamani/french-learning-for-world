/**
 * The letters section: the two kinds side by side, and the learner's drafts.
 */
import { useEffect, useState } from 'react';
import { SectionHead } from '../../components/SectionHead';
import { Link } from 'react-router';
import { useApp, useUserId } from '../../app-context';
import { countWords } from './model';
import { draftsFor, type Draft } from './store';
import { KINDS, freeTaskId, type LettersFile } from './types';
import { Fr, NotReady, useLetters, useText } from './ui';
import { ExamSectionCard, PageWithAside, TipCard } from '../../components/aside';
import { DraftsCard } from '../../components/aside/DraftsCard';
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

  const taskTitle = (taskId: string) => {
    const task = data.tasks.find((x) => x.id === taskId);
    if (task) return text(task.task).text;
    const kind = KINDS.find((k) => freeTaskId(k) === taskId);
    const content = data.kinds.find((k) => k.id === kind);
    return content ? `${t('lwFreeTask')} — ${text(content.name).text}` : taskId;
  };
  const kindOfTask = (taskId: string) => taskId.split('.')[1] ?? '';

  const rows = drafts === null ? null : drafts.filter((d) => d.text.trim().length > 0).sort((a, b) => b.updatedAt - a.updatedAt)
    .map((d) => ({ to: `/app/writing/${kindOfTask(d.taskId)}/${d.taskId}`, title: taskTitle(d.taskId), words: countWords(d.text), updatedAt: d.updatedAt }));

  return (
    <PageWithAside className="lw-page" testId="lw-home" aside={(
      <>
        <DraftsCard drafts={rows} />
        <ExamSectionCard section="pe" />
        <TipCard id="writing" />
      </>
    )}>
    <div className="lw">
      <SectionHead title={t('lwTitle')} fr="Les lettres" lede={t('lwLead')}
                   note={<p className="lw-note" dir="auto">{t('lwDraftedNote')}</p>} />

      <ul className="lw-kinds">
        {data.kinds.map((k) => (
          <li key={k.id} className="card lw-kind" data-testid={`lw-kind-${k.id}`}>
            <p className="lw-kind__register">{t(k.register === 'vous' ? 'lwRegisterVous' : 'lwRegisterTu')}</p>
            <h2 className="lw-kind__title"><Fr>{k.name.fr ?? ''}</Fr></h2>
            {settings.ui !== 'fr' && <p className="lw-kind__sub" dir="auto">{text(k.name).text}</p>}
            <p className="lw-kind__desc" dir="auto">{text(k.when).text}</p>
            {/* The parts in order, from the data file: what the marker expects to find. */}
            <ol className="lw-kind__parts" aria-label={t('lwParts')}>
              {k.parts.map((p) => <li key={p.id}><Fr>{p.name.fr ?? ''}</Fr></li>)}
            </ol>
            <div className="lw-kind__actions">
              <Link className="btn btn--primary" to={`/app/writing/${k.id}`}>{t('lwStudy')}</Link>
              <Link className="btn" to={`/app/writing/${k.id}#tasks`}>{t('lwWrite')}</Link>
            </div>
          </li>
        ))}
      </ul>

    </div>
    </PageWithAside>
  );
}
