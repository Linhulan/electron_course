// CDM协议使用示例和测试

import { CDMProtocolParser, getCDMCommandName, parseCountResultData, parseDeviceStatusData, parseErrorStatusData } from './cdmProtocol';
import { CDMCommandCode } from './types';

/**
 * CDM协议使用示例类
 */
export class CDMProtocolExample {
  private parser = new CDMProtocolParser();

  /**
   * 示例：解析CDM协议数据
   */
  demonstrateParsingExample(): void {
    console.log('=== CDM协议解析示例 ===');

    // 示例1: 解析计数结果
    const countResultHex = this.createCountResultExample();
    console.log('计数结果数据:', countResultHex);
    this.parseAndDisplay(countResultHex);

    // 示例2: 解析设备状态
    const statusHex = this.createDeviceStatusExample();
    console.log('设备状态数据:', statusHex);
    this.parseAndDisplay(statusHex);

    // 示例3: 解析错误状态
    const errorHex = this.createErrorStatusExample();
    console.log('错误状态数据:', errorHex);
    this.parseAndDisplay(errorHex);
  }

  /**
   * 解析并显示数据
   */
  private parseAndDisplay(hexData: string): void {
    if (this.parser.canHandle(hexData)) {
      const result = this.parser.parse(hexData, true);
      if (result) {
        console.log('解析结果:', {
          协议类型: result.protocolType,
          时间戳: result.timestamp,
          命令码: result.cmdGroup,
          命令名称: getCDMCommandName(result.cmdGroup),
          数据长度: result.length,
          原始数据: result.rawData
        });

        // 根据命令码解析具体数据
        this.parseSpecificData(result.cmdGroup, result.data);
      } else {
        console.log('解析失败');
      }
    } else {
      console.log('无法处理该协议数据');
    }
    console.log('---');
  }
  /**
   * 根据命令码解析具体数据
   */
  private parseSpecificData(cmdGroup: string, data: number[]): void {
    switch (cmdGroup) {
      case CDMCommandCode.COUNT_RESULT: {
        const countResult = parseCountResultData(data);
        console.log('计数结果详情:', countResult);
        break;
      }
      
      case CDMCommandCode.DEVICE_STATUS: {
        const deviceStatus = parseDeviceStatusData(data);
        console.log('设备状态详情:', deviceStatus);
        break;
      }
      
      case CDMCommandCode.ERROR_STATUS: {
        const errorStatus = parseErrorStatusData(data);
        console.log('错误状态详情:', errorStatus);
        break;
      }
      
      default:
        console.log('数据:', data.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
    }
  }

  /**
   * 创建计数结果示例数据
   */
  private createCountResultExample(): string {
    // 构建CDM协议包：FDDF + 长度 + CMD-G + 数据 + CRC
    const header = 'FDDF0000'; // FDDF + 2字节占位符
    const length = '000A'; // 数据长度：10字节 (CMD-G 2字节 + 数据 6字节 + CRC 2字节)
    const cmdG = CDMCommandCode.COUNT_RESULT; // 12
    const data = '000005DC0064010'; // 总数1500(0x05DC) + 面额100(0x0064) + 状态1 + 模式0
    const crc = '1234'; // 示例CRC（实际应用中需要正确计算）
    
    return header.substring(0, 4) + length + cmdG + data + crc;
  }

  /**
   * 创建设备状态示例数据
   */
  private createDeviceStatusExample(): string {
    const header = 'FDDF';
    const length = '0008'; // 8字节：CMD-G(2) + 数据(4) + CRC(2)
    const cmdG = CDMCommandCode.DEVICE_STATUS; // 01
    const data = '0701'; // 状态字节：在线+就绪+计数中 + 模式1
    const temperature = '00FA'; // 温度25.0°C (250/10)
    const crc = '5678'; // 示例CRC
    
    return header + length + cmdG + data + temperature + crc;
  }

  /**
   * 创建错误状态示例数据
   */
  private createErrorStatusExample(): string {
    const header = 'FDDF';
    const length = '0006'; // 6字节：CMD-G(2) + 数据(2) + CRC(2)
    const cmdG = CDMCommandCode.ERROR_STATUS; // 20
    const errorCode = '0003'; // 错误码：纸币卡塞 + 传感器故障
    const crc = '9ABC'; // 示例CRC
    
    return header + length + cmdG + errorCode + crc;
  }

  /**
   * 演示命令码扩展
   */
  demonstrateCommandExtension(): void {
    console.log('\n=== CDM命令码扩展示例 ===');
    
    // 显示所有支持的命令码
    const allCommands = Object.values(CDMCommandCode);
    console.log('支持的命令码:');
    allCommands.forEach(cmd => {
      console.log(`  ${cmd}: ${getCDMCommandName(cmd)}`);
    });

    // 演示自定义命令
    const customHex = this.createCustomCommandExample();
    console.log('\n自定义命令示例:', customHex);
    this.parseAndDisplay(customHex);
  }

  /**
   * 创建自定义命令示例
   */
  private createCustomCommandExample(): string {
    const header = 'FDDF';
    const length = '0008'; // 8字节
    const cmdG = CDMCommandCode.CUSTOM_01; // A1
    const customData = '1234ABCD'; // 自定义数据
    const crc = 'DEF0'; // 示例CRC
    
    return header + length + cmdG + customData + crc;
  }

  /**
   * 演示多包数据处理
   */
  demonstrateMultiPacketParsing(): void {
    console.log('\n=== 多包数据处理示例 ===');
    
    // 创建包含多个CDM协议包的数据
    const packet1 = this.createCountResultExample();
    const packet2 = this.createDeviceStatusExample();
    const multiPacketData = packet1 + packet2;
    
    console.log('多包数据:', multiPacketData);
    console.log('数据长度:', multiPacketData.length);
    
    // 解析多包数据（注意：当前解析器处理第一个包）
    this.parseAndDisplay(multiPacketData);
  }

  /**
   * 运行所有示例
   */
  runAllExamples(): void {
    this.demonstrateParsingExample();
    this.demonstrateCommandExtension();
    this.demonstrateMultiPacketParsing();
  }
}

/**
 * CDM协议构建器示例
 */
export class CDMCommandBuilder {
  private readonly HEADER = 'FDDF';

