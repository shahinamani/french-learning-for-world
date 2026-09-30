// Wiring. The logic worth testing lives in fsrs.js, timer.js, storage.js and
// i18n.js; this file only connects it to the DOM.

import { RATING, newCardState, review, previewIntervals } from './fsrs.js';
import * as T from './timer.js';
import { playChime, unlock } from './chime.js';
import { loadProgress, saveProgress, loadSettings, saveSettings,
         exportProgress, importProgress } from './storage.js';
import { LOCALES, MEANING_LOCALES, dictionaries, detectLocale, translator } from './i18n.js';
import { cardKey } from './cardKey.js';

const $ = (id) => document.getElementById(id);
const TABS = ['study', 'exams', 'browse', 'progress', 'about'];

const app = {
  cards: [], exams: null,
  progress: loadProgress(),
  settings: loadSettings(),
  t: translator('en'), lang: 'en', tab: 'study',
  queue: [], current: null, revealed: false,
  reviewed: 0, sessionSize: 0,
  storageWorks: true, settingsOpen: false, timerOpen: false,
  openExam: null, examFilter: null,
  timer: { endsAt: 0, durationMin: 10, running: false, selectedMin: 10, sound: true, finished: null },
};

/* ── element helper ────────────────────────────────────── */

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat()) if (c) node.append(c);
  return node;
}

const SVG = 'http://www.w3.org/2000/svg';
/** Icons are drawn, not typed: an emoji renders differently on every system. */
function icon(...paths) {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', 'i');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of paths) {
    const p = document.createElementNS(SVG, 'path');
    p.setAttribute('d', d);
    svg.append(p);
  }
  return svg;
}
const ICONS = {
  study: ['M7 8.5A1.5 1.5 0 0 1 8.5 7h9A1.5 1.5 0 0 1 19 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 7 17.5z', 'M5 16.2A1.6 1.6 0 0 1 4 14.8V6.6A1.6 1.6 0 0 1 5.6 5h8.2c.6 0 1.2.4 1.4 1'],
  exams: ['M7 3h7l4 4v14H7z', 'M14 3v4h4', 'M10 13h6M10 17h4'],
  browse: ['M4 6h16M4 12h16M4 18h10'],
  progress: ['M4 19h16', 'M7 19v-6M12 19V7M17 19v-9'],
  about: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 11v5', 'M12 8h.01'],
};

/* ── content ───────────────────────────────────────────── */

async function loadContent() {
  const index = await fetch('content/decks.json').then((r) => {
    if (!r.ok) throw new Error(`decks.json: ${r.status}`);
    return r.json();
  });
  const decks = await Promise.all(index.decks.map((d) =>
    fetch(`content/${d.file}`).then((r) => {
      if (!r.ok) throw new Error(`${d.file}: ${r.status}`);
      return r.json();
    })));
  return decks.flatMap((deck) => deck.cards.map((card) => ({
    ...card,
    deckId: deck.id,
    key: card.key ?? cardKey(card.type, card.fr),
  })));
}

/* ── scheduling ────────────────────────────────────────── */

const stateOf = (key) => app.progress[key] ?? newCardState();
const isNew = (key) => !app.progress[key] || app.progress[key].reps === 0;
const isDue = (key, now) => (app.progress[key]?.dueAt ?? 0) <= now;
const inFilter = (card) => !app.examFilter || app.examFilter.levels.includes(card.level);

/** Due cards first, longest overdue first; then new cards, in deck order. */
function buildQueue(now, includeNew = true) {
  const due = [], fresh = [];
  for (const card of app.cards) {
    if (!inFilter(card)) continue;
    if (isNew(card.key)) { if (includeNew) fresh.push(card); }
    else if (isDue(card.key, now)) due.push(card);
  }
  due.sort((a, b) => app.progress[a.key].dueAt - app.progress[b.key].dueAt);
  return [...due, ...fresh];
}

function counts(now) {
  let due = 0, fresh = 0, learned = 0, total = 0;
  for (const card of app.cards) {
    if (!inFilter(card)) continue;
    total += 1;
    if (isNew(card.key)) fresh += 1;
    else {
      if (isDue(card.key, now)) due += 1;
      if (app.progress[card.key].stability >= 21) learned += 1;
    }
  }
  return { due, fresh, learned, total };
}

