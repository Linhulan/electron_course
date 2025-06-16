import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { BrowserWindow } from 'electron';
import { ipcWebContentsSend } from './utils.js';

// Mock SerialPort with a simple factory function
vi.mock('serialport', () => {
  const mockInstance = {
    on: vi.fn(),
    write: vi.fn(),
    close: vi.fn(),
    path: 'COM1'
  };

  const MockSerialPort = vi.fn(() => mockInstance);
  MockSerialPort.list = vi.fn();

  return {
    SerialPort: MockSerialPort
  };
});

// Mock utils
vi.mock('./utils.js', () => ({
  ipcWebContentsSend: vi.fn()
}));

// Import after mocking
const { SerialPortManager, getAvailablePorts } = await import('./serialPort.js');
const { SerialPort } = await import('serialport');

// Mock BrowserWindow
const mockBrowserWindow = {
  webContents: {
    send: vi.fn()
  }
} as unknown as BrowserWindow;

describe('SerialPortManager', () => {
  let serialPortManager: SerialPortManager;
  let mockIpcWebContentsSend: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    serialPortManager = new SerialPortManager(mockBrowserWindow);
    mockIpcWebContentsSend = vi.mocked(ipcWebContentsSend);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('listPorts', () => {
    it('should return formatted port list', async () => {
      const mockPorts = [
        {
          path: 'COM1',
          manufacturer: 'FTDI',
          serialNumber: '12345',
          vendorId: '0403',
          productId: '6001',
          friendlyName: 'USB Serial Port (COM1)'
        },
        {
          path: 'COM3',
          manufacturer: 'Arduino',
          vendorId: '2341',
          friendlyName: 'Arduino Uno (COM3)'
        }
      ];      mockSerialPortList.mockResolvedValue(mockPorts);

      const result = await serialPortManager.listPorts();

      expect(mockSerialPortList).toHaveBeenCalledOnce();
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        path: 'COM1',
        manufacturer: 'FTDI',
        serialNumber: '12345',
        vendorId: '0403',
        productId: '6001',
        friendlyName: 'USB Serial Port (COM1)',
        displayName: 'USB Serial Port (COM1)'
      });
    });    it('should handle errors when listing ports', async () => {
      const error = new Error('Port access denied');
      mockSerialPortList.mockRejectedValue(error);

      await expect(serialPortManager.listPorts()).rejects.toThrow(
        'Failed to list serial ports: Port access denied'
      );
    });

    it('should handle ports without friendlyName', async () => {
      const mockPorts = [
        {
          path: 'COM2',
          manufacturer: 'Unknown'
        }
      ];

      mockSerialPortList.mockResolvedValue(mockPorts);

      const result = await serialPortManager.listPorts();

      expect(result[0].displayName).toBe('Unknown - COM2');
    });
  });

  describe('connect', () => {
    it('should connect to serial port successfully', async () => {
      const portPath = 'COM11';
      const config = { baudRate: 115200 };

      // Mock successful connection
      const connectPromise = serialPortManager.connect(portPath, config);

      // Simulate the 'open' event
      const openCallback = mockSerialPortInstance.on.mock.calls.find(
        call => call[0] === 'open'
      )?.[1];
      
      if (openCallback) {
        setTimeout(() => openCallback(), 0);
      }

      const result = await connectPromise;

      expect(result).toBe(true);      expect(mockSerialPort).toHaveBeenCalledWith({
        path: portPath,
        baudRate: 115200,
        dataBits: 8,
        stopBits: 1,
        parity: 'none'
      });
      expect(mockIpcWebContentsSend).toHaveBeenCalledWith(
        'serial-connected',
        mockBrowserWindow.webContents,
        {
          portPath,
          config: {
            baudRate: 115200,
            dataBits: 8,
            stopBits: 1,
            parity: 'none'
          }
        }
      );
    });

    it('should handle connection errors', async () => {
      const portPath = 'COM1';
      const error = new Error('Port not found');

      const connectPromise = serialPortManager.connect(portPath);

      // Simulate the 'error' event
      const errorCallback = mockSerialPortInstance.on.mock.calls.find(
        call => call[0] === 'error'
      )?.[1];

      if (errorCallback) {
        setTimeout(() => errorCallback(error), 0);
      }

      await expect(connectPromise).rejects.toThrow('Port not found');
    });

    it('should disconnect existing connection before connecting', async () => {
      const mockClose = vi.fn((callback) => callback());
      mockSerialPortInstance.close = mockClose;

      // First connection
      const firstConnect = serialPortManager.connect('COM1');
      const openCallback = mockSerialPortInstance.on.mock.calls.find(
        call => call[0] === 'open'
      )?.[1];
      
      if (openCallback) {
        setTimeout(() => openCallback(), 0);
      }
      await firstConnect;

      // Second connection should close first
      const secondConnect = serialPortManager.connect('COM2');
      
      // Simulate second open event
      setTimeout(() => {
        const secondOpenCallback = mockSerialPortInstance.on.mock.calls
          .filter(call => call[0] === 'open')
          .pop()?.[1];
        if (secondOpenCallback) secondOpenCallback();
      }, 0);

      await secondConnect;

      expect(mockClose).toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    beforeEach(async () => {
      // Establish connection first
      const connectPromise = serialPortManager.connect('COM1');
      const openCallback = mockSerialPortInstance.on.mock.calls.find(
        call => call[0] === 'open'
      )?.[1];
      
      if (openCallback) {
        setTimeout(() => openCallback(), 0);
      }
      await connectPromise;
    });

    it('should disconnect successfully', async () => {
      const mockClose = vi.fn((callback) => callback());
      mockSerialPortInstance.close = mockClose;

      await serialPortManager.disconnect();

      expect(mockClose).toHaveBeenCalled();
      expect(mockIpcWebContentsSend).toHaveBeenCalledWith(
        'serial-disconnected',
        mockBrowserWindow.webContents,
        {}
      );
    });

    it('should handle disconnect errors', async () => {
      const error = new Error('Disconnect failed');
      const mockClose = vi.fn((callback) => callback(error));
      mockSerialPortInstance.close = mockClose;

      await expect(serialPortManager.disconnect()).rejects.toThrow('Disconnect failed');
    });
  });

  describe('sendData', () => {
    beforeEach(async () => {
      // Establish connection first
      const connectPromise = serialPortManager.connect('COM1');
      const openCallback = mockSerialPortInstance.on.mock.calls.find(
        call => call[0] === 'open'
      )?.[1];
      
      if (openCallback) {
        setTimeout(() => openCallback(), 0);
      }
      await connectPromise;
    });

    it('should send data successfully', async () => {
      const testData = 'Hello Arduino!';
      const mockWrite = vi.fn((data, callback) => callback());
      mockSerialPortInstance.write = mockWrite;

      await serialPortManager.sendData(testData);

      expect(mockWrite).toHaveBeenCalledWith(testData, expect.any(Function));
    });

    it('should handle send errors', async () => {
      const testData = 'Hello Arduino!';
      const error = new Error('Send failed');
      const mockWrite = vi.fn((data, callback) => callback(error));
      mockSerialPortInstance.write = mockWrite;

      await expect(serialPortManager.sendData(testData)).rejects.toThrow('Send failed');
    });

    it('should throw error when not connected', async () => {
      await serialPortManager.disconnect();

      await expect(serialPortManager.sendData('test')).rejects.toThrow(
        'Serial port is not connected'
      );
    });
  });

  describe('getConnectionStatus', () => {
    it('should return disconnected status initially', () => {
      const status = serialPortManager.getConnectionStatus();

      expect(status).toEqual({
        isConnected: false,
        portPath: undefined
      });
    });

    it('should return connected status after connection', async () => {
      const portPath = 'COM1';
      const connectPromise = serialPortManager.connect(portPath);
      const openCallback = mockSerialPortInstance.on.mock.calls.find(
        call => call[0] === 'open'
      )?.[1];
      
      if (openCallback) {
        setTimeout(() => openCallback(), 0);
      }
      await connectPromise;

      const status = serialPortManager.getConnectionStatus();

      expect(status).toEqual({
        isConnected: true,
        portPath: portPath
      });
    });
  });

  describe('event handling', () => {
    beforeEach(async () => {
      // Establish connection first
      const connectPromise = serialPortManager.connect('COM1');
      const openCallback = mockSerialPortInstance.on.mock.calls.find(
        call => call[0] === 'open'
      )?.[1];
      
      if (openCallback) {
        setTimeout(() => openCallback(), 0);
      }
      await connectPromise;
    });

    it('should handle data events', () => {
      const testData = Buffer.from('sensor:25.6');
      
      const dataCallback = mockSerialPortInstance.on.mock.calls.find(
        call => call[0] === 'data'
      )?.[1];

      if (dataCallback) {
        dataCallback(testData);
      }

      expect(mockIpcWebContentsSend).toHaveBeenCalledWith(
        'serial-data-received',
        mockBrowserWindow.webContents,
        {
          data: 'sensor:25.6',
          timestamp: expect.any(String)
        }
      );
    });

    it('should handle error events', () => {
      const error = new Error('Serial error');
      
      const errorCallback = mockSerialPortInstance.on.mock.calls.find(
        call => call[0] === 'error'
      )?.[1];

      if (errorCallback) {
        errorCallback(error);
      }

      expect(mockIpcWebContentsSend).toHaveBeenCalledWith(
        'serial-error',
        mockBrowserWindow.webContents,
        {
          error: 'Serial error'
        }
      );
    });

    it('should handle close events', () => {
      const closeCallback = mockSerialPortInstance.on.mock.calls.find(
        call => call[0] === 'close'
      )?.[1];

      if (closeCallback) {
        closeCallback();
      }

      expect(mockIpcWebContentsSend).toHaveBeenCalledWith(
        'serial-disconnected',
        mockBrowserWindow.webContents,
        {}
      );
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources properly', async () => {
      const mockClose = vi.fn((callback) => callback());
      mockSerialPortInstance.close = mockClose;

      // Connect first
      const connectPromise = serialPortManager.connect('COM1');
      const openCallback = mockSerialPortInstance.on.mock.calls.find(
        call => call[0] === 'open'
      )?.[1];
      
      if (openCallback) {
        setTimeout(() => openCallback(), 0);
      }
      await connectPromise;

      // Cleanup
      await serialPortManager.cleanup();

      expect(mockClose).toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      const error = new Error('Cleanup failed');
      const mockClose = vi.fn((callback) => callback(error));
      mockSerialPortInstance.close = mockClose;

      // Connect first
      const connectPromise = serialPortManager.connect('COM1');
      const openCallback = mockSerialPortInstance.on.mock.calls.find(
        call => call[0] === 'open'
      )?.[1];
      
      if (openCallback) {
        setTimeout(() => openCallback(), 0);
      }
      await connectPromise;

      // Cleanup should not throw
      await expect(serialPortManager.cleanup()).resolves.toBeUndefined();
    });
  });
});

describe('getAvailablePorts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return formatted port list', async () => {
    const mockPorts = [
      {
        path: 'COM1',
        manufacturer: 'FTDI',
        friendlyName: 'USB Serial Port (COM1)'
      }
    ];    mockSerialPortList.mockResolvedValue(mockPorts);

    const result = await getAvailablePorts();

    expect(result).toHaveLength(1);
    expect(result[0].displayName).toBe('USB Serial Port (COM1)');
  });

  it('should return empty array on error', async () => {
    mockSerialPortList.mockRejectedValue(new Error('Access denied'));

    const result = await getAvailablePorts();

    expect(result).toEqual([]);
  });

  it('should handle ports without friendlyName', async () => {
    const mockPorts = [
      {
        path: 'COM2',
        manufacturer: 'Arduino'
      }
    ];

    mockSerialPortList.mockResolvedValue(mockPorts);

    const result = await getAvailablePorts();

    expect(result[0].displayName).toBe('Arduino (COM2)');
  });
});
