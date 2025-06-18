import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import "./CounterDashboard.css";
import {
  protocolManager,
  CountingProtocolData,
  getCountingStatus,
  isSessionStart,
  isSessionEnd,
  isSessionUpdate,
} from "./protocols";
import { initializeProtocols } from "./protocols/init";

interface CounterData {
  id: string;
  timestamp: string;
  totalCount: number;
  denomination: number; // 面额
  amount: number; // 金额
  speed: number; // 点钞速度 (张/分钟)
  status: "counting" | "completed" | "error" | "paused";
  errorCode?: string;
  serialNumber?: string; // 机器序列号
  details?: DenominationDetail[]; // 面额详细信息
}

// Session数据结构 - 用于记录完整的点钞会话
interface SessionData {
  id: string;
  timestamp: string;
  startTime: string;
  endTime?: string;
  totalCount: number;
  totalAmount: number;
  errorCount: number; // 错误张数
  status: "counting" | "completed" | "error" | "paused";
  errorCode?: string;
  serialNumber?: string;
  denominationBreakdown: Map<number, DenominationDetail>; // 面额分布
}

// 面额详细信息
interface DenominationDetail {
  denomination: number; // 面额 (例如: 1, 5, 10, 20, 50, 100)
  count: number; // 张数
  amount: number; // 小计金额
}

interface CounterStats {
  totalSessions: number;
  totalAmount: number;
  totalNotes: number;
  averageSpeed: number;
  errorPcs: number;
}

interface CounterDashboardProps {
  className?: string;
}

// Session管理函数 - 处理点钞会话
const handleSessionUpdate = (
  protocolData: CountingProtocolData,
  currentSession: SessionData | null,
  setCurrentSession: (session: SessionData | null) => void,
  setSessionData: (updater: (prev: SessionData[]) => SessionData[]) => void
): SessionData => {
  const status = getCountingStatus(protocolData.status);
  const now = new Date();
  // 如果状态是开始刷新，创建新Session (开始协议不携带金额和面额)
  if (isSessionStart(protocolData.status)) {
    // 如果有已完成的Session，先保存到历史记录
    if (currentSession && currentSession.status === "completed") {
      console.log(
        "Previous completed session archived before starting new session"
      );
    }
    const newSession: SessionData = {
      id: now.getTime().toString(),
      timestamp: now.toLocaleTimeString(),
      startTime: now.toLocaleString(),
      totalCount: 0, // 开始时张数为0
      totalAmount: 0, // 开始时金额为0
      errorCount: 0, // 开始时错误张数为0
      status: status,
      errorCode:
        protocolData.errorCode !== 0
          ? `E${protocolData.errorCode
              .toString(16)
              .padStart(3, "0")
              .toUpperCase()}`
          : undefined,
      serialNumber: protocolData.serialNumber,
      denominationBreakdown: new Map(),
    };

    setCurrentSession(newSession);
    return newSession;
  }

  // 如果没有当前Session但不是开始状态，说明有问题，创建一个临时Session
  if (!currentSession) {
    const tempSession: SessionData = {
      id: now.getTime().toString(),
      timestamp: now.toLocaleTimeString(),
      startTime: now.toLocaleString(),
      totalCount: isSessionUpdate(protocolData.status)
        ? protocolData.totalCount
        : 0,
      totalAmount: isSessionUpdate(protocolData.status)
        ? protocolData.totalAmount
        : 0,
      errorCount: 0, // 临时Session错误张数初始化为0
      status: status,
      errorCode:
        protocolData.errorCode !== 0
          ? `E${protocolData.errorCode
              .toString(16)
              .padStart(3, "0")
              .toUpperCase()}`
          : undefined,
      serialNumber: protocolData.serialNumber,
      denominationBreakdown: new Map(),
    };

    setCurrentSession(tempSession);
    return tempSession;
  }

  // 更新当前Session
  const updatedSession: SessionData = {
    ...currentSession,
    status: status,
    timestamp: now.toLocaleTimeString(),
    errorCode:
      protocolData.errorCode !== 0
        ? `E${protocolData.errorCode
            .toString(16)
            .padStart(3, "0")
            .toUpperCase()}`
        : undefined,
  };
  // 只有在刷新中状态时才更新金额和张数 (因为只有这种协议携带有效的金额和面额数据)
  if (isSessionUpdate(protocolData.status)) {
    updatedSession.totalCount = protocolData.totalCount;
    updatedSession.totalAmount = protocolData.totalAmount;

    // 如果有错误代码，累积错误张数
    if (protocolData.errorCode !== 0) {
      updatedSession.errorCount = (currentSession.errorCount || 0) + 1;
    }
  }
  // 如果Session完成，添加到历史记录但保留在当前Session显示 (结束协议不携带金额数据)
  if (isSessionEnd(protocolData.status)) {
    updatedSession.endTime = now.toLocaleString();
    setSessionData((prev) => [updatedSession, ...prev].slice(0, 50));
    // 保留完成的Session在界面上，不清空
    setCurrentSession(updatedSession);
  } else {
    setCurrentSession(updatedSession);
  }

  return updatedSession;
};

