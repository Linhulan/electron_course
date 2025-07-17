import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import "./SessionDetailDrawer.css";
import { debugLog } from "../protocols";
import ExportPanel from "./ExportPanel";
import { formatCurrency, formatDenomination } from "../common/common";
import { SessionData, CounterData } from "../common/types";

interface SessionDetailDrawerProps {
  isOpen: boolean;
  sessionData: SessionData | null;
  onClose: () => void;
}

export const SessionDetailDrawer: React.FC<SessionDetailDrawerProps> = ({
  isOpen,
  sessionData,
  onClose,
}) => {
  const { t } = useTranslation();
  const [showDetailedBreakdown, setShowDetailedBreakdown] = useState(false);
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [selectedCurrencyTab, setSelectedCurrencyTab] = useState<string>('');
  const [serialSearchTerm, setSerialSearchTerm] = useState<string>('');
  const [filteredDetails, setFilteredDetails] = useState<CounterData[]>([]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "counting":
        return "⏳";
      case "completed":
        return "✅";
      case "error":
        return "❌";
      case "paused":
        return "⏸️";
      default:
        return "⭕";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "counting":
        return t("counter.sessionStatus.counting");
      case "completed":
        return t("counter.sessionStatus.completed");
      case "error":
        return t("counter.sessionStatus.error");
      case "paused":
        return t("counter.sessionStatus.paused");
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "counting":
        return "#ffa500";
      case "completed":
        return "#28a745";
      case "error":
        return "#dc3545";
      case "paused":
        return "#6c757d";
      default:
        return "#6c757d";
    }
  };  const onExport = async () => {
    // 显示导出面板
    setShowExportPanel(true);
  };
  const handleExportComplete = (result: { success: boolean; filePath?: string; error?: string }) => {
    debugLog("Export completed:", result);
    // 可以在这里添加成功/失败的提示
    if (result.success) {
      console.log(`✅ 导出成功: ${result.filePath || 'Unknown path'}`);
    } else {
      console.error(`❌ 导出失败: ${result.error}`);
    }
  };
  // 获取可用的货币代码列表
  const getAvailableCurrencies = useCallback((): string[] => {
    if (!sessionData) return [];
    if (sessionData.currencyCountRecords) {
      return Array.from(sessionData.currencyCountRecords.keys()).sort();
    }
    return [];
  }, [sessionData]);

  // 检查是否有多种货币
  const hasMultipleCurrencies = (): boolean => {
    return getAvailableCurrencies().length > 1;
  };  // 获取当前选中Tab的面额数据
  const getCurrentTabDenominationData = () => {
    if (!sessionData) return { details: [], totalCount: 0, totalAmount: 0 };

    if (sessionData.currencyCountRecords && sessionData.currencyCountRecords.size > 0) {
      // 使用新的货币记录结构
      const record = sessionData.currencyCountRecords.get(selectedCurrencyTab);
      if (record) {
        const details = Array.from(record.denominationBreakdown.entries())
          .map(([, detail]) => detail) // DenominationDetail 已经包含 denomination 字段
          .sort((a, b) => b.denomination - a.denomination);
        return {
          details,
          totalCount: record.totalCount,
          totalAmount: record.totalAmount
        };
      }
    } else if (sessionData.denominationBreakdown) {
      // 兼容旧数据结构（单一货币）
      const details = Array.from(sessionData.denominationBreakdown.entries())
        .map(([, detail]) => detail)
        .sort((a, b) => b.denomination - a.denomination);
      return {
        details,
        totalCount: sessionData.totalCount,
        totalAmount: sessionData.totalAmount || 0
      };
    }
    
    return { details: [], totalCount: 0, totalAmount: 0 };
  };

  // 获取指定货币的总张数
  const getTotalCountByCurrency = (currencyCode: string): number => {
    if (!sessionData?.currencyCountRecords) return 0;
    const record = sessionData.currencyCountRecords.get(currencyCode);
    return record ? record.totalCount : 0;
  };  // 自动选择Tab
  useEffect(() => {
    if (!sessionData) return;
    
    const availableCurrencies = getAvailableCurrencies();
    if (availableCurrencies.length > 0) {
      // 如果当前选中的货币不存在，切换到第一个可用货币
      if (!availableCurrencies.includes(selectedCurrencyTab)) {
        setSelectedCurrencyTab(availableCurrencies[0]);
      }
    } else {
      // 如果没有货币数据，重置为空
      setSelectedCurrencyTab('');
    }
  }, [sessionData, selectedCurrencyTab, getAvailableCurrencies]);

  // 冠字号搜索逻辑
  useEffect(() => {
    if (!sessionData?.details) {
      setFilteredDetails([]);
      return;
    }

    if (!serialSearchTerm.trim()) {
      setFilteredDetails(sessionData.details);
      return;
    }

    const searchTerm = serialSearchTerm.toLowerCase();
    const filtered = sessionData.details.filter(detail =>
      detail.serialNumber?.toLowerCase().includes(searchTerm)
    );
    setFilteredDetails(filtered);
  }, [sessionData, serialSearchTerm]);

  if (!sessionData) {
    return null;
  }

  // 获取当前Tab的面额数据
  const { details: denominationArray, totalCount, totalAmount } = getCurrentTabDenominationData();

  return (
    <>
      {/* 背景遮罩 */}
      <div className={`drawer-overlay ${isOpen ? "open" : "close"}`} onClick={onClose} />

      {/* 抽屉主体 */}
      <div className={`session-detail-drawer ${isOpen ? "open" : "close"}`}>
        {/* 抽屉头部 */}
        <div className="drawer-header">
          <div className="drawer-title">
            <span className="session-icon">📊</span>
            <h3>
              {t("counter.sessionDetail.title")} #{sessionData.no}
            </h3>
          </div>
          <button className="drawer-close-btn" onClick={onClose}>
            <span>✕</span>
          </button>
        </div>

        {/* 抽屉内容 */}
        <div className="drawer-content">          {/* Session基本信息 */}
          <div className="detail-section">
            <h4 className="section-title">
              <span className="section-icon">ℹ️</span>
              {t("counter.sessionDetail.basicInfo")}
            </h4>
            <div className="info-grid">
              {/* 总体统计 */}
              <div className="info-item">
                <span className="info-label">
                  {t("counter.session.count")}:
                </span>
                <span className="info-value highlight">
                  {(sessionData.totalCount - sessionData.errorCount).toLocaleString()}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">
                  {t("counter.session.errorCount")}:
                </span>
                <span className="info-value error-value">
                  {sessionData.errorCount || 0}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">
                  {t("counter.session.status")}:
                </span>
                <span
                  className="info-value status-value"
                  style={{ color: getStatusColor(sessionData.status) }}
                >
                  {getStatusIcon(sessionData.status)}{" "}
                  {getStatusText(sessionData.status)}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">
                  {t("counter.sessionDetail.startTime")}:
                </span>
                <span className="info-value">{sessionData.startTime}</span>
              </div>
            </div>            {/* 各国货币统计 */}
            {sessionData.currencyCountRecords && sessionData.currencyCountRecords.size > 0 && (
              <div className="currency-breakdown">
                <h5 className="currency-breakdown-title">
                  <span className="section-icon">💱</span>
                  {t("counter.sessionDetail.currencyBreakdown", "货币统计")}
                </h5>
                {sessionData.currencyCountRecords.size <= 2 ? (
                  // 货币数量≤2时，使用卡片网格布局
                  <div className="currency-stats-grid">
                    {Array.from(sessionData.currencyCountRecords.entries()).map(([currencyCode, record]) => (
                      <div key={currencyCode} className="currency-stat-item">
                        <div className="currency-header">
                          <span className="currency-code">{currencyCode}</span>
                        </div>
                        <div className="currency-stats">
                          <div className="currency-stat">
                            <span className="stat-label">{t("counter.session.count")}</span>
                            <span className="stat-value">{record.totalCount.toLocaleString()}</span>
                          </div>
                          <div className="currency-stat">
                            <span className="stat-label">{t("counter.session.amount")}</span>
                            <span className="stat-value">{formatCurrency(record.totalAmount, { currency: currencyCode })}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  // 货币数量>2时，使用紧凑列表布局
                  <div className="currency-stats-list">
                    {Array.from(sessionData.currencyCountRecords.entries()).map(([currencyCode, record]) => (
                      <div key={currencyCode} className="currency-stat-row">
                        <div className="currency-info">
                          <span className="currency-code">{currencyCode}</span>
                        </div>
                        <div className="currency-values">
                          <span className="stat-item">
                            <span className="stat-label">{t("counter.session.count")}:</span>
                            <span className="stat-value">{record.totalCount.toLocaleString()}</span>
                          </span>
                          <span className="stat-item">
                            <span className="stat-label">{t("counter.session.amount")}:</span>
                            <span className="stat-value">{formatCurrency(record.totalAmount, { currency: currencyCode })}</span>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 单一货币情况的兼容处理 */}
            {(!sessionData.currencyCountRecords || sessionData.currencyCountRecords.size === 0) && (
              <div className="info-item">
                <span className="info-label">
                  {t("counter.session.amount")}:
                </span>
                <span className="info-value highlight">
                  {formatCurrency(sessionData.totalAmount || 0, { currency: sessionData.currencyCountRecords?.get(sessionData.id)?.currencyCode })}

                </span>
              </div>
            )}
          </div>{" "}
          {/* 面额分布 */}
          <div className="detail-section">
            <h4 className="section-title">
              <span className="section-icon">💰</span>
              {t("counter.sessionDetail.denominationBreakdown")}{" "}
              <button
                className={`toggle-detail-btn ${
                  showDetailedBreakdown ? "active" : ""
                }`}
                onClick={() => setShowDetailedBreakdown(!showDetailedBreakdown)}
              >
                {showDetailedBreakdown
                  ? t("counter.sessionDetail.hideDetails", "隐藏详情")
                  : t("counter.sessionDetail.showDetails", "显示详情")}
              </button>
            </h4>            {/* 多货币Tab切换 */}
            {hasMultipleCurrencies() && (
              <div className="currency-tabs">
                {getAvailableCurrencies().map(currencyCode => (
                  <button
                    key={currencyCode}
                    className={`currency-tab ${selectedCurrencyTab === currencyCode ? 'active' : ''}`}
                    onClick={() => setSelectedCurrencyTab(currencyCode)}
                  >
                    <span className="tab-label">{currencyCode}</span>
                    <span className="tab-count">{getTotalCountByCurrency(currencyCode)}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="denomination-breakdown">
              {denominationArray.length === 0 ? (
                <div className="no-data-message">
                  {t("counter.sessionDetail.noDenominationData")}
                </div>
              ) : (
                <div className="denomination-list compact">
                  {denominationArray.map((detail) => (
                    <div
                      key={detail.denomination}
                      className="denomination-item compact"
                    >
                      {" "}
                      {/* 紧凑的主要信息行 */}
                      <div className="denomination-main-info">
                        <div className="denomination-basic">                          
                          <span className="denomination-value">
                            {formatDenomination(detail.denomination, { showCurrencySymbol: false })}
                          </span>
                          <span className="denomination-count">
                            {detail.count} {t("counter.detailTable.pcs")}
                          </span>
                          <span className="denomination-amount">
                            {formatCurrency(detail.amount, { currency: selectedCurrencyTab })}
                          </span>
                        </div>
                      </div>
                      {/* 详细占比图表（可折叠） */}
                      {showDetailedBreakdown && (
                        <div className="denomination-detailed">
                          <div className="denomination-bars">
                            {" "}
                            {/* 张数占比条 */}
                            <div className="denomination-bar-container">
                              <div className="bar-label">
                                <span className="bar-icon">📄</span>
                                <span className="bar-text">
                                  {t(
                                    "counter.sessionDetail.countRatio",
                                    "张数占比"
                                  )}
                                </span>
                                <span className="bar-percentage">
                                  {((detail.count / totalCount) * 100).toFixed(
                                    1
                                  )}
                                  %
                                </span>
                              </div>
                              <div className="denomination-bar count-bar">
                                <div
                                  className="denomination-fill count-fill"
                                  style={{
                                    width: `${
                                      (detail.count / totalCount) * 100
                                    }%`,
                                  }}
                                />
                              </div>
                            </div>
                            {/* 金额占比条 */}
                            <div className="denomination-bar-container">
                              <div className="bar-label">
                                <span className="bar-icon">💰</span>
                                <span className="bar-text">
                                  {t(
                                    "counter.sessionDetail.amountRatio",
                                    "金额占比"
                                  )}
                                </span>
                                <span className="bar-percentage">
                                  {(
                                    (detail.amount / totalAmount) *
                                    100
                                  ).toFixed(1)}
                                  %
                                </span>
                              </div>
                              <div className="denomination-bar amount-bar">
                                <div
                                  className="denomination-fill amount-fill"
                                  style={{
                                    width: `${
                                      (detail.amount / totalAmount) * 100
                                    }%`,
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}{" "}
                  {/* 总计行 */}
                  <div className="denomination-item total compact">
                    <div className="denomination-main-info">
                      <div className="denomination-basic">
                        <span className="denomination-value">
                          {t("counter.detailTable.totalRow")}
                        </span>
                        <span className="denomination-count">
                          {totalCount} {t("counter.detailTable.pcs")}
                        </span>
                        <span className="denomination-amount">
                          {formatCurrency(totalAmount, { currency: selectedCurrencyTab })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          {/* 交易明细 */}
          <div className="detail-section">
            <h4 className="section-title">
              <span className="section-icon">📝</span>
              {t("counter.sessionDetail.transactionDetails")}
              {sessionData.details && sessionData.details.length > 0 && (
                <span className="detail-count">
                  ({filteredDetails.length} / {sessionData.details.length})
                </span>
              )}
            </h4>
            
            {/* 冠字号搜索框 */}
            {sessionData.details && sessionData.details.length > 0 && (
              <div className="serial-search-container">
                <input
                  type="text"
                  className="serial-search-input"
                  placeholder={t("counter.sessionDetail.searchSerialNumber", "搜索冠字号...")}
                  value={serialSearchTerm}
                  onChange={(e) => setSerialSearchTerm(e.target.value)}
                />
                {serialSearchTerm && (
                  <button
                    className="clear-search-btn"
                    onClick={() => setSerialSearchTerm('')}
                    title={t("common.clear", "清除")}
                  >
                    ✕
                  </button>
                )}
                {serialSearchTerm && (
                  <span className="search-results-count">
                    {filteredDetails.length} {t("counter.sessionDetail.searchResults", "条结果")}
                  </span>
                )}
              </div>
            )}
            <div className="transaction-details">
              {filteredDetails.length === 0 ? (
                <div className="no-data-message">
                  {serialSearchTerm ? 
                    t("counter.sessionDetail.noSearchResults", "没有找到匹配的冠字号") :
                    t("counter.sessionDetail.noTransactionData")
                  }
                </div>
              ) : (
                <div className="transaction-table">
                  {" "}
                  <div className="transaction-header">
                    <div className="transaction-col-no">#</div>
                    <div className="transaction-col-serial">
                      {t("counter.sessionDetail.serialNumber")}
                    </div>
                    <div className="transaction-col-denomination">
                      {t("counter.detailTable.denomination")}
                    </div>
                    <div className="transaction-col-currency">
                      {t("counter.sessionDetail.currency")}
                    </div>
                    <div className="transaction-col-error">
                      {t("counter.sessionDetail.error")}
                    </div>
                  </div>{" "}
                  <div className="transaction-body">
                    {filteredDetails.map((detail) => (
                      <div key={detail.id} className="transaction-row">
                        <div className="transaction-col-no">{detail.no}</div>
                        <div className="transaction-col-serial">
                          {detail.serialNumber ? (
                            serialSearchTerm ? (
                              <span
                                dangerouslySetInnerHTML={{
                                  __html: detail.serialNumber.replace(
                                    new RegExp(`(${serialSearchTerm})`, 'gi'),
                                    '<mark>$1</mark>'
                                  )
                                }}
                              />
                            ) : (
                              detail.serialNumber
                            )
                          ) : (
                            "-"
                          )}
                        </div>                        
                        <div className="transaction-col-denomination">
                          {formatDenomination(detail.denomination, { showCurrencySymbol: false })}
                        </div>
                        <div className="transaction-col-currency">
                          {detail.currencyCode}
                        </div>
                        <div className="transaction-col-error">
                          {detail.errorCode || "-"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>        {/* 抽屉底部操作 */}
        <div className="drawer-footer">
          <button className="action-btn secondary" onClick={() => onClose}>
            {t("common.close")}
          </button>
          <button
            className="action-btn primary"
            onClick={() => onExport()}
          >
            {t("counter.sessionDetail.exportSession")}
          </button>
        </div>
      </div>

      {/* 导出面板 */}
      {showExportPanel && (
        <ExportPanel
          isOpen={showExportPanel}
          sessionData={sessionData ? [sessionData] : []}
          onExportComplete={handleExportComplete}
          onClose={() => setShowExportPanel(false)}
        />
      )}
    </>
  );
};
