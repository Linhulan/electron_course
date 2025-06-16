import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { app, BrowserWindow, ipcMain } from 'electron';

// Mock Electron modules
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
  }
}));

// Mock SerialPort
const mockSerialPortInstance = {
  on: vi.fn(),
  write: vi.fn(),
  close: vi.fn(),
  path: 'COM1'
};

const mockSerialPortConstructor = vi.fn(() => mockSerialPortInstance);
const mockSerialPortList = vi.fn();

const mockSerialPort = Object.assign(mockSerialPortConstructor, {
  list: mockSerialPortList
});

vi.mock('serialport', () => ({
  SerialPort: mockSerialPort
}));

// Mock path and utils modules
vi.mock('./pathResolver.js', () => ({
  getPreloadPath: vi.fn().mockReturnValue('/preload.js'),
  getUIPath: vi.fn().mockReturnValue('/ui')
}));

vi.mock('./utils.js', () => ({
  isDev: vi.fn().mockReturnValue(true),
  ipcMainHandle: vi.fn((key, handler) => {
    ipcMain.handle(key, handler);
  }),
  ipcWebContentsSend: vi.fn()
}));

vi.mock('./resourceManager.js', () => ({
  pollResources: vi.fn(),
  getStaticData: vi.fn()
}));

vi.mock('./tray.js', () => ({
  createTray: vi.fn()
}));

vi.mock('./menu.js', () => ({
  createMenu: vi.fn()
}));

