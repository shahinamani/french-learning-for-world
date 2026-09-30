// Interface strings.
//
// `en` is the structural source of truth: every other locale is checked
// against its key set at load, so a missing or surplus key is caught by the
// test suite rather than by a learner meeting a blank label.
//
// Page direction follows the interface language; content direction follows the
// content. A Persian meaning is marked rtl on its own element even when the
// interface is English, because the two are different questions.

export const LOCALES = Object.freeze({
  en: { name: 'English', dir: 'ltr' },
  fa: { name: 'فارسی', dir: 'rtl' },
  fr: { name: 'Français', dir: 'ltr' },
});

const en = {
  appName: 'French Learning for World',
  tagline: 'Free French practice for everyone. No account, works offline.',
  study: 'Study', browse: 'Browse', progress: 'Progress', about: 'About',
  dueToday: 'Due now', newCards: 'New', learned: 'Learned', totalCards: 'Cards',
  startSession: 'Start studying',
  nothingDue: 'Nothing is due right now.',
  nothingDueBody: 'Come back later, or study ahead with new cards.',
  studyAhead: 'Study new cards anyway',
  showAnswer: 'Show answer',
  again: 'Again', hard: 'Hard', good: 'Good', easy: 'Easy',
  minutes: 'min', days: 'd', now: 'now',
  past: 'Past', future: 'Future',
  timer: 'Study timer', start: 'Start', pause: 'Pause', reset: 'Reset',
  dismiss: 'Dismiss',
  timerDone: 'Time is up.',
  timerDoneSilent: 'Time is up. The browser would not play the chime.',
  timerFinishedAway: 'Your timer finished while you were away.',
  soundOn: 'Chime on', soundOff: 'Chime off',
  meaningLanguage: 'Meaning shown in',
  sessionDone: 'Session finished.',
  sessionDoneBody: 'Everything due has been reviewed.',
  reviewedCount: 'Reviewed: {n}',
  level: 'Level', allLevels: 'All levels',
  verb: 'verb', noun: 'noun', adjective: 'adjective',
  masculine: 'masculine', feminine: 'feminine',
  exportProgress: 'Export my progress', importProgress: 'Import progress',
  resetProgress: 'Erase all my progress',
  resetConfirm: 'Erase all progress on this device? This cannot be undone.',
  imported: 'Imported {n} cards.',
  storageUnavailable: 'This browser is not saving progress — it may be a private window.',
  offlineReady: 'Ready to use offline.',
  source: 'Source', licence: 'Licence',
  loading: 'Loading…',
  loadFailed: 'Could not load the content. Check your connection and reload.',
  footLegal: 'Independent study tool. Not affiliated with any examination body. No certificates are issued.',
};

const fa = {
  appName: 'یادگیری فرانسه برای جهان',
  tagline: 'تمرین رایگان زبان فرانسه برای همه. بدون حساب کاربری، بدون اینترنت هم کار می‌کند.',
  study: 'مطالعه', browse: 'مرور', progress: 'پیشرفت', about: 'درباره',
  dueToday: 'اکنون برای مرور', newCards: 'جدید', learned: 'آموخته', totalCards: 'کارت‌ها',
  startSession: 'شروع مطالعه',
  nothingDue: 'در حال حاضر کارتی برای مرور نیست.',
  nothingDueBody: 'بعداً برگردید، یا کارت‌های جدید را زودتر بخوانید.',
  studyAhead: 'به هر حال کارت‌های جدید را بخوان',
  showAnswer: 'نمایش پاسخ',
  again: 'دوباره', hard: 'سخت', good: 'خوب', easy: 'آسان',
  minutes: 'دقیقه', days: 'روز', now: 'اکنون',
  past: 'گذشته', future: 'آینده',
  timer: 'زمان‌سنج مطالعه', start: 'شروع', pause: 'توقف', reset: 'بازنشانی',
  dismiss: 'بستن',
  timerDone: 'زمان تمام شد.',
  timerDoneSilent: 'زمان تمام شد. مرورگر اجازه‌ی پخش صدا نداد.',
  timerFinishedAway: 'زمان‌سنج شما در نبودتان به پایان رسید.',
  soundOn: 'صدا روشن', soundOff: 'صدا خاموش',
  meaningLanguage: 'زبان معنی',
  sessionDone: 'جلسه تمام شد.',
  sessionDoneBody: 'همه‌ی کارت‌های امروز مرور شدند.',
  reviewedCount: 'مرور شده: {n}',
  level: 'سطح', allLevels: 'همه‌ی سطح‌ها',
  verb: 'فعل', noun: 'اسم', adjective: 'صفت',
  masculine: 'مذکر', feminine: 'مؤنث',
  exportProgress: 'خروجی گرفتن از پیشرفت من', importProgress: 'وارد کردن پیشرفت',
  resetProgress: 'پاک کردن تمام پیشرفت من',
  resetConfirm: 'تمام پیشرفت روی این دستگاه پاک شود؟ این کار برگشت‌پذیر نیست.',
  imported: '{n} کارت وارد شد.',
  storageUnavailable: 'این مرورگر پیشرفت را ذخیره نمی‌کند — شاید پنجره‌ی ناشناس باشد.',
  offlineReady: 'آماده برای استفاده بدون اینترنت.',
  source: 'منبع', licence: 'مجوز',
  loading: 'در حال بارگذاری…',
  loadFailed: 'محتوا بارگذاری نشد. اتصال خود را بررسی و صفحه را دوباره باز کنید.',
  footLegal: 'ابزار مطالعه‌ی مستقل. وابسته به هیچ نهاد آزمون‌گیرنده‌ای نیست. هیچ مدرکی صادر نمی‌کند.',
};

