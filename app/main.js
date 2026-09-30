// Wiring. The pure logic lives in fsrs.js, timer.js, storage.js and i18n.js;
// this file only connects it to the DOM, so the parts worth testing can be
// tested without a browser.

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
  cards: [],
  exams: null,
  openExam: null,      // the exam whose detail page is showing
  examFilter: null,    // { code, levels } — restricts the study session
  progress: loadProgress(),
  settings: loadSettings(),
  t: translator('en'),
  lang: 'en',
  tab: 'study',
  queue: [],
  current: null,
  revealed: false,
  reviewed: 0,
  storageWorks: true,
  timer: { endsAt: 0, durationMin: 10, running: false, selectedMin: 10, sound: true, finished: null },
  tick: 0,
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
  return decks.flatMap((deck) =>
    deck.cards.map((card) => ({
      ...card,
      deckId: deck.id,
      // Trust the file, but verify: a key that does not match the word it is
      // filed under would silently split one card's history in two.
      key: card.key ?? cardKey(card.type, card.fr),
      licence: card.licence ?? deck.licence,
    })));
}

/* ── scheduling ────────────────────────────────────────── */

const stateOf = (key) => app.progress[key] ?? newCardState();
const isNew = (key) => !app.progress[key] || app.progress[key].reps === 0;
const isDue = (key, now) => (app.progress[key]?.dueAt ?? 0) <= now;

/** Due cards first, oldest due first; then new cards, in deck order. */
function inFilter(card) {
  return !app.examFilter || app.examFilter.levels.includes(card.level);
}

function buildQueue(now, includeNew = true) {
  const due = [], fresh = [];
  for (const card of app.cards) {
    if (!inFilter(card)) continue;
    if (isNew(card.key)) { if (includeNew) fresh.push(card); }
    else if (isDue(card.key, now)) due.push(card);
  }
  due.sort((a, b) => (app.progress[a.key].dueAt) - (app.progress[b.key].dueAt));
  return [...due, ...fresh];
}

function counts(now) {
  let due = 0, fresh = 0, learned = 0;
  for (const card of app.cards) {
    if (!inFilter(card)) continue;
    if (isNew(card.key)) fresh += 1;
    else {
      if (isDue(card.key, now)) due += 1;
      if (app.progress[card.key].stability >= 21) learned += 1;
    }
  }
  return { due, fresh, learned, total: app.cards.length };
}

function rate(rating) {
  if (!app.current) return;
  const now = Date.now();
  const { state } = review(stateOf(app.current.key), rating, now);
  app.progress[app.current.key] = state;
  app.reviewed += 1;
  if (!saveProgress(app.progress)) app.storageWorks = false;
  // A lapse goes to the back of this session rather than out of it.
  app.queue = app.queue.slice(1);
  if (rating === RATING.AGAIN) app.queue.push(app.current);
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
  else renderTimerClock();
}

/* ── rendering ─────────────────────────────────────────── */

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

/* ── exams ─────────────────────────────────────────────── */

const SKILL_ORDER = ['general', 'listening', 'reading', 'writing', 'speaking'];
const SKILL_KEY = { general: 'skillGeneral', listening: 'skillListening',
  reading: 'skillReading', writing: 'skillWriting', speaking: 'skillSpeaking' };
const KIND_KEY = { 'exam-body': 'kindExamBody', broadcaster: 'kindBroadcaster',
  institutional: 'kindInstitutional', open: 'kindOpen' };

const cardsAtLevels = (levels) => app.cards.filter((c) => levels.includes(c.level)).length;

