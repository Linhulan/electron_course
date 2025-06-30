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
  hexData: string; // hex模式下的十六进制数据
  textData: string; // 行模式下的文本数据
  timestamp: string;
  messageType?: 'normal' | 'warning' | 'error' | 'success' | 'info'; // 行模式下可能包含消息类型
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
  "send-serial-hex-data": void;
  "get-serial-connection-status": SerialConnectionStatus;
  "set-serial-receive-mode": boolean;
  // 文件管理相关事件
  "export-excel": ExportResult;
  "export-pdf": ExportResult;
  "get-export-history": ExportFileInfo[];
  "open-file": boolean;
  "show-in-folder": boolean;
  "delete-file": boolean;
  "get-default-export-dir": string;
  "set-default-export-dir": boolean;
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
    sendSerialHexData: (hexString: string) => Promise<void>;
    getSerialConnectionStatus: () => Promise<SerialConnectionStatus>;
    setSerialReceiveMode: (useRawMode: boolean) => Promise<boolean>;
    
    // Serial Port event subscriptions
    onSerialConnected: (callback: (data: SerialPortConnectionData) => void) => UnsubscribeFunction;
    onSerialDisconnected: (callback: () => void) => UnsubscribeFunction;
    onSerialDataReceived: (callback: (data: SerialDataReceived) => void) => UnsubscribeFunction;
    onSerialError: (callback: (error: SerialError) => void) => UnsubscribeFunction;
    
    // 文件管理函数
    exportExcel: (sessionData: any[], options?: ExportOptions) => Promise<ExportResult>;
    exportPDF: (sessionData: any[], options?: ExportOptions) => Promise<ExportResult>;
    getExportHistory: () => Promise<ExportFileInfo[]>;
    openFile: (filePath: string) => Promise<boolean>;
    showInFolder: (filePath: string) => Promise<boolean>;
    deleteFile: (filePath: string) => Promise<boolean>;
    getDefaultExportDir: () => Promise<string>;
    setDefaultExportDir: (dirPath: string) => Promise<boolean>;
  };
}

// 文件管理相关类型
type ExportFileInfo = {
  id: string;
  filename: string;
  filePath: string;
  fileType: 'excel' | 'pdf';
  size: number;
  createdAt: string;
  sessionCount: number;
};

type ExportOptions = {
  format?: 'excel' | 'pdf';
  filename?: string;
  useDefaultDir?: boolean;
  customDir?: string;
  openAfterExport?: boolean;
};

type ExportResult = {
  success: boolean;
  filePath?: string;
  fileInfo?: ExportFileInfo;
  error?: string;
};
