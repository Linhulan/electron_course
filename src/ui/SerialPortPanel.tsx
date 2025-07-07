import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import "./SerialPortPanel.css";
import { useAppConfigStore } from "./contexts/store";
import toast from "react-hot-toast";
import { getSerialPortManager, SerialPortManager } from "./utils/SerialPortManager";

interface SerialPortPanelProps {
  className?: string;
}

export const SerialPortPanel: React.FC<SerialPortPanelProps> = ({
  className,
}) => {
  const { t } = useTranslation();
  const serialManager = getSerialPortManager();
  
  // 简化的状态管理 - 大部分状态由 SerialPortManager 管理
  const [serialData, setSerialData] = useState<string[]>([]);
  const [sendMessage, setSendMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [isHexMode, setIsHexMode] = useState<boolean>(true);
  const [showTimestamp, setShowTimestamp] = useState<boolean>(true);
  const [isHexSendMode, setIsHexSendMode] = useState<boolean>(true);
  
  // 从 SerialPortManager 获取状态
  const [availablePorts, setAvailablePorts] = useState<SerialPortInfo[]>([]);
  const [selectedPort, setSelectedPort] = useState<string>("");
  const [connectionStatus, setConnectionStatus] = useState<SerialConnectionStatus>({ isConnected: false });
  const [config, setConfig] = useState<SerialPortConfig>({
    baudRate: 115200,
    dataBits: 8,
    stopBits: 1,
    parity: "none",
  });
  
  const serialConnected = useAppConfigStore((state) => state.serialConnected);
  const setSerialConnected = useAppConfigStore((state) => state.setSerialConnected);

  const dataDisplayRef = useRef<HTMLDivElement>(null);
  const addToDataDisplay = useCallback(
    (
      message: string,
      type:
        | "system"
        | "sent"
        | "received"
        | "error"
        | "warning"
        | "success"
        | "info"
        | "normal" = "system",
      skipTimestamp = false
    ) => {
      const timestamp = new Date().toLocaleTimeString();
      const formattedMessage = skipTimestamp
        ? message
        : `[${timestamp}] ${message}`;
      setSerialData((prev) => [...prev, `${type}|||${formattedMessage}`]); // Use ||| as delimiter to avoid conflicts with colons in data

      // Auto-scroll to bottom - 使用多种方法确保滚动成功
      setTimeout(() => {
        if (dataDisplayRef.current) {
          const element = dataDisplayRef.current;
          element.scrollTop = element.scrollHeight;
          // 强制滚动到底部
          element.scrollIntoView({ behavior: "smooth", block: "end" });
        }
      }, 10);

      // 延迟再次确保滚动到底部
      setTimeout(() => {
        if (dataDisplayRef.current) {
          dataDisplayRef.current.scrollTop =
            dataDisplayRef.current.scrollHeight;
        }
      }, 100);
    },
    []
  );

  // 监听HexMode变化，更新接收模式
  useEffect(() => {
    const updateReceiveMode = async () => {
      try {
        await serialManager.setReceiveMode(isHexMode);
        console.log(
          `Serial receive mode set to: ${
            isHexMode ? "Raw (Hex)" : "Line (Text)"
          }`
        );
      } catch {
        console.error("Failed to set serial receive mode");
      }
    };

    updateReceiveMode();
  }, [isHexMode, serialManager]);

  // 自动连接方法 - 使用 SerialPortManager
  const autoConnect = useCallback(async () => {
    const toastId = toast.loading(
      t("counter.autoConnectInfo", "Connecting to serial port..."),
      { position: "top-right" }
    );

    try {
      const success = await serialManager.autoConnect();
      
      if (success) {
        toast.success(
          t("counter.autoConnectSuccess", "Successfully connected to serial port."),
          { id: toastId }
        );
      } else {
        toast.error(
          t("counter.autoConnectFailed", "Failed to auto-connect to any serial port."),
          { id: toastId }
        );
      }
    } catch {
      toast.error(
        t("counter.autoConnectFailed", "Failed to auto-connect to any serial port."),
        { id: toastId }
      );
    }
  }, [serialManager, t]);

  // 刷新端口 - 使用 SerialPortManager
  const refreshPorts = useCallback(async () => {
    try {
      setIsLoading(true);
      await serialManager.refreshPorts();
    } catch (error) {
      setError(`Failed to list ports: ${error}`);
    } finally {
      setIsLoading(false);
    }
  }, [serialManager]);

  // 初始化 SerialPortManager 和设置事件监听
  useEffect(() => {
    const initializeSerialManager = async () => {
      try {
        // 更新配置
        serialManager.updateConfig(config);
        
        // 初始化管理器
        await serialManager.initialize();
        
        // 设置状态同步
        setAvailablePorts(serialManager.getAvailablePorts());
        setSelectedPort(serialManager.getSelectedPort());
        setConnectionStatus(serialManager.getConnectionStatus());
        
        // 设置事件监听器
        serialManager.addEventListener({
          onConnected: (data) => {
            setConnectionStatus({ isConnected: true, portPath: data.portPath });
            setSelectedPort(data.portPath);
            addToDataDisplay(
              `Connected to ${data.portPath} with baud rate ${data.config.baudRate}`,
              "system"
            );
            setError("");
          },
          onDisconnected: () => {
            setConnectionStatus({ isConnected: false });
            addToDataDisplay("Disconnected from serial port", "system");
          },
          onDataReceived: (data) => {
            // 根据时间戳开关决定显示格式
            const displayText = showTimestamp
              ? isHexMode
                ? `${data.timestamp}:${data.hexData}`
                : `${data.timestamp}:${data.textData}`
              : isHexMode
              ? data.hexData
              : data.textData;

            // 使用从后端传来的messageType
            addToDataDisplay(
              displayText,
              data.messageType as
                | "system"
                | "sent"
                | "received"
                | "error"
                | "warning"
                | "success"
                | "info"
                | "normal",
              true
            );
          },
          onError: (error) => {
            setError(error.error);
            addToDataDisplay(`Error: ${error.error}`, "error");
          },
          onPortsUpdated: (ports) => {
            setAvailablePorts(ports);
            // 如果当前选中的端口不再可用，清除选择
            if (selectedPort && !ports.some((port) => port.path === selectedPort)) {
              setSelectedPort("");
            }
          }
        });
        
      } catch (error) {
        console.error('Failed to initialize SerialPortManager:', error);
        setError(`Failed to initialize serial port manager: ${error}`);
      }
    };

    initializeSerialManager();

    // 清理函数
    return () => {
      serialManager.removeEventListener();
    };
  }, [
    serialManager,
    config,
    addToDataDisplay,
    isHexMode,
    showTimestamp,
    selectedPort,
  ]);

  // 监听来自 CounterDashboard 的手动自动连接事件
  useEffect(() => {
    const handleManualAutoConnect = () => {
      console.log("Manual auto-connect triggered from dashboard");
      addToDataDisplay(
        "Manual auto-connect triggered from dashboard",
        "system"
      );
      autoConnect();
    };

    // 监听自定义事件
    window.addEventListener("triggerAutoConnect", handleManualAutoConnect);

    return () => {
      window.removeEventListener("triggerAutoConnect", handleManualAutoConnect);
    };
  }, [autoConnect, addToDataDisplay]);

  // 连接方法 - 使用 SerialPortManager
  const handleConnect = async () => {
    if (!selectedPort) {
      setError("Please select a port first");
      return;
    }

    try {
      setIsLoading(true);
      setError("");
      
      // 更新管理器配置
      serialManager.updateConfig(config);
      
      const success = await serialManager.connect(selectedPort);
      if (success) {
        setSerialConnected(true);
      } else {
        setError(`Failed to connect to ${selectedPort}`);
      }
    } catch {
      setError(`Failed to connect: ${selectedPort}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 断开连接方法 - 使用 SerialPortManager
  const handleDisconnect = async () => {
    try {
      setIsLoading(true);
      setError("");
      await serialManager.disconnect();
      setSerialConnected(false);
    } catch (error) {
      setError(`Failed to disconnect: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 发送数据方法 - 使用 SerialPortManager
  const handleSendData = async () => {
    if (!sendMessage.trim()) return;
    try {
      setError("");
      
      await serialManager.sendData(sendMessage, isHexSendMode);
      
      if (isHexSendMode) {
        const formattedHex = SerialPortManager.formatHexString(sendMessage);
        addToDataDisplay(`${formattedHex} (HEX)`, "sent");
      } else {
        addToDataDisplay(`${sendMessage}`, "sent");
      }

      setSendMessage("");
    } catch (error) {
      setError(`Failed to send data: ${error}`);
    }
  };

  const clearDataDisplay = () => {
    setSerialData([]);
  };

  // 处理配置变化 - 同步到 SerialPortManager
  useEffect(() => {
    serialManager.updateConfig(config);
  }, [config, serialManager]);

  // 处理端口选择变化
  const handlePortSelect = (portPath: string) => {
    setSelectedPort(portPath);
    serialManager.setSelectedPort(portPath);
  };

  return (
    <div className={`serial-port-panel-layout ${className || ""}`}>
        {/* 左侧：串口连接配置 */}
        <div className="serial-port-config-section">
          {" "}
          <div className="serial-port-connection">
          <h3>{t("serialPort.connection")}</h3>

          {error && <div className="error-message">{error}</div>}

          <div className="port-selection">
            <label htmlFor="port-select">{t("serialPort.selectPort")}:</label>
            <div className="port-select-row">
              {" "}
              <select
                id="port-select"
                value={selectedPort}
                onChange={(e) => handlePortSelect(e.target.value)}
                disabled={connectionStatus.isConnected || isLoading}
                title={
                  selectedPort
                    ? availablePorts.find((p) => p.path === selectedPort)
                        ?.displayName || selectedPort
                    : t("serialPort.selectPort")
                }
              >
                <option value="">-- {t("serialPort.selectPort")} --</option>
                {availablePorts.map((port) => (
                  <option
                    key={port.path}
                    value={port.path}
                    title={SerialPortManager.getPortDisplayName(port)}
                  >
                    {SerialPortManager.getPortDisplayName(port)}
                  </option>
                ))}
              </select>{" "}
              <button
                onClick={refreshPorts}
                disabled={isLoading}
                className="refresh-btn"
                title={t("serialPort.refreshPorts")}
              >
                <span className="refresh-icon">🔄</span>
              </button>
            </div>
          </div>

          <div className="connection-config">
            <div className="config-row">
              <label htmlFor="baud-rate">{t("serialPort.baudRate")}:</label>
              <select
                id="baud-rate"
                value={config.baudRate}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    baudRate: parseInt(e.target.value),
                  }))
                }
                disabled={serialConnected}
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
            </div>{" "}
            <div className="config-row">
              <label htmlFor="data-bits">{t("serialPort.dataBits")}:</label>
              <select
                id="data-bits"
                value={config.dataBits}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    dataBits: parseInt(e.target.value) as 5 | 6 | 7 | 8,
                  }))
                }
                disabled={serialConnected}
              >
                <option value={5}>5</option>
                <option value={6}>6</option>
                <option value={7}>7</option>
                <option value={8}>8</option>
              </select>
            </div>
            <div className="config-row">
              <label htmlFor="stop-bits">{t("serialPort.stopBits")}:</label>
              <select
                id="stop-bits"
                value={config.stopBits}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    stopBits: parseFloat(e.target.value) as 1 | 1.5 | 2,
                  }))
                }
                disabled={serialConnected}
              >
                <option value={1}>1</option>
                <option value={1.5}>1.5</option>
                <option value={2}>2</option>
              </select>
            </div>
            <div className="config-row">
              <label htmlFor="parity">{t("serialPort.parity")}:</label>
              <select
                id="parity"
                value={config.parity}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    parity: e.target.value as
                      | "none"
                      | "even"
                      | "odd"
                      | "mark"
                      | "space",
                  }))
                }
                disabled={serialConnected}
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
            <strong>{t("serialPort.connectionStatus")}:</strong>
            <span className={serialConnected ? "connected" : "disconnected"}>
              {serialConnected
                ? ` ${t("serialPort.connected")} ${connectionStatus.portPath}`
                : ` ${t("serialPort.disconnected")}`}
            </span>
          </div>

          <div className="connection-actions">
            {!serialConnected ? (
              <button
                onClick={handleConnect}
                disabled={!selectedPort || isLoading}
                className="connect-btn"
              >
                {isLoading
                  ? t("serialPort.connecting")
                  : t("serialPort.connect")}
              </button>
            ) : (
              <button
                onClick={handleDisconnect}
                disabled={isLoading}
                className="disconnect-btn"
              >
                {isLoading
                  ? t("serialPort.disconnecting")
                  : t("serialPort.disconnect")}
              </button>
            )}
          </div>
        </div>
      </div>{" "}
      {/* 右侧：串口通信日志 */}
      <div className="serial-port-log-section">
        <div className="serial-port-communication">
          <h3>{t("serialPort.receiveData")}</h3>
          <div className="data-display-container">
            {" "}
            <div className="data-display-header">
              <span>{t("serialPort.receiveData")}</span>{" "}
              <div className="display-controls">
                <label className="hex-mode-toggle">
                  <input
                    type="checkbox"
                    checked={isHexMode}
                    onChange={(e) => setIsHexMode(e.target.checked)}
                  />
                  {t("serialPort.hexMode")}
                  <small className="mode-hint">
                    {isHexMode
                      ? t("serialPort.hexModeHint")
                      : t("serialPort.textModeHint")}
                  </small>
                </label>
                <label className="timestamp-toggle">
                  <input
                    type="checkbox"
                    checked={showTimestamp}
                    onChange={(e) => setShowTimestamp(e.target.checked)}
                  />
                  {t("serialPort.showTimestamp")}
                </label>
                <button onClick={clearDataDisplay} className="clear-btn">
                  {t("common.clear")}
                </button>
              </div>
            </div>
            <div className="data-display" ref={dataDisplayRef}>
              {serialData.length === 0 ? (
                <div className="no-data">{t("common.noData")}...</div>
              ) : (
                serialData.map((data, index) => {
                  const delimiterIndex = data.indexOf("|||");
                  if (delimiterIndex === -1) {
                    // Fallback for old format
                    const [type, ...messageParts] = data.split(":");
                    const message = messageParts.join(":");
                    return (
                      <div key={index} className={`data-line ${type}`}>
                        <pre style={{ margin: 0, fontFamily: "inherit" }}>
                          {message}
                        </pre>
                      </div>
                    );
                  }

                  const type = data.substring(0, delimiterIndex);
                  const message = data.substring(delimiterIndex + 3);
                  return (
                    <div key={index} className={`data-line ${type}`}>
                      <pre style={{ margin: 0, fontFamily: "inherit" }}>
                        {message}
                      </pre>
                    </div>
                  );
                })
              )}
            </div>
          </div>{" "}
          {/* Send Data 区域移动到日志区域底部 */}
          <div className="send-data-container">
            <h4>{t("serialPort.sendData")}</h4>

            {/* 发送模式切换 */}
            <div className="send-mode-controls">
              <label className="send-mode-toggle">
                <input
                  type="checkbox"
                  checked={isHexSendMode}
                  onChange={(e) => setIsHexSendMode(e.target.checked)}
                />
                {t("serialPort.hexMode")}
              </label>
            </div>

            <div className="send-data-row">
              <input
                type="text"
                value={sendMessage}
                onChange={(e) => setSendMessage(e.target.value)}
                placeholder={
                  isHexSendMode
                    ? "48656C6C6F or 48 65 6C 6C 6F..."
                    : t("serialPort.dataToSend")
                }
                disabled={!connectionStatus.isConnected}
                onKeyPress={(e) => e.key === "Enter" && handleSendData()}
                className="send-input"
              />
              <button
                onClick={handleSendData}
                disabled={!connectionStatus.isConnected || !sendMessage.trim()}
                className="send-btn"
              >
                {t("serialPort.send")} {isHexSendMode ? "Hex" : "Text"}
              </button>
            </div>

            {/* 测试数据按钮 */}
            {import.meta.env.DEV && (
              <div className="test-data-buttons">
                <button
                  onClick={() =>
                    setSendMessage(
                      isHexSendMode ? "AA 55 03 00 01 00 00 01 A5 5A" : "Hello"
                    )
                  }
                  disabled={!connectionStatus.isConnected}
                  className="test-btn"
                >
                  {isHexSendMode ? "Test Hex (CDM Start)" : "Test Text (Start)"}
                </button>
                <button
                  onClick={() => setSendMessage("0A0D")}
                  disabled={!connectionStatus.isConnected}
                  className="test-btn"
                >
                  Test Hex (WL Start)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
