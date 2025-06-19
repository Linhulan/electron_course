import { BrowserWindow } from 'electron';
import { getPreloadPath } from './pathResolver.js';

export function createSplashWindow(): BrowserWindow {
  const splash = new BrowserWindow({
    width: 480,
    height: 320,
    frame: false,
    alwaysOnTop: true,
    transparent: false, // 改为不透明以支持白色背景
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: getPreloadPath(),
      // 性能优化
      backgroundThrottling: false,
    },
    show: false, // 初始隐藏，等待内容加载完成
    // 硬件加速优化
    paintWhenInitiallyHidden: false,    // iOS 风格圆角
    backgroundColor: '#ffffff', // 设置默认背景色，避免透明闪烁
    vibrancy: 'content', // macOS 上的磨砂效果
  });
  // 创建 iOS 风格的启动页面内容
  const splashHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        
        body {
          margin: 0;
          padding: 0;
          background: linear-gradient(180deg, #ffffff 0%, #f8fafc 50%, #f1f5f9 100%);
          color: #1f2937;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          height: 100vh;
          overflow: hidden;
          position: relative;
          /* 启用硬件加速 */
          transform: translateZ(0);
          -webkit-backface-visibility: hidden;
          backface-visibility: hidden;
        }
        
        /* iOS 风格背景装饰 */
        body::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle at 30% 20%, rgba(99, 102, 241, 0.1) 0%, transparent 50%),
                      radial-gradient(circle at 70% 80%, rgba(168, 85, 247, 0.08) 0%, transparent 50%);
          animation: backgroundFloat 8s ease-in-out infinite;
          z-index: 0;
        }
        
        .container {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }
        
        .logo-container {
          position: relative;
          margin-bottom: 32px;
        }
        
        .logo {
          width: 72px;
          height: 72px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 20px; /* iOS 风格圆角 */
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
          color: white;
          position: relative;
          box-shadow: 0 10px 25px rgba(102, 126, 234, 0.25),
                      0 5px 10px rgba(102, 126, 234, 0.15);
          /* 优化动画性能 */
          will-change: transform;
          transform: translateZ(0);
          animation: logoFloat 3s ease-in-out infinite;
        }
        
        /* iOS 风格光泽效果 */
        .logo::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.3) 0%, transparent 50%);
          border-radius: 20px;
          opacity: 0;
          animation: shine 4s ease-in-out infinite;
        }
        
        .title {
          font-size: 28px;
          font-weight: 700;
          color: #111827;
          margin-bottom: 8px;
          opacity: 0;
          transform: translateY(20px);
          animation: fadeInUp 0.8s ease-out 0.3s forwards;
          letter-spacing: -0.5px;
        }
        
        .subtitle {
          font-size: 16px;
          font-weight: 500;
          color: #6b7280;
          margin-bottom: 40px;
          opacity: 0;
          transform: translateY(20px);
          animation: fadeInUp 0.8s ease-out 0.5s forwards;
        }
        
        .loading-container {
          position: relative;
          width: 240px;
          margin-bottom: 24px;
        }
        
        .loading {
          width: 100%;
          height: 4px;
          background: #f3f4f6;
          border-radius: 8px;
          overflow: hidden;
          position: relative;
          opacity: 0;
          animation: fadeIn 0.8s ease-out 0.7s forwards;
          box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        .loading::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 40%;
          height: 100%;
          background: linear-gradient(90deg, #667eea, #764ba2);
          border-radius: 8px;
          transform: translateX(-100%);
          animation: loading 2s ease-in-out infinite 1s;
          will-change: transform;
          box-shadow: 0 0 10px rgba(102, 126, 234, 0.4);
        }
        
        .progress-text {
          font-size: 14px;
          font-weight: 500;
          color: #9ca3af;
          opacity: 0;
          animation: fadeIn 0.6s ease-out 0.9s forwards;
          transition: all 0.3s ease;
        }
        
        /* iOS 风格动画 */
        @keyframes backgroundFloat {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          33% { transform: translate(-20px, -20px) rotate(1deg); }
          66% { transform: translate(20px, -10px) rotate(-1deg); }
        }
        
        @keyframes logoFloat {
          0%, 100% { 
            transform: translateZ(0) translateY(0px) scale(1); 
          }
          50% { 
            transform: translateZ(0) translateY(-8px) scale(1.02); 
          }
        }
        
        @keyframes shine {
          0%, 100% { opacity: 0; }
          50% { opacity: 1; }
        }
        
        @keyframes loading {
          0% { 
            transform: translateX(-100%); 
          }
          50% {
            transform: translateX(0%);
          }
          100% { 
            transform: translateX(150%); 
          }
        }
        
        @keyframes fadeIn {
          to {
            opacity: 1;
          }
        }
        
        @keyframes fadeInUp {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        /* 减少重绘 */
        .logo, .loading::after {
          transform: translateZ(0);
        }
        
        /* 暗色模式支持 */
        @media (prefers-color-scheme: dark) {
          body {
            background: linear-gradient(180deg, #1f2937 0%, #111827 50%, #0f172a 100%);
            color: #f9fafb;
          }
          
          .title {
            color: #f9fafb;
          }
          
          .subtitle {
            color: #9ca3af;
          }
          
          .loading {
            background: #374151;
            box-shadow: inset 0 1px 3px rgba(255, 255, 255, 0.1);
          }
          
          .progress-text {
            color: #6b7280;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo-container">
          <div class="logo">⚡</div>
        </div>
        <div class="title">Electron Serial</div>
        <div class="subtitle">正在启动应用</div>
        <div class="loading-container">
          <div class="loading"></div>
        </div>
        <div class="progress-text">正在初始化组件...</div>
      </div>
      
      <script>
        // 优化的进度文本更新
        const progressTexts = [
          '正在初始化组件...',
          '正在加载配置文件...',
          '正在启动串口服务...',
          '正在准备用户界面...',
          '即将完成...'
        ];
        
        let currentIndex = 0;
        const progressElement = document.querySelector('.progress-text');
        
        // 每300ms更换一次文本，添加平滑过渡
        const textInterval = setInterval(() => {
          currentIndex = (currentIndex + 1) % progressTexts.length;
          if (progressElement) {
            progressElement.style.opacity = '0.6';
            setTimeout(() => {
              progressElement.textContent = progressTexts[currentIndex];
              progressElement.style.opacity = '1';
            }, 150);
          }
        }, 300);
        
        // 1.4秒后停止更换文本，显示最终状态
        setTimeout(() => {
          clearInterval(textInterval);
          if (progressElement) {
            progressElement.style.opacity = '0.6';
            setTimeout(() => {
              progressElement.textContent = '启动完成';
              progressElement.style.opacity = '1';
              progressElement.style.color = '#059669'; // 成功绿色
            }, 150);
          }
        }, 1400);
      </script>
    </body>
    </html>
  `;
  splash.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHTML)}`);
  
  // 等待内容加载完成后再显示窗口，避免透明闪烁
  splash.webContents.once('did-finish-load', () => {
    splash.show();
    splash.center(); // 确保窗口居中显示
  });
  
  return splash;
}