function startSession(includeNew) {
  app.queue = buildQueue(Date.now(), includeNew);
  app.current = app.queue[0] ?? null;
  app.sessionSize = app.queue.length;
  app.revealed = false;
  app.reviewed = 0;
  render();
}

function rate(rating) {
  if (!app.current) return;
  const now = Date.now();
  app.progress[app.current.key] = review(stateOf(app.current.key), rating, now).state;
  app.reviewed += 1;
  if (!saveProgress(app.progress)) app.storageWorks = false;
  // A forgotten card returns at the end of this session, not tomorrow.
  app.queue = app.queue.slice(1);
  if (rating === RATING.AGAIN) { app.queue.push(app.current); app.sessionSize += 1; }
  app.current = app.queue[0] ?? null;
  app.revealed = false;
  render();
}

/* ── timer ─────────────────────────────────────────────── */

function startTimer() {
  const now = Date.now();
  app.timer.endsAt = now + app.timer.selectedMin * 60000;
  app.timer.durationMin = app.timer.selectedMin;
  app.timer.running = true;
  app.timer.finished = null;
  T.saveTimer(app.timer.endsAt, app.timer.durationMin);
  if (app.timer.sound) unlock();   // prime audio inside the real gesture
  renderTimer();
}

function stopTimer() {
  app.timer.running = false;
  app.timer.endsAt = 0;
  T.clearTimer();
  renderTimer();
}

async function finishTimer() {
  app.timer.running = false;
  app.timer.endsAt = 0;
  T.clearTimer();
  const outcome = await T.announceFinish(app.timer.sound ? playChime : undefined);
  app.timer.finished = app.timer.sound && !outcome.soundPlayed ? 'silent' : 'done';
  renderTimer();
  try {
    if (globalThis.Notification?.permission === 'granted') {
      new Notification(app.t('timerDone'), { silent: true });
    }
  } catch { /* a notification that cannot be shown changes nothing */ }
}

function pollTimer() {
  if (!app.timer.running) return;
  if (T.remainingSeconds(app.timer.endsAt, Date.now()) <= 0) finishTimer();
  else renderClock();
}

function renderClock() {
  const secs = app.timer.running
    ? T.remainingSeconds(app.timer.endsAt, Date.now())
    : app.timer.selectedMin * 60;
  $('timer-clock').textContent = T.formatClock(secs);
}

function renderTimer() {
  const t = app.t;
  renderClock();
  $('timer-pill').classList.toggle('is-running', app.timer.running);
  $('timer-pill').setAttribute('aria-expanded', String(app.timerOpen));
  $('timer-panel').hidden = !app.timerOpen;

  $('timer-presets').replaceChildren(...T.PRESETS_MIN.map((m) =>
    el('button', {
      class: 'preset', type: 'button',
      'aria-pressed': String(app.timer.selectedMin === m),
      'data-testid': `timer-preset-${m}`,
      text: T.presetLabel(m), disabled: app.timer.running,
      onclick: () => { app.timer.selectedMin = m; renderTimer(); },
    })));

  const start = $('timer-start');
  start.textContent = app.timer.running ? t('pause') : t('start');
  start.onclick = () => (app.timer.running ? stopTimer() : startTimer());
  $('timer-reset').textContent = t('reset');
  $('timer-reset').onclick = stopTimer;

  const sound = $('timer-sound');
  sound.replaceChildren(app.timer.sound
    ? icon('M11 5 6 9H3v6h3l5 4z', 'M16 8.5a5 5 0 0 1 0 7M19 6a9 9 0 0 1 0 12')
    : icon('M11 5 6 9H3v6h3l5 4z', 'M16 9.5l5 5M21 9.5l-5 5'));
  sound.setAttribute('aria-pressed', String(app.timer.sound));
  sound.setAttribute('aria-label', app.timer.sound ? t('soundOn') : t('soundOff'));
  sound.onclick = () => {
    app.timer.sound = !app.timer.sound;
    T.writeSoundPreference(app.timer.sound);
    if (app.timer.sound) unlock();
    renderTimer();
  };

  const box = $('timer-finished');
  box.hidden = !app.timer.finished;
  if (app.timer.finished) {
    $('timer-finished-text').textContent =
      app.timer.finished === 'away' ? t('timerFinishedAway')
      : app.timer.finished === 'silent' ? t('timerDoneSilent')
      : t('timerDone');
  }
  $('timer-dismiss').textContent = t('dismiss');
  $('timer-dismiss').onclick = () => { app.timer.finished = null; renderTimer(); };
}

