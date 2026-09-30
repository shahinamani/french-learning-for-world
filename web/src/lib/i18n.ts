import type { Locale } from './types';

export const LOCALES: Record<Locale, { name: string; dir: 'ltr' | 'rtl' }> = {
  en: { name: 'English', dir: 'ltr' },
  fr: { name: 'Français', dir: 'ltr' },
  fa: { name: 'فارسی', dir: 'rtl' },
  ar: { name: 'العربية', dir: 'rtl' },
};

/** `en` is the structural source of truth; the test asserts the other three match its keys. */
const en = {
  appName: 'French Learning for World',
  learn: 'Learn', practise: 'Practise', progress: 'Progress', search: 'Search',
  settings: 'Settings', account: 'Account', about: 'About', close: 'Close', back: 'Back',
  today: 'Today', dueNow: 'Due now', newCards: 'New', learned: 'Learned', cards: 'Cards',
  yourLevel: 'Your level', toWorkOn: 'To work on', start: 'Start', startSession: 'Start studying',
  minutes: '{n} min', sessionOf: '{n} cards · {m} min',
  nothingDue: 'Nothing is due right now', nothingDueBody: 'Study ahead with new cards, or come back later.',
  studyAhead: 'Study new cards', sessionDone: 'Session finished',
  sessionDoneBody: 'Everything due has been reviewed.', reviewed: 'Reviewed: {n}',
  showAnswer: 'Show answer', again: 'Again', hard: 'Hard', good: 'Good', easy: 'Easy',
  now: 'now', days: '{n}d', past: 'Past', future: 'Future',
  verb: 'verb', noun: 'noun', adjective: 'adjective', masculine: 'masculine', feminine: 'feminine',
  timer: 'Study timer', pause: 'Pause', reset: 'Reset', dismiss: 'Dismiss',
  timerDone: 'Time is up.', timerDoneSilent: 'Time is up. The browser would not play the chime.',
  timerAway: 'Your timer finished while you were away.',
  soundOn: 'Chime on', soundOff: 'Chime off',
  conceptRecord: 'Your record on this', practiseThis: 'Practise this concept',
  noRecordYet: 'No reviews yet. Study a card that uses it and this fills in.',
  reviewsCount: '{n} reviews', accuracy: 'Accuracy', lastSeen: 'Last seen',
  relatedConcepts: 'What this card tests', openPanel: 'Open details',
  searchPlaceholder: 'Lessons, grammar, verbs, words…',
  searchEmpty: 'Nothing for “{q}”. Try: passé composé, liaison, voyager.',
  searchHint: 'Type to search. Try a level like “B1”, or a time like “5 min”.',
  grammar: 'Grammar', vocabulary: 'Vocabulary', phonetics: 'Pronunciation', usage: 'Usage',
  concepts: 'Concepts', sessions: 'Sessions', loading: 'Loading…',
  loadFailed: 'Could not load the content.', retry: 'Try again',
  offline: 'Offline — what is already on this device still works.',
  storageBlocked: 'This browser is not saving progress — it may be a private window.',
  weakNone: 'Not enough data yet. After about twenty reviews your weak points appear here.',
  history: 'History', thisWeek: 'This week', whatMoved: 'What moved', noHistory: 'No reviews yet.',
  interfaceLanguage: 'Interface language', meaningLanguage: 'Meaning shown in',
  profile: 'Profile', switchProfile: 'Switch profile', newProfile: 'New profile',
  exportData: 'Export my data', eraseData: 'Erase everything',
  eraseConfirm: 'Erase all progress for this profile? This cannot be undone.',
  notBuilt: 'Not built yet',
  notBuiltBody: 'This section is planned. The shell, search, the side panel and flashcards are complete; the rest follow the same pattern.',
  independence: 'Independent study tool. Not affiliated with any examination body. No certificates are issued.',
};

type Dict = typeof en;