describe('Serial Port Integration Tests', () => {
  let mockWindow: any;
  
  beforeEach(() => {
    vi.clearAllMocks();
    mockWindow = {
      webContents: {
        send: vi.fn()
      }
    };
    (BrowserWindow as any).mockReturnValue(mockWindow);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('IPC Handlers Registration', () => {
    it('should register all serial port IPC handlers', async () => {
      // Import main module to trigger handler registration
      await import('./main.js');

      // Verify that ipcMain.handle was called for each serial port handler
      const expectedHandlers = [
        'list-serial-ports',
        'connect-serial-port',
        'disconnect-serial-port', 
        'send-serial-data',
        'get-serial-connection-status'
      ];

      expectedHandlers.forEach(handlerKey => {
        expect(ipcMain.handle).toHaveBeenCalledWith(
          handlerKey,
          expect.any(Function)
        );
      });
    });
  });

  describe('Serial Port List Handler', () => {
    it('should handle list-serial-ports IPC call', async () => {
      const mockPorts = [
        {
          path: 'COM1',
          manufacturer: 'FTDI',
          friendlyName: 'USB Serial Port'
        }
      ];

      mockSerialPortList.mockResolvedValue(mockPorts);

      // Import main to register handlers
      await import('./main.js');

      // Find the list-serial-ports handler
      const handlerCall = (ipcMain.handle as any).mock.calls.find(
        (call: any) => call[0] === 'list-serial-ports'
      );

      expect(handlerCall).toBeDefined();

      // Execute the handler
      const handler = handlerCall[1];
      const result = await handler();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(expect.objectContaining({
        path: 'COM1',
        manufacturer: 'FTDI',
        friendlyName: 'USB Serial Port'
      }));
    });
  });

  describe('Serial Port Connection Handler', () => {
    it('should handle connect-serial-port IPC call', async () => {
      // Mock successful connection
      setTimeout(() => {
        const openCallback = mockSerialPortInstance.on.mock.calls.find(
          (call: any) => call[0] === 'open'
        )?.[1];
        if (openCallback) openCallback();
      }, 0);

      // Import main to register handlers
      await import('./main.js');

      // Find the connect handler
      const handlerCall = (ipcMain.handle as any).mock.calls.find(
        (call: any) => call[0] === 'connect-serial-port'
      );

      expect(handlerCall).toBeDefined();

      // Execute the handler
      const handler = handlerCall[1];
      const result = await handler('COM1', { baudRate: 115200 });

      expect(result).toBe(true);
      expect(mockSerialPortConstructor).toHaveBeenCalledWith({
        path: 'COM1',
        baudRate: 115200,
        dataBits: 8,
        stopBits: 1,
        parity: 'none'
      });
    });
  });

  describe('Serial Port Data Handler', () => {
    it('should handle send-serial-data IPC call', async () => {
      // First establish connection
      setTimeout(() => {
        const openCallback = mockSerialPortInstance.on.mock.calls.find(
          (call: any) => call[0] === 'open'
        )?.[1];
        if (openCallback) openCallback();
      }, 0);

      // Import main to register handlers
      await import('./main.js');

      // Connect first
      const connectHandler = (ipcMain.handle as any).mock.calls.find(
        (call: any) => call[0] === 'connect-serial-port'
      )?.[1];
      
      await connectHandler('COM1');

      // Mock successful write
      mockSerialPortInstance.write.mockImplementation((data: any, callback: any) => {
        callback();
      });

      // Find the send data handler
      const sendDataHandler = (ipcMain.handle as any).mock.calls.find(
        (call: any) => call[0] === 'send-serial-data'
      )?.[1];

      expect(sendDataHandler).toBeDefined();

      // Execute the handler
      await sendDataHandler('Hello Arduino!');

      expect(mockSerialPortInstance.write).toHaveBeenCalledWith(
        'Hello Arduino!',
        expect.any(Function)
      );
    });
  });

  describe('Serial Port Events', () => {
    it('should handle serial port data events', async () => {
      // Import main to register handlers
      await import('./main.js');

      // Establish connection
      const connectHandler = (ipcMain.handle as any).mock.calls.find(
        (call: any) => call[0] === 'connect-serial-port'
      )?.[1];

      // Mock connection
      setTimeout(() => {
        const openCallback = mockSerialPortInstance.on.mock.calls.find(
          (call: any) => call[0] === 'open'
        )?.[1];
        if (openCallback) openCallback();
      }, 0);

      await connectHandler('COM1');

      // Simulate data received
      const dataCallback = mockSerialPortInstance.on.mock.calls.find(
        (call: any) => call[0] === 'data'
      )?.[1];

      expect(dataCallback).toBeDefined();

      const testData = Buffer.from('temperature:25.6');
      dataCallback(testData);

      // Verify that data was processed (this would normally send to renderer)
      expect(mockSerialPortInstance.on).toHaveBeenCalledWith('data', expect.any(Function));
    });

    it('should handle serial port error events', async () => {
      // Import main to register handlers
      await import('./main.js');

      // Establish connection
      const connectHandler = (ipcMain.handle as any).mock.calls.find(
        (call: any) => call[0] === 'connect-serial-port'
      )?.[1];

      // Mock connection
      setTimeout(() => {
        const openCallback = mockSerialPortInstance.on.mock.calls.find(
          (call: any) => call[0] === 'open'
        )?.[1];
        if (openCallback) openCallback();
      }, 0);

      await connectHandler('COM1');

      // Simulate error
      const errorCallback = mockSerialPortInstance.on.mock.calls.find(
        (call: any) => call[0] === 'error'
      )?.[1];

      expect(errorCallback).toBeDefined();

      const testError = new Error('Serial communication error');
      errorCallback(testError);

      // Verify that error was handled
      expect(mockSerialPortInstance.on).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('Serial Port Status Handler', () => {
    it('should handle get-serial-connection-status IPC call', async () => {
      // Import main to register handlers
      await import('./main.js');

      // Find the status handler
      const statusHandler = (ipcMain.handle as any).mock.calls.find(
        (call: any) => call[0] === 'get-serial-connection-status'
      )?.[1];

      expect(statusHandler).toBeDefined();

      // Execute the handler (should return disconnected initially)
      const status = statusHandler();

      expect(status).toEqual({
        isConnected: false,
        portPath: undefined
      });
    });
  });

  describe('Serial Port Disconnect Handler', () => {
    it('should handle disconnect-serial-port IPC call', async () => {
      // Mock successful close
      mockSerialPortInstance.close.mockImplementation((callback: any) => {
        callback();
      });

      // Import main to register handlers
      await import('./main.js');

      // First connect
      const connectHandler = (ipcMain.handle as any).mock.calls.find(
        (call: any) => call[0] === 'connect-serial-port'
      )?.[1];

      setTimeout(() => {
        const openCallback = mockSerialPortInstance.on.mock.calls.find(
          (call: any) => call[0] === 'open'
        )?.[1];
        if (openCallback) openCallback();
      }, 0);

      await connectHandler('COM1');

      // Now disconnect
      const disconnectHandler = (ipcMain.handle as any).mock.calls.find(
        (call: any) => call[0] === 'disconnect-serial-port'
      )?.[1];

      expect(disconnectHandler).toBeDefined();

      await disconnectHandler();

      expect(mockSerialPortInstance.close).toHaveBeenCalled();
    });
  });
});
