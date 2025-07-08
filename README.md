# 项目简介

electron_course 是一个基于 Electron + React + TypeScript 的桌面应用，主要用于串口练习时作为上位机，解析和展示点钞机等设备通过串口发送的点钞数据。该项目集成了协议解析、数据管理、导出报表和本地历史记录管理等功能，适用于硬件开发、点钞机或类似串口数据采集场景的上位机软件开发和教学演示。

## 主要功能

- **串口协议解析**  
  内置可扩展的协议解析框架，支持多种串口协议，重点支持点钞机协议（完整支持 FDDF 开头的 44 字节数据包，粘包处理、完整性校验、面额和金额统计等），可便捷扩展新协议。
- **数据展示与统计**  
  实时解析串口数据，展示点钞总张数、面额、金额等详细统计信息，支持 Session 状态管理（点钞开始/刷新/完成）。
- **文件管理与报表导出**  
  支持将点钞统计结果导出为 Excel（多工作表、统计/明细/面额分布）和 PDF 专业报表，自动保存历史导出记录，可查看、打开、删除和清理历史文件。
- **用户界面**  
  采用 React 实现现代化界面，支持侧边栏集成、国际化（中英文），完整交互体验。
- **本地文件操作**  
  通过 Electron 主进程安全访问本地文件系统，自动管理文件目录，支持自定义导出路径和文件名。

## 适用场景

- 点钞机等金融设备的上位机数据采集展示与管理
- 串口协议开发调试、教学和演示
- 需要本地数据导出、历史记录管理的桌面端串口工具

## 技术架构

- Electron：主进程负责窗口管理、本地文件读写和安全 API 暴露
- React + TypeScript：构建前端渲染层和交互逻辑
- IPC 通信：主进程与渲染层安全通信
- 协议解析模块：支持多协议注册、自动识别和统一数据处理

## 目录结构示例

```
src/
├── electron/        # 主进程代码（文件操作、IPC 等）
├── ui/
│   ├── components/  # React 组件（如 FileManager）
│   └── protocols/   # 串口协议解析相关
└── types.d.ts       # 类型定义
```

---

本项目适合需要上位机采集、解析与展示串口点钞数据的开发者或教学场景，也可作为 Electron + React 桌面应用的学习案例。

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config({
  extends: [
    // Remove ...tseslint.configs.recommended and replace with this
    ...tseslint.configs.recommendedTypeChecked,
    // Alternatively, use this for stricter rules
    ...tseslint.configs.strictTypeChecked,
    // Optionally, add this for stylistic rules
    ...tseslint.configs.stylisticTypeChecked,
  ],
  languageOptions: {
    // other options...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config({
  plugins: {
    // Add the react-x and react-dom plugins
    'react-x': reactX,
    'react-dom': reactDom,
  },
  rules: {
    // other rules...
    // Enable its recommended typescript rules
    ...reactX.configs['recommended-typescript'].rules,
    ...reactDom.configs.recommended.rules,
  },
})
```
