import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BrowserWindow } from 'electron';

// Simple mock setup
const mockSerialPortInstance = {
  on: vi.fn(),
  write: vi.fn(),
  close: vi.fn(),
  path: 'COM1'
};

const mockSerialPortConstructor = vi.fn(() => mockSerialPortInstance);
const mockList = vi.fn();
(mockSerialPortConstructor as any).list = mockList;

vi.mock('serialport', () => ({
  SerialPort: mockSerialPortConstructor
}));

vi.mock('./utils.js', () => ({
  ipcWebContentsSend: vi.fn()
}));

// Import after mocking
const { SerialPortManager, getAvailablePorts } = await import('./serialPort.js');
const { ipcWebContentsSend } = await import('./utils.js');

describe('Serial Port Tests', () => {
  let mockBrowserWindow: BrowserWindow;
  let serialPortManager: InstanceType<typeof SerialPortManager>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockBrowserWindow = {
      webContents: { send: vi.fn() }
    } as any;
    serialPortManager = new SerialPortManager(mockBrowserWindow);
  });

  describe('listPorts', () => {
    it('should list available ports', async () => {
      const mockPorts = [
        { path: 'COM1', manufacturer: 'FTDI', friendlyName: 'USB Serial' }
      ];
      mockList.mockResolvedValue(mockPorts);

      const result = await serialPortManager.listPorts();

      expect(mockList).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('COM1');
    });

    it('should handle errors', async () => {
      mockList.mockRejectedValue(new Error('Access denied'));

      await expect(serialPortManager.listPorts()).rejects.toThrow('Failed to list serial ports');
    });
  });

  describe('connect', () => {
    it('should connect successfully', async () => {
      const connectPromise = serialPortManager.connect('COM11');
      
      // Simulate open event
      setImmediate(() => {
        const openHandler = mockSerialPortInstance.on.mock.calls
          .find(call => call[0] === 'open')?.[1];
        if (openHandler) openHandler();
      });

      const result = await connectPromise;
      expect(result).toBe(true);
      expect(mockSerialPortConstructor).toHaveBeenCalledWith({
        path: 'COM11',
        baudRate: 9600,
        dataBits: 8,
        stopBits: 1,
        parity: 'none'
      });
    });

    it('should handle connection errors', async () => {
      const connectPromise = serialPortManager.connect('COM11');

      // Simulate error event
      setImmediate(() => {
        const errorHandler = mockSerialPortInstance.on.mock.calls
          .find(call => call[0] === 'error')?.[1];
        if (errorHandler) errorHandler(new Error('Port not found'));
      });

      await expect(connectPromise).rejects.toThrow('Port not found');
    });
  });

  describe('sendData', () => {
    beforeEach(async () => {
      // Connect first
      const connectPromise = serialPortManager.connect('COM1');
      setImmediate(() => {
        const openHandler = mockSerialPortInstance.on.mock.calls
          .find(call => call[0] === 'open')?.[1];
        if (openHandler) openHandler();
      });
      await connectPromise;
    });

    it('should send data successfully', async () => {
      mockSerialPortInstance.write.mockImplementation((data, callback) => callback());

      await serialPortManager.sendData('test data');

      expect(mockSerialPortInstance.write).toHaveBeenCalledWith(
        'test data',
        expect.any(Function)
      );
    });

    it('should handle send errors', async () => {
      const error = new Error('Send failed');
      mockSerialPortInstance.write.mockImplementation((data, callback) => callback(error));

      await expect(serialPortManager.sendData('test')).rejects.toThrow('Send failed');
    });
  });

  describe('getAvailablePorts', () => {
    it('should return port list', async () => {
      const mockPorts = [{ path: 'COM1', manufacturer: 'Arduino' }];
      mockList.mockResolvedValue(mockPorts);

      const result = await getAvailablePorts();

      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('COM1');
    });

    it('should return empty array on error', async () => {
      mockList.mockRejectedValue(new Error('Error'));

      const result = await getAvailablePorts();

      expect(result).toEqual([]);
    });
  });
});
