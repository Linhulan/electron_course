import React from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import './Sidebar.css';

export type PageType = 'serial-port' | 'counter-dashboard';

interface SidebarProps {
  currentPage: PageType;
  onPageChange: (page: PageType) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onPageChange }) => {
  const { t } = useTranslation();
  
  const menuItems = [
    {
      id: 'serial-port' as PageType,
      label: t('sidebar.serialPort'),
      icon: '🔌',
      description: t('sidebar.serialPortDesc')
    },
    {
      id: 'counter-dashboard' as PageType,
      label: t('sidebar.counterDashboard'),
      icon: '💰',
      description: t('sidebar.counterDashboardDesc')
    }
  ];

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title">
          <span className="sidebar-icon">📊</span>
          <span className="sidebar-text">{t('sidebar.controlPanel')}</span>
        </div>
      </div>
      
      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <button
            key={item.id}
            className={`sidebar-item ${currentPage === item.id ? 'active' : ''}`}
            onClick={() => onPageChange(item.id)}
            title={item.description}
          >
            <span className="sidebar-item-icon">{item.icon}</span>
            <span className="sidebar-item-label">{item.label}</span>
          </button>
        ))}
      </nav>
        <div className="sidebar-footer">
        <LanguageSwitcher dropdownDirection="right" />
        <div className="sidebar-version">
          <span>{t('common.version')} 1.0.0</span>
        </div>
      </div>
    </div>
  );
};
