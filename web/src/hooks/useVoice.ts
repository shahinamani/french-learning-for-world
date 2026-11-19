/**
 * The device's French voice, and the speed the learner chose for it.
 *
 * Read from the device and never assumed (lib/speech.ts says why): `available`
 * is false on a machine with no French voice, and the callers then render no
 * Listen button at all rather than a dead one. The speed is kept per profile
 * under the profile's own key, so two learners on one device each keep theirs.
 */
import { useCallback, useEffect, useState } from 'react';
import { onVoicesReady, RATES, stop, type FrenchVoice, type Rate } from '../lib/speech';
import { userKey } from '../lib/session';

const rateKey = (userId: string) => userKey(userId, 'voice-rate');

function readRate(userId: string): Rate {
  try {
    const n = Number(localStorage.getItem(rateKey(userId)));
    return (RATES as readonly number[]).includes(n) ? (n as Rate) : 1;
  } catch { return 1; }
}

export function useVoice(userId: string) {
  const [voiceList, setVoiceList] = useState<FrenchVoice[]>([]);
  const [rate, setRateState] = useState<Rate>(() => readRate(userId));
  useEffect(() => onVoicesReady(setVoiceList), []);
  useEffect(() => { setRateState(readRate(userId)); }, [userId]);
  // Leaving the screen must not leave speech running.
  useEffect(() => () => stop(), []);
  const setRate = useCallback((r: Rate) => {
    setRateState(r);
    try { localStorage.setItem(rateKey(userId), String(r)); } catch { /* private mode */ }
  }, [userId]);
  return { available: voiceList.length > 0, voiceId: voiceList[0]?.id ?? null, rate, setRate };
}
