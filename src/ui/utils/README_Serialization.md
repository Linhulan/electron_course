# Protobuf 序列化服务使用指南

本项目实现了基于 Protocol Buffers (protobuf) 的 SessionData 序列化方案，提供了高效的数据序列化和反序列化功能。

## 特性

- 🚀 **高性能**: 相比 JSON 提供更快的序列化/反序列化速度
- 💾 **高压缩比**: 通常比 JSON 节省 20-50% 的存储空间
- 🔒 **类型安全**: 完整的 TypeScript 类型支持
- 🌐 **浏览器兼容**: 支持现代浏览器环境
- 📦 **批量处理**: 支持单个和批量数据序列化
- 🎯 **易于使用**: 提供简单的 API 接口

## 安装依赖

项目已经安装了所需的依赖：

```bash
npm install protobufjs
```

## 基本使用

### 导入模块

```typescript
import { 
  protobufSerializer,
  serializeSessionDataToBase64,
  deserializeSessionDataFromBase64,
  SessionData 
} from './utils/serialization';
```

### 序列化单个 SessionData

```typescript
// 创建 SessionData 对象
const sessionData: SessionData = {
  id: 1001,
  no: 1,
  timestamp: new Date().toLocaleTimeString(),
  startTime: new Date().toLocaleString(),
  totalCount: 125,
  totalAmount: 7200,
  errorCount: 0,
  status: "completed",
  denominationBreakdown: new Map([
    [100, { denomination: 100, count: 50, amount: 5000 }],
    [50, { denomination: 50, count: 30, amount: 1500 }]
  ])
};

// 序列化为 Base64 字符串
const serializedData = protobufSerializer.serializeSessionDataToBase64(sessionData);
console.log('序列化数据:', serializedData);

// 反序列化
const deserializedData = protobufSerializer.deserializeSessionDataFromBase64(serializedData);
console.log('反序列化数据:', deserializedData);
```

### 批量序列化

```typescript
// 序列化多个 SessionData
const sessionArray: SessionData[] = [session1, session2, session3];

const batchData = protobufSerializer.serializeSessionDataBatchToBase64(sessionArray);
const restoredArray = protobufSerializer.deserializeSessionDataBatchFromBase64(batchData);
```

### 二进制序列化

```typescript
// 序列化为二进制数据
const binaryData = protobufSerializer.serializeSessionData(sessionData);
console.log('二进制数据大小:', binaryData.length, '字节');

// 从二进制数据反序列化
const restored = protobufSerializer.deserializeSessionData(binaryData);
```

## 高级功能

### 性能比较

```typescript
// 比较 Protobuf 与 JSON 的性能
const comparison = protobufSerializer.compareWithJSON(sessionData);
console.log('压缩比:', comparison.compressionRatio);
console.log('Protobuf 大小:', comparison.protobufSize, '字节');
console.log('JSON 大小:', comparison.jsonSize, '字节');
```

### 数据大小查询

```typescript
// 获取序列化后的数据大小
const size = protobufSerializer.getSerializedSize(sessionData);
console.log('序列化大小:', size, '字节');

// 获取批量数据大小
const batchSize = protobufSerializer.getBatchSerializedSize(sessionArray);
console.log('批量序列化大小:', batchSize, '字节');
```

## 在项目中集成

### 1. 数据导出功能

```typescript
// 在 CounterDashboard.tsx 中使用
const exportData = () => {
  try {
    const serializedData = protobufSerializer.serializeSessionDataBatchToBase64(sessionData);
    
    // 创建下载链接
    const blob = new Blob([serializedData], { type: 'application/protobuf' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `session-data-${Date.now()}.pb`;
    link.click();
    
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('导出失败:', error);
  }
};
```

### 2. 数据导入功能

```typescript
const importData = (file: File) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const base64Data = e.target?.result as string;
      const importedSessions = protobufSerializer.deserializeSessionDataBatchFromBase64(base64Data);
      
      // 更新应用状态
      setSessionData(importedSessions);
      console.log('成功导入', importedSessions.length, '个会话');
    } catch (error) {
      console.error('导入失败:', error);
    }
  };
  reader.readAsText(file);
};
```

### 3. 本地存储优化

```typescript
// 使用 Protobuf 优化 localStorage
const saveToLocalStorage = (key: string, data: SessionData[]) => {
  try {
    const serializedData = protobufSerializer.serializeSessionDataBatchToBase64(data);
    localStorage.setItem(key, serializedData);
  } catch (error) {
    console.error('保存到本地存储失败:', error);
  }
};

const loadFromLocalStorage = (key: string): SessionData[] => {
  try {
    const serializedData = localStorage.getItem(key);
    if (serializedData) {
      return protobufSerializer.deserializeSessionDataBatchFromBase64(serializedData);
    }
  } catch (error) {
    console.error('从本地存储读取失败:', error);
  }
  return [];
};
```

## 性能优化建议

### 1. 批量处理
对于大量数据，建议使用批量序列化方法：

```typescript
// ✅ 推荐：批量处理
const batchData = protobufSerializer.serializeSessionDataBatch(sessions);

// ❌ 不推荐：逐个处理
sessions.forEach(session => {
  protobufSerializer.serializeSessionData(session);
});
```

### 2. 错误处理
始终包含适当的错误处理：

```typescript
try {
  const serialized = protobufSerializer.serializeSessionDataToBase64(data);
  // 处理序列化结果
} catch (error) {
  console.error('序列化失败:', error);
  // 回退到 JSON 序列化或其他处理方式
}
```

## 示例运行

项目包含完整的使用示例，可以通过以下方式运行：

```typescript
import { SerializationUsageExample } from './utils/serializationExample';

// 运行所有示例
SerializationUsageExample.runAllExamples();

// 或者运行特定示例
SerializationUsageExample.demonstrateBasicSerialization();
SerializationUsageExample.demonstratePerformanceComparison();
```

## 故障排除

### 常见问题

1. **序列化失败**
   - 检查数据结构是否完整
   - 确保 Map 对象正确创建
   - 验证必需字段是否存在

2. **反序列化失败**
   - 检查数据是否被正确编码
   - 确保使用相同的 schema 版本
   - 验证 Base64 字符串格式

3. **性能问题**
   - 对大数据集使用批量方法
   - 考虑数据分页
   - 监控内存使用情况

### 调试技巧

```typescript
// 启用详细日志
console.log('序列化前数据:', sessionData);
const serialized = protobufSerializer.serializeSessionDataToBase64(sessionData);
console.log('序列化结果长度:', serialized.length);

// 验证往返一致性
const roundTrip = protobufSerializer.deserializeSessionDataFromBase64(serialized);
const isConsistent = JSON.stringify(sessionData) === JSON.stringify(roundTrip);
console.log('往返一致性:', isConsistent);
```

## 未来扩展

- 支持更多数据类型
- 添加数据压缩选项
- 实现版本兼容性检查
- 添加数据校验功能

## 许可证

本序列化服务作为项目的一部分，遵循项目的许可证条款。
