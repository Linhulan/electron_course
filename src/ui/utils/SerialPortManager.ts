import { useAppConfigStore } from '../contexts/store';

export interface SerialPortManagerConfig {
  baudRate: number;
  dataBits: 5 | 6 | 7 | 8;
  stopBits: 1 | 1.5 | 2;
  parity: "none" | "even" | "odd" | "mark" | "space";
  autoConnect?: boolean;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface SerialPortManagerEvents {
  onConnected?: (data: SerialPortConnectionData) => void;
  onDisconnected?: () => void;
  onDataReceived?: (data: SerialDataReceived) => void;
  onError?: (error: { error: string; code?: string }) => void;
  onPortsUpdated?: (ports: SerialPortInfo[]) => void;
  onConnectionStateChanged?: (connected: boolean) => void;
}

export type SerialMessageType = 
  | "system" 
  | "sent" 
  | "received" 
  | "error" 
  | "warning" 
  | "success" 
  | "info" 
  | "normal";

export class SerialPortManager {
  private static instance: SerialPortManager;
  private config: SerialPortManagerConfig;
  private availablePorts: SerialPortInfo[] = [];
  private selectedPort: string = "";
  private connectionStatus: SerialConnectionStatus = { isConnected: false };
  private isConnecting: boolean = false;
  private eventListeners: SerialPortManagerEvents = {};
  private unsubscribeFunctions: (() => void)[] = [];

  private constructor() {
    this.config = {
      baudRate: 115200,
      dataBits: 8,
      stopBits: 1,
      parity: "none",
      autoConnect: false,
      retryAttempts: 3,
      retryDelay: 1000,
    };
    this.initializeEventListeners();
  }

  // 单例模式
  public static getInstance(): SerialPortManager {
    if (!SerialPortManager.instance) {
      SerialPortManager.instance = new SerialPortManager();
    }
    return SerialPortManager.instance;
  }

  // 初始化事件监听器
  private initializeEventListeners(): void {
    // 这些监听器会在initialize方法中设置
  }

  // 初始化管理器
  public async initialize(): Promise<void> {
    try {
      // 刷新端口列表
      await this.refreshPorts();
      
      // 检查连接状态
      await this.checkConnectionStatus();

      // 设置electron事件监听器
      this.setupElectronListeners();
      
      console.log('SerialPortManager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize SerialPortManager:', error);
      throw error;
    }
  }

  // 设置electron事件监听器
  private setupElectronListeners(): void {
    // 清除之前的监听器
    this.unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
    this.unsubscribeFunctions = [];

    // 连接事件
    const unsubscribeConnected = window.electron.onSerialConnected((data) => {
      this.connectionStatus = { isConnected: true, portPath: data.portPath };
      this.selectedPort = data.portPath;
      
      // 更新全局状态
      useAppConfigStore.getState().setSerialConnected(true);
      
      // 触发回调
      this.eventListeners.onConnected?.(data);
      this.eventListeners.onConnectionStateChanged?.(true);
    });

    // 断开连接事件
    const unsubscribeDisconnected = window.electron.onSerialDisconnected(() => {
      this.connectionStatus = { isConnected: false };
      this.isConnecting = false;
      
      // 更新全局状态
      useAppConfigStore.getState().setSerialConnected(false);
      
      // 触发回调
      this.eventListeners.onDisconnected?.();
      this.eventListeners.onConnectionStateChanged?.(false);
    });

    // 数据接收事件
    const unsubscribeDataReceived = window.electron.onSerialDataReceived((data) => {
      this.eventListeners.onDataReceived?.(data);
    });

    // 错误事件
    const unsubscribeError = window.electron.onSerialError((error) => {
      this.eventListeners.onError?.(error);
    });

    // 保存取消订阅函数
    this.unsubscribeFunctions = [
      unsubscribeConnected,
      unsubscribeDisconnected,
      unsubscribeDataReceived,
      unsubscribeError
    ];
  }

  // 刷新端口列表
  public async refreshPorts(): Promise<SerialPortInfo[]> {
    try {
      const ports = await window.electron.listSerialPorts();
      this.availablePorts = ports;

      // 如果当前选中的端口不再可用，清除选择
      if (this.selectedPort && !ports.some(port => port.path === this.selectedPort)) {
        this.selectedPort = "";
      }

      // 触发回调
      this.eventListeners.onPortsUpdated?.(ports);
      
      return ports;
    } catch (error) {
      console.error('Failed to refresh ports:', error);
      throw error;
    }
  }

  // 检查连接状态
  private async checkConnectionStatus(): Promise<void> {
    try {
      const status = await window.electron.getSerialConnectionStatus();
      this.connectionStatus = status;
      
      // 同步全局状态
      useAppConfigStore.getState().setSerialConnected(status.isConnected);
    } catch (error) {
      console.error('Failed to check connection status:', error);
    }
  }

