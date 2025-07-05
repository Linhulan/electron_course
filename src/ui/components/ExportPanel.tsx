import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SessionData } from '../common/types';
import './ExportPanel.css';
import { useAppConfigStore } from '../contexts/store';
import { generateSessionNoFromId } from '../protocols';

// 使用 Electron 的导出结果类型
interface ElectronExportResult {
  success: boolean;
  filePath?: string;
  fileInfo?: {
    id: string;
    filename: string;
    filePath: string;
    fileType: 'excel' | 'pdf';
    size: number;
    createdAt: string;
    sessionCount: number;
  };
  error?: string;
}

interface ExportPanelProps {
  isOpen: boolean;
  sessionData: SessionData[];
  onExportComplete?: (result: ElectronExportResult) => void;
  onImportComplete?: (result: any) => void; // 添加导入完成回调
  onClose?: () => void;
}

const ExportPanel: React.FC<ExportPanelProps> = ({ 
  isOpen,
  sessionData, 
  onExportComplete,
  onImportComplete,
  onClose 
}) => {
  const { t } = useTranslation();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false); // 添加导入状态
  const [exportStatus, setExportStatus] = useState<string>('');
  const [filename, setFilename] = useState(() => {
    // 生成适合文件名的时间戳（去除冒号等非法字符）
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    return `session_report_${timestamp}`;
  });
  const setAutoSave = useAppConfigStore((state) => state.setAutoSave);
  const autoSave = useAppConfigStore((state) => state.autoSave);
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export'); // 添加Tab状态

  // 当面板打开或sessionData变化时，更新文件名
  useEffect(() => {
    if (isOpen && sessionData.length > 0) {
      const len = sessionData.length;
      // 生成适合文件名的时间戳（去除非法字符）
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      
      // 如果有数据，设置默认文件名
      if (len > 1) {
        setFilename(`CounterReport_#${generateSessionNoFromId(sessionData[0].id)}~${generateSessionNoFromId(sessionData[len - 1].id)}_${timestamp}`);
      }
      else if (len === 1) {
        setFilename(`CounterReport_#${generateSessionNoFromId(sessionData[0].id)}_${timestamp}`);
      }
      console.log('Filename updated for session data:', { len, firstNo: sessionData[0]?.id, lastNo: sessionData[len - 1]?.id });
    }
  }, [isOpen, sessionData]);

  // 添加ESC键关闭功能
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        console.log('ESC key pressed, closing panel');
        onClose?.();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
      // 防止背景滚动
      document.body.style.overflow = 'hidden';
      console.log('Export panel opened, ESC key listener added');
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);
  /**
   * 处理Excel导出
   */
  const handleExportExcel = async () => {
    if (sessionData.length === 0) {
      setExportStatus(`❌ ${t('exportPanel.noDataToExport')}`);
      return;
    }

    setIsExporting(true);
    setExportStatus(`📊 ${t('exportPanel.generatingExcel')}`);

    try {
      const result = await window.electron.exportExcel(sessionData, {
        filename: `${filename}.xlsx`,
        useDefaultDir: true,
        openAfterExport: true
      });
      
      if (result.success) {
        setExportStatus(`✅ ${t('exportPanel.exportSuccessExcel')} ${result.filePath}`);
        onExportComplete?.(result);
      } else {
        setExportStatus(`❌ ${t('exportPanel.exportFailedExcel')} ${result.error}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      setExportStatus(`❌ ${t('exportPanel.exportErrorExcel')} ${errorMessage}`);
    } finally {
      setIsExporting(false);
    }
  };
  /**
   * 处理PDF导出
   */
  const handleExportPDF = async () => {
    if (sessionData.length === 0) {
      setExportStatus(`❌ ${t('exportPanel.noDataToExport')}`);
      return;
    }

    setIsExporting(true);
    setExportStatus(`📄 ${t('exportPanel.generatingPDF')}`);

    try {
      const result = await window.electron.exportPDF(sessionData, {
        filename: `${filename}.pdf`,
        useDefaultDir: true,
        openAfterExport: true
      });
      
      if (result.success) {
        setExportStatus(`✅ ${t('exportPanel.exportSuccessPDF')} ${result.filePath}`);
        onExportComplete?.(result);
      } else {
        setExportStatus(`❌ ${t('exportPanel.exportFailedPDF')} ${result.error}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      setExportStatus(`❌ ${t('exportPanel.exportErrorPDF')} ${errorMessage}`);
    } finally {
      setIsExporting(false);
    }
  };
  /**
   * 处理批量导出
   */
  const handleBatchExport = async () => {
    if (sessionData.length === 0) {
      setExportStatus(`❌ ${t('exportPanel.noDataToExport')}`);
      return;
    }

    setIsExporting(true);
    setExportStatus(`🚀 ${t('exportPanel.batchExporting')}`);

    try {
      const [excelResult, pdfResult] = await Promise.all([
        window.electron.exportExcel(sessionData, {
          filename: `${filename}_excel.xlsx`,
          useDefaultDir: true,
          openAfterExport: false
        }),
        window.electron.exportPDF(sessionData, {
          filename: `${filename}_pdf.pdf`,
          useDefaultDir: true,
          openAfterExport: false
        })
      ]);

      const excelStatus = excelResult.success ? '✅' : '❌';
      const pdfStatus = pdfResult.success ? '✅' : '❌';
      
      setExportStatus(`${t('exportPanel.batchCompleted')} ${excelStatus} PDF ${pdfStatus}`);
      
      if (excelResult.success) {
        onExportComplete?.(excelResult);
      }
      if (pdfResult.success) {
        onExportComplete?.(pdfResult);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      setExportStatus(`❌ ${t('exportPanel.exportErrorBatch')} ${errorMessage}`);
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * 处理Excel文件导入
   */
  const handleImportExcel = async () => {
    setIsImporting(true);
    setExportStatus(`Selecting file...`);

    try {
      const result = await window.electron.importFromExcel();
      
      if (result.success && result.sessionData) {
        setExportStatus(`SUCCESS: ${t('exportPanel.importSuccess', 'Import successful!')} (${result.importedCount} sessions)`);
        onImportComplete?.(result);
      } else {
        const errorMsg = result.errors?.join(', ') || t('exportPanel.importFailed', 'Import failed');
        setExportStatus(`ERROR: ${errorMsg}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setExportStatus(`ERROR: ${t('exportPanel.importError', 'Import error:')} ${errorMessage}`);
    } finally {
      setIsImporting(false);
    }
  };

  /**
   * 处理目录批量导入
   */
  const handleImportDirectory = async () => {
    setIsImporting(true);
    setExportStatus(`Scanning directory...`);

    try {
      const result = await window.electron.importFromDirectory();
      
      if (result.success && result.sessionData) {
        const message = `SUCCESS: ${t('exportPanel.batchImportSuccess', 'Batch import successful!')} (${result.importedCount} sessions imported, ${result.skippedCount || 0} skipped)`;
        setExportStatus(message);
        onImportComplete?.(result);
      } else {
        const errorMsg = result.errors?.join(', ') || t('exportPanel.batchImportFailed', 'Batch import failed');
        setExportStatus(`ERROR: ${errorMsg}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setExportStatus(`ERROR: ${t('exportPanel.batchImportError', 'Batch import error:')} ${errorMessage}`);
    } finally {
      setIsImporting(false);
    }
  };

  /**
   * 清除状态消息
   */
  const clearStatus = () => {
    setExportStatus('');
  };

  /**
   * 处理遮罩点击关闭
   */
  const handleOverlayClick = (e: React.MouseEvent) => {
    // 确保点击的是遮罩层本身，而不是子元素
    if (e.target === e.currentTarget) {
      console.log('Overlay clicked, closing panel');
      onClose?.();
    }
  };

  /**
   * 处理关闭按钮点击
   */
  const handleCloseClick = () => {
    console.log('Close button clicked, closing panel');
    onClose?.();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* 背景遮罩 */}
      <div 
        className="export-panel-overlay" 
        onClick={handleOverlayClick}
      />
      
      {/* 导出面板模态框 */}
      <div className={`export-panel-modal ${isOpen ? 'open' : ''}`}>
        <div className="export-panel">
          <div className="export-panel-header">
            <h3>📊 {t('exportPanel.title')}</h3>
            <div className="header-right">
              <span className="data-count">
                {sessionData.length} {t('exportPanel.sessionCount')}
              </span>
              {onClose && (
                <button 
                  className="export-panel-close-btn" 
                  onClick={handleCloseClick}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

      <div className="export-options">
        <div className="option-group">
          <label htmlFor="filename">{t('exportPanel.filename')}:</label>
          <input
            id="filename"
            type="text"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            placeholder={t('exportPanel.filenamePlaceholder')}
            disabled={isExporting}
          />
        </div>

        <div className="option-group">
          <label>
            <input
              type="checkbox"
              checked={autoSave}
              onChange={(e) => setAutoSave(e.target.checked)}
              disabled={isExporting}
            />
            {t('exportPanel.autoSave')}
          </label>
        </div>
      </div>

      <div className="export-buttons">
        <button
          className="export-btn excel-btn"
          onClick={handleExportExcel}
          disabled={isExporting || sessionData.length === 0}
        >
          {isExporting ? t('exportPanel.exporting') : `📊 ${t('exportPanel.exportExcel')}`}
        </button>

        <button
          className="export-btn pdf-btn"
          onClick={handleExportPDF}
          disabled={isExporting || sessionData.length === 0}
        >
          {isExporting ? t('exportPanel.exporting') : `📄 ${t('exportPanel.exportPDF')}`}
        </button>

        <button
          className="export-btn batch-btn"
          onClick={handleBatchExport}
          disabled={isExporting || sessionData.length === 0}
        >
          {isExporting ? t('exportPanel.exporting') : `🚀 ${t('exportPanel.batchExport')}`}
        </button>
      </div>

      {exportStatus && (
        <div className="export-status">
          <div className="status-message">
            {exportStatus}
          </div>
          <button 
            className="clear-status-btn"
            onClick={clearStatus}
          >
            ✕
          </button>
        </div>
      )}      <div className="export-info">
        <h4>📋 {t('exportPanel.exportInfo')}</h4>
        <ul>
          <li><strong>{t('exportPanel.exportExcel')}:</strong> {t('exportPanel.excelDescription')}</li>
          <li><strong>{t('exportPanel.exportPDF')}:</strong> {t('exportPanel.pdfDescription')}</li>
          <li><strong>{t('exportPanel.batchExport')}:</strong> {t('exportPanel.batchDescription')}</li>
          <li><strong>{t('fileManager.defaultDirectory')}:</strong> {t('exportPanel.fileLocationDescription')}</li>
        </ul>
      </div>
        </div>
      </div>
    </>
  );
};

export default ExportPanel;
