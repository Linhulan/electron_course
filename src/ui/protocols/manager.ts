import { 
  ProtocolManager, 
  ProtocolParser, 
  BaseProtocolData 
} from './types';
import { cleanHexString } from './utils';

/**
 * 协议管理器实现
 * 负责管理多个协议解析器并提供统一的解析接口
 */
export class ProtocolManagerImpl implements ProtocolManager {
  private parsers: Map<string, ProtocolParser<BaseProtocolData>> = new Map();
  
  /**
   * 注册协议解析器
   */
  registerParser<T extends BaseProtocolData>(parser: ProtocolParser<T>): void {
    const protocolName = parser.getProtocolName();
    // 类型断言，因为我们知道所有解析器都继承自BaseProtocolData
    this.parsers.set(protocolName, parser as ProtocolParser<BaseProtocolData>);
    console.log(`Protocol parser registered: ${protocolName}`);
  }
  
  /**
   * 解析数据 - 自动选择合适的解析器
   */
  parseData(hexData: string, isCompletePacket?: boolean): BaseProtocolData | null {
    const cleanHex = cleanHexString(hexData);
    
    if (!cleanHex) {
      console.warn('Empty hex data provided to protocol manager');
      return null;
    }
    
    // 尝试每个注册的解析器
    for (const [protocolName, parser] of this.parsers) {
      if (parser.canHandle(cleanHex)) {
        console.log(`Using parser: ${protocolName} for data: ${cleanHex.substring(0, 20)}...`);
        try {
          const result = parser.parse(cleanHex, isCompletePacket);
          if (result) {
            return result;
          }
        } catch (error) {
          console.error(`Error in parser ${protocolName}:`, error);
          continue; // 尝试下一个解析器
        }
      }
      else
      {
        console.log(`Parser ${protocolName} cannot handle data: ${cleanHex.substring(0, 20)}...`);
      }
    }
    
    console.warn(`No suitable parser found for data: ${cleanHex.substring(0, 20)}...`);
    return null;
  }
  
  /**
   * 获取支持的协议列表
   */
  getSupportedProtocols(): string[] {
    return Array.from(this.parsers.keys());
  }
    /**
   * 获取指定协议的解析器
   */
  getParser<T extends BaseProtocolData>(protocolName: string): ProtocolParser<T> | null {
    const parser = this.parsers.get(protocolName);
    return parser ? (parser as ProtocolParser<T>) : null;
  }
  
  /**
   * 移除协议解析器
   */
  unregisterParser(protocolName: string): boolean {
    const removed = this.parsers.delete(protocolName);
    if (removed) {
      console.log(`Protocol parser unregistered: ${protocolName}`);
    }
    return removed;
  }
  
  /**
   * 清空所有解析器
   */
  clearAllParsers(): void {
    const count = this.parsers.size;
    this.parsers.clear();
    console.log(`Cleared ${count} protocol parsers`);
  }
  
  /**
   * 获取解析器数量
   */
  getParserCount(): number {
    return this.parsers.size;
  }
}

// 创建全局协议管理器实例
export const protocolManager = new ProtocolManagerImpl();
