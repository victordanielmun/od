import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

// Mock WebSocket
global.WebSocket = class WebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  constructor(url) {
    this.url = url;
    this.readyState = WebSocket.CONNECTING;
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      if (this.onopen) this.onopen();
    }, 50);
  }
  send() {}
  close() {}
};

import { vi } from 'vitest';
import mockTranslations from '../locales/en/translation.json';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => {
      if (key === 'lobby.sidebar.chat_request') return 'wants to chat.';
      if (key === 'lobby.sidebar.type_words') return 'Message...';
      const parts = key.split('.');
      let result = mockTranslations;
      for (const part of parts) {
        if (result && result[part] !== undefined) {
          result = result[part];
        } else {
          return key;
        }
      }
      return result;
    },
    i18n: {
      changeLanguage: () => Promise.resolve(),
      language: 'en',
    },
  }),
  initReactI18next: {
    type: '3rdParty',
    init: () => {},
  }
}));

const mockPhaserGlobal = {
  Game: class {
    constructor(config) {
      this.config = config;
    }
    destroy() {}
  },
  AUTO: 0,
  Scene: class {
    constructor() {}
  },
  Scale: {
    FIT: 0,
    CENTER_BOTH: 0,
    RESIZE: 0,
  },
  Input: { Keyboard: { KeyCodes: {} } },
  GameObjects: {
    Container: class {
      constructor() { this.add = () => {}; }
      add() {}
    }
  }
};
global.Phaser = mockPhaserGlobal;
if (typeof window !== 'undefined') {
  window.Phaser = mockPhaserGlobal;
  
  // Mock window.matchMedia for JSDOM
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // Deprecated
      removeListener: vi.fn(), // Deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}


