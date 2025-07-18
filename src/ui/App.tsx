import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { HashRouter as Router, Routes, Route } from "react-router-dom";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { UpdateNotification } from "./components/UpdateNotification";
import { useAppConfigStore } from "./contexts/store";
import { usePageNavigation } from "./hooks/usePageNavigation";
import { useUpdateListener } from "./hooks/useUpdateListener";
import "./App.css";
import { SerialPortPanel } from "./SerialPortPanel";
import { CounterDashboard } from "./CounterDashboard";
import { FileManagerPage } from "./components/FileManagerPage";
import { ImportDataViewer } from "./ImportDataViewer";
import { Sidebar, PageType } from "./Sidebar";
import { Toaster } from "react-hot-toast";

interface AppProps {
  onAppReady?: () => void;
}

// 主应用内容组件
function AppContent({ onAppReady }: AppProps) {
  const { t, ready } = useTranslation();
  const { theme } = useAppConfigStore();
  const { currentPage, navigateToPage, getPageTitle } = usePageNavigation();
  
  // 初始化更新监听器
  useUpdateListener();

  // 应用主题到根元素
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "light") {
      root.setAttribute("data-theme", "light");
    } else {
      root.removeAttribute("data-theme"); // dark 是默认主题
    }
  }, [theme]);

  // 当应用完全加载后通知隐藏加载屏幕
  useEffect(() => {
    if (ready && onAppReady) {
      // 延迟一点时间确保渲染完成
      const timer = setTimeout(() => {
        onAppReady();
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [ready, onAppReady]);

  const handlePageChange = (newPage: PageType) => {
    console.log(`handlePageChange: Navigating to page: ${newPage}`);
    navigateToPage(newPage);
  };

  return (
    <>
      <Header title={getPageTitle(t)} />
      <div className="app-layout">
        <Sidebar currentPage={currentPage} onPageChange={handlePageChange} />
        <main className="main-content">
          <Routes>
            <Route
              path="/"
              element={
                    <CounterDashboard className="page-content" />
              }
            />
            {import.meta.env.DEV && (
              <Route
                path="/serial-port"
                element={
                      <SerialPortPanel className="page-content" />
                }
              />
            )}
            {import.meta.env.DEV && (
              <Route
                path="/file-manager"
                element={
                    <FileManagerPage className="page-content" />
                }
              />
            )}
            <Route
              path="/import-viewer"
              element={
                    <ImportDataViewer className="page-content" />
              }
            />
          </Routes>
        </main>
      </div>
      <Toaster position="top-right" />
    </>
  );
}

function App({ onAppReady }: AppProps) {
  return (
    <Router>
        <AppContent onAppReady={onAppReady} />
    </Router>
  );
}

function Header({ title }: { title: string }) {
  const { theme, setTheme } = useAppConfigStore();
  const [isMaximized, setIsMaximized] = useState(false);

  const toggleTheme = (e: React.MouseEvent) => {
    const x = e.clientX;
    const y = e.clientY;
    const targetRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );
    const transition = document.startViewTransition(() => {
      setTheme(theme === "light" ? "dark" : "light");
    });

    transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0% at ${x}px ${y}px)`,
            `circle(${targetRadius}px at ${x}px ${y}px)`,
          ],
          easing: "ease-in-out",
        },
        {
          duration: 500,
          pseudoElement: "::view-transition-new(root)",
        }
      );
    });
  };

  const handleMaximize = () => {
    window.electron.sendFrameAction("MAXIMIZE");
    setIsMaximized(!isMaximized);
  };

  return (
    <header>
      <div className="header-left">
        <span className="app-title">{title}</span>
      </div>
      <div className="header-right">
        <button
          className="theme-switcher"
          onClick={toggleTheme}
          title={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
        >
          {theme === "light" ? "◐" : "◑"}
        </button>
        <UpdateNotification />
        <LanguageSwitcher compact className="header-language-switcher" />
        <button
          id="minimize"
          onClick={() => window.electron.sendFrameAction("MINIMIZE")}
          title="Minimize"
        ></button>
        <button
          id="maximize"
          onClick={handleMaximize}
          title={isMaximized ? "Restore" : "Maximize"}
          className={isMaximized ? "maximized" : ""}
        ></button>
        <button
          id="close"
          onClick={() => window.electron.sendFrameAction("CLOSE")}
          title="Close"
        ></button>
      </div>
    </header>
  );
}

export default App;
