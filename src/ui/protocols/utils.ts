// 协议解析工具函数

/**
 * 从十六进制字符串中提取多个协议包
 * @param hexData 十六进制数据字符串
 * @param protocolHeader 协议头标识 (默认为 "FDDF")
 * @returns 提取的协议包数组
 */
export function extractMultipleProtocols(
  hexData: string, 
  protocolHeader: string = "FDDF"
): string[] {
  const protocols: string[] = [];
  let position = 0;

  while (position < hexData.length) {
    // 查找协议头
    const headerIndex = hexData.indexOf(protocolHeader, position);
    if (headerIndex === -1) {
      break; // 没有找到更多协议头
    }

    // 检查是否有足够的数据来读取长度字段
    if (headerIndex + 4 >= hexData.length) {
      break;
    }

    // 读取长度字段（第3个字节，即位置 headerIndex + 4 和 headerIndex + 5）
    const lengthHex = hexData.substr(headerIndex + 4, 2);
    const packetLength = parseInt(lengthHex, 16);
    const totalPacketLength = (packetLength + 4) * 2; // 转换为十六进制字符数

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

/**
 * 将十六进制字符串转换为字节数组
 * @param hexString 十六进制字符串
 * @returns 字节数组
 */
export function hexStringToBytes(hexString: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < hexString.length; i += 2) {
    bytes.push(parseInt(hexString.substr(i, 2), 16));
  }
  return bytes;
}

/**
 * 字节数组转换为小端序整数
 * @param bytes 字节数组
 * @param startIndex 开始索引
 * @param length 字节长度
 * @returns 整数值
 */
export function bytesToLittleEndianInt(
  bytes: number[], 
  startIndex: number, 
  length: number
): number {
  let result = 0;
  for (let i = 0; i < length; i++) {
    result += bytes[startIndex + i] * Math.pow(256, i);
  }
  return result;
}

/**
 * 从字节数组中提取字符串（过滤空字节）
 * @param bytes 字节数组
 * @param startIndex 开始索引
 * @param length 字节长度
 * @returns 字符串
 */
export function bytesToString(
  bytes: number[], 
  startIndex: number, 
  length: number
): string {
  const stringBytes = bytes.slice(startIndex, startIndex + length);
  return String.fromCharCode(...stringBytes.filter(b => b !== 0));
}

/**
 * 验证协议头
 * @param bytes 字节数组
 * @param expectedHeader 期望的协议头字节
 * @returns 是否匹配
 */
export function validateProtocolHeader(
  bytes: number[], 
  expectedHeader: number[]
): boolean {
  if (bytes.length < expectedHeader.length) {
    return false;
  }
  
  for (let i = 0; i < expectedHeader.length; i++) {
    if (bytes[i] !== expectedHeader[i]) {
      return false;
    }
  }
  
  return true;
}

/**
 * 清理十六进制字符串（移除空格并转换为大写）
 * @param hexString 原始十六进制字符串
 * @returns 清理后的字符串
 */
export function cleanHexString(hexString: string): string {
  return hexString.replace(/\s+/g, "").toUpperCase();
}

/**
 * 计算简单的校验和
 * @param bytes 字节数组
 * @param startIndex 开始索引
 * @param length 计算长度
 * @returns 校验和
 */
export function calculateChecksum(
  bytes: number[], 
  startIndex: number = 0, 
  length?: number
): number {
  const endIndex = length ? startIndex + length : bytes.length;
  let checksum = 0;
  
  for (let i = startIndex; i < endIndex; i++) {
    checksum ^= bytes[i]; // XOR校验
  }
  
  return checksum;
}
