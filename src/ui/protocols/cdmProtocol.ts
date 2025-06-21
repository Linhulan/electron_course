import { 
  ProtocolParser, 
  CDMCommandCode,
  BaseProtocolData,
  CountingProtocolData
} from './types';
import { 
  hexStringToBytes,
  validateProtocolHeader,
  cleanHexString,
  bytesToLittleEndianInt,
  bytesToString
} from './utils';

/**
 * CDM协议解析器
 * 支持协议格式：FDDF + 长度 + CMD-G(模式码) + 数据 + CRC
 */
export class CDMProtocolParser implements ProtocolParser<BaseProtocolData[]> {
  private static readonly PROTOCOL_HEADER = [0xFD, 0xDF];
  private static readonly PROTOCOL_HEADER_STR = "FDDF";
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
    if (!cleanHex.startsWith(CDMProtocolParser.PROTOCOL_HEADER_STR)) {
      return false;
    }
    
    return true;
  }  
  
  parse(hexData: string): BaseProtocolData[] | null {
    try {
      // console.log(`[${this.getProtocolName()}] Parsing data: ${hexData}`);
      const cleanHex = cleanHexString(hexData);
      const results: BaseProtocolData[] = [];
      
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
          results.push(result);
        }
      }

      return results.length > 0 ? results : null;

    } catch (error) {
      console.error(`[${this.getProtocolName()}] Error parsing protocol data:`, error);
      return null;
    }
  }
  
  /**
   * 提取协议包
   * @param hexData 十六进制数据字符串
   * @returns 提取到的协议包数组
   */
  private extractCDMProtocols(hexData: string): string[] {
    const protocols: string[] = [];
    let position = 0;

    while (position < hexData.length) {
      // 查找协议头
      const headerIndex = hexData.indexOf(CDMProtocolParser.PROTOCOL_HEADER_STR, position);
      if (headerIndex === -1) {
        break; // 没有找到更多协议头
      }

      // 检查是否有足够的数据来读取长度字段
      if (headerIndex + 4 >= hexData.length) {
        break;
      }

      // 读取长度字段（第5个字节，即位置 headerIndex + 4）
      const lengthHex = hexData.substr(headerIndex + 4, 2); // 1字节长度 = 2个十六进制字符
      const dataLength = parseInt(lengthHex, 16);
      const totalPacketLength = dataLength * 2; // 数据长度*2

      // 检查是否有完整的协议包
      if (totalPacketLength <= hexData.length) {
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
  
  /**
   * 解析单个CDM协议包
   * 解析格式：FDDF + 长度 + CMD-G(模式码) + 数据 + CRC
   * 转换为字节数组后进行验证和解析。
   * 
   * 验证步骤：
   * 1. 验证协议头是否为FDDF
   * 2. 验证长度字段是否正确
   * 3. 验证CMD-G字段
   * 4. 验证CRC校验码
   * 
   * @param hexData 十六进制数据字符串
   * @returns 解析后的协议数据或null
   */
  private parseSingleProtocol(hexData: string): BaseProtocolData | null {
    try {
      const bytes = hexStringToBytes(hexData);
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
        return null;
      }

      const parsedData = this.parseDataByCmdGroup(cmdGroup, data);
      return parsedData;

    } catch (error) {
      console.error(`[${this.getProtocolName()}] Error parsing single protocol:`, error);
      return null;
    }
  }
  
  private parseDataByCmdGroup(cmdGroup: number, data: number[]): BaseProtocolData | null {
    console.log(`[${this.getProtocolName()}] Parsing data by CMD-G: ${cmdGroup}`, data);
    switch (cmdGroup) {
      case CDMCommandCode.COUNT_RESULT:
        return this.parseCountResultData(data);
      default:
        return null;
    }
  }

  /**
   * 解析计数结果数据
   */
  private parseCountResultData(data: number[]): CountingProtocolData {
  
  // 假设数据格式：总数(4字节) + 面额(2字节) + 状态(1字节) + 模式(1字节)
  // 解析协议数据
  const totalCount = bytesToLittleEndianInt(data, 0, 4);
  const denomination = bytesToLittleEndianInt(data, 4, 4);
  const totalAmount = bytesToLittleEndianInt(data, 8, 8);
  
  // 解析货币代码和序列号
  const currencyCode = bytesToString(data, 16, 4);
  const serialNumber = bytesToString(data, 20, 11);

  return {
    timestamp: new Date().toLocaleString(),
    protocolType: this.getProtocolName(),
    rawData: data.map(byte => byte.toString(16).padStart(2, '0')).join(' '),
    totalCount,
    denomination,
    totalAmount,
    currencyCode,
    serialNumber,
    reserved1: data.slice(31, 36),
    errorCode: data[36],
    status: data[37],
    reserved2: data[38],
  };
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
 * 获取CDM命令名称
 */
export function getCDMCommandName(cmdGroup: number): string {
  const commandNames: Record<number, string> = {
    [CDMCommandCode.COUNT_RESULT]: '计数结果',
  };
  
  return commandNames[cmdGroup] || `未知命令(${cmdGroup})`;
}
