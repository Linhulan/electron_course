import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import "./SessionDetailDrawer.css";
import { debugLog } from "../protocols";
import ExportPanel from "./ExportPanel";
import { formatCurrency, formatDenomination } from "../common/common";

interface CounterData {
  id: number;
  no: number;
  timestamp: string;
  currencyCode: string;
  denomination: number;
  status: "counting" | "completed" | "error" | "paused";
  errorCode?: string;
  serialNumber?: string;
}

interface DenominationDetail {
  denomination: number;
  count: number;
  amount: number;
}

interface SessionData {
  id: number;
  no: number;
  timestamp: string;
  startTime: string;
  endTime?: string;
  machineMode?: string;
  totalCount: number;
  totalAmount: number;
  errorCount: number;
  status: "counting" | "completed" | "error" | "paused";
  errorCode?: string;
  denominationBreakdown: Map<number, DenominationDetail>;
  details?: CounterData[];
}

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
  };  const onExport = async (_sessionData: SessionData) => {
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

  if (!isOpen || !sessionData) {
    return null;
  }
  const denominationArray = Array.from(
    sessionData.denominationBreakdown.values()
  ).sort((a, b) => b.denomination - a.denomination);
  // 计算总数和总金额，用于计算占比
  const totalAmount = denominationArray.reduce((sum, d) => sum + d.amount, 0);
  const totalCount = denominationArray.reduce((sum, d) => sum + d.count, 0);

  return (
    <>
      {/* 背景遮罩 */}
      <div className="drawer-overlay" onClick={onClose} />

      {/* 抽屉主体 */}
      <div className={`session-detail-drawer ${isOpen ? "open" : ""}`}>
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
        <div className="drawer-content">
          {/* Session基本信息 */}
          <div className="detail-section">
            <h4 className="section-title">
              <span className="section-icon">ℹ️</span>
              {t("counter.sessionDetail.basicInfo")}
            </h4>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">
                  {t("counter.session.count")}:
                </span>
                <span className="info-value highlight">
                  {sessionData.totalCount.toLocaleString()}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">
                  {t("counter.session.amount")}:
                </span>
                <span className="info-value highlight">
                  {formatCurrency(sessionData.totalAmount)}
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
            </div>
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
            </h4>
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
                        <div className="denomination-basic">                          <span className="denomination-value">
                            {formatDenomination(detail.denomination)}
                          </span>
                          <span className="denomination-count">
                            {detail.count} {t("counter.detailTable.pcs")}
                          </span>
                          <span className="denomination-amount">
                            {formatCurrency(detail.amount)}
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
                          {formatCurrency(totalAmount)}
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
                  ({sessionData.details.length})
                </span>
              )}
            </h4>
            <div className="transaction-details">
              {!sessionData.details || sessionData.details.length === 0 ? (
                <div className="no-data-message">
                  {t("counter.sessionDetail.noTransactionData")}
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
                    {" "}
                    {sessionData.details.map((detail) => (
                      <div key={detail.id} className="transaction-row">
                        <div className="transaction-col-no">{detail.no}</div>
                        <div className="transaction-col-serial">
                          {detail.serialNumber || "-"}
                        </div>                        <div className="transaction-col-denomination">
                          {formatDenomination(detail.denomination)}
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
            onClick={() => onExport(sessionData)}
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