/* ── card ──────────────────────────────────────────────── */

const dirOf = (loc) => LOCALES[loc]?.dir ?? 'ltr';
const meaningOf = (card) => card.meanings[app.settings.showTranslation] ?? card.meanings.en ?? '';
function altMeaningOf(card) {
  const pref = app.settings.showTranslation;
  const alt = pref === 'en' ? 'fa' : 'en';
  return card.meanings[alt] ?? '';
}

/**
 * Mark the form the example exists to teach, so the eye lands on "j'ai été"
 * instead of hunting for the point. Text nodes, never innerHTML: content is
 * data and data is never markup.
 */
function sentence(ex) {
  const at = ex.form ? ex.fr.toLowerCase().indexOf(ex.form.toLowerCase()) : -1;
  if (at < 0) return [document.createTextNode(ex.fr)];
  return [
    document.createTextNode(ex.fr.slice(0, at)),
    el('mark', { class: 'form', text: ex.fr.slice(at, at + ex.form.length) }),
    document.createTextNode(ex.fr.slice(at + ex.form.length)),
  ];
}

function reveal() {
  if (getSelection()?.toString()) return;   // a drag-select ends in a click
  app.revealed = true;
  render();
}

function renderCard() {
  const t = app.t, card = app.current, pref = app.settings.showTranslation;

  const face = el('div', {
    class: `card${app.revealed ? ' is-open' : ''}`,
    'data-testid': 'flashcard',
    role: app.revealed ? null : 'button',
    tabindex: app.revealed ? null : '0',
    onclick: app.revealed ? null : reveal,
    onkeydown: app.revealed ? null : (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); reveal(); }
    },
  },
    el('div', { class: 'tags' },
      el('span', { class: 'tag tag-level', text: card.level }),
      el('span', { class: 'tag', text: t(card.type) }),
      card.gender ? el('span', { class: 'tag', text: t(card.gender === 'f' ? 'feminine' : 'masculine') }) : null,
      // The preposition is on the front because it is part of what must be recalled.
      card.prep ? el('span', { class: 'tag tag-prep', lang: 'fr', dir: 'ltr', text: card.prep }) : null,
    ),
    el('p', { class: 'word', lang: 'fr', dir: 'ltr' },
      card.article ? el('span', { class: 'art', text: card.article }) : null,
      document.createTextNode(card.fr)),
  );

  if (app.revealed) {
    face.append(el('div', { class: 'answer' },
      el('div', { class: 'meaning', lang: pref, dir: dirOf(pref), text: meaningOf(card) }),
      altMeaningOf(card)
        ? el('div', { class: 'meaning-alt', lang: pref === 'en' ? 'fa' : 'en',
            dir: pref === 'en' ? 'rtl' : 'ltr', text: altMeaningOf(card) })
        : null,
      ...card.examples.map((ex) => el('div', { class: 'ex' },
        el('span', { class: 'ex-label' },
          document.createTextNode(t(ex.tense)),
          ex.form ? el('b', { lang: 'fr', dir: 'ltr', text: ` · ${ex.form}` }) : null),
        el('div', { class: 'ex-fr', lang: 'fr', dir: 'ltr' }, ...sentence(ex)),
        el('div', { class: 'ex-tr', lang: pref, dir: dirOf(pref),
          text: ex.translations[pref] ?? ex.translations.en ?? '' }),
      )),
    ));
  }
  return face;
}

