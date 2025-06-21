import React, { useState, useEffect } from 'react';
import { 
  exportSessionsToExcel, 
  exportSessionsToPDF, 
  type ConvertResult 
} from '../utils/convertFile';
import { SessionData } from '../utils/serialization';
import './ExportPanel.css';

interface ExportPanelProps {
  isOpen: boolean;
  sessionData: SessionData[];
  onExportComplete?: (result: ConvertResult) => void;
  onClose?: () => void;
}

const ExportPanel: React.FC<ExportPanelProps> = ({ 
  isOpen,
  sessionData, 
  onExportComplete,
  onClose 
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string>('');
  const [filename, setFilename] = useState(`session_report_${new Date().toISOString().split('T')[0]}`);
  const [includeCharts, setIncludeCharts] = useState(true);

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
      setExportStatus('❌ 没有可导出的数据');
      return;
    }

    setIsExporting(true);
    setExportStatus('📊 正在生成Excel文件...');

    try {
      const result = await exportSessionsToExcel(sessionData, filename);
      
      if (result.success) {
        setExportStatus(`✅ Excel导出成功！文件已保存到: ${result.filePath}`);
        onExportComplete?.(result);
      } else {
        setExportStatus(`❌ Excel导出失败: ${result.error}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      setExportStatus(`❌ Excel导出异常: ${errorMessage}`);
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * 处理PDF导出
   */
  const handleExportPDF = async () => {
    if (sessionData.length === 0) {
      setExportStatus('❌ 没有可导出的数据');
      return;
    }

    setIsExporting(true);
    setExportStatus('📄 正在生成PDF文件...');

    try {
      const result = await exportSessionsToPDF(sessionData, filename, includeCharts);
      
      if (result.success) {
        setExportStatus(`✅ PDF导出成功！文件已保存到: ${result.filePath}`);
        onExportComplete?.(result);
      } else {
        setExportStatus(`❌ PDF导出失败: ${result.error}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      setExportStatus(`❌ PDF导出异常: ${errorMessage}`);
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * 处理批量导出
   */
  const handleBatchExport = async () => {
    if (sessionData.length === 0) {
      setExportStatus('❌ 没有可导出的数据');
      return;
    }

    setIsExporting(true);
    setExportStatus('🚀 正在批量导出Excel和PDF...');

    try {
      const [excelResult, pdfResult] = await Promise.all([
        exportSessionsToExcel(sessionData, `${filename}_excel`),
        exportSessionsToPDF(sessionData, `${filename}_pdf`, includeCharts)
      ]);

      const excelStatus = excelResult.success ? '✅' : '❌';
      const pdfStatus = pdfResult.success ? '✅' : '❌';
      
      setExportStatus(`批量导出完成: Excel ${excelStatus} PDF ${pdfStatus}`);
      
      if (excelResult.success) {
        onExportComplete?.(excelResult);
      }
      if (pdfResult.success) {
        onExportComplete?.(pdfResult);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      setExportStatus(`❌ 批量导出异常: ${errorMessage}`);
    } finally {
      setIsExporting(false);
    }
  };  /**
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
            <h3>📊 数据导出</h3>
            <div className="header-right">
              <span className="data-count">
                {sessionData.length} 条会话数据
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
          <label htmlFor="filename">文件名:</label>
          <input
            id="filename"
            type="text"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            placeholder="请输入文件名"
            disabled={isExporting}
          />
        </div>

        <div className="option-group">
          <label>
            <input
              type="checkbox"
              checked={includeCharts}
              onChange={(e) => setIncludeCharts(e.target.checked)}
              disabled={isExporting}
            />
            包含图表 (PDF)
          </label>
        </div>
      </div>

      <div className="export-buttons">
        <button
          className="export-btn excel-btn"
          onClick={handleExportExcel}
          disabled={isExporting || sessionData.length === 0}
        >
          {isExporting ? '导出中...' : '📊 导出Excel'}
        </button>

        <button
          className="export-btn pdf-btn"
          onClick={handleExportPDF}
          disabled={isExporting || sessionData.length === 0}
        >
          {isExporting ? '导出中...' : '📄 导出PDF'}
        </button>

        <button
          className="export-btn batch-btn"
          onClick={handleBatchExport}
          disabled={isExporting || sessionData.length === 0}
        >
          {isExporting ? '导出中...' : '🚀 批量导出'}
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
      )}

      <div className="export-info">
        <h4>📋 导出说明</h4>
        <ul>          <li><strong>Excel导出:</strong> 包含概览统计、详细数据和面额统计三个工作表</li>
          <li><strong>PDF导出:</strong> 生成格式化的报告，可选择包含图表</li>
          <li><strong>批量导出:</strong> 同时生成Excel和PDF两种格式</li>
          <li><strong>文件位置:</strong> 默认保存到项目的exports目录</li>
        </ul>
      </div>
        </div>
      </div>
    </>
  );
};

export default ExportPanel;
