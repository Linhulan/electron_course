import { 
  ProtocolParser, 
  CDMProtocolData, 
  CDMCommandCode,
  CDMStatus
} from './types';
import { 
  hexStringToBytes,
  bytesToBigEndianInt,
  validateProtocolHeader,
  cleanHexString
} from './utils';

/**
 * CDM协议解析器
 * 支持协议格式：FDDF + 长度 + CMD-G(模式码) + 数据 + CRC
 */
export class CDMProtocolParser implements ProtocolParser<CDMProtocolData> {
  private static readonly PROTOCOL_HEADER = [0xFD, 0xDF];
  private static readonly MIN_PACKET_LENGTH = 16; // 8字节 = 16个十六进制字符 (最小包：头部4 + 长度2 + CMD-G2 + CRC2)
  
  getProtocolName(): string {
    return "CDMProtocol";
  }
  
  canHandle(hexData: string): boolean {
    const cleanHex = cleanHexString(hexData);
    
    // 检查最小长度
    if (cleanHex.length < CDMProtocolParser.MIN_PACKET_LENGTH) {
      return false;
    }
    
    // 检查协议头是否以FDDF开头
    if (!cleanHex.startsWith("FDDF")) {
      return false;
    }
    
    return true;
  }
  
  parse(hexData: string, isCompletePacket?: boolean): CDMProtocolData | null {
    try {
      console.log(`[${this.getProtocolName()}] Parsing data: ${hexData}`);
      const cleanHex = cleanHexString(hexData);
      
      // 如果不是完整包且数据较短，可能是分包，不进行解析
      if (!isCompletePacket && cleanHex.length < CDMProtocolParser.MIN_PACKET_LENGTH) {
        console.log(`[${this.getProtocolName()}] Incomplete packet detected, waiting for more data`);
        return null;
      }
      
      // 检查是否能处理该协议
      if (!this.canHandle(cleanHex)) {
        console.warn(`[${this.getProtocolName()}] Cannot handle this protocol data`);
        return null;
      }
      
      // 处理粘包情况：提取多个协议包
      const protocols = this.extractCDMProtocols(cleanHex);
      
      // 解析第一个有效的协议包
      for (const protocolHex of protocols) {
        const result = this.parseSingleProtocol(protocolHex);
        if (result) {
          return result;
        }
      }
      
      return null;
    } catch (error) {
      console.error(`[${this.getProtocolName()}] Error parsing protocol data:`, error);
      return null;
    }
  }
  
  /**
   * 提取CDM协议包
   */
  private extractCDMProtocols(hexData: string): string[] {
    const protocols: string[] = [];
    let position = 0;

    while (position < hexData.length) {
      // 查找协议头FDDF
      const headerIndex = hexData.indexOf("FDDF", position);
      if (headerIndex === -1) {
        break; // 没有找到更多协议头
      }

      // 检查是否有足够的数据来读取长度字段
      if (headerIndex + 8 >= hexData.length) {
        break;
      }

      // 读取长度字段（第5个字节，即位置 headerIndex + 8）
      const lengthHex = hexData.substr(headerIndex + 8, 2); // 1字节长度 = 2个十六进制字符
      const dataLength = parseInt(lengthHex, 16);
      const totalPacketLength = 8 + dataLength * 2; // FDDF(8) + 长度字段(2) + 数据长度*2

      // 检查是否有完整的协议包
      if (headerIndex + totalPacketLength <= hexData.length) {
        const protocolHex = hexData.substr(headerIndex, totalPacketLength);
        protocols.push(protocolHex);
        position = headerIndex + totalPacketLength;
      } else {
        // 不完整的包，停止处理
        break;
      }
    }

    // 如果没有找到完整的协议包，返回整个数据进行尝试解析
    if (protocols.length === 0) {
      protocols.push(hexData);
    }

    return protocols;
  }
  