function renderExams() {
  const t = app.t;
  const host = $('exams-body');
  if (!app.exams) { host.replaceChildren(el('p', { text: t('loadFailed') })); return; }

  const notice = el('p', { class: 'exam-disclaimer', text: app.exams.disclaimer });

  if (!app.openExam) {
    host.replaceChildren(
      el('h2', { class: 'section-h', text: t('exams') }),
      el('p', { class: 'section-intro', text: t('examsIntro') }),
      el('div', { class: 'exam-grid' }, ...app.exams.exams.map((x) => {
        const n = cardsAtLevels(x.levels);
        return el('button', { class: 'exam-card', type: 'button',
          'data-testid': `exam-${x.id}`,
          onclick: () => { app.openExam = x.id; render(); window.scrollTo(0, 0); } },
          el('span', { class: 'exam-code', text: x.code }),
          el('span', { class: 'exam-full', lang: 'fr', dir: 'ltr', text: x.fullName }),
          el('span', { class: 'exam-levels' },
            ...x.levels.map((lv) => el('span', { class: 'chip chip-level', text: lv }))),
          el('span', { class: 'exam-count',
            text: `${t('examCardsHere')}: ${n} · ${x.resources.length} ${t('examResources').toLowerCase()}` }),
        );
      })),
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
    el('button', { class: 'btn btn-quiet btn-small', type: 'button',
      text: `← ${t('examBack')}`, onclick: () => { app.openExam = null; render(); } }),
    el('h2', { class: 'section-h', text: x.code }),
    el('p', { class: 'exam-full-line', lang: 'fr', dir: 'ltr', text: x.fullName }),

    el('dl', { class: 'exam-facts' },
      el('dt', { text: t('examLevels') }),
      el('dd', {}, ...x.levels.map((lv) => el('span', { class: 'chip chip-level', text: lv }))),
      el('dt', { text: t('examOwner') }),
      el('dd', { lang: 'fr', dir: 'ltr', text: x.owner }),
    ),

    el('div', { class: 'exam-study' },
      n > 0
        ? el('button', { class: 'btn btn-primary', type: 'button',
            'data-testid': 'exam-study',
            text: `${t('examStudyCards')} (${n})`,
            onclick: () => {
              app.examFilter = { code: x.code, levels: x.levels };
              app.tab = 'study'; app.openExam = null;
              startSession(true); window.scrollTo(0, 0);
            } })
        : el('p', { class: 'exam-empty', text: t('examNoCards') })),

    el('h3', { class: 'section-h3', text: t('examResources') }),
    ...SKILL_ORDER.filter((sk) => bySkill.has(sk)).map((sk) => el('section', { class: 'skill-block' },
      el('h4', { class: 'skill-h', text: t(SKILL_KEY[sk]) }),
      el('ul', { class: 'link-list' }, ...bySkill.get(sk).map((res) => el('li', {},
        // rel="noopener noreferrer": an external page opened with target=_blank
        // can otherwise reach back through window.opener.
        el('a', { href: res.url, target: '_blank', rel: 'noopener noreferrer nofollow',
          lang: res.lang ?? 'fr', dir: 'ltr', text: res.title,
          title: t('externalLink') }),
        el('span', { class: 'link-kind', text: t(KIND_KEY[res.kind] ?? 'kindOpen') }),
        res.levels ? el('span', { class: 'link-levels', text: res.levels.join(' ') }) : null,
      ))),
    )),
    el('p', { class: 'links-note', text: t('linksUnchecked') }),
    notice);
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
    el('p', { class: 'repo' }, el('a', {
      href: 'https://github.com/shahinamani/french-learning-for-world',
      target: '_blank', rel: 'noopener noreferrer', text: t('aboutRepo') })),
  );
}

function renderStats() {
  const c = counts(Date.now());
  const t = app.t;
  $('stats').replaceChildren(
    el('div', { class: 'stat is-due' }, el('span', { class: 'stat-n', text: c.due }), el('span', { class: 'stat-l', text: t('dueToday') })),
    el('div', { class: 'stat' }, el('span', { class: 'stat-n', text: c.fresh }), el('span', { class: 'stat-l', text: t('newCards') })),
    el('div', { class: 'stat' }, el('span', { class: 'stat-n', text: c.learned }), el('span', { class: 'stat-l', text: t('learned') })),
    el('div', { class: 'stat' }, el('span', { class: 'stat-n', text: c.total }), el('span', { class: 'stat-l', text: t('totalCards') })),
  );
}

