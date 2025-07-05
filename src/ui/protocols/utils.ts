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
 * 将字节数组转换为大端序整数
 * @param bytes 字节数组
 * @param startIndex 开始索引
 * @param length 字节长度
 * @returns 大端序整数值
 */
export function bytesToBigEndianInt(
  bytes: number[], 
  startIndex: number, 
  length: number
): number {
  let result = 0;
  const endIndex = startIndex + length;
  
  for (let i = startIndex; i < endIndex && i < bytes.length; i++) {
    result = (result << 8) | bytes[i];
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


/**
 * 雪花ID生成器类 - 支持多机器环境下的唯一ID生成
 * 基于Twitter的Snowflake算法
 * 64位ID结构：1位符号位 + 41位时间戳 + 5位数据中心ID + 5位机器ID + 12位序列号
 */
class SnowflakeIdGenerator {
  private sequence: number = 0;
  private lastTimestamp: number = -1;
  private readonly epoch: number = 1672531200000; // 2023-01-01 00:00:00 UTC
  private readonly machineId: number;
  private readonly datacenterId: number;
  
  // 各部分占用的位数
  private readonly machineIdBits: number = 5;
  private readonly datacenterIdBits: number = 5;
  private readonly sequenceBits: number = 12;
  
  // 各部分的最大值
  private readonly maxMachineId: number = (1 << this.machineIdBits) - 1; // 31
  private readonly maxDatacenterId: number = (1 << this.datacenterIdBits) - 1; // 31
  private readonly maxSequence: number = (1 << this.sequenceBits) - 1; // 4095
  
  // 各部分左移位数
  private readonly machineIdShift: number = this.sequenceBits; // 12
  private readonly datacenterIdShift: number = this.sequenceBits + this.machineIdBits; // 17
  private readonly timestampLeftShift: number = this.sequenceBits + this.machineIdBits + this.datacenterIdBits; // 22

  constructor(machineId?: number, datacenterId?: number) {
    // 如果没有提供机器ID，则基于本机特征生成
    this.machineId = machineId ?? this.generateMachineId();
    this.datacenterId = datacenterId ?? this.generateDatacenterId();
    
    if (this.machineId > this.maxMachineId || this.machineId < 0) {
      throw new Error(`机器ID必须在0到${this.maxMachineId}之间`);
    }
    
    if (this.datacenterId > this.maxDatacenterId || this.datacenterId < 0) {
      throw new Error(`数据中心ID必须在0到${this.maxDatacenterId}之间`);
    }
  }

  /**
   * 生成机器ID（基于本机特征）
   */
  private generateMachineId(): number {
    // 基于用户代理、屏幕分辨率、时区等生成机器标识
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';
    const platform = typeof navigator !== 'undefined' ? navigator.platform : 'unknown';
    const language = typeof navigator !== 'undefined' ? navigator.language : 'unknown';
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    const machineStr = `${userAgent}_${platform}_${language}_${timezone}`;
    let hash = 0;
    for (let i = 0; i < machineStr.length; i++) {
      const char = machineStr.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash) % (this.maxMachineId + 1);
  }

  /**
   * 生成数据中心ID（基于网络和硬件特征）
   */
  private generateDatacenterId(): number {
    // 基于屏幕分辨率、CPU核心数等生成数据中心标识
    const screen = typeof window !== 'undefined' && window.screen 
      ? `${window.screen.width}x${window.screen.height}` 
      : 'unknown';
    const cores = typeof navigator !== 'undefined' && 'hardwareConcurrency' in navigator
      ? navigator.hardwareConcurrency 
      : 1;
    const memory = typeof navigator !== 'undefined' && 'deviceMemory' in navigator
      ? (navigator as any).deviceMemory 
      : 0;
    
    const datacenterStr = `${screen}_${cores}_${memory}`;
    let hash = 0;
    for (let i = 0; i < datacenterStr.length; i++) {
      const char = datacenterStr.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash) % (this.maxDatacenterId + 1);
  }

  /**
   * 获取下一个时间戳（毫秒）
   */
  private getNextTimestamp(lastTimestamp: number): number {
    let timestamp = Date.now();
    while (timestamp <= lastTimestamp) {
      timestamp = Date.now();
    }
    return timestamp;
  }

  /**
   * 生成唯一ID
   */
  public generateId(): bigint {
    let timestamp = Date.now();

    // 时钟回拨检查
    if (timestamp < this.lastTimestamp) {
      throw new Error(`时钟回拨检测：当前时间${timestamp}小于上次时间${this.lastTimestamp}`);
    }

    // 同一毫秒内
    if (timestamp === this.lastTimestamp) {
      this.sequence = (this.sequence + 1) & this.maxSequence;
      // 序列号溢出，等待下一毫秒
      if (this.sequence === 0) {
        timestamp = this.getNextTimestamp(this.lastTimestamp);
      }
    } else {
      // 新的毫秒，序列号重置
      this.sequence = 0;
    }

    this.lastTimestamp = timestamp;

    // 组装ID：时间戳 | 数据中心ID | 机器ID | 序列号
    const id = BigInt(timestamp - this.epoch) << BigInt(this.timestampLeftShift) |
               BigInt(this.datacenterId) << BigInt(this.datacenterIdShift) |
               BigInt(this.machineId) << BigInt(this.machineIdShift) |
               BigInt(this.sequence);

    return id;
  }

  /**
   * 生成字符串格式的ID
   */
  public generateStringId(): string {
    return this.generateId().toString();
  }

  /**
   * 生成数字格式的ID（注意：可能丢失精度）
   */
  public generateNumberId(): number {
    const id = this.generateId();
    if (id > BigInt(Number.MAX_SAFE_INTEGER)) {
      console.warn('生成的ID超过了JavaScript安全整数范围，建议使用generateStringId()');
    }
    return Number(id);
  }

  /**
   * 获取当前实例的机器信息
   */
  public getMachineInfo(): { machineId: number; datacenterId: number } {
    return {
      machineId: this.machineId,
      datacenterId: this.datacenterId
    };
  }
}

// 创建全局实例
const snowflakeGenerator = new SnowflakeIdGenerator();

/**
 * 生成一个唯一的雪花ID（字符串格式，推荐）
 * @returns 生成一个唯一的雪花ID字符串
 * 该ID基于改进的雪花算法，支持多机器环境，确保全局唯一性
 */
export function generateSnowflakeId(): string {
  return snowflakeGenerator.generateStringId();
}

/**
 * 生成一个唯一的雪花ID（数字格式，兼容旧版本）
 * @returns 生成一个唯一的雪花ID数字
 * 注意：超过JavaScript安全整数范围时可能丢失精度，建议使用generateSnowflakeId()
 */
export function generateSnowflakeIdNumber(): number {
  return snowflakeGenerator.generateNumberId();
}

/**
 * 从Session ID生成显示用的Session编号
 */
export function generateSessionNoFromId(sessionId: string): number {
  // 对于雪花ID，取后6位并转换为数字，确保唯一性
  const lastDigits = sessionId.slice(-6);
  const numericPart = lastDigits.replace(/\D/g, ''); // 移除非数字字符
  return parseInt(numericPart) || Date.now() % 1000000;
}

/**
 * 创建自定义配置的雪花ID生成器
 * @param machineId 机器ID (0-31)
 * @param datacenterId 数据中心ID (0-31)
 * @returns 雪花ID生成器实例
 */
export function createSnowflakeGenerator(machineId?: number, datacenterId?: number): SnowflakeIdGenerator {
  return new SnowflakeIdGenerator(machineId, datacenterId);
}

/**
 * 获取当前机器的雪花ID生成器信息
 */
export function getSnowflakeGeneratorInfo(): { machineId: number; datacenterId: number } {
  return snowflakeGenerator.getMachineInfo();
}


/**
 * 开发模式下才输出日志
 */
export function debugLog(message: string, ...optionalParams: any[]): void {
  if (import.meta.env.DEV) {
    console.log(`[DEBUG] ${message}`, ...optionalParams);
  }
}

export function warningLog(message: string, ...optionalParams: any[]): void {
  if (import.meta.env.DEV) {
    console.warn(`[WARN] ${message}`, ...optionalParams);
  }
}