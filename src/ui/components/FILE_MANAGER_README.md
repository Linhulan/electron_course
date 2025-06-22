# 文件管理系统使用指南

## 概述

本文件管理系统为货币计数器应用提供了完整的 Excel 和 PDF 导出功能，包括文件的创建、保存、历史记录管理等功能。

## 系统架构

### 1. 主进程 (Electron Main Process)
- **文件路径**: `src/electron/fileManage.ts`
- **功能**: 负责实际的文件操作，包括生成、保存、删除文件等
- **特点**: 直接访问文件系统，提供安全的文件操作

### 2. IPC 通信层
- **主进程**: `src/electron/main.ts` - 注册 IPC 处理程序
- **预加载脚本**: `src/electron/preload.cts` - 暴露安全的 API 给渲染进程
- **类型定义**: `types.d.ts` - 定义 TypeScript 类型

### 3. 渲染进程 (React Components)
- **组件文件**: `src/ui/components/FileManager.tsx`
- **样式文件**: `src/ui/components/FileManager.css`
- **功能**: 提供用户界面和交互逻辑

## 核心功能

### 📊 导出功能
- **Excel 导出**: 支持多工作表，包含会话汇总、详细信息、面额统计、纸币详情
- **PDF 导出**: 生成专业的报告，包含图表和详细数据
- **自定义选项**: 支持文件名自定义、导出位置选择、导出后自动打开等

### 📁 文件管理
- **智能目录管理**: 自动创建默认导出目录
- **历史记录**: 自动记录所有导出文件，支持查看、打开、删除
- **文件操作**: 支持在文件管理器中显示、直接打开文件
- **清理功能**: 自动清理无效的历史记录

### ⚙️ 配置选项
- **默认导出目录**: 可自定义默认保存位置
- **历史记录限制**: 控制保存的历史文件数量
- **自动清理**: 定期清理旧文件

## 使用方法

### 1. 基本导出操作

```typescript
import { useFileManager } from './components/FileManager';

const { exportExcel, exportPDF } = useFileManager();

// 导出 Excel
const result = await exportExcel(sessionData, {
  filename: 'custom-report',
  useDefaultDir: true,
  openAfterExport: true
});

// 导出 PDF
const result = await exportPDF(sessionData, {
  useDefaultDir: false, // 显示保存对话框
  openAfterExport: true
});
```

### 2. 使用导出按钮组件

```jsx
import { ExportButtons } from './components/FileManager';

<ExportButtons 
  sessionData={sessionData}
  onExportComplete={(result) => {
    console.log('Export completed:', result);
  }}
  onExportError={(error) => {
    console.error('Export failed:', error);
  }}
/>
```

### 3. 使用文件历史面板

```jsx
import { FileHistoryPanel } from './components/FileManager';

<FileHistoryPanel />
```

### 4. 高级用法

```typescript
const fileManager = useFileManager();

// 获取导出历史
const history = await fileManager.refreshHistory();

// 设置默认导出目录
await fileManager.setDefaultDir('/path/to/new/directory');

// 文件操作
await fileManager.openFile('/path/to/file.xlsx');
await fileManager.showInFolder('/path/to/file.pdf');
await fileManager.deleteFile('/path/to/old-file.xlsx');
```

## 配置选项

### ExportOptions 接口

```typescript
interface ExportOptions {
  format?: 'excel' | 'pdf';           // 导出格式
  filename?: string;                  // 自定义文件名
  useDefaultDir?: boolean;            // 是否使用默认目录
  openAfterExport?: boolean;          // 导出后是否自动打开
}
```

### FileManagerConfig 配置

```typescript
interface FileManagerConfig {
  defaultExportDir: string;           // 默认导出目录
  maxHistoryFiles: number;            // 最大历史文件数量
  autoCleanOldFiles: boolean;         // 是否自动清理旧文件
  cleanupDays: number;                // 清理天数阈值
}
```

## 文件结构

```
src/
├── electron/
│   ├── fileManage.ts          # 文件管理核心逻辑
│   ├── main.ts                # IPC 处理程序注册
│   └── preload.cts            # API 暴露
├── ui/
│   └── components/
│       ├── FileManager.tsx    # React 组件
│       └── FileManager.css    # 组件样式
└── types.d.ts                 # TypeScript 类型定义
```

## 最佳实践

### 1. 错误处理
```typescript
try {
  const result = await exportExcel(sessionData);
  if (!result.success) {
    throw new Error(result.error);
  }
  // 处理成功情况
} catch (error) {
  // 处理错误情况
  console.error('Export failed:', error);
}
```

### 2. 用户体验优化
- 在导出过程中显示加载状态
- 提供导出进度反馈
- 在导出完成后提供操作选项（打开文件、查看文件夹等）

### 3. 性能优化
- 使用默认目录避免频繁的文件对话框
- 合理设置历史记录数量限制
- 定期清理无效的历史记录

## 故障排除

### 常见问题

1. **文件保存失败**
   - 检查目录权限
   - 确保有足够的磁盘空间
   - 验证文件名是否合法

2. **历史记录不显示**
   - 检查历史文件是否存在
   - 验证 JSON 格式是否正确
   - 尝试刷新历史记录

3. **导出内容为空**
   - 确保 sessionData 数据完整
   - 检查数据格式是否符合要求

### 调试技巧

- 查看控制台日志获取详细错误信息
- 使用开发者工具检查网络和文件系统操作
- 在主进程中添加日志输出进行调试

## 更新日志

### v1.0.0
- 实现基本的 Excel 和 PDF 导出功能
- 添加文件历史记录管理
- 支持自定义导出选项
- 提供 React 组件和 Hook

---

如需更多帮助或有问题反馈，请查看项目文档或联系开发团队。
