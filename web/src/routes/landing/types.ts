import type { Dict } from '../../lib/i18n';

/** The translator the landing page uses: already bound to the language the
 *  page is actually written in, and already French-typeset when that is French.
 *  Passed down rather than re-derived so every section agrees on one answer to
 *  "what language is this page in". */
export type Tx = (key: keyof Dict, vars?: Record<string, string | number>) => string;

/** The language the page's COPY is in. Not always the interface language: when
 *  nobody has written the page in the reader's language it is English. */
export type CopyLocale = 'en' | 'fr' | 'fa' | 'ar';