function renderActions() {
  const host = $('actions'), t = app.t;
  if (app.tab !== 'study' || !app.current) { host.hidden = true; return; }
  host.hidden = false;

  if (!app.revealed) {
    host.replaceChildren(el('div', { class: 'actions-in' },
      el('button', { class: 'reveal', type: 'button', 'data-testid': 'reveal',
        text: t('showAnswer'), onclick: reveal })));
    return;
  }
  const preview = previewIntervals(stateOf(app.current.key), Date.now());
  const when = (d) => (d === 0 ? t('now') : `${d}${t('days')}`);
  host.replaceChildren(el('div', { class: 'actions-in' },
    ...[['again', RATING.AGAIN, preview.AGAIN], ['hard', RATING.HARD, preview.HARD],
        ['good', RATING.GOOD, preview.GOOD], ['easy', RATING.EASY, preview.EASY]]
      .map(([name, value, days]) => el('button', {
        class: `rate rate-${value}`, type: 'button', 'data-testid': `rate-${value}`,
        onclick: () => rate(value) },
        el('span', { class: 'rate-name', text: t(name) }),
        el('span', { class: 'rate-when', text: when(days) }),
      ))));
}

function renderStage() {
  const t = app.t, host = $('session');

  const filter = $('exam-filter');
  filter.hidden = !app.examFilter;
  if (app.examFilter) {
    filter.replaceChildren(
      el('span', { text: t('examFilterOn', { code: app.examFilter.code }) }),
      el('button', { class: 'btn btn-ghost btn-sm', type: 'button',
        'data-testid': 'exam-filter-clear', text: t('examFilterClear'),
        onclick: () => { app.examFilter = null; startSession(true); } }));
  }

  if (app.current) { host.replaceChildren(renderCard()); return; }

  const c = counts(Date.now());
  if (app.reviewed > 0) {
    host.replaceChildren(el('div', { class: 'empty' },
      el('div', { class: 'empty-mark' }, icon('M20 6 9 17l-5-5')),
      el('h2', { text: t('sessionDone') }),
      el('p', { text: `${t('sessionDoneBody')} ${t('reviewedCount', { n: app.reviewed })}` }),
      c.fresh > 0 ? el('button', { class: 'btn btn-solid', type: 'button',
        text: t('studyAhead'), onclick: () => startSession(true) }) : null));
    return;
  }
  if (c.due === 0 && c.fresh === 0) {
    host.replaceChildren(el('div', { class: 'empty' },
      el('div', { class: 'empty-mark' }, icon('M20 6 9 17l-5-5')),
      el('h2', { text: t('nothingDue') }),
      el('p', { text: t('nothingDueBody') })));
    return;
  }
  host.replaceChildren(el('div', { class: 'empty' },
    el('div', { class: 'empty-mark' }, icon(...ICONS.study)),
    el('h2', { text: c.due > 0 ? `${t('dueToday')}: ${c.due}` : `${t('newCards')}: ${c.fresh}` }),
    el('p', { text: c.due > 0 ? '' : t('nothingDueBody') }),
    el('button', { class: 'btn btn-solid', type: 'button', 'data-testid': 'start',
      text: t('startSession'), onclick: () => startSession(true) })));
}

function renderRail() {
  const done = app.sessionSize > 0 ? Math.min(app.reviewed, app.sessionSize) : 0;
  const pct = app.sessionSize > 0 ? Math.round((done / app.sessionSize) * 100) : 0;
  $('rail-fill').style.width = `${app.tab === 'study' ? pct : 0}%`;
  $('rail').setAttribute('aria-valuenow', String(pct));
  $('rail').setAttribute('aria-label', app.t('study'));
}

/* ── exams ─────────────────────────────────────────────── */

const SKILL_ORDER = ['general', 'listening', 'reading', 'writing', 'speaking'];
const SKILL_KEY = { general: 'skillGeneral', listening: 'skillListening',
  reading: 'skillReading', writing: 'skillWriting', speaking: 'skillSpeaking' };
const KIND_KEY = { 'exam-body': 'kindExamBody', broadcaster: 'kindBroadcaster',
  institutional: 'kindInstitutional', open: 'kindOpen' };
const cardsAtLevels = (levels) => app.cards.filter((c) => levels.includes(c.level)).length;

