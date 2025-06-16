import { vi } from 'vitest';

// Mock Electron modules globally
vi.mock('electron', () => ({
  app: {
    on: vi.fn(),
    getAppPath: vi.fn().mockReturnValue('/app'),
    quit: vi.fn()
  },
  BrowserWindow: vi.fn().mockImplementation(() => ({
    webContents: {
      send: vi.fn(),
      on: vi.fn()
    },
    loadURL: vi.fn(),
    on: vi.fn(),
    show: vi.fn()
  })),
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
    removeAllListeners: vi.fn()
  },
  ipcRenderer: {
    invoke: vi.fn(),
    on: vi.fn(),
    send: vi.fn(),
    removeAllListeners: vi.fn()
  }
}));

// Global test utilities
globalThis.createMockBrowserWindow = () => ({
  webContents: {
    send: vi.fn()
  }
});

globalThis.createMockSerialPort = () => ({
  on: vi.fn(),
  write: vi.fn(),
  close: vi.fn(),
  path: 'COM1'
});