function renderTimerClock() {
  const secs = app.timer.running
    ? T.remainingSeconds(app.timer.endsAt, Date.now())
    : app.timer.selectedMin * 60;
  $('timer-clock').textContent = T.formatClock(secs);
}

function renderTimer() {
  const t = app.t;
  $('timer').classList.toggle('is-running', app.timer.running);
  renderTimerClock();

  $('timer-presets').replaceChildren(...T.PRESETS_MIN.map((m) =>
    el('button', {
      class: 'preset', type: 'button',
      'aria-pressed': String(app.timer.selectedMin === m),
      'data-testid': `timer-preset-${m}`,
      text: T.presetLabel(m),
      disabled: app.timer.running,
      onclick: () => { app.timer.selectedMin = m; renderTimer(); },
    })));

  const startBtn = $('timer-start');
  startBtn.textContent = app.timer.running ? t('pause') : t('start');
  startBtn.onclick = () => (app.timer.running ? stopTimer() : startTimer());
  $('timer-reset').textContent = t('reset');
  $('timer-reset').onclick = stopTimer;

  const sound = $('timer-sound');
  sound.textContent = app.timer.sound ? '🔔' : '🔕';
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

function meaningIn(card) {
  const pref = app.settings.showTranslation;
  return card.meanings[pref] ?? card.meanings.en ?? '';
}
function altMeaning(card) {
  const pref = app.settings.showTranslation;
  return pref === 'en' ? (card.meanings.fa ?? '') : (card.meanings.en ?? '');
}
const dirOf = (locale) => LOCALES[locale]?.dir ?? 'ltr';

/**
 * Show the sentence with the form being taught marked, so the learner's eye
 * lands on "j'ai ete" rather than hunting for which word is the point. Built
 * from text nodes, never innerHTML: content is data, and data is never markup.
 */
function highlightForm(example) {
  const sentence = example.fr;
  const form = example.form;
  if (!form) return [document.createTextNode(sentence)];
  const at = sentence.toLowerCase().indexOf(form.toLowerCase());
  if (at < 0) return [document.createTextNode(sentence)];
  return [
    document.createTextNode(sentence.slice(0, at)),
    el('mark', { class: 'form', text: sentence.slice(at, at + form.length) }),
    document.createTextNode(sentence.slice(at + form.length)),
  ];
}

function renderCard() {
  const t = app.t;
  const card = app.current;
  const pref = app.settings.showTranslation;

  const front = el('div', { class: 'card', role: 'button', tabindex: '0',
    'data-testid': 'flashcard',
    onclick: () => { if (!getSelection()?.toString()) { app.revealed = true; render(); } },
    onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); app.revealed = true; render(); } } },
    el('div', { class: 'card-meta' },
      el('span', { class: 'chip chip-level', text: card.level }),
      el('span', { class: 'chip', text: t(card.type) }),
      card.gender ? el('span', { class: 'chip', text: t(card.gender === 'f' ? 'feminine' : 'masculine') }) : null,
      // The preposition belongs on the front: it is part of what must be recalled.
      card.prep ? el('span', { class: 'chip chip-prep', lang: 'fr', text: card.prep }) : null,
    ),
    el('div', { class: 'headword', lang: 'fr', dir: 'ltr' },
      card.article ? el('span', { class: 'article', text: card.article }) : null,
      document.createTextNode(card.fr)),
    app.revealed ? null : el('div', { class: 'card-hint', text: t('showAnswer') }),
  );

  if (app.revealed) {
    const answer = el('div', { class: 'answer' },
      el('div', { class: 'meaning', lang: pref, dir: dirOf(pref), text: meaningIn(card) }),
      altMeaning(card) ? el('div', { class: 'meaning-alt', lang: pref === 'en' ? 'fa' : 'en',
        dir: pref === 'en' ? 'rtl' : 'ltr', text: altMeaning(card) }) : null,
      ...card.examples.map((ex) => el('div', { class: 'example' },
        el('span', { class: 'example-tense', text: `${t(ex.tense)} · ${ex.form ?? ''}` }),
        el('div', { class: 'example-fr', lang: 'fr', dir: 'ltr' }, ...highlightForm(ex)),
        el('div', { class: 'example-tr', lang: pref, dir: dirOf(pref),
          text: ex.translations[pref] ?? ex.translations.en ?? '' }),
      )),
    );
    front.append(answer);
  }

  const parts = [front];
  if (app.revealed) {
    const preview = previewIntervals(stateOf(card.key), Date.now());
    const label = (days) => days === 0 ? t('now') : `${days}${t('days')}`;
    parts.push(el('div', { class: 'ratings' },
      ...[['again', RATING.AGAIN, preview.AGAIN], ['hard', RATING.HARD, preview.HARD],
          ['good', RATING.GOOD, preview.GOOD], ['easy', RATING.EASY, preview.EASY]]
        .map(([name, value, days]) => el('button', {
          class: `rate rate-${value}`, type: 'button',
          'data-testid': `rate-${value}`, onclick: () => rate(value) },
          el('span', { class: 'rate-name', text: t(name) }),
          el('span', { class: 'rate-when', text: label(days) }),
        ))));
  }
  return parts;
}

