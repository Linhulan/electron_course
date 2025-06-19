// 协议解析相关的基础类型定义

// 通用协议解析接口
export interface ProtocolParser<T> {
  /**
   * 解析协议数据
   * @param hexData 十六进制数据字符串
   * @param isCompletePacket 是否为完整包
   * @returns 解析后的数据或null
   */
  parse(hexData: string, isCompletePacket?: boolean): T | null;
  
  /**
   * 获取协议名称
   */
  getProtocolName(): string;
  
  /**
   * 检查是否支持该协议
   * @param hexData 十六进制数据字符串
   */
  canHandle(hexData: string): boolean;
}

// 协议解析结果基础接口
export interface BaseProtocolData {
  timestamp: string;
  protocolType: string;
  rawData: string;
}

// 点钞机协议数据接口
export interface CountingProtocolData extends BaseProtocolData {
  check: number[]; // 0:1 CHECK: 0xFD 0xDF
  length: number; // 2 长度: 0x2C
  cmdGroup: number; // 3 CMD-G: 0x0E
  totalCount: number; // 4:7 总张数 (低位先行)
  denomination: number; // 8:11 面额
  totalAmount: number; // 12:19 总金额 (8字节)
  currencyCode: string; // 20:23 货币代码 (4位包含结束符号)
  serialNumber: string; // 24:34 SN (11位)
  reserved1: number[]; // 35:39 RESERVED
  errorCode: number; // 40 ErrCode
  status: number; // 41 状态位 0x00: 开始刷新； 0x01: 刷新中; 0x02: 刷新完成； 0x03: 刷新完成，接钞满；
  reserved2: number; // 42 RESERVED
  crc: number; // 43 CRC
}

// 协议管理器接口
export interface ProtocolManager {
  /**
   * 注册协议解析器
   */
  registerParser<T extends BaseProtocolData>(parser: ProtocolParser<T>): void;
  
  /**
   * 解析数据
   */
  parseData(hexData: string, isCompletePacket?: boolean): BaseProtocolData | null;
  
  /**
   * 获取支持的协议列表
   */
  getSupportedProtocols(): string[];
}

// 协议状态枚举
export enum ProtocolStatus {
  START_COUNTING = 0x00,    // 开始刷新
  COUNTING = 0x01,          // 刷新中
  COMPLETED = 0x02,         // 刷新完成
  COMPLETED_FULL = 0x03     // 刷新完成，接钞满
}

// 状态转换映射
export type CountingStatus = "counting" | "completed" | "error" | "paused";

// CDM协议数据接口
export interface CDMProtocolData extends BaseProtocolData {
  header: number[]; // 0:2 协议头: 0xFD 0xDF
  length: number; // 3 数据长度 (1字节)
  cmdGroup: number; // 4 CMD-G: 模式码 (1字节)
  data: number[]; // 5:n-1 数据部分
  crc: number; // n CRC校验 (1字节)
}

// CDM协议命令码枚举
export enum CDMCommandCode {
  // 设备状态相关
  DEVICE_STATUS = '01',
  DEVICE_INFO = '02', 
  RESET_DEVICE = '03',
  
  // 钞票处理相关
  COUNT_START = '10',
  COUNT_STOP = '11',
  COUNT_RESULT = '12',
  DENOMINATION_INFO = '13',
  
  // 故障诊断相关
  ERROR_STATUS = '20',
  SENSOR_STATUS = '21',
  MAINTENANCE_INFO = '22',
  
  // 配置相关
  SET_CONFIG = '30',
  GET_CONFIG = '31',
  CALIBRATION = '32',
  
  // 自定义扩展
  CUSTOM_01 = 'A1',
  CUSTOM_02 = 'A2',
  CUSTOM_03 = 'A3'
}

// CDM协议状态枚举
export enum CDMStatus {
  IDLE = 0x00,           // 空闲
  WORKING = 0x01,        // 工作中
  ERROR = 0x02,          // 错误
  MAINTENANCE = 0x03,    // 维护模式
  OFFLINE = 0x04         // 离线
}