const fr = {
  appName: 'Apprendre le français pour le monde',
  tagline: 'Pratique gratuite du français pour tous. Sans compte, fonctionne hors ligne.',
  study: 'Étudier', browse: 'Parcourir', progress: 'Progrès', about: 'À propos',
  dueToday: 'À réviser', newCards: 'Nouvelles', learned: 'Apprises', totalCards: 'Cartes',
  startSession: 'Commencer',
  nothingDue: "Rien à réviser pour l'instant.",
  nothingDueBody: 'Revenez plus tard, ou prenez de nouvelles cartes en avance.',
  studyAhead: 'Étudier de nouvelles cartes',
  showAnswer: 'Voir la réponse',
  again: 'À revoir', hard: 'Difficile', good: 'Bien', easy: 'Facile',
  minutes: 'min', days: 'j', now: 'maintenant',
  past: 'Passé', future: 'Futur',
  timer: "Minuteur d'étude", start: 'Démarrer', pause: 'Pause', reset: 'Réinitialiser',
  dismiss: 'Fermer',
  timerDone: 'Le temps est écoulé.',
  timerDoneSilent: "Le temps est écoulé. Le navigateur n'a pas joué le carillon.",
  timerFinishedAway: 'Votre minuteur a fini pendant votre absence.',
  soundOn: 'Carillon activé', soundOff: 'Carillon désactivé',
  meaningLanguage: 'Langue des significations',
  sessionDone: 'Séance terminée.',
  sessionDoneBody: 'Toutes les cartes dues ont été révisées.',
  reviewedCount: 'Révisées : {n}',
  level: 'Niveau', allLevels: 'Tous les niveaux',
  verb: 'verbe', noun: 'nom', adjective: 'adjectif',
  masculine: 'masculin', feminine: 'féminin',
  exportProgress: 'Exporter mes progrès', importProgress: 'Importer des progrès',
  resetProgress: 'Effacer tous mes progrès',
  resetConfirm: 'Effacer tous les progrès sur cet appareil ? Action irréversible.',
  imported: '{n} cartes importées.',
  storageUnavailable: "Ce navigateur n'enregistre pas les progrès — fenêtre privée ?",
  offlineReady: 'Prêt pour une utilisation hors ligne.',
  source: 'Source', licence: 'Licence',
  loading: 'Chargement…',
  loadFailed: 'Contenu non chargé. Vérifiez votre connexion et rechargez.',
  footLegal: "Outil d'étude indépendant. Non affilié à un organisme d'examen. Aucun certificat n'est délivré.",
};

export const dictionaries = Object.freeze({ en, fa, fr });

/** Pick a starting language from the browser, falling back to English. */
export function detectLocale(navigatorLanguages = []) {
  for (const tag of navigatorLanguages) {
    const base = String(tag).toLowerCase().split('-')[0];
    if (base in dictionaries) return base;
  }
  return 'en';
}

export function translator(locale) {
  const dict = dictionaries[locale] ?? en;
  return (key, vars) => {
    let out = dict[key] ?? en[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
    return out;
  };
}
