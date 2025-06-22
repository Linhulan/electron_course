import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

// 中文语言包
const zhCN = {
  translation: {
    // 通用
    common: {
      confirm: "确认",
      cancel: "取消",
      save: "保存",
      delete: "删除",
      edit: "编辑",
      close: "关闭",
      refresh: "刷新",
      clear: "清空",
      export: "导出",
      import: "导入",
      loading: "加载中...",
      noData: "暂无数据",
      error: "错误",
      success: "成功",
      warning: "警告",
      info: "信息",
      yes: "是",
      no: "否",
      search: "搜索",
      filter: "筛选",
      sort: "排序",
      settings: "设置",
      help: "帮助",
      about: "关于",
      version: "版本",
      language: "语言",
    },

    // 应用标题
    app: {
      title: "串口监控系统",
      subtitle: "点钞机数据监控平台",
    },    // 侧边栏
    sidebar: {
      controlPanel: "控制面板",
      serialPort: "串口监控",
      counterDashboard: "点钞数据",
      fileManager: "文件管理",
      serialPortDesc: "串口通信监控",
      counterDashboardDesc: "点钞机数据看板",
      fileManagerDesc: "导出文件管理",
      collapse: "收起侧边栏",
      expand: "展开侧边栏",
    },

    // 串口监控页面
    serialPort: {
      title: "串口连接",
      connection: "串口连接",
      configuration: "连接配置",
      portSelection: "端口选择",
      selectPort: "请选择端口",
      refreshPorts: "刷新端口",
      baudRate: "波特率",
      dataBits: "数据位",
      stopBits: "停止位",
      parity: "校验位",
      connect: "连接",
      disconnect: "断开连接",
      connected: "已连接",
      disconnected: "未连接",
      connecting: "连接中...",
      disconnecting: "断开中...",
      connectionStatus: "连接状态",

      // 数据发送区域
      sendData: "发送数据",
      dataToSend: "待发送数据",
      sendMode: "发送模式",
      textMode: "文本模式",
      hexMode: "HEX模式",
      send: "发送",
      sendHex: "发送HEX",

      // 数据接收区域
      receiveData: "接收数据",
      receiveMode: "接收模式",
      displayMode: "显示模式",
      showTimestamp: "显示时间戳",
      autoScroll: "自动滚动",
      clearData: "清空",
      exportData: "导出",

      // 测试数据
      testData: "测试数据",
      sendTestData: "发送测试数据",

      // 状态消息
      status: {
        selectPortFirst: "请先选择端口",
        connectSuccess: "连接成功",
        connectFailed: "连接失败",
        disconnectSuccess: "断开连接成功",
        sendSuccess: "发送成功",
        sendFailed: "发送失败",
        noPortsFound: "未找到可用端口",
        receiveModeSwitch: "接收模式已切换至: {{mode}}",
      },

      // 错误消息
      errors: {
        listPortsFailed: "获取端口列表失败: {{error}}",
        connectFailed: "连接失败: {{error}}",
        disconnectFailed: "断开失败: {{error}}",
        sendFailed: "发送失败: {{error}}",
        setReceiveModeFailed: "设置接收模式失败: {{error}}",
      },
    },

    // 点钞数据看板
    counter: {
      title: "点钞机数据看板",
      dashboard: "数据看板",
      realTimeData: "实时数据",
      statistics: "统计信息",

      // 连接状态
      connectionStatus: "连接状态",
      connected: "已连接",
      disconnected: "未连接",

      // 控制按钮
      startSimulation: "开始模拟",
      stopSimulation: "停止模拟",
      clearData: "清空",
      exportData: "导出",

      // 时间范围
      timeRange: "时间范围",
      lastHour: "最近1小时",
      last24Hours: "最近24小时",
      last7Days: "最近7天",
      last30Days: "最近30天",

      // 统计卡片
      stats: {
        totalSessions: "点钞次数",
        totalAmount: "总金额",
        totalNotes: "总张数",
        averageSpeed: "平均速度",
        errorPcs: "错误张数",
        speedUnit: "张/分",
      }, // 当前会话
      currentSession: "当前点钞会话",
      noCurrentSession: "暂无进行中的点钞会话",
      clearCurrentSession: "清空当前会话",
      clearSession: "清空",
      session: {
        status: "状态",
        denomination: "面额",
        count: "张数",
        amount: "金额",
        speed: "速度",
        device: "设备",
        date: "日期",
        errorCount: "错误张数",
      },

      // 状态
      sessionStatus: {
        counting: "计数中",
        completed: "已完成",
        error: "错误",
        paused: "已暂停",
      },
      // 记录表格
      records: "点钞记录",
      detailedRecords: "面额统计",
      table: {
        time: "时间",
        status: "状态",
        denomination: "面额",
        count: "张数",
        amount: "金额",
        speed: "速度",
        device: "设备",
        errorPcs: "错误张数",
      },

      // 详细记录表格
      detailTable: {
        denomination: "面额",
        count: "张数",
        total: "小计",
        totalRow: "总计",
        pcs: "张",
        bills: "张纸币",
      },      // 无数据提示
      noData: {
        title: "暂无点钞数据",
        subtitle: "请开始点钞来查看数据",        noDetailedRecords: "暂无面额统计",
        startCountingHint: "开始点钞查看面额分布",
        suggestion: "连接串口并开始点钞即可在此查看记录"
      },      // Session详情抽屉
      sessionDetail: {
        title: "点钞会话详情",
        basicInfo: "基本信息",
        denominationBreakdown: "面额分布",
        transactionDetails: "交易明细",
        exportSession: "导出会话",
        noDenominationData: "暂无面额数据",
        noTransactionData: "暂无交易明细",        serialNumber: "序列号",
        startTime: "开始时间",        endTime: "结束时间",
        currency: "货币",
        error: "错误",
        countRatio: "张数占比",
        amountRatio: "金额占比",
        showDetails: "显示详情",
        hideDetails: "隐藏详情",
      },

      // 点击提示
      clickToViewDetails: "点击查看详情",
    },    // 文件管理
    fileManager: {
      title: "文件管理",
      exportHistory: "导出历史",
      exportFiles: "导出文件",
      recentExports: "最近导出",
      fileOperations: "文件操作",
      exportData: "导出数据",
      openFile: "打开",
      showInFolder: "文件夹",
      deleteFile: "删除",
      refreshHistory: "刷新",
      noFilesFound: "未找到文件",
      fileDeleted: "文件已删除",
      operationFailed: "操作失败",
      exportSettings: "导出设置",
      defaultDirectory: "默认目录",
      setDefaultDirectory: "设置默认目录",
      loadingHistory: "加载导出历史...",
      confirmDelete: "删除 {{filename}}?",
      enterDirectory: "输入新的默认目录:",
      directoryUpdated: "默认目录更新成功!",
      directoryUpdateFailed: "更新默认目录失败。",
      notSet: "未设置",
      setting: "设置中...",
      change: "更改",
      exportOptions: "导出选项",
      autoSaveInfo: "文件自动保存到默认目录",
      historyInfo: "导出历史自动维护",
      formatsInfo: "支持格式: Excel (.xlsx), PDF (.pdf)",
    },
  },
};

