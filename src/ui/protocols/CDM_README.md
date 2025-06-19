# CDM协议支持文档

## 概述

CDM协议是一种基于 `FDDF开头 + 长度 + CMD-G(模式码) + 数据 + CRC` 格式的通信协议，主要用于设备间的数据交换。

## 协议格式

```
| 字段   | 长度 | 说明                           |
|--------|------|--------------------------------|
| Header | 4字节 | 协议头，固定为 0xFD 0xDF 0x?? 0x?? |
| Length | 2字节 | 数据长度（大端序）             |
| CMD-G  | 2字节 | 命令码/模式码                  |
| Data   | N字节 | 数据部分                       |
| CRC    | 2字节 | CRC校验码                      |
```

## 支持的命令码

### 设备管理类
- `01` - 设备状态查询
- `02` - 设备信息查询  
- `03` - 设备复位

### 钞票处理类
- `10` - 开始计数
- `11` - 停止计数
- `12` - 计数结果
- `13` - 面额信息

### 故障诊断类
- `20` - 错误状态
- `21` - 传感器状态
- `22` - 维护信息

### 配置管理类
- `30` - 设置配置
- `31` - 获取配置
- `32` - 校准操作

### 自定义扩展类
- `A1` - 自定义命令01
- `A2` - 自定义命令02
- `A3` - 自定义命令03

## 使用方法

### 1. 解析CDM协议数据

```typescript
import { CDMProtocolParser } from './protocols/cdmProtocol';

const parser = new CDMProtocolParser();

// 检查是否能处理该数据
if (parser.canHandle(hexData)) {
  // 解析数据
  const result = parser.parse(hexData, true);
  if (result) {
    console.log('命令码:', result.cmdGroup);
    console.log('数据:', result.data);
  }
}
```

### 2. 构建CDM命令

```typescript
import { CDMCommandBuilder } from './protocols/cdmExample';

const builder = new CDMCommandBuilder();

// 构建设备状态查询命令
const statusQuery = builder.buildDeviceStatusQuery();

// 构建开始计数命令
const startCount = builder.buildStartCountCommand(1);

// 构建停止计数命令
const stopCount = builder.buildStopCountCommand();
```

### 3. 数据解析

```typescript
import { 
  parseCountResultData,
  parseDeviceStatusData,
  parseErrorStatusData 
} from './protocols/cdmProtocol';

// 解析计数结果
const countResult = parseCountResultData(data);

// 解析设备状态
const deviceStatus = parseDeviceStatusData(data);

// 解析错误状态
const errorStatus = parseErrorStatusData(data);
```

## 示例数据包

### 计数结果示例
```
FDDF000A12000005DC006401001234
```
- `FDDF` - 协议头
- `000A` - 长度10字节
- `12` - 计数结果命令
- `000005DC` - 总数1500
- `0064` - 面额100
- `01` - 状态
- `00` - 模式
- `1234` - CRC

### 设备状态示例
```
FDDF000801070100FA5678
```
- `FDDF` - 协议头
- `0008` - 长度8字节
- `01` - 设备状态命令
- `07` - 状态字节（在线+就绪+计数中）
- `01` - 模式
- `00FA` - 温度25.0°C
- `5678` - CRC

## 扩展新命令

### 1. 添加命令码

在 `types.ts` 中的 `CDMCommandCode` 枚举中添加新的命令码：

```typescript
export enum CDMCommandCode {
  // ...existing codes...
  NEW_COMMAND = 'A4', // 新命令码
}
```

### 2. 添加命令名称

在 `cdmProtocol.ts` 中的 `getCDMCommandName` 函数中添加对应的名称：

```typescript
const commandNames: Record<string, string> = {
  // ...existing names...
  [CDMCommandCode.NEW_COMMAND]: '新命令名称',
};
```

### 3. 添加数据解析

如果需要特殊的数据解析，可以添加相应的解析函数：

```typescript
export function parseNewCommandData(data: number[]): NewCommandData {
  // 解析逻辑
}
```

### 4. 更新解析逻辑

在需要的地方添加对新命令的处理：

```typescript
switch (cmdGroup) {
  case CDMCommandCode.NEW_COMMAND: {
    const result = parseNewCommandData(data);
    // 处理结果
    break;
  }
  // ...other cases...
}
```

## 注意事项

1. **CRC校验**: 当前实现使用CRC-16-CCITT算法，实际应用中可能需要根据具体设备调整
2. **字节序**: 长度字段使用大端序，数据字段的字节序根据具体命令而定
3. **错误处理**: 建议在解析过程中添加充分的错误处理和日志记录
4. **性能优化**: 对于高频数据，可以考虑缓存和批量处理

## 测试

运行CDM协议示例：

```typescript
import { runCDMExamples } from './protocols/cdmExample';

runCDMExamples();
```

这将执行所有的示例代码，包括：
- 协议解析示例
- 命令构建示例
- 多包数据处理示例
- 命令扩展示例
