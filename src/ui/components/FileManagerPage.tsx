import React from 'react';
import { useTranslation } from 'react-i18next';
import { FileHistoryPanel, ExportSettings } from './FileManager';
import './FileManagerPage.css';

interface FileManagerPageProps {
  className?: string;
}

export const FileManagerPage: React.FC<FileManagerPageProps> = ({ className }) => {
  const { t } = useTranslation();

  return (
    <div className={`file-manager-page ${className || ''}`}>
      <div className="file-manager-header">
        <h2>{t('fileManager.title')}</h2>
        <p className="page-description">
          {t('sidebar.fileManagerDesc')}
        </p>
      </div>

      <div className="file-manager-content">
        {/* 设置区域 */}
        <div className="settings-section">
          <div className="section-header">
            <h3>{t('fileManager.exportSettings')}</h3>
            <p className="section-description">
              Configure export preferences and default directories
            </p>
          </div>
          
          <ExportSettings />
        </div>

        {/* 文件历史区域 */}
        <div className="history-section">
          <div className="section-header">
            <h3>{t('fileManager.exportHistory')}</h3>
            <p className="section-description">
              Manage and access your exported files
            </p>
          </div>
          
          <FileHistoryPanel />
        </div>
      </div>
    </div>
  );
};
