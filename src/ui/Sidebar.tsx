import React from 'react';
import './Sidebar.css';

export type PageType = 'serial-port' | 'counter-dashboard';

interface SidebarProps {
  currentPage: PageType;
  onPageChange: (page: PageType) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onPageChange }) => {
  const menuItems = [
    {
      id: 'serial-port' as PageType,
      label: '串口监控',
      icon: '🔌',
      description: 'Serial Port Monitor'
    },
    {
      id: 'counter-dashboard' as PageType,
      label: '点钞数据',
      icon: '💰',
      description: 'Money Counter Dashboard'
    }
  ];

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title">
          <span className="sidebar-icon">📊</span>
          <span className="sidebar-text">控制面板</span>
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
        <div className="sidebar-version">
          <span>Version 1.0.0</span>
        </div>
      </div>
    </div>
  );
};
