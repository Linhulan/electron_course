import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import './CounterDashboard.css';

interface CounterData {
  id: string;
  timestamp: string;
  totalCount: number;
  denomination: number; // 面额
  amount: number; // 金额
  speed: number; // 点钞速度 (张/分钟)
  status: 'counting' | 'completed' | 'error' | 'paused';
  errorCode?: string;
  serialNumber?: string; // 机器序列号
}

interface CounterStats {
  totalSessions: number;
  totalAmount: number;
  totalNotes: number;
  averageSpeed: number;
  errorRate: number;
}

interface CounterDashboardProps {
  className?: string;
}

export const CounterDashboard: React.FC<CounterDashboardProps> = ({ className }) => {
  const { t } = useTranslation();
  const [counterData, setCounterData] = useState<CounterData[]>([]);
  const [currentSession, setCurrentSession] = useState<CounterData | null>(null);
  const [stats, setStats] = useState<CounterStats>({
    totalSessions: 0,
    totalAmount: 0,
    totalNotes: 0,
    averageSpeed: 0,
    errorRate: 0
  });
  const [isConnected, setIsConnected] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  
  const dataDisplayRef = useRef<HTMLDivElement>(null);

  // 模拟实时数据更新
  useEffect(() => {
    // 这里将来会替换为真实的串口数据监听
    const mockDataInterval = setInterval(() => {
      if (isConnected && Math.random() > 0.3) { // 70% 概率生成数据
        const newData: CounterData = {
          id: Date.now().toString(),
          timestamp: new Date().toLocaleTimeString(),
          totalCount: Math.floor(Math.random() * 100) + 1,
          denomination: [10, 20, 50, 100][Math.floor(Math.random() * 4)],
          amount: 0, // 将根据 totalCount * denomination 计算
          speed: Math.floor(Math.random() * 200) + 800, // 800-1000 张/分钟
          status: Math.random() > 0.95 ? 'error' : 'completed',
          errorCode: Math.random() > 0.95 ? 'E001' : undefined,
          serialNumber: 'CM-2024-001'
        };
        newData.amount = newData.totalCount * newData.denomination;
        
        setCurrentSession(newData);
        setCounterData(prev => [newData, ...prev].slice(0, 50)); // 保留最近50条记录
      }
    }, 2000);

    return () => clearInterval(mockDataInterval);
  }, [isConnected]);  const getFilteredData = useCallback(() => {
    const now = new Date();
    const timeRanges = {
      '1h': 1 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };
    
    const cutoffTime = now.getTime() - timeRanges[selectedTimeRange];
    
    return counterData.filter(item => {
      const itemTime = new Date(`${new Date().toDateString()} ${item.timestamp}`).getTime();
      return itemTime >= cutoffTime;
    });
  }, [counterData, selectedTimeRange]);

  // 计算统计数据
  useEffect(() => {
    const filteredData = getFilteredData();
    const newStats: CounterStats = {
      totalSessions: filteredData.length,
      totalAmount: filteredData.reduce((sum, item) => sum + item.amount, 0),
      totalNotes: filteredData.reduce((sum, item) => sum + item.totalCount, 0),
      averageSpeed: filteredData.length > 0 
        ? filteredData.reduce((sum, item) => sum + item.speed, 0) / filteredData.length 
        : 0,
      errorRate: filteredData.length > 0 
        ? (filteredData.filter(item => item.status === 'error').length / filteredData.length) * 100 
        : 0
    };
    setStats(newStats);
  }, [getFilteredData]);

  const startMockConnection = () => {
    setIsConnected(true);
  };

  const stopMockConnection = () => {
    setIsConnected(false);
    setCurrentSession(null);
  };

  const clearData = () => {
    setCounterData([]);
    setCurrentSession(null);
  };

  const exportData = () => {
    const dataStr = JSON.stringify(counterData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `counter-data-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY'
    }).format(amount);
  };
  const getStatusIcon = (status: CounterData['status']) => {
    switch (status) {
      case 'counting': return '⏳';
      case 'completed': return '✅';
      case 'error': return '❌';
      case 'paused': return '⏸️';
      default: return '⭕';
    }
  };

  const getStatusText = (status: CounterData['status']) => {
    switch (status) {
      case 'counting': return t('counter.sessionStatus.counting');
      case 'completed': return t('counter.sessionStatus.completed');
      case 'error': return t('counter.sessionStatus.error');
      case 'paused': return t('counter.sessionStatus.paused');
      default: return status;
    }
  };

  const getStatusColor = (status: CounterData['status']) => {
    switch (status) {
      case 'counting': return '#ffa500';
      case 'completed': return '#28a745';
      case 'error': return '#dc3545';
      case 'paused': return '#6c757d';
      default: return '#6c757d';
    }
  };

  return (
    <div className={`counter-dashboard ${className || ''}`}>      {/* 头部控制区 */}
      <div className="dashboard-header">
        <div className="dashboard-title">
          <h2>💰 {t('counter.title')}</h2>
          <div className="connection-status">
            <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}></span>
            <span>{isConnected ? t('counter.connected') : t('counter.disconnected')}</span>
          </div>
        </div>
        
        <div className="dashboard-controls">          <select 
            value={selectedTimeRange} 
            onChange={(e) => setSelectedTimeRange(e.target.value as '1h' | '24h' | '7d' | '30d')}
            className="time-range-select"
          >
            <option value="1h">{t('counter.lastHour')}</option>
            <option value="24h">{t('counter.last24Hours')}</option>
            <option value="7d">{t('counter.last7Days')}</option>
            <option value="30d">{t('counter.last30Days')}</option>
          </select>
          
          <button 
            onClick={isConnected ? stopMockConnection : startMockConnection}
            className={`control-btn ${isConnected ? 'stop' : 'start'}`}
          >
            {isConnected ? t('counter.stopSimulation') : t('counter.startSimulation')}
          </button>
          
          <button onClick={clearData} className="control-btn clear">
            {t('counter.clearData')}
          </button>
          
          <button onClick={exportData} className="control-btn export">
            {t('counter.exportData')}
          </button>
        </div>
      </div>

      {/* 统计卡片区 */}
      <div className="stats-grid">        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-info">
            <div className="stat-value">{stats.totalSessions}</div>
            <div className="stat-label">{t('counter.stats.totalSessions')}</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">💴</div>
          <div className="stat-info">
            <div className="stat-value">{formatCurrency(stats.totalAmount)}</div>
            <div className="stat-label">{t('counter.stats.totalAmount')}</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">📄</div>
          <div className="stat-info">
            <div className="stat-value">{stats.totalNotes.toLocaleString()}</div>
            <div className="stat-label">{t('counter.stats.totalNotes')}</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">⚡</div>
          <div className="stat-info">
            <div className="stat-value">{Math.round(stats.averageSpeed)}</div>
            <div className="stat-label">{t('counter.stats.averageSpeed')} ({t('counter.stats.speedUnit')})</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">⚠️</div>
          <div className="stat-info">
            <div className="stat-value">{stats.errorRate.toFixed(1)}%</div>
            <div className="stat-label">{t('counter.stats.errorRate')}</div>
          </div>
        </div>
      </div>      {/* 当前会话显示 */}
      {currentSession && (
        <div className="current-session">
          <h3>{t('counter.currentSession')}</h3>
          <div className="session-info">
            <div className="session-item">
              <span className="session-label">{t('counter.session.status')}:</span>
              <span className="session-value" style={{ color: getStatusColor(currentSession.status) }}>
                {getStatusIcon(currentSession.status)} {getStatusText(currentSession.status)}
              </span>
            </div>
            <div className="session-item">
              <span className="session-label">{t('counter.session.denomination')}:</span>
              <span className="session-value">¥{currentSession.denomination}</span>
            </div>
            <div className="session-item">
              <span className="session-label">{t('counter.session.count')}:</span>
              <span className="session-value">{currentSession.totalCount}</span>
            </div>
            <div className="session-item">
              <span className="session-label">{t('counter.session.amount')}:</span>
              <span className="session-value">{formatCurrency(currentSession.amount)}</span>
            </div>
            <div className="session-item">
              <span className="session-label">{t('counter.session.speed')}:</span>
              <span className="session-value">{currentSession.speed} {t('counter.stats.speedUnit')}</span>
            </div>
          </div>
        </div>
      )}      {/* 数据列表 */}
      <div className="data-section">
        <h3>{t('counter.records')}</h3>
        <div className="data-list" ref={dataDisplayRef}>
          {counterData.length === 0 ? (
            <div className="no-data">
              <div className="no-data-icon">📝</div>
              <div className="no-data-text">{t('counter.noData.title')}</div>
              <div className="no-data-hint">{t('counter.noData.subtitle')}</div>
            </div>
          ) : (
            <div className="data-table">
              <div className="table-header">
                <div className="col-time">{t('counter.table.time')}</div>
                <div className="col-status">{t('counter.table.status')}</div>
                <div className="col-denomination">{t('counter.table.denomination')}</div>
                <div className="col-count">{t('counter.table.count')}</div>
                <div className="col-amount">{t('counter.table.amount')}</div>
                <div className="col-speed">{t('counter.table.speed')}</div>
                <div className="col-serial">{t('counter.table.device')}</div>
              </div>
              {counterData.map((item) => (
                <div key={item.id} className="table-row">
                  <div className="col-time">{item.timestamp}</div>
                  <div className="col-status">
                    <span style={{ color: getStatusColor(item.status) }}>
                      {getStatusIcon(item.status)}
                    </span>
                  </div>
                  <div className="col-denomination">¥{item.denomination}</div>
                  <div className="col-count">{item.totalCount}</div>
                  <div className="col-amount">{formatCurrency(item.amount)}</div>
                  <div className="col-speed">{item.speed}</div>
                  <div className="col-serial">{item.serialNumber}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
