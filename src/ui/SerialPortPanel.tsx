import React, { useState, useEffect, useRef, useCallback } from 'react';
import './SerialPortPanel.css';

interface SerialPortPanelProps {
  className?: string;
}

export const SerialPortPanel: React.FC<SerialPortPanelProps> = ({ className }) => {
  const [availablePorts, setAvailablePorts] = useState<SerialPortInfo[]>([]);
  const [selectedPort, setSelectedPort] = useState<string>('');
  const [connectionStatus, setConnectionStatus] = useState<SerialConnectionStatus>({ isConnected: false });
  const [serialData, setSerialData] = useState<string[]>([]);
  const [sendMessage, setSendMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [isHexMode, setIsHexMode] = useState<boolean>(false);
  const [showTimestamp, setShowTimestamp] = useState<boolean>(true);
  const [config, setConfig] = useState<SerialPortConfig>({
    baudRate: 115200,
    dataBits: 8,
    stopBits: 1,
    parity: 'none'
  });
  
  const dataDisplayRef = useRef<HTMLDivElement>(null);  const addToDataDisplay = useCallback((message: string, type: 'system' | 'sent' | 'received' | 'error' | 'warning' | 'success' | 'info' | 'normal' = 'system', skipTimestamp = false) => {
    const timestamp = new Date().toLocaleTimeString();
    const formattedMessage = skipTimestamp ? message : `[${timestamp}] ${message}`;
    setSerialData(prev => [...prev, `${type}|||${formattedMessage}`]); // Use ||| as delimiter to avoid conflicts with colons in data
    
    // Auto-scroll to bottom - 使用多种方法确保滚动成功
    setTimeout(() => {
      if (dataDisplayRef.current) {
        const element = dataDisplayRef.current;
        element.scrollTop = element.scrollHeight;
        // 强制滚动到底部
        element.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    }, 10);
    
    // 延迟再次确保滚动到底部
    setTimeout(() => {
      if (dataDisplayRef.current) {
        dataDisplayRef.current.scrollTop = dataDisplayRef.current.scrollHeight;
      }
    }, 100);
  }, []);

  const refreshPorts = useCallback(async () => {
    try {
      setIsLoading(true);
      const ports = await window.electron.listSerialPorts();
      setAvailablePorts(ports);
      
      // If currently selected port is no longer available, clear selection
      if (selectedPort && !ports.some(port => port.path === selectedPort)) {
        setSelectedPort('');
      }
    } catch (err) {
      setError(`Failed to list ports: ${err}`);
    } finally {
      setIsLoading(false);
    }
  }, [selectedPort]);

  const checkConnectionStatus = useCallback(async () => {
    try {
      const status = await window.electron.getSerialConnectionStatus();
      setConnectionStatus(status);
    } catch (err) {
      setError(`Failed to check connection status: ${err}`);
    }
  }, []);

  // Load available ports on component mount
  useEffect(() => {
    refreshPorts();
    checkConnectionStatus();

    // Subscribe to serial port events
    const unsubscribeConnected = window.electron.onSerialConnected((data) => {
      setConnectionStatus({ isConnected: true, portPath: data.portPath });
      addToDataDisplay(`Connected to ${data.portPath} with baud rate ${data.config.baudRate}`, 'system');
      setError('');
    });

    const unsubscribeDisconnected = window.electron.onSerialDisconnected(() => {
      setConnectionStatus({ isConnected: false });
      addToDataDisplay('Disconnected from serial port', 'system');
    });    const unsubscribeDataReceived = window.electron.onSerialDataReceived((data) => {
      // 根据时间戳开关决定显示格式
      const displayText = showTimestamp 
        ? (isHexMode ? `${data.timestamp}:${data.hexData}` : `${data.timestamp}:${data.data}`)
        : (isHexMode ? data.hexData : data.data);
      // 使用从后端传来的messageType
      addToDataDisplay(displayText, data.messageType as 'system' | 'sent' | 'received' | 'error' | 'warning' | 'success' | 'info' | 'normal', true);
    });

    const unsubscribeError = window.electron.onSerialError((error) => {
      setError(error.error);
      addToDataDisplay(`Error: ${error.error}`, 'error');
    });

    return () => {
      unsubscribeConnected();
      unsubscribeDisconnected();
      unsubscribeDataReceived();
      unsubscribeError();
    };
  }, [refreshPorts, checkConnectionStatus, addToDataDisplay, isHexMode, showTimestamp]);

  const handleConnect = async () => {
    if (!selectedPort) {
      setError('Please select a port first');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      await window.electron.connectSerialPort(selectedPort, config);
    } catch (err) {
      setError(`Failed to connect: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setIsLoading(true);
      setError('');
      await window.electron.disconnectSerialPort();
    } catch (err) {
      setError(`Failed to disconnect: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendData = async () => {
    if (!sendMessage.trim()) return;

    try {
      setError('');
      await window.electron.sendSerialData(sendMessage);
      const timestamp = new Date().toLocaleTimeString();
      addToDataDisplay(`[${timestamp}]:${sendMessage}`, 'sent');
      setSendMessage('');
    } catch (err) {
      setError(`Failed to send data: ${err}`);
    }
  };

  const handleSendTestData = async () => {
    const testMessages = [
      'Hello Serial Port!',
      'Test Message 1',
      'Test Message 2',
      'AT+VERSION?'
    ];

    for (const message of testMessages) {
      setSendMessage(message);
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms between messages
      await handleSendData();
    }
  };

  const clearDataDisplay = () => {
    setSerialData([]);
  };

  const getPortDisplayName = (port: SerialPortInfo): string => {
    return port.displayName || `${port.path} ${port.friendlyName ? `(${port.friendlyName})` : ''}`;
  };

  return (
    <div className={`serial-port-panel-layout ${className || ''}`}>
      {/* 左侧：串口连接配置 */}
      <div className="serial-port-config-section">
        <div className="serial-port-connection">
          <h3>Serial Port Connection</h3>
          
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="port-selection">
            <label htmlFor="port-select">Select Port:</label>
            <div className="port-select-row">
              <select
                id="port-select"
                value={selectedPort}
                onChange={(e) => setSelectedPort(e.target.value)}
                disabled={connectionStatus.isConnected || isLoading}
              >
                <option value="">-- Select a port --</option>
                {availablePorts.map((port) => (
                  <option key={port.path} value={port.path}>
                    {getPortDisplayName(port)}
                  </option>
                ))}
              </select>
              <button
                onClick={refreshPorts}
                disabled={isLoading}
                className="refresh-btn"
                title="Refresh port list"
              >
                🔄
              </button>
            </div>
          </div>

          <div className="connection-config">
            <div className="config-row">
              <label htmlFor="baud-rate">Baud Rate:</label>
              <select
                id="baud-rate"
                value={config.baudRate}
                onChange={(e) => setConfig(prev => ({ ...prev, baudRate: parseInt(e.target.value) }))}
                disabled={connectionStatus.isConnected}
              >
                <option value={9600}>9600</option>
                <option value={19200}>19200</option>
                <option value={38400}>38400</option>
                <option value={57600}>57600</option>
                <option value={115200}>115200</option>
                <option value={230400}>230400</option>
                <option value={460800}>460800</option>
                <option value={921600}>921600</option>
              </select>
            </div>

            <div className="config-row">
              <label htmlFor="data-bits">Data Bits:</label>
              <select
                id="data-bits"
                value={config.dataBits}
                onChange={(e) => setConfig(prev => ({ ...prev, dataBits: parseInt(e.target.value) as 5 | 6 | 7 | 8 }))}
                disabled={connectionStatus.isConnected}
              >
                <option value={5}>5</option>
                <option value={6}>6</option>
                <option value={7}>7</option>
                <option value={8}>8</option>
              </select>
            </div>

            <div className="config-row">
              <label htmlFor="stop-bits">Stop Bits:</label>
              <select
                id="stop-bits"
                value={config.stopBits}
                onChange={(e) => setConfig(prev => ({ ...prev, stopBits: parseFloat(e.target.value) as 1 | 1.5 | 2 }))}
                disabled={connectionStatus.isConnected}
              >
                <option value={1}>1</option>
                <option value={1.5}>1.5</option>
                <option value={2}>2</option>
              </select>
            </div>

            <div className="config-row">
              <label htmlFor="parity">Parity:</label>
              <select
                id="parity"
                value={config.parity}
                onChange={(e) => setConfig(prev => ({ ...prev, parity: e.target.value as 'none' | 'even' | 'odd' | 'mark' | 'space' }))}
                disabled={connectionStatus.isConnected}
              >
                <option value="none">None</option>
                <option value="even">Even</option>
                <option value="odd">Odd</option>
                <option value="mark">Mark</option>
                <option value="space">Space</option>
              </select>
            </div>
          </div>

          <div className="connection-status">
            <strong>Status:</strong> 
            <span className={connectionStatus.isConnected ? 'connected' : 'disconnected'}>
              {connectionStatus.isConnected ? ` Connected to ${connectionStatus.portPath}` : ' Disconnected'}
            </span>
          </div>

          <div className="connection-actions">
            {!connectionStatus.isConnected ? (
              <button
                onClick={handleConnect}
                disabled={!selectedPort || isLoading}
                className="connect-btn"
              >
                {isLoading ? 'Connecting...' : 'Connect'}
              </button>
            ) : (
              <button
                onClick={handleDisconnect}
                disabled={isLoading}
                className="disconnect-btn"
              >
                {isLoading ? 'Disconnecting...' : 'Disconnect'}
              </button>
            )}
          </div>

          <div className="send-data-container">
            <h4>Send Data</h4>
            <div className="send-data-row">
              <input
                type="text"
                value={sendMessage}
                onChange={(e) => setSendMessage(e.target.value)}
                placeholder="Enter message to send..."
                disabled={!connectionStatus.isConnected}
                onKeyPress={(e) => e.key === 'Enter' && handleSendData()}
                className="send-input"
              />
              <button
                onClick={handleSendData}
                disabled={!connectionStatus.isConnected || !sendMessage.trim()}
                className="send-btn"
              >
                Send
              </button>
            </div>
            
            <button
              onClick={handleSendTestData}
              disabled={!connectionStatus.isConnected}
              className="test-btn"
            >
              Send Test Data
            </button>
          </div>
        </div>
      </div>

      {/* 右侧：串口通信日志 */}
      <div className="serial-port-log-section">
        <div className="serial-port-communication">
          <h3>Serial Communication Log</h3>
          
          <div className="data-display-container">
            <div className="data-display-header">
              <span>Data Log</span>              <div className="display-controls">
                <label className="hex-mode-toggle">
                  <input
                    type="checkbox"
                    checked={isHexMode}
                    onChange={(e) => setIsHexMode(e.target.checked)}
                  />
                  Hex Mode
                </label>
                <label className="timestamp-toggle">
                  <input
                    type="checkbox"
                    checked={showTimestamp}
                    onChange={(e) => setShowTimestamp(e.target.checked)}
                  />
                  Show Timestamp
                </label>
                <button onClick={clearDataDisplay} className="clear-btn">Clear</button>
              </div>
            </div>            <div className="data-display" ref={dataDisplayRef}>
              {serialData.length === 0 ? (
                <div className="no-data">No data received yet...</div>
              ) : (
                serialData.map((data, index) => {
                  const delimiterIndex = data.indexOf('|||');
                  if (delimiterIndex === -1) {
                    // Fallback for old format
                    const [type, ...messageParts] = data.split(':');
                    const message = messageParts.join(':');
                    return (
                      <div key={index} className={`data-line ${type}`}>
                        <pre style={{ margin: 0, fontFamily: 'inherit' }}>{message}</pre>
                      </div>
                    );
                  }
                  
                  const type = data.substring(0, delimiterIndex);
                  const message = data.substring(delimiterIndex + 3);
                  return (
                    <div key={index} className={`data-line ${type}`}>
                      <pre style={{ margin: 0, fontFamily: 'inherit' }}>{message}</pre>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
