import { useNavigate, useLocation } from 'react-router-dom';
import { useCallback } from 'react';
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

/**
 * 页面导航Hook
 * 提供页面切换功能和当前页面信息
 */
export const usePageNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // 获取当前页面类型
  const currentPage = ROUTE_PAGES[location.pathname] || "counter-dashboard";

  // 导航到指定页面
  const navigateToPage = useCallback((page: PageType) => {
    const route = PAGE_ROUTES[page];
    if (route && route !== location.pathname) {
      navigate(route);
    }
  }, [navigate, location.pathname]);

  // 获取页面标题的辅助函数
  const getPageTitle = useCallback((t: any) => {
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
