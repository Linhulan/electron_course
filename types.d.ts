type Statistics = {
  cpuUsage: number;
  ramUsage: number;
  storageUsage: number;
};

type StaticData = {
  totalStorage: number;
  cpuModel: string;
  totalMemoryGB: number;
};

type View = "CPU" | "RAM" | "STORAGE";

type FrameWindowAction = "MINIMIZE" | "MAXIMIZE" | "CLOSE";

type SerialPortConnectionData = {
  portPath: string;
  config: {
    baudRate: number;
    dataBits: number;
    stopBits: number;
    parity: string;
  };
};

type SerialDataReceived = {
  data: string;
  hexData: string;
  rawBuffer: number[];
  timestamp: string;
  messageType: 'normal' | 'warning' | 'error' | 'success' | 'info';
};

type SerialError = {
  error: string;
};

type SerialPortInfo = {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  pnpId?: string;
  locationId?: string;
  productId?: string;
  vendorId?: string;
  friendlyName?: string;
  displayName: string;
};

type SerialConnectionStatus = {
  isConnected: boolean;
  portPath?: string;
};

type SerialPortConfig = {
  baudRate?: number;
  dataBits?: 5 | 6 | 7 | 8;
  stopBits?: 1 | 1.5 | 2;
  parity?: 'none' | 'even' | 'odd' | 'mark' | 'space';
};

type EventPayloadMapping = {
  statistics: Statistics;
  getStaticData: StaticData;
  changeView: View;
  sendFrameAction: FrameWindowAction;
  "serial-connected": SerialPortConnectionData;
  "serial-disconnected": Record<string, never>;
  "serial-data-received": SerialDataReceived;
  "serial-error": SerialError;
  "list-serial-ports": SerialPortInfo[];
  "connect-serial-port": boolean;
  "disconnect-serial-port": void;
  "send-serial-data": void;
  "get-serial-connection-status": SerialConnectionStatus;
  "set-serial-receive-mode": boolean;
};

type UnsubscribeFunction = () => void;

interface Window {
  electron: {
    subscribeStatistics: (
      callback: (statistics: Statistics) => void
    ) => UnsubscribeFunction;

    subscribeChangeView: (
      callback: (view: View) => void
    ) => UnsubscribeFunction;

    getStaticData: () => Promise<StaticData>;
    sendFrameAction: (payload: FrameWindowAction) => void;
      // Serial Port functions
    listSerialPorts: () => Promise<SerialPortInfo[]>;
    connectSerialPort: (portPath: string, config?: SerialPortConfig) => Promise<boolean>;
    disconnectSerialPort: () => Promise<void>;
    sendSerialData: (data: string) => Promise<void>;
    getSerialConnectionStatus: () => Promise<SerialConnectionStatus>;
    setSerialReceiveMode: (useRawMode: boolean) => Promise<boolean>;
    
    // Serial Port event subscriptions
    onSerialConnected: (callback: (data: SerialPortConnectionData) => void) => UnsubscribeFunction;
    onSerialDisconnected: (callback: () => void) => UnsubscribeFunction;
    onSerialDataReceived: (callback: (data: SerialDataReceived) => void) => UnsubscribeFunction;
    onSerialError: (callback: (error: SerialError) => void) => UnsubscribeFunction;
  };
}
