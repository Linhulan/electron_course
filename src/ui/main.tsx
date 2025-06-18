import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n' // 初始化i18n
import App from './App.tsx'

// 隐藏加载指示器的函数
const hideLoadingScreen = () => {
  const loadingElement = document.getElementById('loading');
  const rootElement = document.getElementById('root');
  
  if (loadingElement && rootElement) {
    // 启用硬件加速
    loadingElement.style.willChange = 'opacity';
    rootElement.style.willChange = 'opacity';
    
    // 添加已加载类
    document.body.classList.add('app-loaded');
    
    // 确保过渡完成后清理
    setTimeout(() => {
      loadingElement.remove();
      // 清理 will-change 属性以释放 GPU 资源
      rootElement.style.willChange = '';
    }, 300); // 等待淡出动画完成
  }
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App onAppReady={hideLoadingScreen} />
  </StrictMode>,
)