function renderExams() {
  const t = app.t, host = $('exams-body');
  if (!app.exams) { host.replaceChildren(el('p', { class: 'lede', text: t('loadFailed') })); return; }
  const notice = el('p', { class: 'note exam-disclaimer', text: app.exams.disclaimer });

  if (!app.openExam) {
    host.replaceChildren(
      el('h2', { class: 'h2', text: t('exams') }),
      el('p', { class: 'lede', text: t('examsIntro') }),
      el('div', { class: 'exam-grid' }, ...app.exams.exams.map((x) =>
        el('button', { class: 'exam-card', type: 'button', 'data-testid': `exam-${x.id}`,
          onclick: () => { app.openExam = x.id; render(); $('main').scrollTop = 0; } },
          el('span', { class: 'exam-code', text: x.code }),
          el('span', { class: 'exam-full', lang: 'fr', dir: 'ltr', text: x.fullName }),
          el('span', { class: 'exam-lv' }, ...x.levels.map((lv) =>
            el('span', { class: 'tag tag-level', text: lv }))),
          el('span', { class: 'exam-n',
            text: `${t('examCardsHere')}: ${cardsAtLevels(x.levels)} · ${x.resources.length} ${t('examResources').toLowerCase()}` }),
        ))),
      notice);
    return;
  }

  const x = app.exams.exams.find((e) => e.id === app.openExam);
  if (!x) { app.openExam = null; renderExams(); return; }
  const n = cardsAtLevels(x.levels);
  const bySkill = new Map();
  for (const res of x.resources) {
    if (!bySkill.has(res.skill)) bySkill.set(res.skill, []);
    bySkill.get(res.skill).push(res);
  }

  host.replaceChildren(
    el('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: `← ${t('examBack')}`,
      onclick: () => { app.openExam = null; render(); } }),
    el('h2', { class: 'h2', style: 'margin-top:10px', text: x.code }),
    el('p', { class: 'lede', lang: 'fr', dir: 'ltr', text: x.fullName }),
    el('dl', { class: 'facts' },
      el('dt', { text: t('examLevels') }),
      el('dd', {}, ...x.levels.map((lv) => el('span', { class: 'tag tag-level', text: lv }))),
      el('dt', { text: t('examOwner') }),
      el('dd', { lang: 'fr', dir: 'ltr', text: x.owner })),
    n > 0
      ? el('button', { class: 'btn btn-solid', type: 'button', 'data-testid': 'exam-study',
          text: `${t('examStudyCards')} (${n})`,
          onclick: () => {
            app.examFilter = { code: x.code, levels: x.levels };
            app.tab = 'study'; app.openExam = null;
            startSession(true); $('main').scrollTop = 0;
          } })
      : el('p', { class: 'exam-empty', text: t('examNoCards') }),
    el('h3', { class: 'h3', text: t('examResources') }),
    ...SKILL_ORDER.filter((sk) => bySkill.has(sk)).map((sk) => el('section', {},
      el('h4', { class: 'skill-h', text: t(SKILL_KEY[sk]) }),
      el('ul', { class: 'links' }, ...bySkill.get(sk).map((res) => el('li', {},
        // noopener: a page opened with target=_blank can otherwise reach back
        // through window.opener.
        el('a', { href: res.url, target: '_blank', rel: 'noopener noreferrer nofollow',
          lang: res.lang ?? 'fr', dir: 'ltr', text: res.title, title: t('externalLink') }),
        el('span', { class: 'link-kind', text: t(KIND_KEY[res.kind] ?? 'kindOpen') }),
        res.levels ? el('span', { class: 'link-lv', text: res.levels.join(' ') }) : null,
      ))))),
    el('p', { class: 'note links-note', text: t('linksUnchecked') }),
    notice);
}

/* ── browse, progress, about ───────────────────────────── */