  /**
   * 构建CDM命令包
   */
  buildCommand(cmdG: string, data: string = ''): string {
    const dataLength = (data.length / 2) + 4; // 数据字节数 + CMD-G(2) + CRC(2)
    const length = dataLength.toString(16).padStart(4, '0').toUpperCase();
    const payload = this.HEADER + length + cmdG + data;
    
    // 简单CRC计算（实际应用中应使用正确的CRC算法）
    const crc = this.calculateSimpleCRC(payload);
    
    return payload + crc;
  }

  /**
   * 构建设备状态查询命令
   */
  buildDeviceStatusQuery(): string {
    return this.buildCommand(CDMCommandCode.DEVICE_STATUS);
  }

  /**
   * 构建开始计数命令
   */
  buildStartCountCommand(mode: number = 0): string {
    const modeHex = mode.toString(16).padStart(2, '0');
    return this.buildCommand(CDMCommandCode.COUNT_START, modeHex);
  }

  /**
   * 构建停止计数命令
   */
  buildStopCountCommand(): string {
    return this.buildCommand(CDMCommandCode.COUNT_STOP);
  }

  /**
   * 构建设备复位命令
   */
  buildResetCommand(): string {
    return this.buildCommand(CDMCommandCode.RESET_DEVICE);
  }

  /**
   * 简单CRC计算（示例）
   */
  private calculateSimpleCRC(data: string): string {
    let crc = 0;
    for (let i = 0; i < data.length; i += 2) {
      const byte = parseInt(data.substr(i, 2), 16);
      crc ^= byte;
    }
    return crc.toString(16).padStart(4, '0').toUpperCase();
  }

  /**
   * 演示命令构建
   */
  demonstrateCommandBuilding(): void {
    console.log('\n=== CDM命令构建示例 ===');
    
    console.log('设备状态查询:', this.buildDeviceStatusQuery());
    console.log('开始计数命令:', this.buildStartCountCommand(1));
    console.log('停止计数命令:', this.buildStopCountCommand());
    console.log('设备复位命令:', this.buildResetCommand());
  }
}

/**
 * 运行CDM协议示例
 */
export function runCDMExamples(): void {
  console.log('🚀 CDM协议示例开始');
  
  const example = new CDMProtocolExample();
  example.runAllExamples();
  
  const builder = new CDMCommandBuilder();
  builder.demonstrateCommandBuilding();
  
  console.log('✅ CDM协议示例完成');
}

// 如果直接运行此文件，执行示例
if (typeof window === 'undefined') {
  runCDMExamples();
}
