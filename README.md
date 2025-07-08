---

electron_course 是一个基于 Electron + React + TypeScript 的桌面应用，主要用于串口练习时作为上位机，解析和展示点钞机等设备通过串口发送的点钞数据。该项目集成了协议解析、数据管理、导出报表和本地历史记录管理等功能，适用于硬件开发、点钞机或类似串口数据采集场景的上位机软件开发和教学演示。

## 主要功能

- 串口协议解析：可扩展的协议解析框架，支持点钞机协议（FDDF44字节包、粘包、校验、面额金额统计等），可扩展新协议。
- 数据展示与统计：实时解析串口数据，展示点钞总张数、面额、金额等，支持 Session 状态管理。
- 文件管理与报表导出：支持 Excel/PDF 导出，自动保存历史导出记录，查看/打开/删除/清理历史文件。
- 用户界面：现代化 React UI，支持侧边栏集成、国际化。
- 本地文件操作：安全访问本地文件系统，自动管理导出目录和文件名。

## 适用场景

- 点钞机等金融设备的上位机数据采集展示与管理
- 串口协议开发调试、教学和演示
- 需要本地数据导出、历史记录管理的桌面端串口工具

---

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