function renderBrowse() {
  const t = app.t, now = Date.now(), pref = app.settings.showTranslation;
  const search = $('browse-search');
  search.placeholder = `${t('browse')}…`;
  const q = search.value.trim().toLowerCase();
  const rows = app.cards.filter(inFilter).filter((c) => !q
    || c.fr.toLowerCase().includes(q)
    || Object.values(c.meanings).some((m) => m.toLowerCase().includes(q)));
  $('browse-list').replaceChildren(...rows.map((c) => el('li', { class: 'row' },
    el('span', { class: 'row-fr', lang: 'fr', dir: 'ltr',
      text: (c.article ? `${c.article} ` : '') + c.fr + (c.prep ? ` (${c.prep})` : '') }),
    el('span', { class: 'row-mean', lang: pref, dir: dirOf(pref), text: meaningOf(c) }),
    el('span', { class: 'row-state',
      text: isNew(c.key) ? t('newCards') : isDue(c.key, now) ? t('dueToday')
        : `${Math.round((app.progress[c.key].dueAt - now) / 86400000)}${t('days')}` }),
  )));
}

function renderProgress() {
  const t = app.t, c = counts(Date.now());
  const pct = c.total ? Math.round((c.learned / c.total) * 100) : 0;
  const stat = (n, label) => el('div', { class: 'stat' },
    el('span', { class: 'stat-n', text: n }), el('span', { class: 'stat-l', text: label }));
  $('progress-body').replaceChildren(
    el('h2', { class: 'h2', text: t('progress') }),
    el('p', { class: 'lede', text: `${t('learned')}: ${c.learned} / ${c.total} (${pct}%)` }),
    el('div', { class: 'stats' },
      stat(c.due, t('dueToday')), stat(c.fresh, t('newCards')),
      stat(c.learned, t('learned')), stat(c.total, t('totalCards'))),
    el('div', { class: 'bar-track' }, el('span', { style: `width:${pct}%` })),
    el('div', { class: 'sheet-actions' },
      el('button', { class: 'btn btn-sm', type: 'button', text: t('exportProgress'), onclick: downloadProgress }),
      el('button', { class: 'btn btn-sm', type: 'button', text: t('importProgress'), onclick: uploadProgress }),
      el('button', { class: 'btn btn-sm danger', type: 'button', text: t('resetProgress'),
        onclick: () => {
          if (!confirm(t('resetConfirm'))) return;
          app.progress = {}; saveProgress(app.progress); startSession(true);
        } })),
  );
}

function renderAbout() {
  const t = app.t;
  $('about-body').replaceChildren(
    el('h2', { text: t('aboutTitle') }),
    el('p', { text: t('aboutIntro') }),
    el('h3', { text: t('aboutDataH') }), el('p', { text: t('aboutDataP') }),
    el('h3', { text: t('aboutIndepH') }),
    el('p', {}, el('strong', { text: t('aboutIndepP1') })),
    el('p', {}, el('strong', { text: t('aboutIndepP2') })),
    el('h3', { text: t('aboutContentH') }), el('p', { text: t('aboutContentP') }),
    el('h3', { text: t('aboutLevelsH') }), el('p', { text: t('aboutLevelsP') }),
    el('p', {}, el('a', { href: 'https://github.com/shahinamani/french-learning-for-world',
      target: '_blank', rel: 'noopener noreferrer', text: t('aboutRepo') })),
  );
}

function downloadProgress() {
  const url = URL.createObjectURL(new Blob([exportProgress()], { type: 'application/json' }));
  const a = el('a', { href: url, download: 'french-progress.json' });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function uploadProgress() {
  const input = el('input', { type: 'file', accept: 'application/json,.json' });
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const n = importProgress(await file.text());
      app.progress = loadProgress();
      showBanner(app.t('imported', { n }));
      startSession(true);
    } catch (err) { showBanner(String(err.message ?? err)); }
  };
  input.click();
}

function showBanner(message) {
  const b = $('banner');
  b.textContent = message;
  b.hidden = false;
}

/* ── chrome ────────────────────────────────────────────── */

function renderTabs() {
  const t = app.t;
  $('tabs').replaceChildren(...TABS.map((name) => el('button', {
    class: 'tab', type: 'button', role: 'tab',
    'aria-selected': String(app.tab === name),
    onclick: () => {
      app.tab = name;
      location.hash = name;
      if (name !== 'exams') app.openExam = null;
      render();
      $('main').scrollTop = 0;
    },
  }, icon(...ICONS[name]), el('span', { text: t(name) }))));
  for (const name of TABS) $(`panel-${name}`).hidden = app.tab !== name;
}