  // 连接到指定端口
  public async connect(portPath?: string): Promise<boolean> {
    const targetPort = portPath || this.selectedPort;
    
    if (!targetPort) {
      const error = { error: "No port selected for connection", code: "NO_PORT" };
      this.eventListeners.onError?.(error);
      return false;
    }

    if (this.isConnecting) {
      console.warn('Connection already in progress');
      return false;
    }

    try {
      this.isConnecting = true;
      
      const connected = await window.electron.connectSerialPort(targetPort, this.config);
      
      if (connected) {
        this.selectedPort = targetPort;
        return true;
      } else {
        this.isConnecting = false;
        return false;
      }
    } catch (error) {
      this.isConnecting = false;
      const errorObj = { error: `Failed to connect to ${targetPort}: ${error}`, code: "CONNECT_FAILED" };
      this.eventListeners.onError?.(errorObj);
      return false;
    }
  }

  // 断开连接
  public async disconnect(): Promise<void> {
    try {
      await window.electron.disconnectSerialPort();
    } catch (error) {
      const errorObj = { error: `Failed to disconnect: ${error}`, code: "DISCONNECT_FAILED" };
      this.eventListeners.onError?.(errorObj);
      throw error;
    }
  }

  // 自动连接
  public async autoConnect(): Promise<boolean> {
    if (this.availablePorts.length === 0) {
      console.warn("No available ports to auto-connect");
      const error = { error: "No available ports for auto-connect", code: "NO_PORTS" };
      this.eventListeners.onError?.(error);
      return false;
    }

    for (const port of this.availablePorts) {
      console.log(`Attempting to connect to port: ${port.path}`);
      
      const connected = await this.connect(port.path);
      
      if (!connected) {
        continue;
      }

      // 发送握手信号
      try {
        await this.sendData("AA55030001000001A55A", true);
        
        // 等待响应
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // 检查连接是否成功建立
        if (this.isConnected()) {
          return true;
        }
        
        // 如果握手失败，断开连接
        await this.disconnect();
      } catch (error) {
        console.warn(`Handshake failed for port ${port.path}:`, error);
        await this.disconnect();
      }
    }

    return false;
  }

  // 发送数据
  public async sendData(data: string, isHex: boolean = false): Promise<void> {
    if (!this.connectionStatus.isConnected) {
      throw new Error("Serial port is not connected");
    }

    try {
      if (isHex) {
        await window.electron.sendSerialHexData(data);
      } else {
        await window.electron.sendSerialData(data);
      }
    } catch (error) {
      const errorObj = { error: `Failed to send data: ${error}`, code: "SEND_FAILED" };
      this.eventListeners.onError?.(errorObj);
      throw error;
    }
  }

  // 设置接收模式
  public async setReceiveMode(isHexMode: boolean): Promise<void> {
    try {
      await window.electron.setSerialReceiveMode(isHexMode);
    } catch (error) {
      console.error('Failed to set receive mode:', error);
      throw error;
    }
  }

  // 更新配置
  public updateConfig(config: Partial<SerialPortManagerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // 获取配置
  public getConfig(): SerialPortManagerConfig {
    return { ...this.config };
  }

  // 获取连接状态
  public getConnectionStatus(): SerialConnectionStatus {
    return { ...this.connectionStatus };
  }

  // 获取可用端口
  public getAvailablePorts(): SerialPortInfo[] {
    return [...this.availablePorts];
  }

  // 获取选中端口
  public getSelectedPort(): string {
    return this.selectedPort;
  }

  // 设置选中端口
  public setSelectedPort(portPath: string): void {
    this.selectedPort = portPath;
  }

  // 检查是否已连接
  public isConnected(): boolean {
    return this.connectionStatus.isConnected;
  }

  // 检查是否正在连接
  public isConnectingStatus(): boolean {
    return this.isConnecting;
  }

  // 添加事件监听器
  public addEventListener(events: Partial<SerialPortManagerEvents>): void {
    this.eventListeners = { ...this.eventListeners, ...events };
  }

  // 移除事件监听器
  public removeEventListener(): void {
    this.eventListeners = {};
  }

  // 清理资源
  public destroy(): void {
    // 清除electron事件监听器
    this.unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
    this.unsubscribeFunctions = [];
    
    // 清除事件监听器
    this.eventListeners = {};
    
    // 重置状态
    this.availablePorts = [];
    this.selectedPort = "";
    this.connectionStatus = { isConnected: false };
    this.isConnecting = false;
    
    console.log('SerialPortManager destroyed');
  }

  // 格式化十六进制字符串
  public static formatHexString(hexString: string): string {
    // 移除空格和其他分隔符，只保留十六进制字符
    const cleanHex = hexString.replace(/[^0-9A-Fa-f]/g, "");
    // 每两个字符之间添加空格
    return cleanHex.replace(/(.{2})/g, "$1 ").trim();
  }

  // 获取端口显示名称
  public static getPortDisplayName(port: SerialPortInfo): string {
    return (
      port.displayName ||
      `${port.path} ${port.friendlyName ? `(${port.friendlyName})` : ""}`
    );
  }
}

// 导出单例实例获取函数
export const getSerialPortManager = () => SerialPortManager.getInstance();
