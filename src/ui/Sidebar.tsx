import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { useAppVersion } from "./hooks/useAppVersion";
import "./Sidebar.css";

export type PageType = "serial-port" | "counter-dashboard" | "file-manager" | "import-viewer";

interface SidebarProps {
  currentPage: PageType;
  onPageChange: (page: PageType) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onPageChange,
}) => {
  const { t } = useTranslation();
  const { version, loading } = useAppVersion();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const menuItems = import.meta.env.DEV
    ? [
        {
          id: "serial-port" as PageType,
          label: t("sidebar.serialPort"),
          icon: "🔌",
          description: t("sidebar.serialPortDesc"),
        },
        {
          id: "counter-dashboard" as PageType,
          label: t("sidebar.counterDashboard"),
          icon: "💰",
          description: t("sidebar.counterDashboardDesc"),
        },
        {
          id: "file-manager" as PageType,
          label: t("sidebar.fileManager"),
          icon: "📁",
          description: t("sidebar.fileManagerDesc"),
        },
        {
          id: "import-viewer" as PageType,
          label: t("sidebar.importViewer"),
          icon: "📊",
          description: t("sidebar.importViewerDesc"),
        },
      ]
    : [
        {
          id: "counter-dashboard" as PageType,
          label: t("sidebar.counterDashboard"),
          icon: "💰",
          description: t("sidebar.counterDashboardDesc"),
        },
        {
          id: "import-viewer" as PageType,
          label: t("sidebar.importViewer"),
          icon: "📊",
          description: t("sidebar.importViewerDesc"),
        },
      ];

  return (
    <div className={`sidebar ${isCollapsed ? "collapsed" : ""}`}>
      <div className="sidebar-header">
        {" "}
        <div className="sidebar-title">
          <button
            className="sidebar-icon-button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? t("sidebar.expand") : t("sidebar.collapse")}
          >
            <span className="sidebar-icon">☰</span>
          </button>
          {!isCollapsed && (
            <span className="sidebar-text">{t("sidebar.controlPanel")}</span>
          )}
        </div>
      </div>{" "}
      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <button
            key={item.id}
            className={`sidebar-item ${
              currentPage === item.id ? "active" : ""
            }`}
            onClick={() => onPageChange(item.id)}
            title={item.description}
          >
            <span className="sidebar-item-icon">{item.icon}</span>
            {!isCollapsed && (
              <span className="sidebar-item-label">{item.label}</span>
            )}
          </button>
        ))}
      </nav>
      {!isCollapsed && (
        <div className="sidebar-footer">
          <LanguageSwitcher dropdownDirection="right" />
          <div className="sidebar-version">
            <span>
              {t("common.version")} {loading ? "..." : version}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
