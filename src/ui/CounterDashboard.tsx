import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import "./CounterDashboard.css";

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

// 串口协议解析相关类型
interface SerialProtocolData {
  check: number[]; // 0:1 CHECK: 0xFD 0xDF
  length: number; // 2 长度: 0x2C
  cmdGroup: number; // 3 CMD-G: 0x0E
  totalCount: number; // 4:7 总张数 (低位先行)
  denomination: number; // 8:11 面额
  totalAmount: number; // 12:19 总金额 (8字节)
  currencyCode: string; // 20:23 货币代码 (4位包含结束符号)
  serialNumber: string; // 24:34 SN (11位)
  reserved1: number[]; // 35:39 RESERVED
  errorCode: number; // 40 ErrCode
  status: number; // 41 状态位 0x00: 开始刷新； 0x01: 刷新中; 0x02: 刷新完成； 0x03: 刷新完成，接钞满；
  reserved2: number; // 42 RESERVED
  crc: number; // 43 CRC
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

// 串口协议解析工具函数 - 增强粘包处理
const parseSerialProtocolData = (
  hexData: string,
  isCompletePacket?: boolean
): SerialProtocolData | null => {
  try {
    // 移除空格并转换为大写
    const cleanHex = hexData.replace(/\s+/g, "").toUpperCase();

    // 如果不是完整包且数据较短，可能是分包，不进行解析
    if (!isCompletePacket && cleanHex.length < 88) {
      console.log("Incomplete packet detected, waiting for more data");
      return null;
    }

    // 检查数据长度是否足够 (最少44字节 = 88个十六进制字符)
    if (cleanHex.length < 88) {
      console.warn("Serial data too short:", cleanHex.length);
      return null;
    }

    // 处理粘包情况：如果数据很长，可能包含多个协议包
    const protocols = extractMultipleProtocols(cleanHex);

    // 返回第一个有效的协议包
    for (const protocolHex of protocols) {
      const result = parseSingleProtocol(protocolHex);
      if (result) {
        return result;
      }
    }

    return null;
  } catch (error) {
    console.error("Error parsing serial protocol data:", error);
    return null;
  }
};

// 从十六进制字符串中提取多个协议包
const extractMultipleProtocols = (hexData: string): string[] => {
  const protocols: string[] = [];
  let position = 0;

  while (position < hexData.length) {
    // 查找协议头 FDDF
    const headerIndex = hexData.indexOf("FDDF", position);
    if (headerIndex === -1) {
      break; // 没有找到更多协议头
    }

    // 检查是否有足够的数据来读取长度字段
    if (headerIndex + 4 >= hexData.length) {
      break;
    }

    // 读取长度字段（第3个字节，即位置 headerIndex + 4 和 headerIndex + 5）
    const lengthHex = hexData.substr(headerIndex + 4, 2);
    const packetLength = parseInt(lengthHex, 16);
    const totalPacketLength = (packetLength + 4) * 2; // 转换为十六进制字符数

    // 检查是否有完整的协议包
    if (headerIndex + totalPacketLength <= hexData.length) {
      const protocolHex = hexData.substr(headerIndex, totalPacketLength);
      protocols.push(protocolHex);
      position = headerIndex + totalPacketLength;
    } else {
      // 不完整的包，停止处理
      break;
    }
  }

  // 如果没有找到完整的协议包，返回整个数据进行尝试解析
  if (protocols.length === 0) {
    protocols.push(hexData);
  }

  return protocols;
};

// 解析单个协议包
const parseSingleProtocol = (hexData: string): SerialProtocolData | null => {
  try {
    // 将十六进制字符串转换为字节数组
    const bytes: number[] = [];
    for (let i = 0; i < hexData.length; i += 2) {
      bytes.push(parseInt(hexData.substr(i, 2), 16));
    }

    // 检查协议头
    if (bytes[0] !== 0xfd || bytes[1] !== 0xdf) {
      console.warn("Invalid protocol header:", bytes[0], bytes[1]);
      return null;
    }

    // 检查CMD-G是否为点钞数据
    if (bytes[3] !== 0x0e) {
      console.warn("Not counting data CMD-G:", bytes[3]);
      return null;
    }

    // 解析数据
    const totalCount =
      bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24);
    const denomination =
      bytes[8] | (bytes[9] << 8) | (bytes[10] << 16) | (bytes[11] << 24);

    // 解析8字节金额 (低位先行)
    let totalAmount = 0;
    for (let i = 0; i < 8; i++) {
      totalAmount += bytes[12 + i] * Math.pow(256, i);
    }

    // 解析货币代码 (4字节，包含结束符)
    const currencyBytes = bytes.slice(20, 24);
    const currencyCode = String.fromCharCode(
      ...currencyBytes.filter((b) => b !== 0)
    );

    // 解析序列号 (11字节)
    const snBytes = bytes.slice(24, 35);
    const serialNumber = String.fromCharCode(...snBytes.filter((b) => b !== 0));

    const errorCode = bytes[40];
    const status = bytes[41];
    const crc = bytes[43];

    return {
      check: [bytes[0], bytes[1]],
      length: bytes[2],
      cmdGroup: bytes[3],
      totalCount,
      denomination,
      totalAmount,
      currencyCode,
      serialNumber,
      reserved1: bytes.slice(35, 40),
      errorCode,
      status,
      reserved2: bytes[42],
      crc,
    };
  } catch (error) {
    console.error("Error parsing single protocol:", error);
    return null;
  }
};

