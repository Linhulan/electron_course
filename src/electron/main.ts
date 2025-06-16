import { app, BrowserWindow } from "electron";
import { ipcMainHandle, ipcMainOn, isDev } from "./utils.js";
import { getStaticData, pollResources } from "./resourceManager.js";
import { getPreloadPath, getUIPath } from "./pathResolver.js";
import { createTray } from "./tray.js";
import { createMenu } from "./menu.js";
import { SerialPort } from 'serialport';
// app.commandLine.appendSwitch("enable-lcp");
// app.commandLine.appendSwitch('disable-features', 'OutOfProcessPdf');
// app.enableSandbox(); // 必须启用沙箱

// Menu.setApplicationMenu(null);

async function listSerialPorts() {
  try {
    const ports = await SerialPort.list();
    return ports;
    // return ports.map(port => ({
    //   path: port.path,
    //   vendorId: port.vendorId,
    //   displayName: `${port.path} - ${port.manufacturer || 'Unknown'}`,
    // }));
  } catch (err) {
    console.error('Error listing serial ports:', err);
    return [];
  }
}


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

  createTray(mainWindow);
  createMenu(mainWindow);
  handleCloseEvenets(mainWindow);

  const ports = await listSerialPorts();
  console.log("Serial ports detected:");
  console.log(ports);

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