const fr: Dict = {
  appName: 'Apprendre le français pour le monde',
  learn: 'Apprendre', practise: 'Pratiquer', progress: 'Progrès', search: 'Chercher',
  settings: 'Réglages', account: 'Compte', about: 'À propos', close: 'Fermer', back: 'Retour',
  today: "Aujourd'hui", dueNow: 'À réviser', newCards: 'Nouvelles', learned: 'Apprises', cards: 'Cartes',
  yourLevel: 'Votre niveau', toWorkOn: 'À travailler', start: 'Commencer', startSession: 'Commencer',
  minutes: '{n} min', sessionOf: '{n} cartes · {m} min',
  nothingDue: "Rien à réviser pour l'instant", nothingDueBody: 'Prenez de nouvelles cartes, ou revenez plus tard.',
  studyAhead: 'Nouvelles cartes', sessionDone: 'Séance terminée',
  sessionDoneBody: 'Toutes les cartes dues ont été révisées.', reviewed: 'Révisées : {n}',
  showAnswer: 'Voir la réponse', again: 'À revoir', hard: 'Difficile', good: 'Bien', easy: 'Facile',
  now: 'maintenant', days: '{n} j', past: 'Passé', future: 'Futur',
  verb: 'verbe', noun: 'nom', adjective: 'adjectif', masculine: 'masculin', feminine: 'féminin',
  timer: "Minuteur d'étude", pause: 'Pause', reset: 'Réinitialiser', dismiss: 'Fermer',
  timerDone: 'Le temps est écoulé.', timerDoneSilent: "Le temps est écoulé. Le navigateur n'a pas joué le carillon.",
  timerAway: 'Votre minuteur a fini pendant votre absence.',
  soundOn: 'Carillon activé', soundOff: 'Carillon désactivé',
  conceptRecord: 'Votre historique sur ce point', practiseThis: 'Travailler ce point',
  noRecordYet: 'Aucune révision. Étudiez une carte qui le met en jeu et ceci se remplira.',
  reviewsCount: '{n} révisions', accuracy: 'Réussite', lastSeen: 'Dernière fois',
  relatedConcepts: 'Ce que cette carte met en jeu', openPanel: 'Voir le détail',
  searchPlaceholder: 'Leçons, grammaire, verbes, mots…',
  searchEmpty: 'Rien pour « {q} ». Essayez : passé composé, liaison, voyager.',
  searchHint: 'Tapez pour chercher. Essayez un niveau comme « B1 », ou une durée comme « 5 min ».',
  grammar: 'Grammaire', vocabulary: 'Vocabulaire', phonetics: 'Prononciation', usage: 'Usage',
  concepts: 'Points', sessions: 'Séances', loading: 'Chargement…',
  loadFailed: 'Impossible de charger le contenu.', retry: 'Réessayer',
  offline: 'Hors ligne — ce qui est déjà sur cet appareil fonctionne.',
  storageBlocked: "Ce navigateur n'enregistre pas la progression — fenêtre privée ?",
  weakNone: "Pas encore assez de données. Après une vingtaine de révisions, vos points faibles apparaissent ici.",
  history: 'Historique', thisWeek: 'Cette semaine', whatMoved: 'Ce qui a bougé', noHistory: 'Aucune révision.',
  interfaceLanguage: "Langue de l'interface", meaningLanguage: 'Langue des significations',
  profile: 'Profil', switchProfile: 'Changer de profil', newProfile: 'Nouveau profil',
  exportData: 'Exporter mes données', eraseData: 'Tout effacer',
  eraseConfirm: 'Effacer toute la progression de ce profil ? Action irréversible.',
  notBuilt: 'Pas encore construit',
  notBuiltBody: "Cette section est prévue. La coque, la recherche, le panneau latéral et les cartes sont terminés ; le reste suivra le même schéma.",
  independence: "Outil d'étude indépendant. Non affilié à un organisme d'examen. Aucun certificat n'est délivré.",
};

