import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './FileManager.css';

// 文件管理 Hook
export const useFileManager = () => {
  const [exportHistory, setExportHistory] = useState<ExportFileInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [defaultExportDir, setDefaultExportDir] = useState<string>('');

  // 加载导出历史
  const loadExportHistory = async () => {
    try {
      const history = await window.electron.getExportHistory();
      setExportHistory(history);
    } catch (error) {
      console.error('Failed to load export history:', error);
    }
  };

  // 加载默认导出目录
  const loadDefaultExportDir = async () => {
    try {
      const dir = await window.electron.getDefaultExportDir();
      setDefaultExportDir(dir);
    } catch (error) {
      console.error('Failed to load default export directory:', error);
    }
  };

  // 导出 Excel
  const exportExcel = async (sessionData: any[], options: ExportOptions = {}) => {
    setIsLoading(true);
    try {
      const result = await window.electron.exportExcel(sessionData, {
        useDefaultDir: true,
        openAfterExport: false,
        ...options
      });
      
      if (result.success) {
        await loadExportHistory(); // 刷新历史记录
        return result;
      } else {
        throw new Error(result.error || 'Export failed');
      }
    } catch (error) {
      console.error('Excel export failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // 导出 PDF
  const exportPDF = async (sessionData: any[], options: ExportOptions = {}) => {
    setIsLoading(true);
    try {
      const result = await window.electron.exportPDF(sessionData, {
        useDefaultDir: true,
        openAfterExport: false,
        ...options
      });
      
      if (result.success) {
        await loadExportHistory(); // 刷新历史记录
        return result;
      } else {
        throw new Error(result.error || 'Export failed');
      }
    } catch (error) {
      console.error('PDF export failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // 打开文件
  const openFile = async (filePath: string) => {
    try {
      const success = await window.electron.openFile(filePath);
      if (!success) {
        throw new Error('Failed to open file');
      }
    } catch (error) {
      console.error('Failed to open file:', error);
      throw error;
    }
  };

  // 在文件夹中显示文件
  const showInFolder = async (filePath: string) => {
    try {
      await window.electron.showInFolder(filePath);
    } catch (error) {
      console.error('Failed to show in folder:', error);
      throw error;
    }
  };

  // 删除文件
  const deleteFile = async (filePath: string) => {
    try {
      const success = await window.electron.deleteFile(filePath);
      if (success) {
        await loadExportHistory(); // 刷新历史记录
      }
      return success;
    } catch (error) {
      console.error('Failed to delete file:', error);
      throw error;
    }
  };

  // 设置默认导出目录
  const setDefaultDir = async (dirPath: string) => {
    try {
      const success = await window.electron.setDefaultExportDir(dirPath);
      if (success) {
        setDefaultExportDir(dirPath);
      }
      return success;
    } catch (error) {
      console.error('Failed to set default export directory:', error);
      throw error;
    }
  };

  // 初始化
  useEffect(() => {
    loadExportHistory();
    loadDefaultExportDir();
  }, []);

  return {
    exportHistory,
    isLoading,
    defaultExportDir,
    exportExcel,
    exportPDF,
    openFile,
    showInFolder,
    deleteFile,
    setDefaultDir,
    refreshHistory: loadExportHistory
  };
};

// 文件历史记录组件示例
export const FileHistoryPanel: React.FC = () => {
  const { t } = useTranslation();
  const {
    exportHistory,
    isLoading,
    openFile,
    showInFolder,
    deleteFile,
    refreshHistory
  } = useFileManager();

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };
  if (isLoading) {
    return <div className="loading">{t('fileManager.loadingHistory', 'Loading export history...')}</div>;
  }

  return (
    <div className="file-history-panel">
      <div className="panel-header">
        <h3>{t('fileManager.exportHistory')}</h3>
        <button onClick={refreshHistory} className="refresh-btn">
          {t('fileManager.refreshHistory')}
        </button>
      </div>
      
      {exportHistory.length === 0 ? (
        <div className="empty-state">
          <p>{t('fileManager.noFilesFound')}</p>
        </div>
      ) : (
        <div className="file-list">
          {exportHistory.map((file) => (
            <div key={file.id} className="file-item">
              <div className="file-info">
                <div className="file-name">{file.filename}</div>
                <div className="file-meta">
                  <span className="file-type">{file.fileType.toUpperCase()}</span>
                  <span className="file-size">{formatFileSize(file.size)}</span>
                  <span className="file-date">{formatDate(file.createdAt)}</span>
                  <span className="session-count">{file.sessionCount} sessions</span>
                </div>
              </div>
                <div className="file-actions">
                <button
                  onClick={() => openFile(file.filePath)}
                  className="action-btn open-btn"
                  title={t('fileManager.openFile')}
                >
                  {t('fileManager.openFile')}
                </button>
                <button
                  onClick={() => showInFolder(file.filePath)}
                  className="action-btn folder-btn"
                  title={t('fileManager.showInFolder')}
                >
                  {t('fileManager.showInFolder')}
                </button>
                <button
                  onClick={() => {
                    if (confirm(t('fileManager.confirmDelete', { filename: file.filename }))) {
                      deleteFile(file.filePath);
                    }
                  }}
                  className="action-btn delete-btn"
                  title={t('fileManager.deleteFile')}
                >
                  {t('fileManager.deleteFile')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// 导出设置组件
export const ExportSettings: React.FC = () => {
  const { t } = useTranslation();
  const { defaultExportDir, setDefaultDir } = useFileManager();
  const [isChangingDir, setIsChangingDir] = useState(false);
  const handleSetDefaultDirectory = async () => {
    setIsChangingDir(true);
    try {
      // 这里可以集成目录选择对话框
      // 目前使用简单的 prompt 作为示例
      const newDir = prompt(t('fileManager.enterDirectory'), defaultExportDir);
      if (newDir && newDir !== defaultExportDir) {
        const success = await setDefaultDir(newDir);
        if (success) {
          alert(t('fileManager.directoryUpdated'));
        } else {
          alert(t('fileManager.directoryUpdateFailed'));
        }
      }
    } catch (error) {
      console.error('Failed to change directory:', error);
      alert(t('fileManager.directoryUpdateFailed'));
    } finally {
      setIsChangingDir(false);
    }
  };
  return (
    <div className="export-settings">
      <div className="setting-item">
        <label className="setting-label">{t('fileManager.defaultDirectory')}:</label>
        <div className="directory-control">
          <span className="directory-path" title={defaultExportDir}>
            {defaultExportDir || t('fileManager.notSet')}
          </span>
          <button 
            className="change-dir-btn"
            onClick={handleSetDefaultDirectory}
            disabled={isChangingDir}
          >
            {isChangingDir ? t('fileManager.setting') : t('fileManager.change')}
          </button>
        </div>
      </div>
      
      <div className="setting-item">
        <label className="setting-label">{t('fileManager.exportOptions')}:</label>
        <div className="options-info">
          <p className="info-text">
            • {t('fileManager.autoSaveInfo')}
          </p>
          <p className="info-text">
            • {t('fileManager.historyInfo')}
          </p>
          <p className="info-text">
            • {t('fileManager.formatsInfo')}
          </p>
        </div>
      </div>
    </div>
  );
};
