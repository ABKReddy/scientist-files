import type { UnlockedClue } from '../types';

export const UNLOCKED_CLUE_KEY = 'sf:unlocked-clue';

/** Reads the unlocked clue handed over by the verify endpoint (survives refresh). */
export const readUnlockedClue = (): UnlockedClue | null => {
  try {
    const raw = sessionStorage.getItem(UNLOCKED_CLUE_KEY);
    return raw ? (JSON.parse(raw) as UnlockedClue) : null;
  } catch {
    return null;
  }
};

export const clearUnlockedClue = (): void => {
  try {
    sessionStorage.removeItem(UNLOCKED_CLUE_KEY);
  } catch {
    /* storage unavailable */
  }
};