  private parseSingleProtocol(hexData: string): CDMProtocolData | null {
    try {
      const bytes = hexStringToBytes(hexData);
      const timestamp = new Date().toISOString();
      console.log(`[${this.getProtocolName()}] Parsed bytes:`, bytes);
      
      // 验证最小长度 (FDDF + 长度 + CMD-G + CRC = 2 + 1 + 2 + 2 = 7字节最小)
      if (bytes.length < 7) {
        console.warn(`[${this.getProtocolName()}] Packet too short:`, bytes.length);
        return null;
      }
      
      // 验证协议头
      if (!validateProtocolHeader(bytes, CDMProtocolParser.PROTOCOL_HEADER)) {
        console.warn(`[${this.getProtocolName()}] Invalid protocol header:`, bytes[0], bytes[1]);
        return null;
      }
      
      // 解析长度字段（第3个字节，索引2）
      const dataLength = bytes[2];
      // 总长度 = 长度字段(1)
      const expectedTotalLength = dataLength;
      
      if (bytes.length < expectedTotalLength) {
        console.warn(`[${this.getProtocolName()}] Incomplete packet. Expected:`, expectedTotalLength, 'Got:', bytes.length);
        return null;
      }
      
      // 解析CMD-G（模式码，紧跟在长度字段后的2字节）
      // const cmdGroup = bytes.slice(3, 5).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join('');
      const cmdGroup = bytes[3];
      
      // 解析数据部分（CMD-G后到CRC前）
      const dataStart = 4;
      const dataEnd = bytes.length - 1;
      const data = bytes.slice(dataStart, dataEnd);
      
      // 解析CRC（最后1字节）
      const crc = bytes[bytes.length - 1];
      
      // 验证CRC
      if (!this.validateCRC(bytes.slice(0, bytes.length - 1), crc)) {
        console.warn(`[${this.getProtocolName()}] CRC validation failed`);
        // 注意：这里可以选择是否因为CRC错误而拒绝解析
      }
      
      return {
        timestamp,
        protocolType: this.getProtocolName(),
        rawData: hexData,
        header: [bytes[0], bytes[1]],
        length: dataLength,
        cmdGroup: cmdGroup,
        data: Array.from(data),
        crc: crc
      };
    } catch (error) {
      console.error(`[${this.getProtocolName()}] Error parsing single protocol:`, error);
      return null;
    }
  }
  
  /**
   * 验证CRC校验码
   */
  private validateCRC(data: number[], expectedCRC: number): boolean {
    const calculatedCRC = this.calculateCRC(data);
    return calculatedCRC === expectedCRC;
  }
  
  /**
   * 计算CRC校验码（使用CRC-16-CCITT算法）
   */
  private calculateCRC(data: number[]): number {
    let crc = 0x00;
    
    for (const byte of data) {
      crc ^= byte;
      for (let i = 0; i < 8; i++) {
        if (crc & 0x80) {
          crc = (crc << 1) ^ 0x31;
        } else {
          crc = crc << 1;
        }
      }
    }

    return crc & 0xFF;
  }
}

/**
 * CDM协议数据处理工具函数
 */

// 计数结果数据接口
interface CountResultData {
  totalCount: number;
  denomination: number;
  amount: number;
  status: string;
  mode: number;
  timestamp: string;
  error?: string;
}

// 设备状态数据接口
interface DeviceStatusData {
  online: boolean;
  ready: boolean;
  counting: boolean;
  hasError: boolean;
  mode: number;
  temperature: number;
  rawStatus: number;
  error?: string;
}

// 错误状态数据接口
interface ErrorStatusData {
  errorCode: number;
  errorCodeHex: string;
  errors: string[];
  hasError: boolean;
  error?: string;
}

/**
 * 获取CDM命令名称
 */