const fa: Dict = {
  appName: 'یادگیری فرانسه برای جهان',
  learn: 'آموزش', practise: 'تمرین', progress: 'پیشرفت', search: 'جست‌وجو',
  settings: 'تنظیمات', account: 'حساب', about: 'درباره', close: 'بستن', back: 'بازگشت',
  today: 'امروز', dueNow: 'برای مرور', newCards: 'جدید', learned: 'آموخته', cards: 'کارت‌ها',
  yourLevel: 'سطح شما', toWorkOn: 'نیازمند تمرین', start: 'شروع', startSession: 'شروع مطالعه',
  minutes: '{n} دقیقه', sessionOf: '{n} کارت · {m} دقیقه',
  nothingDue: 'در حال حاضر کارتی برای مرور نیست', nothingDueBody: 'کارت‌های جدید بخوانید یا بعداً برگردید.',
  studyAhead: 'کارت‌های جدید', sessionDone: 'جلسه تمام شد',
  sessionDoneBody: 'همه‌ی کارت‌های مهلت‌رسیده مرور شدند.', reviewed: 'مرور شده: {n}',
  showAnswer: 'نمایش پاسخ', again: 'دوباره', hard: 'سخت', good: 'خوب', easy: 'آسان',
  now: 'اکنون', days: '{n} روز', past: 'گذشته', future: 'آینده',
  verb: 'فعل', noun: 'اسم', adjective: 'صفت', masculine: 'مذکر', feminine: 'مؤنث',
  timer: 'زمان‌سنج مطالعه', pause: 'توقف', reset: 'بازنشانی', dismiss: 'بستن',
  timerDone: 'زمان تمام شد.', timerDoneSilent: 'زمان تمام شد. مرورگر اجازه‌ی پخش صدا نداد.',
  timerAway: 'زمان‌سنج شما در نبودتان به پایان رسید.',
  soundOn: 'صدا روشن', soundOff: 'صدا خاموش',
  conceptRecord: 'سابقه‌ی شما در این نکته', practiseThis: 'تمرین همین نکته',
  noRecordYet: 'هنوز مروری نیست. کارتی مرتبط بخوانید تا اینجا پر شود.',
  reviewsCount: '{n} مرور', accuracy: 'درستی', lastSeen: 'آخرین بار',
  relatedConcepts: 'این کارت چه چیزی را می‌سنجد', openPanel: 'نمایش جزئیات',
  searchPlaceholder: 'درس‌ها، دستور، فعل‌ها، واژه‌ها…',
  searchEmpty: 'چیزی برای «{q}» نیست. امتحان کنید: passé composé، liaison، voyager.',
  searchHint: 'برای جست‌وجو تایپ کنید. سطحی مثل «B1» یا مدتی مثل «5 min» را امتحان کنید.',
  grammar: 'دستور زبان', vocabulary: 'واژگان', phonetics: 'تلفظ', usage: 'کاربرد',
  concepts: 'نکته‌ها', sessions: 'جلسه‌ها', loading: 'در حال بارگذاری…',
  loadFailed: 'محتوا بارگذاری نشد.', retry: 'تلاش دوباره',
  offline: 'بدون اینترنت — آنچه روی این دستگاه است کار می‌کند.',
  storageBlocked: 'این مرورگر پیشرفت را ذخیره نمی‌کند — شاید پنجره‌ی ناشناس باشد.',
  weakNone: 'هنوز داده کافی نیست. پس از حدود بیست مرور، نقاط ضعف شما اینجا می‌آید.',
  history: 'تاریخچه', thisWeek: 'این هفته', whatMoved: 'چه چیزی تغییر کرد', noHistory: 'هنوز مروری نیست.',
  interfaceLanguage: 'زبان برنامه', meaningLanguage: 'زبان معنی',
  profile: 'نمایه', switchProfile: 'تغییر نمایه', newProfile: 'نمایه‌ی جدید',
  exportData: 'خروجی گرفتن از داده‌ها', eraseData: 'پاک کردن همه چیز',
  eraseConfirm: 'تمام پیشرفت این نمایه پاک شود؟ برگشت‌پذیر نیست.',
  notBuilt: 'هنوز ساخته نشده',
  notBuiltBody: 'این بخش برنامه‌ریزی شده است. پوسته، جست‌وجو، پنل کناری و کارت‌ها کامل‌اند؛ بقیه همین الگو را دنبال می‌کنند.',
  independence: 'ابزار مطالعه‌ی مستقل. وابسته به هیچ نهاد آزمون‌گیرنده‌ای نیست. هیچ مدرکی صادر نمی‌کند.',
};

