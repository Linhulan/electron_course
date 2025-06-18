// 启动配置
export interface StartupConfig {
  // 最小启动画面显示时间（毫秒）
  minSplashDuration: {
    development: number;
    production: number;
  };    // 动画时长配置 - 使用简单的淡入淡出动画
  animations: {
    splashFadeOut: number;    // 启动画面淡出时间
    mainFadeIn: number;       // 主窗口淡入时间
    delayBetween: number;     // 启动画面关闭和主窗口显示之间的延迟
  };

  // 进度文本更新间隔
  progressTextInterval: number;

  // 是否在开发模式显示启动画面
  showSplashInDev: boolean;
}

export const startupConfig: StartupConfig = {
  minSplashDuration: {
    development: 1000,   // 开发模式 1.0 秒（让用户充分欣赏新设计）
    production: 2500,    // 生产模式 2.5 秒
  },
  animations: {
    splashFadeOut: 200, // 启动画面淡出 0.2 秒
    mainFadeIn: 150,    // 主窗口淡入 0.15 秒
    delayBetween: 250,  // 中间延迟 0.25 秒
  },

  progressTextInterval: 300, // 进度文本每 0.3 秒更新

  showSplashInDev: true, // 开发模式也显示启动画面
};
