import { 
  ProtobufSerializationService, 
  SessionData,
  DenominationDetail 
} from './serialization';

// 使用示例和性能测试
export class SerializationUsageExample {
  private static protobufService = new ProtobufSerializationService();

  /**
   * 创建示例SessionData
   */
  static createSampleSessionData(): SessionData {
    const denominationBreakdown = new Map<number, DenominationDetail>();
    denominationBreakdown.set(100, { denomination: 100, count: 50, amount: 5000 });
    denominationBreakdown.set(50, { denomination: 50, count: 30, amount: 1500 });
    denominationBreakdown.set(20, { denomination: 20, count: 25, amount: 500 });
    denominationBreakdown.set(10, { denomination: 10, count: 20, amount: 200 });

    return {
      id: 1001,
      no: 1,
      timestamp: new Date().toLocaleTimeString(),
      startTime: new Date().toLocaleString(),
      endTime: new Date(Date.now() + 300000).toLocaleString(),
      machineMode: "AUTO",
      totalCount: 125,
      totalAmount: 7200,
      errorCount: 0,
      status: "completed",
      errorCode: undefined,
      denominationBreakdown,
      details: [
        {
          id: 1,
          no: 1,
          timestamp: new Date().toLocaleTimeString(),
          currencyCode: "CNY",
          denomination: 100,
          status: "completed",
          serialNumber: "ABC123456789"
        },
        {
          id: 2,
          no: 2,
          timestamp: new Date().toLocaleTimeString(),
          currencyCode: "CNY",
          denomination: 50,
          status: "completed",
          serialNumber: "DEF987654321"
        }
      ]
    };
  }  /**
   * 序列化示例
   */
  static async demonstrateBasicSerialization(): Promise<void> {
    console.log('=== Protobuf 序列化示例 ===');
    
    const sessionData = this.createSampleSessionData();
    console.log('原始数据:', sessionData);

    try {
      // 序列化为二进制
      const binaryData = this.protobufService.serializeSessionData(sessionData);
      console.log('序列化后的二进制数据大小:', binaryData.length, '字节');

      // 序列化为Base64字符串
      const base64Data = this.protobufService.serializeSessionDataToBase64(sessionData);
      console.log('Base64序列化数据长度:', base64Data.length, '字符');
      console.log('Base64数据预览:', base64Data.substring(0, 100) + '...');

      // 反序列化
      const deserializedData = this.protobufService.deserializeSessionDataFromBase64(base64Data);
      console.log('反序列化后的数据:', deserializedData);

      // 验证数据完整性
      const isDataIntact = JSON.stringify({
        ...sessionData,
        denominationBreakdown: Array.from(sessionData.denominationBreakdown.entries())
      }) === JSON.stringify({
        ...deserializedData,
        denominationBreakdown: Array.from(deserializedData.denominationBreakdown.entries())
      });
      
      console.log('数据完整性验证:', isDataIntact ? '✅ 通过' : '❌ 失败');

    } catch (error) {
      console.error('序列化过程中出错:', error);
    }
  }  /**
   * 批量序列化示例
   */
  static async demonstrateBatchSerialization(): Promise<void> {
    console.log('\n=== 批量序列化示例 ===');
    
    // 创建多个SessionData
    const sessionDataArray: SessionData[] = [];
    for (let i = 1; i <= 5; i++) {
      const session = this.createSampleSessionData();
      session.id = 1000 + i;
      session.no = i;
      sessionDataArray.push(session);
    }

    try {
      // 批量序列化为Base64
      const batchBase64 = this.protobufService.serializeSessionDataBatchToBase64(sessionDataArray);
      console.log('批量序列化数据长度:', batchBase64.length, '字符');

      // 批量反序列化
      const deserializedBatch = this.protobufService.deserializeSessionDataBatchFromBase64(batchBase64);
      console.log('反序列化后的数组长度:', deserializedBatch.length);
      console.log('第一个Session ID:', deserializedBatch[0].id);
      console.log('最后一个Session ID:', deserializedBatch[deserializedBatch.length - 1].id);

    } catch (error) {
      console.error('批量序列化过程中出错:', error);
    }
  }  /**
   * 性能比较：Protobuf vs JSON
   */
  static async demonstratePerformanceComparison(): Promise<void> {
    console.log('\n=== 性能比较：Protobuf vs JSON ===');
    
    const sessionData = this.createSampleSessionData();

    try {
      // Protobuf 序列化性能测试
      const protobufStartTime = performance.now();
      const protobufData = this.protobufService.serializeSessionDataToBase64(sessionData);
      const protobufEndTime = performance.now();
      const protobufTime = protobufEndTime - protobufStartTime;

      // JSON 序列化性能测试
      const jsonStartTime = performance.now();
      const jsonData = JSON.stringify({
        ...sessionData,
        denominationBreakdown: Array.from(sessionData.denominationBreakdown.entries())
      });
      const jsonEndTime = performance.now();
      const jsonTime = jsonEndTime - jsonStartTime;

      // 获取压缩比较数据
      const comparison = this.protobufService.compareWithJSON(sessionData);

      console.log('性能对比结果:');
      console.log('- Protobuf 序列化时间:', protobufTime.toFixed(2), 'ms');
      console.log('- JSON 序列化时间:', jsonTime.toFixed(2), 'ms');
      console.log('- Protobuf 数据大小:', comparison.protobufSize, '字节');
      console.log('- JSON 数据大小:', comparison.jsonSize, '字节');
      console.log('- 压缩比:', comparison.compressionRatio.toFixed(2), 'x');
      console.log('- 空间节省:', ((1 - comparison.protobufSize / comparison.jsonSize) * 100).toFixed(1), '%');

      // 反序列化性能测试
      const protobufDeserStartTime = performance.now();
      this.protobufService.deserializeSessionDataFromBase64(protobufData);
      const protobufDeserEndTime = performance.now();
      const protobufDeserTime = protobufDeserEndTime - protobufDeserStartTime;

      const jsonDeserStartTime = performance.now();
      JSON.parse(jsonData);
      const jsonDeserEndTime = performance.now();
      const jsonDeserTime = jsonDeserEndTime - jsonDeserStartTime;

      console.log('- Protobuf 反序列化时间:', protobufDeserTime.toFixed(2), 'ms');
      console.log('- JSON 反序列化时间:', jsonDeserTime.toFixed(2), 'ms');

    } catch (error) {
      console.error('性能比较过程中出错:', error);
    }
  }
  /**
   * 模拟实际使用场景：数据导出和导入
   */
  static async demonstrateExportImportScenario(): Promise<void> {
    console.log('\n=== 数据导出/导入场景示例 ===');
    
    // 模拟点钞系统的Session数据
    const sessions: SessionData[] = [];
    for (let i = 1; i <= 10; i++) {
      const session = this.createSampleSessionData();
      session.id = i;
      session.no = i;
      sessions.push(session);
    }

    try {
      // 导出数据（序列化）
      console.log('正在导出', sessions.length, '个Session...');
      const exportData = this.protobufService.serializeSessionDataBatchToBase64(sessions);
      console.log('导出完成，数据大小:', exportData.length, '字符');

      // 模拟数据传输或存储...
      console.log('模拟数据传输/存储过程...');

      // 导入数据（反序列化）
      console.log('正在导入数据...');
      const importedSessions = this.protobufService.deserializeSessionDataBatchFromBase64(exportData);
      console.log('导入完成，恢复了', importedSessions.length, '个Session');

      // 验证数据完整性
      let isDataIntact = true;
      for (let i = 0; i < sessions.length; i++) {
        if (sessions[i].id !== importedSessions[i].id || 
            sessions[i].totalAmount !== importedSessions[i].totalAmount) {
          isDataIntact = false;
          break;
        }
      }

      console.log('数据完整性验证:', isDataIntact ? '✅ 通过' : '❌ 失败');
      console.log('总金额对比:');
      console.log('- 原始数据总金额:', sessions.reduce((sum: number, s: SessionData) => sum + s.totalAmount, 0));
      console.log('- 导入数据总金额:', importedSessions.reduce((sum: number, s: SessionData) => sum + s.totalAmount, 0));

    } catch (error) {
      console.error('导出/导入过程中出错:', error);
    }
  }

  /**
   * 运行所有示例
   */
  static async runAllExamples(): Promise<void> {
    console.log('🚀 Protobuf 序列化服务使用示例');
    console.log('=====================================');
    
    await this.demonstrateBasicSerialization();
    await this.demonstrateBatchSerialization();
    await this.demonstratePerformanceComparison();
    await this.demonstrateExportImportScenario();
    
    console.log('\n✅ 所有示例执行完成');
  }
}

// 如果直接运行此文件，执行示例
if (typeof window !== 'undefined') {
  // 浏览器环境，可以通过控制台调用
  (window as unknown as { SerializationExample: typeof SerializationUsageExample }).SerializationExample = SerializationUsageExample;
  console.log('使用 SerializationExample.runAllExamples() 来运行示例');
}