export function getCDMCommandName(cmdGroup: string): string {
  const commandNames: Record<string, string> = {
    [CDMCommandCode.DEVICE_STATUS]: '设备状态查询',
    [CDMCommandCode.DEVICE_INFO]: '设备信息查询',
    [CDMCommandCode.RESET_DEVICE]: '设备复位',
    [CDMCommandCode.COUNT_START]: '开始计数',
    [CDMCommandCode.COUNT_STOP]: '停止计数',
    [CDMCommandCode.COUNT_RESULT]: '计数结果',
    [CDMCommandCode.DENOMINATION_INFO]: '面额信息',
    [CDMCommandCode.ERROR_STATUS]: '错误状态',
    [CDMCommandCode.SENSOR_STATUS]: '传感器状态',
    [CDMCommandCode.MAINTENANCE_INFO]: '维护信息',
    [CDMCommandCode.SET_CONFIG]: '设置配置',
    [CDMCommandCode.GET_CONFIG]: '获取配置',
    [CDMCommandCode.CALIBRATION]: '校准操作',
    [CDMCommandCode.CUSTOM_01]: '自定义命令01',
    [CDMCommandCode.CUSTOM_02]: '自定义命令02',
    [CDMCommandCode.CUSTOM_03]: '自定义命令03'
  };
  
  return commandNames[cmdGroup] || `未知命令(${cmdGroup})`;
}

/**
 * 解析计数结果数据
 */
export function parseCountResultData(data: number[]): CountResultData {
  if (data.length < 8) {
    return { 
      totalCount: 0,
      denomination: 0,
      amount: 0,
      status: '未知',
      mode: 0,
      timestamp: new Date().toISOString(),
      error: '计数结果数据长度不足' 
    };
  }

  // 假设数据格式：总数(4字节) + 面额(2字节) + 状态(1字节) + 模式(1字节)
  const totalCount = (data[0] << 24) | (data[1] << 16) | (data[2] << 8) | data[3];
  const denomination = (data[4] << 8) | data[5];
  const status = data[6];
  const mode = data[7];

  return {
    totalCount,
    denomination,
    amount: totalCount * denomination,
    status: getStatusName(status),
    mode,
    timestamp: new Date().toISOString()
  };
}

/**
 * 解析设备状态数据
 */
export function parseDeviceStatusData(data: number[]): DeviceStatusData {
  if (data.length < 4) {
    return { 
      online: false,
      ready: false,
      counting: false,
      hasError: true,
      mode: 0,
      temperature: 0,
      rawStatus: 0,
      error: '设备状态数据长度不足' 
    };
  }

  const statusByte = data[0];
  const modeByte = data[1];
  const temperature = (data[2] << 8) | data[3];
  return {
    online: (statusByte & 0x01) !== 0,
    ready: (statusByte & 0x02) !== 0,
    counting: (statusByte & 0x04) !== 0,
    hasError: (statusByte & 0x08) !== 0,
    mode: modeByte,
    temperature: temperature / 10, // 假设温度是十倍值
    rawStatus: statusByte
  };
}

/**
 * 解析错误状态数据
 */
export function parseErrorStatusData(data: number[]): ErrorStatusData {
  if (data.length < 2) {
    return { 
      errorCode: 0,
      errorCodeHex: '0x0000',
      errors: [],
      hasError: true,
      error: '错误状态数据长度不足' 
    };
  }

  const errorCode = (data[0] << 8) | data[1];
  const errorMessages: Record<number, string> = {
    0x0001: '纸币卡塞',
    0x0002: '传感器故障',
    0x0004: '电机故障',
    0x0008: '通信异常',
    0x0010: '校准错误',
    0x0020: '温度异常',
    0x0040: '电源故障',
    0x0080: '机械故障'
  };

  const activeErrors: string[] = [];
  for (const [code, message] of Object.entries(errorMessages)) {
    if (errorCode & parseInt(code)) {
      activeErrors.push(message);
    }
  }

  return {
    errorCode: errorCode,
    errorCodeHex: `0x${errorCode.toString(16).padStart(4, '0').toUpperCase()}`,
    errors: activeErrors,
    hasError: activeErrors.length > 0
  };
}

/**
 * 获取状态名称
 */
function getStatusName(status: number): string {
  switch (status) {
    case CDMStatus.IDLE:
      return "空闲";
    case CDMStatus.WORKING:
      return "工作中";
    case CDMStatus.ERROR:
      return "错误";
    case CDMStatus.MAINTENANCE:
      return "维护模式";
    case CDMStatus.OFFLINE:
      return "离线";
    default:
      return `未知状态(${status})`;
  }
}
