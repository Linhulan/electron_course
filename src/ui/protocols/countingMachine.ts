import { 
  ProtocolParser, 
  CountingProtocolData, 
  ProtocolStatus 
} from '../common/types';
import { 
  extractMultipleProtocols,
  hexStringToBytes,
  bytesToLittleEndianInt,
  bytesToString,
  validateProtocolHeader,
  cleanHexString
} from './utils';

/**
 * 点钞机协议解析器
 * 支持协议格式：FDDF + 长度 + CMD-G(0x0E) + 数据 + CRC
 */
export class CountingMachineParser implements ProtocolParser<CountingProtocolData> {
  private static readonly PROTOCOL_HEADER = [0xFD, 0xDF];
  private static readonly CMD_GROUP_COUNTING = 0x0E;
  private static readonly MIN_PACKET_LENGTH = 88; // 44字节 = 88个十六进制字符
  
  getProtocolName(): string {
    return "CountingMachine";
  }
  
  canHandle(hexData: string): boolean {
    const cleanHex = cleanHexString(hexData);
    
    // 检查最小长度
    if (cleanHex.length < CountingMachineParser.MIN_PACKET_LENGTH) {
      return false;
    }
    
    // 检查协议头
    if (!cleanHex.startsWith("FDDF")) {
      return false;
    }
    
    // 检查CMD-G字段（第4个字节）
    if (cleanHex.length >= 8) {
      const cmdGroup = parseInt(cleanHex.substr(6, 2), 16);
      return cmdGroup === CountingMachineParser.CMD_GROUP_COUNTING;
    }
    
    return false;
  }
    parse(hexData: string): CountingProtocolData | null {
    try {
      const cleanHex = cleanHexString(hexData);
      
      // 检查是否能处理该协议
      if (!this.canHandle(cleanHex)) {
        console.warn(`[${this.getProtocolName()}] Cannot handle this protocol data`);
        return null;
      }
      
      // 处理粘包情况：提取多个协议包
      const protocols = extractMultipleProtocols(cleanHex);
      
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
  
  private parseSingleProtocol(hexData: string): CountingProtocolData | null {
    try {
      const bytes = hexStringToBytes(hexData);
      const timestamp = new Date().toISOString();
      
      // 验证协议头
      if (!validateProtocolHeader(bytes, CountingMachineParser.PROTOCOL_HEADER)) {
        console.warn(`[${this.getProtocolName()}] Invalid protocol header:`, bytes[0], bytes[1]);
        return null;
      }
      
      // 验证CMD-G字段
      if (bytes[3] !== CountingMachineParser.CMD_GROUP_COUNTING) {
        console.warn(`[${this.getProtocolName()}] Not counting data CMD-G:`, bytes[3]);
        return null;
      }
      
      // 解析协议数据
      const totalCount = bytesToLittleEndianInt(bytes, 4, 4);
      const denomination = bytesToLittleEndianInt(bytes, 8, 4);
      const totalAmount = bytesToLittleEndianInt(bytes, 12, 8);
      
      // 解析货币代码和序列号
      const currencyCode = bytesToString(bytes, 20, 4);
      const serialNumber = bytesToString(bytes, 24, 11);
      
      return {
        timestamp,
        protocolType: this.getProtocolName(),
        rawData: hexData,
        check: [bytes[0], bytes[1]],
        length: bytes[2],
        cmdGroup: bytes[3],
        totalCount,
        denomination,
        totalAmount,
        currencyCode,
        serialNumber,
        reserved1: bytes.slice(35, 40),
        errorCode: bytes[40],
        status: bytes[41],
        reserved2: bytes[42],
        crc: bytes[43]
      };
    } catch (error) {
      console.error(`[${this.getProtocolName()}] Error parsing single protocol:`, error);
      return null;
    }
  }
}

/**
 * 状态码转换工具函数
 * @param status 协议状态码
 * @returns 业务状态
 */
export function getCountingStatus(status: number): "counting" | "completed" | "error" | "paused" {
  switch (status) {
    case ProtocolStatus.START_COUNTING:
      return "counting"; // 开始刷新
    case ProtocolStatus.COUNTING:
      return "counting"; // 刷新中
    case ProtocolStatus.COMPLETED:
      return "completed"; // 刷新完成
    case ProtocolStatus.COMPLETED_FULL:
      return "completed"; // 刷新完成，接钞满
    default:
      return "error";
  }
}

/**
 * 检查是否为Session开始协议
 */
export function isSessionStart(status: number): boolean {
  return status === ProtocolStatus.START_COUNTING;
}

/**
 * 检查是否为Session结束协议
 */
export function isSessionEnd(status: number): boolean {
  return status === ProtocolStatus.COMPLETED || status === ProtocolStatus.COMPLETED_FULL;
}

/**
 * 检查是否为更新协议（刷新中）
 */
export function isSessionUpdate(status: number): boolean {
  return status === ProtocolStatus.COUNTING;
}
