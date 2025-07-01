import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SessionData } from '../utils/serialization';
import './ExportPanel.css';
import { useAppConfigStore } from '../contexts/store';

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
  onClose?: () => void;
}

const ExportPanel: React.FC<ExportPanelProps> = ({ 
  isOpen,
  sessionData, 
  onExportComplete,
  onClose 
}) => {
  const { t } = useTranslation();
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string>('');
  const [filename, setFilename] = useState(`session_report_${new Date().toISOString()}`);
  const setAutoSave = useAppConfigStore((state) => state.setAutoSave);
  const autoSave = useAppConfigStore((state) => state.autoSave);

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

      const len = sessionData.length;
      // 如果有数据，设置默认文件名
      if (len > 1) {
        setFilename(`CounterReport_#${sessionData[0].no}_#${sessionData[len - 1].no}_${new Date().toISOString()}`);
      }
      else if (len === 1) {
        setFilename(`CounterReport_#${sessionData[0].no}_${new Date().toISOString()}`);
      }
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
  };/**
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
