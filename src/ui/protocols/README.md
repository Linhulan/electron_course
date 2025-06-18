# 协议解析模块 (Protocol Parser Module)

这个模块提供了一个可扩展的协议解析框架，支持多种串口协议的解析和管理。

## 模块结构

```
src/ui/protocols/
├── types.ts           # 类型定义
├── utils.ts           # 工具函数
├── countingMachine.ts # 点钞机协议解析器
├── manager.ts         # 协议管理器
├── init.ts            # 初始化函数
├── test.ts            # 测试示例
└── index.ts           # 统一导出
```

## 核心特性

### 1. 可扩展的协议解析框架
- 支持注册多个协议解析器
- 自动识别和选择合适的协议解析器
- 统一的解析接口和错误处理

### 2. 点钞机协议支持
- 完整的协议包解析 (FDDF开头的44字节协议)
- 粘包处理和完整性校验
- Session状态管理 (开始/刷新中/完成)
- 面额和金额统计

### 3. 工具函数库
- 十六进制字符串处理
- 字节数组转换
- 协议头验证
- 多协议包提取

## 使用方法

### 基本使用

```typescript
import { protocolManager, CountingProtocolData } from './protocols';
import { initializeProtocols } from './protocols/init';

// 1. 初始化协议解析器
initializeProtocols();

// 2. 解析协议数据
const hexData = "FDDF2C0E01000000..."; // 十六进制协议数据
const result = protocolManager.parseData(hexData, true) as CountingProtocolData;

if (result) {
    console.log('协议类型:', result.protocolType);
    console.log('总张数:', result.totalCount);
    console.log('面额:', result.denomination);
    console.log('总金额:', result.totalAmount);
}
```

### 添加新协议解析器

```typescript
import { ProtocolParser, BaseProtocolData } from './protocols/types';

// 1. 定义协议数据接口
interface MyProtocolData extends BaseProtocolData {
    customField: string;
}

// 2. 实现协议解析器
class MyProtocolParser implements ProtocolParser<MyProtocolData> {
    getProtocolName(): string {
        return "MyProtocol";
    }
    
    canHandle(hexData: string): boolean {
        // 检查是否能处理该协议
        return hexData.startsWith("ABCD");
    }
    
    parse(hexData: string): MyProtocolData | null {
        // 实现解析逻辑
        return {
            timestamp: new Date().toISOString(),
            protocolType: this.getProtocolName(),
            rawData: hexData,
            customField: "parsed value"
        };
    }
}

// 3. 注册新协议
const myParser = new MyProtocolParser();
protocolManager.registerParser(myParser);
```

## API 参考

### ProtocolManager
- `parseData(hexData: string, isCompletePacket?: boolean)` - 解析协议数据
- `registerParser<T>(parser: ProtocolParser<T>)` - 注册协议解析器
- `getSupportedProtocols()` - 获取支持的协议列表

### CountingMachineParser
- 支持点钞机协议 (CMD-G = 0x0E)
- 处理Session状态管理
- 自动粘包处理

### 工具函数
- `extractMultipleProtocols(hexData: string)` - 提取多个协议包
- `hexStringToBytes(hexString: string)` - 十六进制转字节数组
- `bytesToLittleEndianInt(bytes, start, length)` - 小端序整数转换

## Session状态管理

点钞机协议支持Session会话管理：

- **0x00 (START_COUNTING)**: 开始点钞会话
- **0x01 (COUNTING)**: 点钞进行中，更新金额和面额
- **0x02 (COMPLETED)**: 点钞完成
- **0x03 (COMPLETED_FULL)**: 点钞完成，接钞满

```typescript
import { isSessionStart, isSessionUpdate, isSessionEnd } from './protocols';

if (isSessionStart(protocolData.status)) {
    // 创建新的点钞会话
} else if (isSessionUpdate(protocolData.status)) {
    // 更新当前会话的金额和面额
} else if (isSessionEnd(protocolData.status)) {
    // 结束当前会话
}
```

## 错误处理

模块提供完整的错误处理和日志记录：

- 协议格式验证
- 数据完整性校验
- 解析异常捕获
- 详细的调试日志

## 测试

运行测试示例：

```typescript
import { testProtocolParsing } from './protocols/test';
testProtocolParsing();
```

## 扩展性

该模块设计为可扩展框架，可以轻松添加新的协议支持：

1. 实现 `ProtocolParser<T>` 接口
2. 定义协议特定的数据类型
3. 注册到协议管理器
4. 自动享受统一的解析和管理功能