// 英文语言包
const enUS = {
  translation: {
    // Common
    common: {
      confirm: "Confirm",
      cancel: "Cancel",
      save: "Save",
      delete: "Delete",
      edit: "Edit",
      close: "Close",
      refresh: "Refresh",
      clear: "Clear",
      export: "Export",
      import: "Import",
      loading: "Loading...",
      noData: "No Data",
      error: "Error",
      success: "Success",
      warning: "Warning",
      info: "Info",
      yes: "Yes",
      no: "No",
      search: "Search",
      filter: "Filter",
      sort: "Sort",
      settings: "Settings",
      help: "Help",
      about: "About",
      version: "Version",
      language: "Language",
    },

    // App titles
    app: {
      title: "Serial Port Monitor",
      subtitle: "Money Counter Data Monitoring Platform",
    },    // Sidebar
    sidebar: {
      controlPanel: "Control Panel",
      serialPort: "Serial Port",
      counterDashboard: "Counter Data",
      fileManager: "File Manager",
      serialPortDesc: "Serial Port Communication Monitor",
      counterDashboardDesc: "Money Counter Dashboard",
      fileManagerDesc: "Export File Management",
      collapse: "Collapse Sidebar",
      expand: "Expand Sidebar",
    },

    // Serial Port Page
    serialPort: {
      title: "Serial Port Connection",
      connection: "Serial Port Connection",
      configuration: "Connection Configuration",
      portSelection: "Port Selection",
      selectPort: "Please select a port",
      refreshPorts: "Refresh Ports",
      baudRate: "Baud Rate",
      dataBits: "Data Bits",
      stopBits: "Stop Bits",
      parity: "Parity",
      connect: "Connect",
      disconnect: "Disconnect",
      connected: "Connected",
      disconnected: "Disconnected",
      connecting: "Connecting...",
      disconnecting: "Disconnecting...",
      connectionStatus: "Connection Status",

      // Data sending area
      sendData: "Send Data",
      dataToSend: "Data to Send",
      sendMode: "Send Mode",
      textMode: "Text Mode",
      hexMode: "HEX Mode",
      send: "Send",
      sendHex: "Send HEX",

      // Data receiving area
      receiveData: "Receive Data",
      receiveMode: "Receive Mode",
      displayMode: "Display Mode",
      showTimestamp: "Show Timestamp",
      autoScroll: "Auto Scroll",
      clearData: "Clear",
      exportData: "Export",

      // Test data
      testData: "Test Data",
      sendTestData: "Send Test Data",

      // Status messages
      status: {
        selectPortFirst: "Please select a port first",
        connectSuccess: "Connected successfully",
        connectFailed: "Connection failed",
        disconnectSuccess: "Disconnected successfully",
        sendSuccess: "Sent successfully",
        sendFailed: "Send failed",
        noPortsFound: "No available ports found",
        receiveModeSwitch: "Receive mode switched to: {{mode}}",
      },

      // Error messages
      errors: {
        listPortsFailed: "Failed to list ports: {{error}}",
        connectFailed: "Failed to connect: {{error}}",
        disconnectFailed: "Failed to disconnect: {{error}}",
        sendFailed: "Failed to send data: {{error}}",
        setReceiveModeFailed: "Failed to set receive mode: {{error}}",
      },
    },

    // Counter Dashboard
    counter: {
      title: "Money Counter Dashboard",
      dashboard: "Dashboard",
      realTimeData: "Real-time Data",
      statistics: "Statistics",

      // Connection status
      connectionStatus: "Connection Status",
      connected: "Connected",
      disconnected: "Disconnected",

      // Control buttons
      startSimulation: "Start Simulation",
      stopSimulation: "Stop Simulation",
      clearData: "Clear",
      exportData: "Export",

      // Time range
      timeRange: "Time Range",
      lastHour: "Last Hour",
      last24Hours: "Last 24 Hours",
      last7Days: "Last 7 Days",
      last30Days: "Last 30 Days",

      // Statistics cards
      stats: {
        totalSessions: "Total Sessions",
        totalAmount: "Total Amount",
        totalNotes: "Total Pcs",
        averageSpeed: "Average Speed",
        errorPcs: "Error Pcs",
        speedUnit: "pcs/min",
      }, // Current session
      currentSession: "Current Counting Session",
      noCurrentSession: "No active counting session",
      clearCurrentSession: "Clear current session",
      clearSession: "Clear",
      session: {
        status: "Status",
        denomination: "Denom.",
        count: "Count",
        amount: "Amount",
        speed: "Speed",
        device: "Device",
        date: "Date",
        errorCount: "Error Count",
      },

      // Status
      sessionStatus: {
        counting: "Counting",
        completed: "Completed",
        error: "Error",
        paused: "Paused",
      },
      // Records table
      records: "Counting Records",
      detailedRecords: "Detailed Records",
      table: {
        time: "Time",
        status: "Status",
        denomination: "Denom.",
        count: "Count",
        amount: "Amount",
        speed: "Speed",
        device: "Device",
        errorPcs: "Error Pcs",
      },

      // Detail table
      detailTable: {
        denomination: "Denom.",
        count: "Count",
        total: "Total",
        totalRow: "Total",
        pcs: "pcs",
        bills: "bills",
      },      // No data prompt
      noData: {
        title: "No counting data available",
        subtitle: "Start Counting to see the data",
        noDetailedRecords: "No detailed records",        startCountingHint: "Start counting to see denomination breakdown",
        suggestion: "Connect serial port and start counting to view records here"
      },      // Session detail drawer
      sessionDetail: {
        title: "Session Details",
        basicInfo: "Basic Information",
        denominationBreakdown: "Denomination Breakdown",
        transactionDetails: "Transaction Details",
        exportSession: "Export Session",
        noDenominationData: "No denomination data",
        noTransactionData: "No transaction details",        serialNumber: "Serial Number",
        startTime: "Start Time",        endTime: "End Time",
        currency: "Currency",
        error: "Error",
        countRatio: "Count Ratio",
        amountRatio: "Amount Ratio",
        showDetails: "Show Details",
        hideDetails: "Hide Details",
      },

      // Click hint
      clickToViewDetails: "Click to view details",
    },    // File Manager
    fileManager: {
      title: "File Manager",
      exportHistory: "Export History",
      exportFiles: "Export Files",
      recentExports: "Recent Exports",
      fileOperations: "File Operations",
      exportData: "Export Data",
      openFile: "Open",
      showInFolder: "Folder",
      deleteFile: "Delete",
      refreshHistory: "Refresh",
      noFilesFound: "No files found",
      fileDeleted: "File deleted",
      operationFailed: "Operation failed",
      exportSettings: "Export Settings",
      defaultDirectory: "Default Directory",
      setDefaultDirectory: "Set Default Directory",
      loadingHistory: "Loading export history...",
      confirmDelete: "Delete {{filename}}?",
      enterDirectory: "Enter new default directory:",
      directoryUpdated: "Default directory updated successfully!",
      directoryUpdateFailed: "Failed to update default directory.",
      notSet: "Not set",
      setting: "Setting...",
      change: "Change",
      exportOptions: "Export Options",
      autoSaveInfo: "Files are automatically saved to the default directory",
      historyInfo: "Export history is maintained automatically",
      formatsInfo: "Supported formats: Excel (.xlsx), PDF (.pdf)",
    },
  },
};

// i18n 配置
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      "zh-CN": zhCN,
      "en-US": enUS,
      zh: zhCN, // 简化版本
      en: enUS, // 简化版本
    },    fallbackLng: "en-US",
    lng: "en-US", // 默认语言改为英文

    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      caches: ["localStorage"],
      lookupLocalStorage: "i18nextLng",
    },

    interpolation: {
      escapeValue: false,
    },

    react: {
      useSuspense: false, // 禁用 Suspense 以避免启动阻塞
    },

    // 启动性能优化
    initImmediate: false, // 立即初始化，不等待检测器
    load: 'languageOnly', // 只加载语言部分，不加载地区
    preload: ['zh-CN', 'en-US'], // 预加载常用语言
    
    // 缓存优化
    cleanCode: true,
    
  });

export default i18n;
