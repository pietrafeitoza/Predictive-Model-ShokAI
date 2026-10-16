import type { SupportedStorage } from '@supabase/supabase-js';

const persistencePreferenceKey = 'shokai.auth.persistence';

type PersistenceMode = 'local' | 'session';

function getPersistenceMode(): PersistenceMode {
  return window.sessionStorage.getItem(persistencePreferenceKey) === 'session'
    ? 'session'
    : 'local';
}

function getStorage(mode: PersistenceMode): Storage {
  return mode === 'local' ? window.localStorage : window.sessionStorage;
}

function getOtherStorage(mode: PersistenceMode): Storage {
  return mode === 'local' ? window.sessionStorage : window.localStorage;
}

export function setRememberSession(remember: boolean): void {
  if (remember) {
    window.localStorage.setItem(persistencePreferenceKey, 'local');
    window.sessionStorage.removeItem(persistencePreferenceKey);
    return;
  }

  window.localStorage.removeItem(persistencePreferenceKey);
  window.sessionStorage.setItem(persistencePreferenceKey, 'session');
}

export function isSessionRemembered(): boolean {
  return getPersistenceMode() === 'local';
}

export const authStorage: SupportedStorage = {
  getItem(key) {
    const mode = getPersistenceMode();
    return getStorage(mode).getItem(key) ?? getOtherStorage(mode).getItem(key);
  },
  setItem(key, value) {
    const mode = getPersistenceMode();
    getStorage(mode).setItem(key, value);
    getOtherStorage(mode).removeItem(key);
  },
  removeItem(key) {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  },
};
