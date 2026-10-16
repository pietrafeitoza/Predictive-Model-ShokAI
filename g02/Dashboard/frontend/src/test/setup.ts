import '@testing-library/jest-dom/vitest';

import { configure, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

configure({ asyncUtilTimeout: 8000 });

class ResizeObserverMock implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock;

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => (store.has(key) ? (store.get(key) ?? null) : null),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
  };
}

// Node's global web storage can shadow jsdom's, leaving window.localStorage undefined.
if (!window.localStorage) {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: createMemoryStorage(),
  });
}
if (!window.sessionStorage) {
  Object.defineProperty(window, 'sessionStorage', {
    configurable: true,
    value: createMemoryStorage(),
  });
}

function createMatchMedia(query: string): MediaQueryList {
  return {
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  } as unknown as MediaQueryList;
}

if (!window.matchMedia) {
  window.matchMedia = createMatchMedia as typeof window.matchMedia;
}

if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => undefined;
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => undefined;
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => undefined;
}

// jsdom's selector engine (nwsapi) resolves the top-layer pseudo-classes
// `:modal`, `:fullscreen` and `:popover-open` extremely slowly. `@floating-ui`
// evaluates them while walking the DOM every time a Radix overlay (dropdown,
// select, popover...) mounts, which can add ~15s to a single test. jsdom never
// has top-layer elements, so short-circuit them to `false`.
const nativeMatches = Element.prototype.matches;
Element.prototype.matches = function matches(this: Element, selector: string) {
  if (selector === ':modal' || selector === ':fullscreen' || selector === ':popover-open') {
    return false;
  }

  return nativeMatches.call(this, selector);
};

const nativeGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
  const rectangle = nativeGetBoundingClientRect.call(this);

  if (!this.classList.contains('recharts-responsive-container')) return rectangle;

  return {
    ...rectangle,
    bottom: 300,
    height: 300,
    right: 800,
    width: 800,
    x: 0,
    y: 0,
    toJSON: () => undefined,
  };
};

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.innerWidth = 1024;
  document.cookie = 'sidebar_state=; path=/; max-age=0';
});
