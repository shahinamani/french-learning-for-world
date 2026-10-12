/**
 * Reading a French word aloud, using whatever voices the device actually has.
 *
 * This is the browser's own `speechSynthesis`. Nothing is downloaded, nothing
 * is sent anywhere, and no audio ships in the bundle — which matters, because
 * recorded audio is blocked on licensing (no recording has been obtained under
 * a licence that permits use) and machine speech is explicitly NOT offered as
 * listening practice. This is a pronunciation aid on a vocabulary card and the
 * interface says so.
 *
 * ## Why the voice list is read and never assumed
 *
 * A France voice and a Canada voice are device facts. macOS ships Thomas and
 * Amélie; a stock Linux Chromium often has no French voice at all. Offering
 * "Canada" on a machine with no `fr-CA` voice would silently give the learner
 * France audio under a Canada label — a wrong claim about what they just
 * heard, which is the class of defect this project exists to avoid. So:
 *
 *   - the regions offered are derived from the voices present;
 *   - if there is no French voice, `voices()` is empty and the caller shows an
 *     honest "no French voice on this device" state instead of a dead button.
 *
 * `getVoices()` is also empty until the engine populates it, which is a famous
 * trap: the first call on a cold page returns `[]`, so a one-shot read makes
 * every device look voiceless. `onVoicesReady` handles that.
 */

export type Region = 'fr-FR' | 'fr-CA' | 'fr-other';

export type FrenchVoice = {
  /** `voiceURI`, which is what identifies a voice across reloads. */
  id: string;
  name: string;
  lang: string;
  region: Region;
};

function supported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function regionOf(lang: string): Region {
  const l = lang.toLowerCase().replace('_', '-');
  if (l.startsWith('fr-fr')) return 'fr-FR';
  if (l.startsWith('fr-ca')) return 'fr-CA';
  return 'fr-other';
}

/** Every French voice this device has, France and Canada first. */
export function voices(): FrenchVoice[] {
  if (!supported()) return [];
  const order: Region[] = ['fr-FR', 'fr-CA', 'fr-other'];
  return window.speechSynthesis.getVoices()
    .filter((v) => v.lang.toLowerCase().startsWith('fr'))
    .map((v) => ({ id: v.voiceURI, name: v.name, lang: v.lang, region: regionOf(v.lang) }))
    .sort((a, b) => order.indexOf(a.region) - order.indexOf(b.region)
      || a.name.localeCompare(b.name));
}

/**
 * Calls back when the voice list is usable, and again if it changes.
 *
 * Returns its own unsubscribe. Chromium fires `voiceschanged` once the engine
 * has enumerated; Safari has them synchronously. Both paths end up calling the
 * listener, so the caller never has to know which browser it is on.
 */
export function onVoicesReady(fn: (list: FrenchVoice[]) => void): () => void {
  if (!supported()) { fn([]); return () => {}; }
  const emit = () => fn(voices());
  emit();
  window.speechSynthesis.addEventListener('voiceschanged', emit);
  return () => window.speechSynthesis.removeEventListener('voiceschanged', emit);
}

/** The speeds offered. 1 is normal; the slow end is what a learner needs. */
export const RATES = [0.5, 0.75, 1] as const;
export type Rate = (typeof RATES)[number];

/** Stop whatever is being said. Safe to call when nothing is speaking. */
export function stop(): void {
  if (supported()) window.speechSynthesis.cancel();
}

/**
 * Say `text` in French, replacing anything already being said.
 *
 * `cancel()` first, always: without it, clicking Listen twice queues two
 * utterances and navigating away leaves the previous word still talking over
 * the next card. Returns false when the device cannot speak it, so the caller
 * can say so rather than appearing to work.
 */
export function speak(text: string, voiceId: string | null, rate: number): boolean {
  if (!supported() || !text.trim()) return false;
  const all = window.speechSynthesis.getVoices()
    .filter((v) => v.lang.toLowerCase().startsWith('fr'));
  const chosen = all.find((v) => v.voiceURI === voiceId) ?? all[0];
  if (!chosen) return false;   // no French voice: the caller says so

  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = chosen;
  u.lang = chosen.lang;          // some engines read `lang`, not `voice`
  u.rate = rate;
  window.speechSynthesis.speak(u);
  return true;
}
