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
  private handshakeTimeout: number | null = null;

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
  public async disconnect(): Promise<boolean> {
    try {
      await window.electron.disconnectSerialPort();
      return true;
    } catch (error) {
      const errorObj = { error: `Failed to disconnect: ${error}`, code: "DISCONNECT_FAILED" };
      this.eventListeners.onError?.(errorObj);
      return false;
    }
  }

  // 自动连接
  public async autoConnect(): Promise<boolean> {
    this.refreshPorts(); // 确保端口列表是最新的

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

      // 发送握手信号并等待响应
      try {
        const handshakeSuccess = await this.performHandshake();
        
        if (handshakeSuccess) {
          console.log(`Successfully connected and handshake with port: ${port.path}`);
          return true;
        }
        
        // 如果握手失败，断开连接
        console.warn(`Handshake failed for port: ${port.path}`);
        await this.disconnect();
      } catch (error) {
        console.warn(`Handshake failed for port ${port.path}:`, error);
        await this.disconnect();
      }
    }

    return false;
  }

  // 执行握手验证
  private async performHandshake(): Promise<boolean> {
    return new Promise((resolve) => {
      let sendTaskID: number | null = null;
      let sendCount = 0;
      const maxSendCount = 3;

      if (this.handshakeTimeout) {
        clearTimeout(this.handshakeTimeout);
      }

      // 清理资源的通用函数
      const cleanup = () => {
        if (this.handshakeTimeout) {
          clearTimeout(this.handshakeTimeout);
          this.handshakeTimeout = null;
        }
        if (sendTaskID) {
          clearInterval(sendTaskID);
          sendTaskID = null;
        }
      };

      // 设置握手超时
      this.handshakeTimeout = window.setTimeout(() => {
        console.warn("Handshake timeout");
        cleanup();
        resolve(false);
      }, 500);

      // 临时监听数据以检测握手响应
      const tempUnsubscribe = window.electron.onSerialDataReceived((data: SerialDataReceived) => {
        if (data.hexData && this.isHandshakeResponse(data.hexData)) {
          console.log("Handshake response received:", data.hexData);
          cleanup();
          tempUnsubscribe();
          resolve(true);
        }
      });

      // 发送3次握手信号, 每次间隔100ms
      sendTaskID = window.setInterval(() => {
        sendCount++;
        
        this.sendData("AA55030001000001A55A", true).catch((error) => {
          console.error("Failed to send handshake data:", error);
          cleanup();
          tempUnsubscribe();
          resolve(false);
        });

        // 发送完3次后停止发送
        if (sendCount >= maxSendCount) {
          if (sendTaskID) {
            clearInterval(sendTaskID);
            sendTaskID = null;
          }
        }
      }, 100);
    });
  }

  // 检查是否为握手响应
  private isHandshakeResponse(hexData: string): boolean {
    // 移除空格并转换为大写
    const cleanHex = hexData.replace(/\s+/g, '').toUpperCase();
    
    // 预期的握手响应特征码 - 修正后的格式
    const expectedResponsePattern = 'AA55030001000001A55A';
    
    // 检查是否包含完整的握手响应特征
    if (cleanHex.includes(expectedResponsePattern)) {
      console.log(`Valid handshake response detected: ${cleanHex}`);
      return true;
    }
    
    // 也可以检查其他可能的响应格式（如果设备有不同的响应格式）
    // 例如可能的变体格式
    const alternativePatterns = [
      'AA55030001000001A55A',  // 标准格式
      // 可以根据实际协议添加其他可能的响应格式
    ];
    
    for (const pattern of alternativePatterns) {
      if (cleanHex.includes(pattern)) {
        console.log(`Alternative handshake response detected: ${cleanHex}`);
        return true;
      }
    }
    
    // 记录未识别的数据用于调试
    console.log(`Unrecognized data during handshake: ${cleanHex}`);
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
  public getConnectionStatus(): SerialConnectionStatus & { isConnecting: boolean } {
    return {
      ...this.connectionStatus,
      isConnecting: this.isConnecting
    };
  }

  // 获取可用端口列表
  public getAvailablePorts(): SerialPortInfo[] {
    return [...this.availablePorts];
  }

  // 获取选中的端口
  public getSelectedPort(): string {
    return this.selectedPort;
  }

  // 设置选中的端口
  public setSelectedPort(portPath: string): void {
    this.selectedPort = portPath;
  }

  // 检查是否已连接
  public isConnected(): boolean {
    return this.connectionStatus.isConnected;
  }

  // 添加事件监听器
  public addEventListener(listeners: SerialPortManagerEvents): void {
    this.eventListeners = { ...this.eventListeners, ...listeners };
  }

  // 移除事件监听器
  public removeEventListener(): void {
    this.eventListeners = {};
  }

  // 重置连接状态
  public resetConnectionState(): void {
    this.isConnecting = false;
    this.connectionStatus = { isConnected: false };
    this.selectedPort = "";
    
    // 清理握手超时
    if (this.handshakeTimeout) {
      clearTimeout(this.handshakeTimeout);
      this.handshakeTimeout = null;
    }
    
    // 更新全局状态
    useAppConfigStore.getState().setSerialConnected(false);
    
    // 触发状态变化事件
    this.eventListeners.onConnectionStateChanged?.(false);
  }

  // 安全断开连接（包含重试机制）
  public async safeDisconnect(maxRetries: number = 3): Promise<void> {
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        await this.disconnect();
        console.log('Successfully disconnected');
        return;
      } catch (error) {
        retryCount++;
        console.warn(`Disconnect attempt ${retryCount} failed:`, error);
        
        if (retryCount >= maxRetries) {
          console.error('Failed to disconnect after multiple attempts');
          // 强制重置状态
          this.resetConnectionState();
          throw new Error(`Failed to disconnect after ${maxRetries} attempts`);
        }
        
        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }

  // 检查设备是否还在响应
  public async isDeviceResponding(): Promise<boolean> {
    if (!this.connectionStatus.isConnected) {
      return false;
    }

    try {
      // 发送一个测试命令并等待响应
      const responseReceived = await this.performHandshake();
      return responseReceived;
    } catch (error) {
      console.warn('Device responsiveness check failed:', error);
      return false;
    }
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
    if (this.handshakeTimeout) {
      clearTimeout(this.handshakeTimeout);
      this.handshakeTimeout = null;
    }
    
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
