import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUpdateStore } from '../hooks/useUpdateStore';
import './UpdateNotification.css';

export const UpdateNotification: React.FC = () => {
  const { t } = useTranslation();
  const [showDropdown, setShowDropdown] = useState(false);
  
  const {
    isUpdateAvailable,
    isUpdateDownloaded,
    isCheckingForUpdates,
    isDownloadingUpdate,
    updateInfo,
    downloadProgress,
    updateError,
    checkForUpdates,
    downloadUpdate,
    installUpdate
  } = useUpdateStore();

  // 如果没有更新相关状态，不显示组件
  if (!isUpdateAvailable && !isUpdateDownloaded && !isCheckingForUpdates && !isDownloadingUpdate) {
    return null;
  }

  const handleCheckForUpdates = () => {
    checkForUpdates();
    setShowDropdown(false);
  };

  const handleDownloadUpdate = () => {
    downloadUpdate();
    setShowDropdown(false);
  };

  const handleInstallUpdate = () => {
    installUpdate();
    setShowDropdown(false);
  };

  const getIconContent = () => {
    if (isCheckingForUpdates) {
      return '⏳';
    }
    if (isDownloadingUpdate) {
      return '📥';
    }
    if (isUpdateDownloaded) {
      return '🔄';
    }
    if (isUpdateAvailable) {
      return '🔔';
    }
    return '📥';
  };

  const getStatusText = () => {
    if (isCheckingForUpdates) {
      return t('update.checking', 'Checking for updates...');
    }
    if (isDownloadingUpdate) {
      const percent = downloadProgress?.percent || 0;
      return t('update.downloading', `Downloading... ${percent.toFixed(0)}%`);
    }
    if (isUpdateDownloaded) {
      return t('update.readyToInstall', 'Ready to install');
    }
    if (isUpdateAvailable) {
      return t('update.available', 'Update available');
    }
    return t('update.upToDate', 'Up to date');
  };

  return (
    <div className="update-notification">
      <button
        className={`update-icon ${isUpdateAvailable || isUpdateDownloaded ? 'has-update' : ''}`}
        onClick={() => setShowDropdown(!showDropdown)}
        title={getStatusText()}
      >
        {getIconContent()}
      </button>

      {showDropdown && (
        <div className="update-dropdown">
          <div className="update-dropdown-content">
            <div className="update-status">
              <span className="status-text">{getStatusText()}</span>
              {updateInfo && (
                <div className="update-info">
                  <div className="update-version">
                    {t('update.version', 'Version')}: {updateInfo.version}
                  </div>
                  {updateInfo.releaseDate && (
                    <div className="update-date">
                      {t('update.releaseDate', 'Release Date')}: {new Date(updateInfo.releaseDate).toLocaleDateString()}
                    </div>
                  )}
                </div>
              )}
            </div>

            {updateError && (
              <div className="update-error">
                <span className="error-text">{updateError.message}</span>
              </div>
            )}

            <div className="update-actions">
              {isUpdateAvailable && !isUpdateDownloaded && !isDownloadingUpdate && (
                <button 
                  className="update-btn download-btn"
                  onClick={handleDownloadUpdate}
                >
                  {t('update.download', 'Download Update')}
                </button>
              )}

              {isUpdateDownloaded && (
                <button 
                  className="update-btn install-btn"
                  onClick={handleInstallUpdate}
                >
                  {t('update.installAndRestart', 'Install & Restart')}
                </button>
              )}

              {!isUpdateAvailable && !isCheckingForUpdates && (
                <button 
                  className="update-btn check-btn"
                  onClick={handleCheckForUpdates}
                >
                  {t('update.checkForUpdates', 'Check for Updates')}
                </button>
              )}
            </div>

            {downloadProgress && isDownloadingUpdate && (
              <div className="download-progress">
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ width: `${downloadProgress.percent}%` }}
                  />
                </div>
                <div className="progress-text">
                  {downloadProgress.percent.toFixed(1)}% - {(downloadProgress.bytesPerSecond / 1024 / 1024).toFixed(1)} MB/s
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
