// 协议解析模块测试示例

import { 
  protocolManager, 
  CountingProtocolData
} from '../protocols';
import { initializeProtocols } from './init';

// 测试协议解析功能
export function testProtocolParsing(): void {
  console.log('=== 协议解析模块测试 ===');
  
  // 初始化协议
  initializeProtocols();
  
  // 测试数据 - 模拟点钞机协议数据
  const testHexData = "FDDF2C0E010000001000000001000000000000000000434E5900000000000000000000000000000000000000000000000000000000000000000000000100A5";
  
  console.log('测试数据:', testHexData);
  console.log('支持的协议:', protocolManager.getSupportedProtocols());
  
  // 解析测试数据
  const result = protocolManager.parseData(testHexData, true) as CountingProtocolData;
  
  if (result) {
    console.log('解析成功:');
    console.log('- 协议类型:', result.protocolType);
    console.log('- 总张数:', result.totalCount);
    console.log('- 面额:', result.denomination);
    console.log('- 总金额:', result.totalAmount);
    console.log('- 状态:', result.status);
    console.log('- 序列号:', result.serialNumber);
    console.log('- 货币代码:', result.currencyCode);
  } else {
    console.log('解析失败');
  }
  
  console.log('=== 测试完成 ===');
}
