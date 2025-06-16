import { app, BrowserWindow } from "electron";
import { ipcMainHandle, ipcMainOn, isDev } from "./utils.js";
import { getStaticData, pollResources } from "./resourceManager.js";
import { getPreloadPath, getUIPath } from "./pathResolver.js";
import { createTray } from "./tray.js";
import { createMenu } from "./menu.js";
import { SerialPortManager, getAvailablePorts } from './serialPort.js';
// app.commandLine.appendSwitch("enable-lcp");
// app.commandLine.appendSwitch('disable-features', 'OutOfProcessPdf');
// app.enableSandbox(); // 必须启用沙箱

// Menu.setApplicationMenu(null);

app.on("ready", async () => {
  const mainWindow = new BrowserWindow({
    webPreferences: {
      preload: getPreloadPath(),
    },
    frame: false,
    // show: false,
  });

  // mainWindow.once("ready-to-show", () => {
  //   mainWindow.show();
  // });

  if (isDev()) {
    mainWindow.loadURL("http://localhost:5123");
  } else {
    mainWindow.loadFile(getUIPath());
  }

  pollResources(mainWindow);

  ipcMainHandle("getStaticData", () => {
    return getStaticData();
  });

  ipcMainOn("sendFrameAction", (payload) => {
    switch (payload) {
      case "MINIMIZE":
        mainWindow.minimize();
        break;
      case "MAXIMIZE":
        if (mainWindow.isMaximized()) {
          mainWindow.unmaximize();
        } else {
          mainWindow.maximize();
        }
        break;
      case "CLOSE":
        mainWindow.close();
        break;
    }
  });

  // 初始化串口管理器
  const serialPortManager = new SerialPortManager(mainWindow);

  // 注册串口相关的IPC处理程序
  ipcMainHandle("list-serial-ports", async () => {
    return await serialPortManager.listPorts();
  });  ipcMainHandle("connect-serial-port", async (...args: unknown[]) => {
    const [portPath, config] = args as [string, SerialPortConfig?];
    return await serialPortManager.connect(portPath, config);
  });

  ipcMainHandle("disconnect-serial-port", async () => {
    return await serialPortManager.disconnect();
  });

  ipcMainHandle("send-serial-data", async (...args: unknown[]) => {
    const [data] = args as [string];
    return await serialPortManager.sendData(data);
  });

  ipcMainHandle("get-serial-connection-status", () => {
    return serialPortManager.getConnectionStatus();
  });

  createTray(mainWindow);
  createMenu(mainWindow);
  handleCloseEvenets(mainWindow);
  // 获取串口列表
  try {
    const ports = await getAvailablePorts();
    console.log("Serial ports detected:");
    
    // 使用简单的日志格式避免编码问题
    ports.forEach((port, index) => {
      console.log(`Port ${index + 1}:`);
      console.log(`  Path: ${port.path}`);
      console.log(`  Manufacturer: ${port.manufacturer || 'Unknown'}`);
      console.log(`  Vendor ID: ${port.vendorId || 'N/A'}`);
      console.log(`  Product ID: ${port.productId || 'N/A'}`);
      console.log(`  Serial Number: ${port.serialNumber || 'N/A'}`);
      console.log('---');
    });
  } catch (error) {
    console.error("Error getting serial ports:", error);
  }

  // mainWindow.webContents.session.on('select-serial-port', (event, portList, webContents, callback) => {
  //   // Add listeners to handle ports being added or removed before the callback for `select-serial-port`
  //   // is called.
  //   mainWindow.webContents.session.on('serial-port-added', (event, port) => {
  //     console.log('serial-port-added FIRED WITH', port)
  //     // Optionally update portList to add the new port
  //   })

  //   mainWindow.webContents.session.on('serial-port-removed', (event, port) => {
  //     console.log('serial-port-removed FIRED WITH', port)
  //     // Optionally update portList to remove the port
  //   })

  //   event.preventDefault()
  //   if (portList && portList.length > 0) {
  //     callback(portList[0].portId)
  //   } else {
  //     // eslint-disable-next-line n/no-callback-literal
  //     callback('') // Could not find any matching devices
  //   }
  // })

});

function handleCloseEvenets(mainWindow: BrowserWindow) {
  let willClose = false;

  mainWindow.on("close", (e) => {
    if (willClose) {
      return;
    }

    e.preventDefault();
    mainWindow.hide();
    if (app.dock) {
      app.dock.hide();
    }
  });

  app.on("before-quit", () => {
    willClose = true;
  });

  mainWindow.on("show", () => {
    willClose = false;
  });
}