function renderSession() {
  const t = app.t;
  const host = $('session');
  const filterBar = $('exam-filter');
  filterBar.hidden = !app.examFilter;
  if (app.examFilter) {
    filterBar.replaceChildren(
      el('span', { text: t('examFilterOn', { code: app.examFilter.code }) }),
      el('button', { class: 'btn btn-quiet btn-small', type: 'button',
        'data-testid': 'exam-filter-clear', text: t('examFilterClear'),
        onclick: () => { app.examFilter = null; startSession(true); } }));
  }
  if (app.current) { host.replaceChildren(...renderCard()); return; }

  const c = counts(Date.now());
  if (app.reviewed > 0) {
    host.replaceChildren(el('div', { class: 'empty' },
      el('h2', { text: t('sessionDone') }),
      el('p', { text: t('sessionDoneBody') }),
      el('p', { text: t('reviewedCount', { n: app.reviewed }) }),
      c.fresh > 0 ? el('button', { class: 'btn btn-primary', type: 'button',
        text: t('studyAhead'), onclick: () => startSession(true) }) : null));
    return;
  }
  if (c.due === 0 && c.fresh === 0) {
    host.replaceChildren(el('div', { class: 'empty' },
      el('h2', { text: t('nothingDue') }), el('p', { text: t('nothingDueBody') })));
    return;
  }
  host.replaceChildren(el('div', { class: 'empty' },
    el('h2', { text: c.due > 0 ? t('dueToday') + `: ${c.due}` : t('nothingDue') }),
    el('p', { text: c.due > 0 ? '' : t('nothingDueBody') }),
    el('button', { class: 'btn btn-primary', type: 'button',
      text: c.due > 0 ? t('startSession') : t('studyAhead'),
      onclick: () => startSession(true) })));
}

function startSession(includeNew) {
  app.queue = buildQueue(Date.now(), includeNew);
  app.current = app.queue[0] ?? null;
  app.revealed = false;
  app.reviewed = 0;
  render();
}

