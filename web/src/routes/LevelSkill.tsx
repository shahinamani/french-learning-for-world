/**
 * One cell of the learn map: a level and a skill, and what is actually in it.
 *
 * This route was a stub. The map offered 42 cells, 24 showed a dash, and **all
 * 18 of the clickable ones led here and said "Not built yet"**. A learner who
 * hits three dead ends stops believing the map, and the map is the portal's
 * main navigation.
 *
 * It now lists the level's concepts with the learner's record against each.
 * That is better than making the cells honestly locked — it turns the map into
 * a route — but only because it also says which concepts have nothing behind
 * them, and there are many: 196 of the 261 live concepts have no exercise at
 * all, and at C1 and C2 it is every single one. A list of 22 concepts where 18
 * are empty would be the same lie one level further down.
 *
 * The four examined skills — listening, reading, writing, speaking — are not
 * modelled in the taxonomy at any level, so those cells are locked on the map
 * and this page says plainly what is missing rather than listing nothing.
 */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useApp, useUserId } from '../app-context';
import { loadContent } from '../lib/content';
import { loadMaterial, conceptsFor, type Material } from '../lib/material';
import { conceptStats, type ConceptStat } from '../lib/progress';
import { Localised } from '../components/Localised';
import { Num } from '../components/Num';
import { Icon } from '../components/Icon';
import { NotFound } from './Stub';
import type { Concept } from '../lib/types';

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
/** The skills the taxonomy models. The other four are examined and unmodelled. */
const TAUGHT = ['grammar', 'vocabulary', 'phonetics', 'usage'];
const EXAMINED = ['listening', 'reading', 'writing', 'speaking'];
/** A closed map rather than `skill[0].toUpperCase() + …`: a dictionary key built
 *  by string surgery renders as nothing at all when it misses, and the parity
 *  check cannot see a key that is never written down. */
const EXAMINED_LABEL: Record<string, 'skillListening' | 'skillReading' | 'skillWriting' | 'skillSpeaking'> = {
  listening: 'skillListening', reading: 'skillReading',
  writing: 'skillWriting', speaking: 'skillSpeaking',
};

/** Enough reviews to say anything at all. Below this, "in progress" is the
 *  honest label — an accuracy from one answer is not a measurement. */
const ENOUGH = 3;

type Row = { concept: Concept; material: Material | undefined; stat: ConceptStat | undefined };

function mastery(stat: ConceptStat | undefined): 'untouched' | 'started' | 'weak' | 'solid' {
  if (!stat || stat.reviews === 0) return 'untouched';
  if (stat.reviews < ENOUGH) return 'started';
  return stat.accuracy >= 0.8 ? 'solid' : 'weak';
}

export function LevelSkill() {
  const { level = '', skill = '' } = useParams();
  const { t } = useApp();
  const userId = useUserId();
  const [rows, setRows] = useState<Row[] | undefined>(undefined);

  const validLevel = LEVELS.includes(level.toUpperCase());
  const known = TAUGHT.includes(skill) || EXAMINED.includes(skill);

  useEffect(() => {
    if (!validLevel || !TAUGHT.includes(skill)) { setRows([]); return; }
    let live = true;
    (async () => {
      const [content, material, stats] = await Promise.all([
        loadContent(), loadMaterial(), conceptStats(userId),
      ]);
      if (!live) return;
      setRows(conceptsFor(content.concepts, level.toUpperCase(), skill).map((concept) => ({
        concept, material: material.get(concept.id), stat: stats.get(concept.id),
      })));
    })().catch(() => { if (live) setRows([]); });
    return () => { live = false; };
  }, [level, skill, userId, validLevel]);

  if (!validLevel || !known) return <NotFound />;

  // An examined skill with no taxonomy behind it. Saying so is the whole point:
  // this is the honest version of the cell that used to lie.
  const examinedLabel = EXAMINED_LABEL[skill];
  if (examinedLabel) {
    return (
      <div className="page">
        <header>
          <h1 className="h2">{level.toUpperCase()} · {t(examinedLabel)}</h1>
        </header>
        <div className="empty" data-testid="skill-not-modelled">
          <div className="empty__icon"><Icon name="book" size={34} /></div>
          <p className="empty__title">{t('notBuilt')}</p>
          <p className="empty__body">{t('skillNotModelled')}</p>
          <div className="row gap-2 wrap" style={{ justifyContent: 'center', marginBlockStart: 'var(--space-5)' }}>
            <Link className="btn btn--primary" to={`/learn/level/${level.toUpperCase()}/grammar`}>
              {t('grammar')}
            </Link>
            <Link className="btn" to="/learn">{t('learn')}</Link>
          </div>
        </div>
      </div>
    );
  }

  if (rows === undefined) {
    return <div className="page"><div className="skeleton skeleton--title" /></div>;
  }

  const withMaterial = rows.filter((r) => (r.material?.total ?? 0) > 0);
  const empty = rows.length - withMaterial.length;

  return (
    <div className="page">
      <header>
        <h1 className="h2">{level.toUpperCase()} · {t(skill as 'grammar')}</h1>
        {/* The count first, because it is the thing a learner most needs to know
            and the thing the old stub hid: how much of this is actually here. */}
        <p className="muted" data-testid="level-skill-count">
          <Num>{withMaterial.length} / {rows.length}</Num>{' '}
          {t('conceptsWithExercises')}
          {empty > 0 ? <> · {t('conceptsListedOnly', { n: String(empty) })}</> : null}
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="empty" data-testid="level-skill-empty">
          <p className="empty__body">{t('noConceptsHere')}</p>
          <Link className="btn" to="/learn">{t('learn')}</Link>
        </div>
      ) : (
        <ul className="rows" data-testid="concept-list">
          {rows.map(({ concept, material, stat }) => {
            const has = (material?.total ?? 0) > 0;
            const state = mastery(stat);
            return (
              <li key={concept.id}>
                {/* A concept with no exercise is NOT a link. Making it one would
                    put the dead end one level deeper, which is the fault this
                    page exists to remove. */}
                {has ? (
                  <Link className="row row--link" to={`/learn/concept/${concept.id}`}
                        data-testid={`concept-${concept.id}`}>
                    <Localised field={concept.name} className="row-fr" />
                    <span className={`chip chip--${state}`} data-testid={`state-${concept.id}`}>
                      {t(`mastery_${state}` as 'mastery_solid')}
                    </span>
                    <span className="muted">
                      <Num>{material!.total}</Num> {t('exercises')}
                    </span>
                  </Link>
                ) : (
                  <div className="row" data-testid={`concept-${concept.id}`} aria-disabled="true">
                    <Localised field={concept.name} className="row-fr" />
                    <span className="chip" data-testid={`state-${concept.id}`}>
                      {t('noExercisesYet')}
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
