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
  generateSnowflakeId,
} from "./protocols";
import { initializeProtocols } from "./protocols/init";
import { SessionDetailDrawer } from "./components/SessionDetailDrawer";
import ExportPanel from "./components/ExportPanel";
import { formatCurrency, formatDenomination } from "./common/common";
import {
  SessionData,
  DenominationDetail,
  CounterData,
  CurrencyCountRecord,
} from "./common/types";

interface CounterStats {
  totalRecords: Map<string, CurrencyCountRecord>; // 改为必需字段，包含所有货币的统计信息
  totalSessions: number;
  totalNotes?: number;
  averageSpeed?: number;
  errorPcs?: number;

  /**
   * @deprecated 请使用 totalRecords 替代
   */
  totalAmount?: number;
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
      id: generateSnowflakeId(),
      no: (currentSession ? currentSession.no + 1 : 1) || 1, // 新Session编号
      timestamp: now.toLocaleTimeString(),
      startTime: now.toLocaleString(),
      currencyCode: protocolData.currencyCode || "",
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
      denominationBreakdown: new Map(),
      currencyCountRecords: new Map<string, CurrencyCountRecord>(),
      details: [], // 初始化为空数组
    };

    setCurrentSession(newSession);
    return newSession;
  }

  // 如果没有当前Session但不是开始状态，说明有问题，创建一个临时Session
  if (!currentSession) {
    const tempSession: SessionData = {
      id: generateSnowflakeId(),
      no: 1,
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
      denominationBreakdown: new Map(),
      currencyCountRecords: new Map<string, CurrencyCountRecord>(),
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

    // 获取对应货币的计数记录
    const record = updatedSession.currencyCountRecords?.get(protocolData.currencyCode);
    if ( record ) {
      // record.totalCount = protocolData.totalCount;
      // record.totalAmount = protocolData.totalAmount;

      record.totalCount += 1;
      record.totalAmount = protocolData.denomination;
      record.errorCount += protocolData.errorCode !== 0 ? 1 : 0;

      record.denominationBreakdown.set(protocolData.denomination, {
        denomination: protocolData.denomination,
        count: (record.denominationBreakdown.get(protocolData.denomination)?.count || 0) + 1,
        amount:
          (record.denominationBreakdown.get(protocolData.denomination)?.amount || 0) +
          protocolData.denomination,
      });

    }
    else 
    {
      updatedSession.currencyCountRecords?.set(protocolData.currencyCode, {
        currencyCode: protocolData.currencyCode,
        totalCount: 1,
        totalAmount: protocolData.denomination,
        errorCount: protocolData.errorCode !== 0 ? 1 : 0,
        denominationBreakdown: 
          new Map<number, DenominationDetail>().set(protocolData.denomination, {
            denomination: protocolData.denomination,
            count: 1,
            amount: protocolData.denomination,
          }),
      });

    }

    // 更新面额分布统计
    // updatedSession.denominationBreakdown.set(protocolData.currencyCode, {
    //   denomination: protocolData.denomination,
    //   count:
    //     (updatedSession.denominationBreakdown.get(protocolData.currencyCode)
    //       ?.count || 0) + 1,
    //   amount:
    //     (updatedSession.denominationBreakdown.get(protocolData.currencyCode)
    //       ?.amount || 0) + protocolData.denomination,
    // });

    // 创建计数记录详情
    updatedSession.details?.push({
      id: generateSnowflakeId(),
      no: (currentSession.details?.length || 0) + 1,
      timestamp: now.toLocaleTimeString(),
      currencyCode: protocolData.currencyCode,
      denomination: protocolData.denomination,
      status: status,
      errorCode: "E" + protocolData.errorCode.toString(10),
      serialNumber: protocolData.serialNumber || "",
    });
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
  const [stats, setStats] = useState<CounterStats>({
    totalRecords: new Map<string, CurrencyCountRecord>(),
    totalSessions: 0,
    totalAmount: 0,
    totalNotes: 0,
    averageSpeed: 0,
    errorPcs: 0,
  });
  const [isConnected, setIsConnected] = useState(false);
  const [isSimulationMode, setIsSimulationMode] = useState(false);
  const [simulationInterval, setSimulationInterval] = useState<number | null>(
    null
  );
  const [simulationSession, setSimulationSession] =
    useState<SessionData | null>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState<
    "1h" | "24h" | "7d" | "30d"
  >("24h");
  // 抽屉相关状态
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(
    null
  );
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [isExportPanelOpen, setIsExportPanelOpen] = useState(false);
  // 面额显示Tab状态
  const [selectedCurrencyTab, setSelectedCurrencyTab] = useState<string>('');

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
            const protocolDataArr = protocolManager.parseData(
              data.hexData
            ) as CountingProtocolData[];            if (protocolDataArr && protocolDataArr.length > 0) {
              for (const protocolData of protocolDataArr) {
                const updatedSession = handleSessionUpdate(
                  protocolData,
                  currentSession,
                  setCurrentSession,
                  setSessionData
                );

                console.log("Updated session from hex data:", updatedSession);
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
    
    // 构建totalRecords - 汇总所有Session的货币统计信息
    const totalRecords = new Map<string, CurrencyCountRecord>();
    
    filteredData.forEach(session => {
      if (session.currencyCountRecords) {
        // 使用新的货币记录结构
        session.currencyCountRecords.forEach((record, currencyCode) => {
          const existing = totalRecords.get(currencyCode);
          if (existing) {
            // 合并现有记录
            existing.totalCount += record.totalCount;
            existing.totalAmount += record.totalAmount;
            existing.errorCount += record.errorCount;
            
            // 合并面额分布
            record.denominationBreakdown.forEach((detail, denomination) => {
              const existingDetail = existing.denominationBreakdown.get(denomination);
              if (existingDetail) {
                existingDetail.count += detail.count;
                existingDetail.amount += detail.amount;
              } else {
                existing.denominationBreakdown.set(denomination, { ...detail });
              }
            });
          } else {
            // 创建新记录，深拷贝面额分布
            const newDenominationBreakdown = new Map<number, DenominationDetail>();
            record.denominationBreakdown.forEach((detail, denomination) => {
              newDenominationBreakdown.set(denomination, { ...detail });
            });
            
            totalRecords.set(currencyCode, {
              currencyCode: record.currencyCode,
              totalCount: record.totalCount,
              totalAmount: record.totalAmount,
              errorCount: record.errorCount,
              denominationBreakdown: newDenominationBreakdown,
            });
          }
        });
      } else {
        // 兼容旧数据结构
        const currencyCode = session.currencyCode || 'CNY';
        const existing = totalRecords.get(currencyCode);
        
        if (existing) {
          existing.totalCount += session.totalCount;
          existing.totalAmount += session.totalAmount || 0;
          existing.errorCount += session.errorCount || 0;
          
          // 合并旧的面额分布
          if (session.denominationBreakdown) {
            session.denominationBreakdown.forEach((detail, denomination) => {
              const existingDetail = existing.denominationBreakdown.get(denomination);
              if (existingDetail) {
                existingDetail.count += detail.count;
                existingDetail.amount += detail.amount;
              } else {
                existing.denominationBreakdown.set(denomination, { ...detail });
              }
            });
          }
        } else {
          // 创建新记录
          const newDenominationBreakdown = new Map<number, DenominationDetail>();
          if (session.denominationBreakdown) {
            session.denominationBreakdown.forEach((detail, denomination) => {
              newDenominationBreakdown.set(denomination, { ...detail });
            });
          }
          
          totalRecords.set(currencyCode, {
            currencyCode,
            totalCount: session.totalCount,
            totalAmount: session.totalAmount || 0,
            errorCount: session.errorCount || 0,
            denominationBreakdown: newDenominationBreakdown,
          });
        }
      }
    });

    // 计算汇总统计数据
    let totalAmount = 0;
    let totalNotes = 0;
    let errorPcs = 0;
    
    totalRecords.forEach(record => {
      totalAmount += record.totalAmount;
      totalNotes += record.totalCount;
      errorPcs += record.errorCount;
    });

    const newStats: CounterStats = {
      totalRecords,
      totalSessions: filteredData.length,
      totalAmount,
      totalNotes,
      averageSpeed: 0, // Session模式下暂不计算速度
      errorPcs,
    };
    setStats(newStats);
  }, [getFilteredData]);
  const clearData = () => {
    setSessionData([]);
    setCurrentSession(null);
    // 重置统计数据
    setStats({
      totalRecords: new Map<string, CurrencyCountRecord>(),
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

  // 处理Session详情抽屉
  const handleSessionClick = (sessionId: number) => {
    setSelectedSessionId(sessionId);
    setIsDetailDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDetailDrawerOpen(false);
    setSelectedSessionId(null);
  };
  const handleExportPanelOpen = () => {
    setIsExportPanelOpen(true);
  };

  const handleExportPanelClose = () => {
    setIsExportPanelOpen(false);
  };
  const handleExportComplete = (result: { success: boolean; message?: string }) => {
    console.log("Export completed in dashboard:", result);
    // 可以在这里添加导出完成后的处理逻辑
    // 比如显示成功消息、更新状态等
  };

  // 仿真数据生成器
  const generateSimulationData = (): CountingProtocolData => {
    const denominations = [1, 5, 10, 20, 50, 100];
    const randomDenomination =
      denominations[Math.floor(Math.random() * denominations.length)];

    // 随机生成一些错误
    const hasError = Math.random() < 0.05; // 5% 错误率
    return {
      timestamp: new Date().toLocaleString(),
      protocolType: "counting",
      rawData: "simulation_data",
      status: 0x02, // 刷新中状态
      totalCount: (simulationSession?.totalCount || 0) + 1,
      totalAmount: (simulationSession?.totalAmount || 0) + randomDenomination,
      denomination: randomDenomination,
      currencyCode: "CNY",
      errorCode: hasError ? Math.floor(Math.random() * 10) + 1 : 0,
      serialNumber: `SIM${Date.now().toString().slice(-6)}`,
      reserved1: [0, 0, 0, 0],
      reserved2: 0,
    };
  };

  // 开始仿真模式
  const startSimulation = () => {
    if (isSimulationMode) return;    console.log("🎮 Starting simulation mode...");
    setIsSimulationMode(true);

    const currencyCode = "CNY"; // 默认货币代码

    // 创建新的仿真会话
    const newSession: SessionData = {
      id: generateSnowflakeId(),
      no: (currentSession ? currentSession.no + 1 : 1) || 1,
      timestamp: new Date().toLocaleTimeString(),
      startTime: new Date().toLocaleString(),
      totalCount: 0,
      totalAmount: 0,
      errorCount: 0,
      currencyCode: currencyCode,
      status: "counting",
      denominationBreakdown: new Map(),
      details: [],
    };

    setCurrentSession(newSession);
    setSimulationSession(newSession);

    // 每500ms生成一个仿真数据
    const interval = window.setInterval(() => {
      const simulationData = generateSimulationData();
      const updatedSession = handleSessionUpdate(
        simulationData,        simulationSession,
        setSimulationSession,
        setSessionData
      );

      setCurrentSession(updatedSession);

      console.log("Generated simulation data:", simulationData);
    }, 500);

    setSimulationInterval(interval);
  };

  // 停止仿真模式
  const stopSimulation = () => {
    if (!isSimulationMode) return;

    console.log("🛑 Stopping simulation mode...");
    setIsSimulationMode(false);

    if (simulationInterval) {
      clearInterval(simulationInterval);
      setSimulationInterval(null);
    }

    // 完成当前仿真会话
    if (simulationSession) {
      const completedSession: SessionData = {
        ...simulationSession,
        status: "completed",
        endTime: new Date().toLocaleString(),
      };

      setCurrentSession(completedSession);
      setSessionData((prev) => [completedSession, ...prev].slice(0, 50));
      setSimulationSession(null);
    }
  };

  // 生成批量测试数据
  const generateTestData = () => {
    console.log("📊 Generating test data...");

    const testSessions: SessionData[] = [];
    const now = new Date();
    const currencyCodes = [
      "CNY",
      "USD",
      "EUR",
      "JPY",
      "GBP",
      "AUD",
      "CAD",
      "CHF",
      "HKD",
      "SGD",
    ];
    let currencyCode = "CNY"; // 默认货币代码

    // 生成5个测试会话
    for (let i = 0; i < 5; i++) {
      const sessionTime = new Date(now.getTime() - i * 60 * 60 * 1000); // 每小时一个会话
      const denominationBreakdown = new Map<number, DenominationDetail>();
      const currencyCountRecords = new Map<string, CurrencyCountRecord>();
      const details: CounterData[] = [];

      let totalCount = 0;
      let totalAmount = 0;
      let errorCount = 0;

      // 为每个会话生成随机数据
      const noteCount = Math.floor(Math.random() * 100) + 20; // 20-120张

      // 每个会话生成随机的货币代码
      currencyCode = currencyCodes[Math.floor(Math.random() * currencyCodes.length)];

      for (let j = 0; j < noteCount; j++) {
        const denominations = [1, 5, 10, 20, 50, 100];
        const denomination =
          denominations[Math.floor(Math.random() * denominations.length)];
        const hasError = Math.random() < 0.03; // 3% 错误率

        totalCount++;
        totalAmount += denomination;
        if (hasError) errorCount++;

        // 更新面额统计, 增加多个货币情况下面额统计处理
        const currencyRecord = currencyCountRecords.get(currencyCode);
        if (currencyRecord) {
          currencyRecord.totalCount++;
          currencyRecord.totalAmount += denomination;
          currencyRecord.errorCount += hasError ? 1 : 0;

          // 更新面额分布
          const existingDetail = currencyRecord.denominationBreakdown.get(
            denomination
          );
          if (existingDetail) {
            existingDetail.count++;
            existingDetail.amount += denomination;
          } else {
            currencyRecord.denominationBreakdown.set(denomination, {
              denomination,
              count: 1,
              amount: denomination,
            });
          }
        }
        else {
          currencyCountRecords.set(currencyCode, {
            currencyCode,
            totalCount: 1,
            totalAmount: denomination,
            errorCount: hasError ? 1 : 0,
            denominationBreakdown: new Map<number, DenominationDetail>([
              [
                denomination,
                {
                  denomination,
                  count: 1,
                  amount: denomination,
                },
              ],
            ]),
          });
        }

        const existing = denominationBreakdown.get(denomination);
        if (existing) {
          denominationBreakdown.set(denomination, {
            denomination,
            count: existing.count + 1,
            amount: existing.amount + denomination,
          });
        } else {
          denominationBreakdown.set(denomination, {
            denomination,
            count: 1,
            amount: denomination,
          });
        }

        // 添加详细记录
        details.push({
          id: generateSnowflakeId(),
          no: j + 1,
          timestamp: new Date(
            sessionTime.getTime() + j * 1000
          ).toLocaleTimeString(),
          currencyCode: currencyCode,
          denomination,
          status: hasError ? "error" : "completed",
          errorCode: hasError
            ? `E${Math.floor(Math.random() * 10) + 1}`
            : undefined,
          serialNumber: `TEST${Date.now().toString().slice(-6)}${j}`,
        });
      }

      const testSession: SessionData = {
        id: generateSnowflakeId(),
        no: 1000 + i,
        timestamp: sessionTime.toLocaleTimeString(),
        startTime: sessionTime.toLocaleString(),
        endTime: new Date(
          sessionTime.getTime() + 5 * 60 * 1000
        ).toLocaleString(), // 5分钟后结束
        machineMode: i % 2 === 0 ? "AUTO" : "MANUAL",
        currencyCode,
        currencyCountRecords,
        totalCount,
        totalAmount,
        errorCount,
        status: "completed",
        denominationBreakdown,
        details,
      };

      testSessions.push(testSession);
    }    // 添加到会话数据中
    setSessionData((prev) => [...testSessions, ...prev].slice(0, 50));

    console.log(
      `✅ Generated ${testSessions.length} test sessions with total data`
    );
  };
  // 获取选中的Session数据
  const getSelectedSession = (): SessionData | null => {
    if (!selectedSessionId) return null;
    return (
      sessionData.find((session) => session.id === selectedSessionId) || null
    );
  };
  const exportData = () => {
    console.log("Exporting session data...");

    // 检查是否有数据可以导出
    if (sessionData.length === 0) {
      console.warn("No session data to export");
      // 可以在这里显示一个提示消息
      return;
    }

    // 打开导出面板
    handleExportPanelOpen();
  };
  // 按货币分组获取面额统计数据
  const getDenominationDetailsByCurrency = (): Map<string, DenominationDetail[]> => {
    const currencyDetailsMap = new Map<string, DenominationDetail[]>();
    
    stats.totalRecords.forEach((record, currencyCode) => {
      const details = Array.from(record.denominationBreakdown.values())
        .sort((a, b) => b.denomination - a.denomination);
      currencyDetailsMap.set(currencyCode, details);
    });
    
    return currencyDetailsMap;
  };

  // 从totalRecords中获取所有面额统计数据（合并所有货币）
  const getAllDenominationDetails = (): DenominationDetail[] => {
    const allDetails: DenominationDetail[] = [];
    
    stats.totalRecords.forEach(record => {
      record.denominationBreakdown.forEach(detail => {
        // 查找是否已存在相同面额
        const existingIndex = allDetails.findIndex(d => d.denomination === detail.denomination);
        if (existingIndex >= 0) {
          // 合并相同面额的统计
          allDetails[existingIndex].count += detail.count;
          allDetails[existingIndex].amount += detail.amount;
        } else {
          // 添加新面额
          allDetails.push({ ...detail });
        }
      });
    });
    
    return allDetails.sort((a, b) => b.denomination - a.denomination);
  };

  // 计算指定货币的总张数
  const getTotalCountByCurrency = (currencyCode: string): number => {
    const record = stats.totalRecords.get(currencyCode);
    return record ? record.totalCount : 0;
  };

  // 计算指定货币的总金额
  const getTotalAmountByCurrency = (currencyCode: string): number => {
    const record = stats.totalRecords.get(currencyCode);
    return record ? record.totalAmount : 0;
  };

  // 计算总张数（所有货币）
  const getTotalCount = (): number => {
    return getAllDenominationDetails().reduce((sum, detail) => sum + detail.count, 0);  };

  // 获取可用的货币代码列表
  const getAvailableCurrencies = (): string[] => {
    return Array.from(stats.totalRecords.keys()).sort();
  };
  // 获取当前选中Tab的面额数据
  const getCurrentTabDenominationDetails = (): DenominationDetail[] => {
    const currencyDetailsMap = getDenominationDetailsByCurrency();
    return currencyDetailsMap.get(selectedCurrencyTab) || [];
  };

  // 获取当前选中Tab的总张数
  const getCurrentTabTotalCount = (): number => {
    return getTotalCountByCurrency(selectedCurrencyTab);
  };

  // 获取当前选中Tab的总金额
  const getCurrentTabTotalAmount = (): number => {
    return getTotalAmountByCurrency(selectedCurrencyTab);
  };  // 当有新的货币数据时，自动切换到第一个货币Tab
  useEffect(() => {
    const availableCurrencies = Array.from(stats.totalRecords.keys()).sort();
    if (availableCurrencies.length > 0) {
      // 如果当前选中的货币不存在，切换到第一个可用货币
      if (!availableCurrencies.includes(selectedCurrencyTab)) {
        setSelectedCurrencyTab(availableCurrencies[0]);
      }
    } else {
      // 如果没有货币数据，重置为空
      setSelectedCurrencyTab('');
    }
  }, [stats.totalRecords, selectedCurrencyTab]);

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

  // 获取Session的货币显示
  const getSessionCurrencyDisplay = (session: SessionData): string => {
    // 如果有新的货币记录结构
    if (session.currencyCountRecords && session.currencyCountRecords.size > 0) {
      const currencies = Array.from(session.currencyCountRecords.keys());
      if (currencies.length === 1) {
        return currencies[0];
      } else if (currencies.length > 1) {
        return "MULTI";
      }
    }
    
    // 兼容旧数据结构
    return session.currencyCode || "CNY";
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
        </div>{" "}
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
          </select>{" "}
          {/* 开发模式下显示仿真控制按钮 */}
          {import.meta.env.DEV && (
            <div className="simulation-controls">
              {!isSimulationMode ? (
                <>
                  <button
                    onClick={startSimulation}
                    className="control-btn simulation-start"
                    title="Start simulation mode"
                  >
                    🎮 Start Simulation
                  </button>
                  <button
                    onClick={generateTestData}
                    className="control-btn test-data"
                    title="Generate batch test data"
                  >
                    📊 Generate Test Data
                  </button>
                </>
              ) : (
                <button
                  onClick={stopSimulation}
                  className="control-btn simulation-stop"
                  title="Stop simulation mode"
                >
                  🛑 Stop Simulation
                </button>
              )}
              {isSimulationMode && (
                <div className="simulation-status">
                  <span className="simulation-indicator">🎮</span>
                  <span>Simulation Active</span>
                </div>
              )}
            </div>
          )}
          <button onClick={clearData} className="control-btn clear">
            {t("counter.clearData")}
          </button>
          <button
            onClick={exportData}
            className={`control-btn export ${
              sessionData.length === 0 ? "disabled" : ""
            }`}
            disabled={sessionData.length === 0}
            title={
              sessionData.length === 0
                ? t("counter.noDataToExport", "No data to export")
                : t("counter.exportData")
            }
          >
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
          {" "}
          <div className="stat-icon">💴</div>
          <div className="stat-info">
            <div
              className="stat-value"              style={{ fontSize: getAmountFontSize(stats.totalAmount || 0) }}
            >
              {formatCurrency(stats.totalAmount || 0)}
            </div>
            <div className="stat-label">{t("counter.stats.totalAmount")}</div>
          </div>
        </div>        <div className="stat-card">
          <div className="stat-icon">📄</div>
          <div className="stat-info">
            <div className="stat-value">
              {(() => {
                const availableCurrencies = getAvailableCurrencies();
                if (availableCurrencies.length > 1) {
                  // 多货币时显示总数
                  return getTotalCount().toLocaleString();
                } else if (availableCurrencies.length === 1) {
                  // 单一货币时显示当前Tab张数
                  return getCurrentTabTotalCount().toLocaleString();
                } else {
                  // 无数据时显示0
                  return "0";
                }
              })()}
            </div>
            <div className="stat-label">{t("counter.stats.totalNotes")}</div>
          </div>
        </div>{" "}
        <div className="stat-card">
          <div className="stat-icon">⚠️</div>
          <div className="stat-info">
            <div className="stat-value error-stat">
              {(stats.errorPcs || 0).toLocaleString()}
            </div>
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
                  {formatCurrency(currentSession.totalAmount || 0)}
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
        <div className="records-grid">          {/* 详细面额统计 Card */}
          <div className="record-card detailed-records-card">            <div className="card-header">
              <h3>
                <span className="section-icon">💰</span>
                {t("counter.detailedRecords")}
                <span className="record-count">
                  {getAvailableCurrencies().length > 1 
                    ? `(${t("counter.totalNotes", "Total")}: ${getTotalCount()})`
                    : getCurrentTabDenominationDetails().length > 0 &&
                      `(${getCurrentTabTotalCount()} ${t("counter.detailTable.bills")})`}
                </span>
              </h3>
            </div>{/* 货币Tab切换 */}
            {getAvailableCurrencies().length > 1 && (
              <div className="currency-tabs">
                {getAvailableCurrencies().map(currencyCode => (
                  <button
                    key={currencyCode}
                    className={`currency-tab ${selectedCurrencyTab === currencyCode ? 'active' : ''}`}
                    onClick={() => setSelectedCurrencyTab(currencyCode)}
                  >
                    💱 {currencyCode}
                    <span className="tab-count">({getTotalCountByCurrency(currencyCode)})</span>
                  </button>
                ))}
              </div>
            )}

            <div className="card-content">
              <div className="details-list">
                {getCurrentTabDenominationDetails().length === 0 ? (
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
                    {getCurrentTabDenominationDetails().map((detail) => (
                      <div key={detail.denomination} className="details-row">
                        <div className="col-denom">
                          <span className="denom-value">
                            {formatDenomination(detail.denomination)}
                          </span>
                        </div>
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
                    {getCurrentTabDenominationDetails().length > 0 && (
                      <div className="details-row total-row">
                        <div className="col-denom">
                          <strong>{t("counter.detailTable.totalRow")}</strong>
                        </div>
                        <div className="col-pcs">
                          <strong>
                            {getCurrentTabTotalCount()}
                          </strong>
                          <span className="count-label">
                            {t("counter.detailTable.pcs")}
                          </span>
                        </div>
                        <div className="col-amount">
                          <strong>
                            {formatCurrency(getCurrentTabTotalAmount())}
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
            {" "}
            <div className="card-header">
              <h3>
                <span className="section-icon">📝</span>
                {t("counter.records")}
                <span className="record-count">
                  {sessionData.length > 0 &&
                    `(${sessionData.length} ${t(
                      "counter.stats.totalSessions"
                    )})`}
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
                    {" "}                    <div className="table-header">
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
                      <div className="col-currency">
                        {t("counter.table.currency", "Currency")}
                      </div>
                      <div className="col-error">
                        {t("counter.table.errorPcs")}
                      </div>
                    </div>{" "}
                    {sessionData.map((item) => (
                      <div
                        key={item.id}
                        className="table-row clickable"
                        onClick={() => handleSessionClick(item.id)}
                        title={t(
                          "counter.clickToViewDetails",
                          "Click to view details"
                        )}
                      >
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
                        </div>                        <div className="col-amount">
                          <div className="amount-value">
                            {formatCurrency(item.totalAmount || 0)}
                          </div>
                        </div>                        <div className="col-currency">
                          <div 
                            className="currency-value"
                            data-currency={getSessionCurrencyDisplay(item)}
                          >
                            {getSessionCurrencyDisplay(item)}
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
                )}{" "}
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Session详情抽屉 */}
      <SessionDetailDrawer
        isOpen={isDetailDrawerOpen}
        sessionData={getSelectedSession()}
        onClose={handleCloseDrawer}
      />
      {/* 导出面额统计面板 */}
      <ExportPanel
        isOpen={isExportPanelOpen}
        sessionData={sessionData}
        onExportComplete={handleExportComplete}
        onClose={handleExportPanelClose}
      />
    </div>
  );
};
