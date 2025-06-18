// 启动配置
export interface StartupConfig {
  // 最小启动画面显示时间（毫秒）
  minSplashDuration: {
    development: number;
    production: number;
  };
    // 动画时长配置
  animations: {
    splashFadeOut: number;    // 启动画面淡出时间
    mainFadeIn: number;       // 主窗口淡入时间 (已弃用，改用弹出放大)
    delayBetween: number;     // 启动画面关闭和主窗口显示之间的延迟
    popupScale: number;       // 弹出放大动画时长
    scaleEasing: string;      // 缩放缓动效果类型
  };
  
  // 进度文本更新间隔
  progressTextInterval: number;
  
  // 是否在开发模式显示启动画面
  showSplashInDev: boolean;
}

export const startupConfig: StartupConfig = {
  minSplashDuration: {
    development: 2000,   // 开发模式 2.0 秒（让用户充分欣赏新设计）
    production: 2500,    // 生产模式 2.5 秒
  },
    animations: {
    splashFadeOut: 300, // 启动画面淡出 0.3 秒（更优雅）
    mainFadeIn: 500,    // 主窗口淡入 0.5 秒（保留兼容，已改用弹出放大）
    delayBetween: 150,  // 中间延迟 0.15 秒
    popupScale: 600,    // 弹出放大动画 0.6 秒（更有弹性）
    scaleEasing: 'easeOutBack', // 缓动效果：后退弹性（类似 iOS）
  },
  
  progressTextInterval: 300, // 进度文本每 0.3 秒更新
  
  showSplashInDev: true, // 开发模式也显示启动画面
};