const ar: Dict = {
  appName: 'تعلّم الفرنسية للعالم',
  learn: 'التعلّم', practise: 'التمرين', progress: 'التقدّم', search: 'البحث',
  settings: 'الإعدادات', account: 'الحساب', about: 'حول', close: 'إغلاق', back: 'رجوع',
  today: 'اليوم', dueNow: 'للمراجعة', newCards: 'جديدة', learned: 'محفوظة', cards: 'البطاقات',
  yourLevel: 'مستواك', toWorkOn: 'بحاجة إلى عمل', start: 'ابدأ', startSession: 'ابدأ الدراسة',
  minutes: '{n} دقيقة', sessionOf: '{n} بطاقة · {m} دقيقة',
  nothingDue: 'لا توجد بطاقات للمراجعة الآن', nothingDueBody: 'ادرس بطاقات جديدة أو عد لاحقًا.',
  studyAhead: 'بطاقات جديدة', sessionDone: 'انتهت الجلسة',
  sessionDoneBody: 'تمت مراجعة كل البطاقات المستحقة.', reviewed: 'تمت مراجعة: {n}',
  showAnswer: 'أظهر الإجابة', again: 'مرة أخرى', hard: 'صعبة', good: 'جيدة', easy: 'سهلة',
  now: 'الآن', days: '{n} ي', past: 'الماضي', future: 'المستقبل',
  verb: 'فعل', noun: 'اسم', adjective: 'صفة', masculine: 'مذكّر', feminine: 'مؤنّث',
  timer: 'مؤقّت الدراسة', pause: 'إيقاف مؤقت', reset: 'إعادة ضبط', dismiss: 'إغلاق',
  timerDone: 'انتهى الوقت.', timerDoneSilent: 'انتهى الوقت. لم يسمح المتصفح بتشغيل الجرس.',
  timerAway: 'انتهى مؤقّتك أثناء غيابك.',
  soundOn: 'الجرس مفعّل', soundOff: 'الجرس متوقف',
  conceptRecord: 'سجلّك في هذه النقطة', practiseThis: 'تدرّب على هذه النقطة',
  noRecordYet: 'لا مراجعات بعد. ادرس بطاقة تستخدمها وسيمتلئ هذا.',
  reviewsCount: '{n} مراجعة', accuracy: 'الدقة', lastSeen: 'آخر مرة',
  relatedConcepts: 'ما تختبره هذه البطاقة', openPanel: 'عرض التفاصيل',
  searchPlaceholder: 'دروس، قواعد، أفعال، كلمات…',
  searchEmpty: 'لا شيء لـ «{q}». جرّب: passé composé، liaison، voyager.',
  searchHint: 'اكتب للبحث. جرّب مستوى مثل «B1» أو مدة مثل «5 min».',
  grammar: 'القواعد', vocabulary: 'المفردات', phonetics: 'النطق', usage: 'الاستعمال',
  concepts: 'النقاط', sessions: 'الجلسات', loading: 'جارٍ التحميل…',
  loadFailed: 'تعذّر تحميل المحتوى.', retry: 'أعد المحاولة',
  offline: 'دون اتصال — ما هو على هذا الجهاز يعمل.',
  storageBlocked: 'هذا المتصفح لا يحفظ التقدّم — قد تكون نافذة خاصة.',
  weakNone: 'لا توجد بيانات كافية بعد. بعد نحو عشرين مراجعة تظهر نقاط ضعفك هنا.',
  history: 'السجل', thisWeek: 'هذا الأسبوع', whatMoved: 'ما الذي تغيّر', noHistory: 'لا مراجعات بعد.',
  interfaceLanguage: 'لغة الواجهة', meaningLanguage: 'لغة المعنى',
  profile: 'الملف', switchProfile: 'تبديل الملف', newProfile: 'ملف جديد',
  exportData: 'تصدير بياناتي', eraseData: 'محو كل شيء',
  eraseConfirm: 'محو كل تقدّم هذا الملف؟ لا يمكن التراجع.',
  notBuilt: 'لم يُبنَ بعد',
  notBuiltBody: 'هذا القسم مخطّط له. الهيكل والبحث واللوحة الجانبية والبطاقات جاهزة؛ والبقية تتبع النمط نفسه.',
  independence: 'أداة دراسة مستقلة. غير تابعة لأي هيئة امتحانات. لا تُصدر أي شهادة.',
};

export const dictionaries: Record<Locale, Dict> = { en, fr, fa, ar };

export function translator(locale: Locale) {
  const dict = dictionaries[locale] ?? en;
  return (key: keyof Dict, vars?: Record<string, string | number>): string => {
    let out: string = dict[key] ?? en[key] ?? String(key);
    if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
    return out;
  };
}

export function detectLocale(langs: readonly string[]): Locale {
  for (const tag of langs) {
    const base = String(tag).toLowerCase().split('-')[0] as Locale;
    if (base && base in dictionaries) return base;
  }
  return 'en';
}