// 状态码转换函数
const getStatusDescription = (
  status: number
): "counting" | "completed" | "error" | "paused" => {
  switch (status) {
    case 0x00:
      return "counting"; // 开始刷新
    case 0x01:
      return "counting"; // 刷新中
    case 0x02:
      return "completed"; // 刷新完成
    case 0x03:
      return "completed"; // 刷新完成，接钞满
    default:
      return "error";
  }
};

// Session管理函数 - 处理点钞会话
const handleSessionUpdate = (
  protocolData: SerialProtocolData,
  currentSession: SessionData | null,
  setCurrentSession: (session: SessionData | null) => void,
  setSessionData: (updater: (prev: SessionData[]) => SessionData[]) => void
): SessionData => {
  const status = getStatusDescription(protocolData.status);
  const now = new Date();
  
  // 如果状态是开始刷新，创建新Session (开始协议不携带金额和面额)
  if (protocolData.status === 0x00) {
    const newSession: SessionData = {
      id: now.getTime().toString(),
      timestamp: now.toLocaleTimeString(),
      startTime: now.toLocaleString(),
      totalCount: 0, // 开始时张数为0
      totalAmount: 0, // 开始时金额为0
      status: status,
      errorCode: protocolData.errorCode !== 0 
        ? `E${protocolData.errorCode.toString(16).padStart(3, "0").toUpperCase()}`
        : undefined,
      serialNumber: protocolData.serialNumber,
      denominationBreakdown: new Map()
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
      totalCount: protocolData.status === 0x01 ? protocolData.totalCount : 0,
      totalAmount: protocolData.status === 0x01 ? protocolData.totalAmount : 0,
      status: status,
      errorCode: protocolData.errorCode !== 0 
        ? `E${protocolData.errorCode.toString(16).padStart(3, "0").toUpperCase()}`
        : undefined,
      serialNumber: protocolData.serialNumber,
      denominationBreakdown: new Map()
    };
    
    setCurrentSession(tempSession);
    return tempSession;
  }
  
  // 更新当前Session
  const updatedSession: SessionData = {
    ...currentSession,
    status: status,
    timestamp: now.toLocaleTimeString(),
    errorCode: protocolData.errorCode !== 0 
      ? `E${protocolData.errorCode.toString(16).padStart(3, "0").toUpperCase()}`
      : undefined,
  };
  
  // 只有在刷新中状态时才更新金额和张数 (因为只有这种协议携带有效的金额和面额数据)
  if (protocolData.status === 0x01) {
    updatedSession.totalCount = protocolData.totalCount;
    updatedSession.totalAmount = protocolData.totalAmount;
  }
  
  // 如果Session完成，添加到历史记录并清空当前Session (结束协议不携带金额数据)
  if (protocolData.status === 0x02 || protocolData.status === 0x03) {
    updatedSession.endTime = now.toLocaleString();
    setSessionData(prev => [updatedSession, ...prev].slice(0, 50));
    setCurrentSession(null);
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
}) => {  const { t } = useTranslation();
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
  }, []);
  // 监听串口数据并解析协议 - 增强粘包处理
  useEffect(() => {
    const unsubscribeDataReceived = window.electron.onSerialDataReceived(
      (data) => {
        // 只处理十六进制数据
        if (data.hexData && isConnected) {
          try {
            // 使用新的解析函数，传递isCompletePacket标识
            const protocolData = parseSerialProtocolData(
              data.hexData,
              data.isCompletePacket
            );
            if (protocolData) {              // 检查是否为点钞数据 (CMD-G = 0x0E)
              if (protocolData.cmdGroup === 0x0e) {                // 使用Session管理函数处理数据
                const updatedSession = handleSessionUpdate(
                  protocolData,
                  currentSession,
                  setCurrentSession,
                  setSessionData
                );                // 只有在刷新中状态时才更新面额统计 (因为只有这种协议携带有效的面额数据)
                if (protocolData.status === 0x01 && protocolData.denomination > 0) {
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
      totalAmount: filteredData.reduce((sum, item) => sum + item.totalAmount, 0),
      totalNotes: filteredData.reduce((sum, item) => sum + item.totalCount, 0),      averageSpeed: 0, // Session模式下暂不计算速度
      errorPcs: filteredData.filter((item) => item.status === "error").length,
    };
    setStats(newStats);
  }, [getFilteredData]);  const clearData = () => {
    setSessionData([]);
    setCurrentSession(null);
    setDenominationStats(new Map()); // 清空面额统计
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
        <div className="stat-card">
          <div className="stat-icon">💴</div>
          <div className="stat-info">
            <div className="stat-value">
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
        </div>
        <div className="stat-card">
          <div className="stat-icon">⚠️</div>
          <div className="stat-info">
            <div className="stat-value">{stats.errorPcs.toLocaleString()}</div>
            <div className="stat-label">{t("counter.stats.errorPcs")}</div>
          </div>
        </div>      </div>{" "}
      {/* 当前会话显示 - 常驻显示 */}
      <div className="current-session">
        <h3>{t("counter.currentSession")}</h3>
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
                <span className="session-value">{currentSession.totalCount}</span>
              </div>
              <div className="session-item">
                <span className="session-label">
                  {t("counter.session.amount")}:
                </span>
                <span className="session-value">
                  {formatCurrency(currentSession.totalAmount)}
                </span>
              </div>
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
            <div className="card-header">
              <h3>
                <span className="section-icon">📝</span>
                {t("counter.records")}                <span className="record-count">
                  {sessionData.length > 0 && `(${sessionData.length} records)`}
                </span>
              </h3>
            </div>
            <div className="card-content">
              <div className="data-list" ref={dataDisplayRef}>
                {sessionData.length === 0 ? (
                  <div className="no-data">
                    <div className="no-data-icon">📝</div>
                    <div className="no-data-text">
                      {t("counter.noData.title")}
                    </div>
                    <div className="no-data-hint">
                      {t("counter.noData.subtitle")}
                    </div>
                  </div>
                ) : (
                  <div className="data-table">                    <div className="table-header">
                      <div className="col-time">{t("counter.table.time")}</div>
                      <div className="col-status">
                        {t("counter.table.status")}
                      </div>
                      <div className="col-count">
                        {t("counter.table.count")}
                      </div>
                      <div className="col-amount">
                        {t("counter.table.amount")}
                      </div>
                    </div>                    {sessionData.map((item) => (
                      <div key={item.id} className="table-row">
                        <div className="col-time">{item.timestamp}</div>
                        <div className="col-status">
                          <span style={{ color: getStatusColor(item.status) }}>
                            {getStatusIcon(item.status)}
                          </span>
                        </div>
                        <div className="col-count">{item.totalCount}</div>
                        <div className="col-amount">
                          {formatCurrency(item.totalAmount)}
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
