import { useNavigate, useLocation } from 'react-router-dom';
import { useCallback, useEffect } from 'react';
import { PageType } from '../Sidebar';

// 页面路由映射
export const PAGE_ROUTES: Record<PageType, string> = {
  "counter-dashboard": "/",
  "serial-port": "/serial-port", 
  "file-manager": "/file-manager",
  "import-viewer": "/import-viewer",
};

// 路由页面映射
export const ROUTE_PAGES: Record<string, PageType> = {
  "/": "counter-dashboard",
  "/serial-port": "serial-port",
  "/file-manager": "file-manager", 
  "/import-viewer": "import-viewer",
};

// 生产环境允许的页面
const PRODUCTION_ALLOWED_PAGES: PageType[] = ["counter-dashboard", "import-viewer"];

// 检查页面是否在生产环境中可用
const isPageAvailableInProduction = (page: PageType): boolean => {
  return import.meta.env.DEV || PRODUCTION_ALLOWED_PAGES.includes(page);
};

/**
 * 页面导航Hook
 * 提供页面切换功能和当前页面信息
 */
export const usePageNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // 获取当前页面类型
  const currentPage = ROUTE_PAGES[location.pathname] || "counter-dashboard";

  // 添加调试信息
  useEffect(() => {
    console.log(`Route Debug - Current location:`, {
      pathname: location.pathname,
      hash: location.hash,
      search: location.search,
      currentPage,
      isDev: import.meta.env.DEV
    });
  }, [location, currentPage]);

  // 在生产环境中保护路由
  useEffect(() => {
    if (!isPageAvailableInProduction(currentPage)) {
      console.warn(`Page ${currentPage} is not available in production environment, redirecting to dashboard`);
      navigate("/", { replace: true });
    }
  }, [currentPage, navigate]);

  // 导航到指定页面（包含生产环境检查）
  const navigateToPage = useCallback((page: PageType) => {
    // 检查页面是否在当前环境中可用
    if (!isPageAvailableInProduction(page)) {
      console.warn(`Page ${page} is not available in production environment`);
      return;
    }
    
    const route = PAGE_ROUTES[page];
    if (route && route !== location.pathname) {
      navigate(route);
    }
  }, [navigate, location.pathname]);

  // 获取页面标题的辅助函数
  const getPageTitle = useCallback((t: { (key: string): string }) => {
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
  }, [currentPage]);

  return {
    currentPage,
    navigateToPage,
    getPageTitle,
    location,
  };
};