// 更新面额统计的函数
const updateDenominationStats = (
  currentStats: Map<number, DenominationDetail>,
  denomination: number
): Map<number, DenominationDetail> => {
  const newStats = new Map(currentStats);
  const existing = newStats.get(denomination);

  if (existing) {
    // 如果已存在该面额，数量加1
    newStats.set(denomination, {
      denomination: denomination,
      count: existing.count + 1,
      amount: existing.amount + denomination,
    });
  } else {
    // 如果是新面额，创建新记录
    newStats.set(denomination, {
      denomination: denomination,
      count: 1,
      amount: denomination,
    });
  }

  return newStats;
};

export const CounterDashboard: React.FC<CounterDashboardProps> = ({
  className,
}) => {
  const { t } = useTranslation();

  // 初始化协议解析器
  useEffect(() => {
    initializeProtocols();
  }, []);

  const [sessionData, setSessionData] = useState<SessionData[]>([]); // 改为Session数据
  const [currentSession, setCurrentSession] = useState<SessionData | null>(
    null
  );
  const [denominationStats, setDenominationStats] = useState<
    Map<number, DenominationDetail>
  >(new Map()); // 面额详细统计
  const [stats, setStats] = useState<CounterStats>({
    totalSessions: 0,
    totalAmount: 0,
    totalNotes: 0,
    averageSpeed: 0,
    errorPcs: 0,
  });
  const [isConnected, setIsConnected] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState<
    "1h" | "24h" | "7d" | "30d"
  >("24h");

  const dataDisplayRef = useRef<HTMLDivElement>(null); // 监听真实的串口连接状态
  useEffect(() => {
    // 检查初始连接状态
    const checkInitialStatus = async () => {
      try {
        const status = await window.electron.getSerialConnectionStatus();
        setIsConnected(status.isConnected);
      } catch (err) {
        console.error("Failed to check initial connection status:", err);
      }
    };

    checkInitialStatus();

    const unsubscribeConnected = window.electron.onSerialConnected(() => {
      setIsConnected(true);
    });

    const unsubscribeDisconnected = window.electron.onSerialDisconnected(() => {
      setIsConnected(false);
    });
    return () => {
      unsubscribeConnected();
      unsubscribeDisconnected();
    };
  }, []); // 监听串口数据并解析协议 - 使用新的协议管理器
  useEffect(() => {
    const unsubscribeDataReceived = window.electron.onSerialDataReceived(
      (data) => {
        // 只处理十六进制数据
        if (data.hexData && isConnected) {
          try {
            // 使用协议管理器解析数据
            const protocolData = protocolManager.parseData(
              data.hexData,
              data.isCompletePacket
            ) as CountingProtocolData;

            if (
              protocolData &&
              protocolData.protocolType === "CountingMachine"
            ) {
              // 检查是否为点钞数据 (CMD-G = 0x0E)
              if (protocolData.cmdGroup === 0x0e) {
                // 使用Session管理函数处理数据
                const updatedSession = handleSessionUpdate(
                  protocolData,
                  currentSession,
                  setCurrentSession,
                  setSessionData
                ); // 只有在刷新中状态时才更新面额统计 (因为只有这种协议携带有效的面额数据)
                if (
                  isSessionUpdate(protocolData.status) &&
                  protocolData.denomination > 0
                ) {
                  setDenominationStats((prev) =>
                    updateDenominationStats(prev, protocolData.denomination)
                  );

                  console.log(
                    "Updated denomination stats for denomination:",
                    protocolData.denomination
                  );
                }

                console.log(
                  "Updated session from",
                  data.isCompletePacket ? "complete packet" : "raw data",
                  ":",
                  updatedSession
                );
              }
            }
          } catch (error) {
            console.error("Error parsing serial data:", error);
          }
        }
      }
    );
    return () => {
      unsubscribeDataReceived();
    };
  }, [isConnected, currentSession]);
  const getFilteredData = useCallback(() => {
    const now = new Date();
    const timeRanges = {
      "1h": 1 * 60 * 60 * 1000,
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
    };

    const cutoffTime = now.getTime() - timeRanges[selectedTimeRange];

    return sessionData.filter((item) => {
      const itemTime = new Date(
        `${new Date().toDateString()} ${item.timestamp}`
      ).getTime();
      return itemTime >= cutoffTime;
    });
  }, [sessionData, selectedTimeRange]);
  // 计算统计数据
  useEffect(() => {
    const filteredData = getFilteredData();
    const newStats: CounterStats = {
      totalSessions: filteredData.length,
      totalAmount: filteredData.reduce(
        (sum, item) => sum + item.totalAmount,
        0
      ),
      totalNotes: filteredData.reduce((sum, item) => sum + item.totalCount, 0),
      averageSpeed: 0, // Session模式下暂不计算速度
      errorPcs: filteredData.reduce(
        (sum, item) => sum + (item.errorCount || 0),
        0
      ),
    };
    setStats(newStats);
  }, [getFilteredData]);  const clearData = () => {
    setSessionData([]);
    setCurrentSession(null);
    setDenominationStats(new Map()); // 清空面额统计
    // 重置统计数据
    setStats({
      totalSessions: 0,
      totalAmount: 0,
      totalNotes: 0,
      averageSpeed: 0,
      errorPcs: 0,
    });
  };

  // 清空当前Session，但保留历史记录
  const clearCurrentSession = () => {
    setCurrentSession(null);
  };

  const exportData = () => {
    const dataStr = JSON.stringify(sessionData, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `session-data-${
      new Date().toISOString().split("T")[0]
    }.json`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("zh-CN", {
      style: "currency",
      currency: "CNY",
    }).format(amount);
  };

  // 根据金额大小动态调整字体大小
  const getAmountFontSize = (amount: number) => {
    const formattedAmount = formatCurrency(amount);
    const length = formattedAmount.length;
    
    if (length <= 8) return "1.5rem"; // 默认大小，例如：¥1,234.00
    if (length <= 12) return "1.3rem"; // 中等金额，例如：¥12,345,678.00  
    if (length <= 15) return "1.1rem"; // 较大金额，例如：¥123,456,789.00
    if (length <= 18) return "0.95rem"; // 很大金额，例如：¥1,234,567,890.00
    return "0.85rem"; // 超大金额
  };

  const getStatusIcon = (status: CounterData["status"]) => {
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

  const getStatusText = (status: CounterData["status"]) => {
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

  const getStatusColor = (status: CounterData["status"]) => {
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
  };

  return (
    <div className={`counter-dashboard ${className || ""}`}>
      {" "}
      {/* 头部控制区 */}
      <div className="dashboard-header">
        <div className="dashboard-title">
          <h2>💰 {t("counter.title")}</h2>
          <div className="connection-status">
            <span
              className={`status-indicator ${
                isConnected ? "connected" : "disconnected"
              }`}
            ></span>
            <span>
              {isConnected ? t("counter.connected") : t("counter.disconnected")}
            </span>
          </div>
        </div>
        <div className="dashboard-controls">
          <select
            value={selectedTimeRange}
            onChange={(e) =>
              setSelectedTimeRange(
                e.target.value as "1h" | "24h" | "7d" | "30d"
              )
            }
            className="time-range-select"
          >
            <option value="1h">{t("counter.lastHour")}</option>
            <option value="24h">{t("counter.last24Hours")}</option>
            <option value="7d">{t("counter.last7Days")}</option>
            <option value="30d">{t("counter.last30Days")}</option>
          </select>

          <button onClick={clearData} className="control-btn clear">
            {t("counter.clearData")}
          </button>

          <button onClick={exportData} className="control-btn export">
            {t("counter.exportData")}
          </button>
        </div>
      </div>
      {/* 统计卡片区 */}
      <div className="stats-grid">
        {" "}
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-info">
            <div className="stat-value">{stats.totalSessions}</div>
            <div className="stat-label">{t("counter.stats.totalSessions")}</div>
          </div>
        </div>
        <div className="stat-card">          <div className="stat-icon">💴</div>
          <div className="stat-info">
            <div 
              className="stat-value" 
              style={{ fontSize: getAmountFontSize(stats.totalAmount) }}
            >
              {formatCurrency(stats.totalAmount)}
            </div>
            <div className="stat-label">{t("counter.stats.totalAmount")}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📄</div>
          <div className="stat-info">
            <div className="stat-value">
              {stats.totalNotes.toLocaleString()}
            </div>
            <div className="stat-label">{t("counter.stats.totalNotes")}</div>
          </div>
        </div>        <div className="stat-card">
          <div className="stat-icon">⚠️</div>
          <div className="stat-info">
            <div className="stat-value error-stat">{stats.errorPcs.toLocaleString()}</div>
            <div className="stat-label">{t("counter.stats.errorPcs")}</div>
          </div>
        </div>{" "}
      </div>{" "}
      {/* 当前会话显示 - 常驻显示 */}
      <div className="current-session">
        <div className="session-header">
          <h3>{t("counter.currentSession")}</h3>
          {currentSession && (
            <button
              className="clear-session-btn"
              onClick={clearCurrentSession}
              title={t("counter.clearCurrentSession")}
            >
              <span className="clear-icon">🗑️</span>
              {t("counter.clearSession")}
            </button>
          )}
        </div>
        <div className="session-info">
          {currentSession ? (
            <>
              <div className="session-item">
                <span className="session-label">
                  {t("counter.session.status")}:
                </span>
                <span
                  className="session-value"
                  style={{ color: getStatusColor(currentSession.status) }}
                >
                  {getStatusIcon(currentSession.status)}{" "}
                  {getStatusText(currentSession.status)}
                </span>
              </div>
              <div className="session-item">
                <span className="session-label">
                  {t("counter.session.count")}:
                </span>
                <span className="session-value">
                  {currentSession.totalCount}
                </span>
              </div>{" "}
              <div className="session-item">
                <span className="session-label">
                  {t("counter.session.amount")}:
                </span>
                <span className="session-value">
                  {formatCurrency(currentSession.totalAmount)}
                </span>
              </div>
              <div className="session-item">
                <span className="session-label">
                  {t("counter.session.errorCount")}:
                </span>
                <span className="session-value error-count">
                  {currentSession.errorCount || 0}
                </span>
              </div>
              {currentSession.endTime && (
                <div className="session-item">
                  <span className="session-label">
                    {t("counter.session.date")}:
                  </span>
                  <span className="session-value end-time">
                    {currentSession.endTime}
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="session-item no-session">
              <span className="session-value">
                {t("counter.noCurrentSession")}
              </span>
            </div>
          )}
        </div>
      </div>{" "}
      {/* 数据记录区域 - 分离的Card布局 */}
      <div className="data-section">
        <div className="records-grid">
          {/* 详细面额统计 Card */}
          <div className="record-card detailed-records-card">
            <div className="card-header">
              {" "}
              <h3>
                <span className="section-icon">💰</span>
                {t("counter.detailedRecords")}
                <span className="record-count">
                  {denominationStats.size > 0 &&
                    `(${Array.from(denominationStats.values()).reduce(
                      (sum, d) => sum + d.count,
                      0
                    )} ${t("counter.detailTable.bills")})`}
                </span>
              </h3>
            </div>
            <div className="card-content">
              <div className="details-list">
                {" "}
                {denominationStats.size === 0 ? (
                  <div className="no-data">
                    <div className="no-data-icon">📝</div>
                    <div className="no-data-text">
                      {t("counter.noData.noDetailedRecords")}
                    </div>
                    <div className="no-data-hint">
                      {t("counter.noData.startCountingHint")}
                    </div>
                  </div>
                ) : (
                  <div className="details-table">
                    {" "}
                    <div className="details-header">
                      <div className="col-denom">
                        {t("counter.detailTable.denomination")}
                      </div>
                      <div className="col-pcs">
                        {t("counter.detailTable.count")}
                      </div>
                      <div className="col-amount">
                        {t("counter.detailTable.total")}
                      </div>
                    </div>
                    {Array.from(denominationStats.values())
                      .sort((a, b) => b.denomination - a.denomination) // 按面额从大到小排序
                      .map((detail) => (
                        <div key={detail.denomination} className="details-row">
                          <div className="col-denom">
                            <span className="denom-value">
                              ¥{detail.denomination}
                            </span>
                          </div>{" "}
                          <div className="col-pcs">
                            <span className="count-value">{detail.count}</span>
                            <span className="count-label">
                              {t("counter.detailTable.pcs")}
                            </span>
                          </div>
                          <div className="col-amount">
                            {formatCurrency(detail.amount)}
                          </div>
                        </div>
                      ))}
                    {/* 总计行 */}
                    {denominationStats.size > 0 && (
                      <div className="details-row total-row">
                        <div className="col-denom">
                          <strong>{t("counter.detailTable.totalRow")}</strong>
                        </div>
                        <div className="col-pcs">
                          <strong>
                            {Array.from(denominationStats.values()).reduce(
                              (sum, d) => sum + d.count,
                              0
                            )}
                          </strong>
                          <span className="count-label">
                            {t("counter.detailTable.pcs")}
                          </span>
                        </div>
                        <div className="col-amount">
                          <strong>
                            {formatCurrency(
                              Array.from(denominationStats.values()).reduce(
                                (sum, d) => sum + d.amount,
                                0
                              )
                            )}
                          </strong>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 计数记录 Card */}
          <div className="record-card counting-records-card">
            {" "}            <div className="card-header">
              <h3>
                <span className="section-icon">📝</span>
                {t("counter.records")}
                <span className="record-count">
                  {sessionData.length > 0 &&
                    `(${sessionData.length} ${t("counter.stats.totalSessions")})`}
                </span>
              </h3>
            </div>
            <div className="card-content">
              <div className="data-list" ref={dataDisplayRef}>
                {" "}
                {sessionData.length === 0 ? (
                  <div className="no-data enhanced">
                    <div className="no-data-illustration">
                      <div className="illustration-circle">
                        <span className="no-data-icon">📝</span>
                      </div>
                      <div className="illustration-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                    <div className="no-data-content">
                      <div className="no-data-text">
                        {t("counter.noData.title")}
                      </div>
                      <div className="no-data-hint">
                        {t("counter.noData.subtitle")}
                      </div>
                      <div className="no-data-suggestion">
                        💡{" "}
                        {t(
                          "counter.noData.suggestion",
                          "Connect to serial port and start counting to see records here"
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="data-table">
                    {" "}
                    <div className="table-header">
                      <div className="col-time">
                        <span className="header-icon">🕒</span>
                        {t("counter.table.time")}
                      </div>
                      <div className="col-count">
                        {t("counter.table.count")}
                      </div>
                      <div className="col-amount">
                        {t("counter.table.amount")}
                      </div>
                      <div className="col-error">
                        {t("counter.table.errorPcs")}
                      </div>
                    </div>
                    {sessionData.map((item) => (
                      <div key={item.id} className="table-row">
                        <div className="col-time">
                          <div className="time-primary">{item.timestamp}</div>
                          {item.endTime && (
                            <div className="time-secondary">
                              {t("counter.session.date")}:{" "}
                              {new Date(item.endTime).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                        <div className="col-count">
                          <div className="count-value">
                            {item.totalCount.toLocaleString()}
                          </div>
                          <div className="count-unit">
                            {t("counter.detailTable.pcs")}
                          </div>
                        </div>
                        <div className="col-amount">
                          <div className="amount-value">
                            {formatCurrency(item.totalAmount)}
                          </div>
                        </div>
                        <div className="col-error">
                          <div
                            className={`error-value ${
                              (item.errorCount || 0) > 0
                                ? "has-error"
                                : "no-error"
                            }`}
                          >
                            {item.errorCount || 0}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