function renderBrowse() {
  const t = app.t, now = Date.now();
  const q = $('browse-search').value.trim().toLowerCase();
  $('browse-search').placeholder = `${t('browse')}…`;
  const rows = app.cards.filter((c) => inFilter(c)).filter((c) => !q
    || c.fr.toLowerCase().includes(q)
    || Object.values(c.meanings).some((m) => m.toLowerCase().includes(q)));
  $('browse-list').replaceChildren(...rows.map((c) => el('li', { class: 'browse-item' },
    el('span', { class: 'browse-fr', lang: 'fr', dir: 'ltr',
      text: (c.article ? c.article + ' ' : '') + c.fr + (c.prep ? ` (${c.prep})` : '') }),
    el('span', { class: 'browse-meaning', lang: app.settings.showTranslation,
      dir: dirOf(app.settings.showTranslation), text: meaningIn(c) }),
    el('span', { class: 'browse-state',
      text: isNew(c.key) ? t('newCards') : isDue(c.key, now) ? t('dueToday')
        : `${Math.round((app.progress[c.key].dueAt - now) / 86400000)}${t('days')}` }),
  )));
}

function renderProgress() {
  const t = app.t;
  const c = counts(Date.now());
  const pct = c.total ? Math.round((c.learned / c.total) * 100) : 0;
  $('progress-body').replaceChildren(
    el('div', { class: 'prose' },
      el('h2', { text: t('progress') }),
      el('p', { text: `${t('learned')}: ${c.learned} / ${c.total} (${pct}%)` }),
      el('div', { class: 'bar' }, el('span', { style: `width:${pct}%` })),
      el('p', { text: `${t('dueToday')}: ${c.due} · ${t('newCards')}: ${c.fresh}` }),
      el('h3', { text: t('exportProgress') }),
      el('p', { style: 'display:flex;gap:8px;flex-wrap:wrap' },
        el('button', { class: 'btn btn-small', type: 'button', text: t('exportProgress'),
          onclick: downloadProgress }),
        el('button', { class: 'btn btn-small', type: 'button', text: t('importProgress'),
          onclick: uploadProgress }),
        el('button', { class: 'btn btn-small danger', type: 'button', text: t('resetProgress'),
          onclick: () => {
            if (!confirm(t('resetConfirm'))) return;
            app.progress = {}; saveProgress(app.progress); startSession(true);
          } })),
    ));
}

function downloadProgress() {
  const blob = new Blob([exportProgress()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
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

function renderTabs() {
  const t = app.t;
  $('tabs').replaceChildren(...TABS.map((name) => el('button', {
    class: 'tab', type: 'button', role: 'tab',
    'aria-selected': String(app.tab === name),
    text: t(name), onclick: () => { app.tab = name; location.hash = name; render(); },
  })));
  for (const name of TABS) $(`panel-${name}`).hidden = app.tab !== name;
}

function applyLanguage() {
  app.t = translator(app.lang);
  const dir = dirOf(app.lang);
  document.documentElement.lang = app.lang;
  document.documentElement.dir = dir;
  // Both: the attribute is what assistive technology and CSS logical
  // properties read, and neither can see a class name.
  document.body.dir = dir;
  for (const node of document.querySelectorAll('[data-t]')) {
    node.textContent = app.t(node.dataset.t);
  }
  document.title = app.t('appName');
}

function render() {
  applyLanguage();
  renderTabs();
  renderStats();
  renderTimer();
  renderSession();
  renderExams();
  renderAbout();
  renderBrowse();
  renderProgress();
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
  // Which language the meanings are shown in is a separate question from the
  // interface language: plenty of learners want a Persian meaning under an
  // English interface, or the reverse.
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

  // Restore after mount, never in an initialiser, so nothing is announced
  // before the strings it would be announced in are loaded.
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
  app.tick = setInterval(pollTimer, 250);

  window.addEventListener('keydown', (e) => {
    if (app.tab !== 'study' || !app.current) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
    if (!app.revealed && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); app.revealed = true; render(); return; }
    if (app.revealed && ['1', '2', '3', '4'].includes(e.key)) { e.preventDefault(); rate(Number(e.key)); }
  });
}

// Offline support is an enhancement: if it fails to register, the portal works
// exactly as before, just without the cache.
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* http://, private mode */ });
  });
}

if (typeof document !== 'undefined') boot();
