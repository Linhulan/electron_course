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
  const [config, setConfig] = useState<SerialPortConfig>({
    baudRate: 9600,
    dataBits: 8,
    stopBits: 1,
    parity: 'none'
  });
  
  const dataDisplayRef = useRef<HTMLDivElement>(null);

  const addToDataDisplay = useCallback((message: string, type: 'system' | 'sent' | 'received' | 'error' = 'system') => {
    const timestamp = new Date().toLocaleTimeString();
    const formattedMessage = `[${timestamp}] ${message}`;
    setSerialData(prev => [...prev, `${type}:${formattedMessage}`]);
    
    // Auto-scroll to bottom
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
    });

    const unsubscribeDataReceived = window.electron.onSerialDataReceived((data) => {
      addToDataDisplay(`[${data.timestamp}] RX: ${data.data}`, 'received');
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
  }, [refreshPorts, checkConnectionStatus, addToDataDisplay]);

  const handleConnect = async () => {
    if (!selectedPort) {
      setError('Please select a port first');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      
      const success = await window.electron.connectSerialPort(selectedPort, config);
      if (!success) {
        setError('Failed to connect to serial port');
      }
    } catch (err) {
      setError(`Connection failed: ${err}`);
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
      setError(`Disconnection failed: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendData = async () => {
    if (!sendMessage.trim()) {
      setError('Please enter a message to send');
      return;
    }

    if (!connectionStatus.isConnected) {
      setError('Not connected to any serial port');
      return;
    }

    try {
      setError('');
      await window.electron.sendSerialData(sendMessage);
      addToDataDisplay(`TX: ${sendMessage}`, 'sent');
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
    <div className={`serial-port-panel ${className || ''}`}>
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

        <div className="connection-controls">
          <div className="connection-status">
            Status: <span className={connectionStatus.isConnected ? 'connected' : 'disconnected'}>
              {connectionStatus.isConnected ? `Connected to ${connectionStatus.portPath}` : 'Disconnected'}
            </span>
          </div>
          
          <div className="connection-buttons">
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
        </div>
      </div>

      <div className="serial-port-communication">
        <h3>Serial Communication</h3>
        
        <div className="data-display-container">
          <div className="data-display-header">
            <span>Data Log</span>
            <button onClick={clearDataDisplay} className="clear-btn">Clear</button>
          </div>
          <div className="data-display" ref={dataDisplayRef}>
            {serialData.length === 0 ? (
              <div className="no-data">No data received yet...</div>
            ) : (
              serialData.map((data, index) => {
                const [type, message] = data.split(':', 2);
                return (
                  <div key={index} className={`data-line ${type}`}>
                    {message}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="send-data-container">
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
  );
};
