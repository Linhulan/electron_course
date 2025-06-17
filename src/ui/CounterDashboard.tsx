import React, { useState, useEffect, useRef, useCallback } from 'react';
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
    <div className={`counter-dashboard ${className || ''}`}>
      {/* 头部控制区 */}
      <div className="dashboard-header">
        <div className="dashboard-title">
          <h2>💰 点钞机数据看板</h2>
          <div className="connection-status">
            <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}></span>
            <span>{isConnected ? '已连接' : '未连接'}</span>
          </div>
        </div>
        
        <div className="dashboard-controls">          <select 
            value={selectedTimeRange} 
            onChange={(e) => setSelectedTimeRange(e.target.value as '1h' | '24h' | '7d' | '30d')}
            className="time-range-select"
          >
            <option value="1h">最近1小时</option>
            <option value="24h">最近24小时</option>
            <option value="7d">最近7天</option>
            <option value="30d">最近30天</option>
          </select>
          
          <button 
            onClick={isConnected ? stopMockConnection : startMockConnection}
            className={`control-btn ${isConnected ? 'stop' : 'start'}`}
          >
            {isConnected ? '停止模拟' : '开始模拟'}
          </button>
          
          <button onClick={clearData} className="control-btn clear">
            清空数据
          </button>
          
          <button onClick={exportData} className="control-btn export">
            导出数据
          </button>
        </div>
      </div>

      {/* 统计卡片区 */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-info">
            <div className="stat-value">{stats.totalSessions}</div>
            <div className="stat-label">点钞次数</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">💴</div>
          <div className="stat-info">
            <div className="stat-value">{formatCurrency(stats.totalAmount)}</div>
            <div className="stat-label">总金额</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">📄</div>
          <div className="stat-info">
            <div className="stat-value">{stats.totalNotes.toLocaleString()}</div>
            <div className="stat-label">总张数</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">⚡</div>
          <div className="stat-info">
            <div className="stat-value">{Math.round(stats.averageSpeed)}</div>
            <div className="stat-label">平均速度 (张/分)</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">⚠️</div>
          <div className="stat-info">
            <div className="stat-value">{stats.errorRate.toFixed(1)}%</div>
            <div className="stat-label">错误率</div>
          </div>
        </div>
      </div>

      {/* 当前会话显示 */}
      {currentSession && (
        <div className="current-session">
          <h3>当前点钞会话</h3>
          <div className="session-info">
            <div className="session-item">
              <span className="session-label">状态:</span>
              <span className="session-value" style={{ color: getStatusColor(currentSession.status) }}>
                {getStatusIcon(currentSession.status)} {currentSession.status}
              </span>
            </div>
            <div className="session-item">
              <span className="session-label">面额:</span>
              <span className="session-value">¥{currentSession.denomination}</span>
            </div>
            <div className="session-item">
              <span className="session-label">张数:</span>
              <span className="session-value">{currentSession.totalCount}</span>
            </div>
            <div className="session-item">
              <span className="session-label">金额:</span>
              <span className="session-value">{formatCurrency(currentSession.amount)}</span>
            </div>
            <div className="session-item">
              <span className="session-label">速度:</span>
              <span className="session-value">{currentSession.speed} 张/分</span>
            </div>
          </div>
        </div>
      )}

      {/* 数据列表 */}
      <div className="data-section">
        <h3>点钞记录</h3>
        <div className="data-list" ref={dataDisplayRef}>
          {counterData.length === 0 ? (
            <div className="no-data">
              <div className="no-data-icon">📝</div>
              <div className="no-data-text">暂无点钞数据</div>
              <div className="no-data-hint">点击"开始模拟"来生成示例数据</div>
            </div>
          ) : (
            <div className="data-table">
              <div className="table-header">
                <div className="col-time">时间</div>
                <div className="col-status">状态</div>
                <div className="col-denomination">面额</div>
                <div className="col-count">张数</div>
                <div className="col-amount">金额</div>
                <div className="col-speed">速度</div>
                <div className="col-serial">设备</div>
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