function toggleSettings(open) {
  app.settingsOpen = open;
  $('settings-sheet').hidden = !open;
  $('scrim').hidden = !open;
  $('settings-btn').setAttribute('aria-expanded', String(open));
}

function applyLanguage() {
  app.t = translator(app.lang);
  const dir = dirOf(app.lang);
  document.documentElement.lang = app.lang;
  document.documentElement.dir = dir;
  // Both: assistive technology reads the attribute, CSS logical properties
  // read the direction, and neither can see a class name.
  document.body.dir = dir;
  for (const node of document.querySelectorAll('[data-t]')) {
    node.textContent = app.t(node.dataset.t);
  }
  document.title = app.t('appName');
}

function render() {
  applyLanguage();
  renderTabs();
  renderRail();
  renderTimer();
  renderStage();
  renderActions();
  renderExams();
  renderBrowse();
  renderProgress();
  renderAbout();
  if (!app.storageWorks) showBanner(app.t('storageUnavailable'));
}

/* ── start ─────────────────────────────────────────────── */

function buildSelects() {
  const ui = $('ui-lang'), meaning = $('meaning-lang');
  ui.replaceChildren(...Object.entries(LOCALES).map(([code, meta]) =>
    el('option', { value: code, text: meta.name, selected: code === app.lang })));
  ui.onchange = () => {
    app.lang = ui.value;
    app.settings.lang = ui.value;
    saveSettings(app.settings);
    render();
  };
  // Which language the meanings appear in is a separate question from the
  // interface language: a Persian meaning under an English interface is a
  // normal thing to want.
  meaning.replaceChildren(...MEANING_LOCALES.map((code) =>
    el('option', { value: code, text: LOCALES[code].name,
      selected: code === app.settings.showTranslation })));
  meaning.onchange = () => {
    app.settings.showTranslation = meaning.value;
    saveSettings(app.settings);
    render();
  };
}

async function boot() {
  app.lang = app.settings.lang ?? detectLocale(navigator.languages ?? [navigator.language]);
  if (!(app.lang in dictionaries)) app.lang = 'en';
  app.t = translator(app.lang);

  const hash = location.hash.replace('#', '');
  if (TABS.includes(hash)) app.tab = hash;

  const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
  app.timer.sound = T.readSoundPreference(reduced);

  // Restored after mount, never in an initialiser, so nothing is announced
  // before the strings it would be announced in exist.
  const restored = T.restore(Date.now());
  if (restored.state === 'running') {
    Object.assign(app.timer, { running: true, endsAt: restored.endsAt,
      durationMin: restored.durationMin, selectedMin: restored.durationMin });
  } else if (restored.state === 'finishedWhileAway') {
    app.timer.finished = 'away';
    app.timer.selectedMin = restored.durationMin;
  }

  buildSelects();
  $('browse-search').addEventListener('input', renderBrowse);
  $('timer-pill').onclick = () => { app.timerOpen = !app.timerOpen; renderTimer(); };
  $('settings-btn').onclick = () => toggleSettings(!app.settingsOpen);
  $('settings-close').onclick = () => toggleSettings(false);
  $('scrim').onclick = () => toggleSettings(false);

  try {
    app.cards = await loadContent();
    app.exams = await fetch('content/exams.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
  } catch (err) {
    showBanner(app.t('loadFailed'));
    console.error(err);
    render();
    return;
  }

  startSession(true);
  setInterval(pollTimer, 250);

  window.addEventListener('keydown', (e) => {
    if (app.settingsOpen && e.key === 'Escape') { toggleSettings(false); return; }
    if (app.tab !== 'study' || !app.current) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
    if (!app.revealed && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); reveal(); return; }
    if (app.revealed && ['1', '2', '3', '4'].includes(e.key)) { e.preventDefault(); rate(Number(e.key)); }
  });
}

// Offline support is an enhancement: if it fails to register the portal works
// exactly as before, without the cache.
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* http://, private mode */ });
  });
}

if (typeof document !== 'undefined') boot();
