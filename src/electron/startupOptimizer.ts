// 启动优化工具函数
export class StartupOptimizer {
  private static timerId: NodeJS.Timeout | null = null;
  
  /**
   * 使用高精度定时器实现平滑的数值过渡 (适配 Node.js 环境)
   */
  static smoothTransition(
    from: number,
    to: number,
    duration: number,
    onUpdate: (value: number) => void,
    onComplete?: () => void
  ): void {
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // 使用缓动函数 (ease-out cubic)
      const eased = 1 - Math.pow(1 - progress, 3);
      const currentValue = from + (to - from) * eased;
      
      onUpdate(currentValue);
      
      if (progress < 1) {
        // 在 Node.js 环境中使用 setImmediate 实现高频率更新
        this.timerId = setTimeout(animate, 16); // ~60fps
      } else {
        onUpdate(to);
        onComplete?.();
        this.timerId = null;
      }
    };
    
    animate();
  }
  
  /**
   * 取消当前的动画
   */
  static cancelTransition(): void {
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }  
  /**
   * 创建延迟执行的Promise
   */
  static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * 线性插值函数
   */
  static lerp(start: number, end: number, factor: number): number {
    return start + (end - start) * factor;
  }
  
  /**
   * 高级缓动函数集合（新增弹性效果）
   */
  static easing = {
    easeOutCubic: (t: number): number => 1 - Math.pow(1 - t, 3),
    easeInOutQuad: (t: number): number => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    easeOutExpo: (t: number): number => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
    // 新增：弹性后退效果（类似 iOS）
    easeOutBack: (t: number): number => {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
    // 新增：弹性反弹效果
    easeOutElastic: (t: number): number => {
      const c4 = (2 * Math.PI) / 3;
      return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    },
  };

  /**
   * 弹出放大动画 - 让窗口从启动位置弹性放大到目标尺寸
   */
  static popupScale(
    window: Electron.BrowserWindow,
    fromBounds: { x: number; y: number; width: number; height: number },
    toBounds: { x: number; y: number; width: number; height: number },
    duration: number,
    easingType: string = 'easeOutBack',
    onComplete?: () => void
  ): void {
    const startTime = Date.now();
    const easingFunc = this.easing[easingType as keyof typeof this.easing] || this.easing.easeOutBack;
    
    // 确保窗口初始状态
    window.setOpacity(0);
    window.setBounds(fromBounds);
    window.show();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easingFunc(progress);
      
      // 计算当前尺寸和位置
      const currentBounds = {
        x: Math.round(this.lerp(fromBounds.x, toBounds.x, eased)),
        y: Math.round(this.lerp(fromBounds.y, toBounds.y, eased)),
        width: Math.round(this.lerp(fromBounds.width, toBounds.width, eased)),
        height: Math.round(this.lerp(fromBounds.height, toBounds.height, eased)),
      };
      
      // 透明度也同步变化（稍微延迟开始，让尺寸先动起来）
      const opacityProgress = Math.max(0, (progress - 0.1) / 0.9);
      const opacity = Math.min(1, opacityProgress);
      
      // 应用变化
      window.setBounds(currentBounds);
      window.setOpacity(opacity);
      
      if (progress < 1) {
        this.timerId = setTimeout(animate, 16); // ~60fps
      } else {
        // 确保最终状态正确
        window.setBounds(toBounds);
        window.setOpacity(1);
        onComplete?.();
        this.timerId = null;
      }
    };
    
    animate();
  }

  /**
   * 计算启动窗口到主窗口的过渡参数
   */
  static calculateTransitionBounds(
    splashBounds: { x: number; y: number; width: number; height: number },
    targetWidth: number,
    targetHeight: number
  ): { from: any; to: any } {
    // 计算启动窗口中心点
    const splashCenterX = splashBounds.x + splashBounds.width / 2;
    const splashCenterY = splashBounds.y + splashBounds.height / 2;
    
    // 计算主窗口应该居中的位置
    const { width: screenWidth, height: screenHeight } = require('electron').screen.getPrimaryDisplay().workAreaSize;
    const targetX = Math.round((screenWidth - targetWidth) / 2);
    const targetY = Math.round((screenHeight - targetHeight) / 2);
    
    return {
      from: splashBounds,
      to: { x: targetX, y: targetY, width: targetWidth, height: targetHeight }
    };
  }

  /**
   * 记录性能指标
   */
  static logPerformance(label: string, startTime: number): void {
    const elapsed = Date.now() - startTime;
    console.log(`⚡ ${label}: ${elapsed}ms`);
  }
  
  /**
   * 简单的回退动画方案（使用基础定时器）
   */
  static simpleFade(
    window: Electron.BrowserWindow,
    from: number,
    to: number,
    duration: number,
    onComplete?: () => void
  ): void {
    const steps = 20; // 20 帧
    const stepDuration = duration / steps;
    const stepValue = (to - from) / steps;
    let currentValue = from;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      currentValue += stepValue;
      
      if (currentStep >= steps) {
        window.setOpacity(to);
        clearInterval(timer);
        onComplete?.();
      } else {
        window.setOpacity(currentValue);
      }
    }, stepDuration);
  }
}
