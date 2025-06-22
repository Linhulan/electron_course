// 协议解析模块统一导出

// 类型定义
export * from '../common/types';

// 工具函数
export * from './utils';

// 协议解析器
export * from './countingMachine';
export * from './cdmProtocol';

// 协议管理器
export { ProtocolManagerImpl, protocolManager } from './manager';

// 初始化函数（需要单独导入以避免循环依赖）
// 使用方式: import { initializeProtocols } from './protocols/init';
