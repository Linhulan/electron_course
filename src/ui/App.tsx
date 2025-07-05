import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { useAppConfigStore } from "./contexts/store";
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

function App({ onAppReady }: AppProps) {
  const [currentPage, setCurrentPage] = useState<PageType>("counter-dashboard");
  const { t, ready } = useTranslation();
  const { theme } = useAppConfigStore();

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
    setCurrentPage(newPage);
  };
  const getPageTitle = () => {
    switch (currentPage) {
      case "serial-port":
        return t("serialPort.title");
      case "counter-dashboard":
        return t("counter.title");
      case "file-manager":
        return t("fileManager.title");
      case "import-viewer":
        return t("importViewer.title");
      default:
        return t("app.title");
    }
  };

  return (
    <>
      <Header title={getPageTitle()} />
      <div className="app-layout">
        <Sidebar currentPage={currentPage} onPageChange={handlePageChange} />
        <main className="main-content">
          <div
            className={`page-container ${
              currentPage === "serial-port" ? "active" : "hidden"
            }`}
          >
            {/* 开发模式下展示串口页面 */}
            <SerialPortPanel className="page-content" />
           
          </div>
          <div
            className={`page-container ${
              currentPage === "counter-dashboard" ? "active" : "hidden"
            }`}
          >
            <CounterDashboard className="page-content" />
          </div>
          <div
            className={`page-container ${
              currentPage === "file-manager" ? "active" : "hidden"
            }`}
          >
            <FileManagerPage className="page-content" />
          </div>
          <div
            className={`page-container ${
              currentPage === "import-viewer" ? "active" : "hidden"
            }`}
          >
            <ImportDataViewer className="page-content" />
          </div>
        </main>
      </div>
      <Toaster position="top-right" />
    </>
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
