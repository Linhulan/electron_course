import { app, BrowserWindow } from "electron";
import { ipcMainHandle, isDev } from "./utils.js";
import { getStaticData, pollResources } from "./resourceManager.js";
import { getPreloadPath, getUIPath } from "./pathResolver.js";


app.commandLine.appendSwitch('enable-lcp');
// app.commandLine.appendSwitch('disable-features', 'OutOfProcessPdf');
app.enableSandbox(); // 必须启用沙箱

app.on("ready", () => {
  const mainWindow = new BrowserWindow({
    webPreferences: {
      preload: getPreloadPath(),
    },
    // show: false,
  });

  // mainWindow.once("ready-to-show", () => {
  //   mainWindow.show();
  // });
  
  if ( isDev() ) {
    mainWindow.loadURL("http://localhost:5123");
  }
  else {
    mainWindow.loadFile(getUIPath());
  }

  pollResources(mainWindow);
  
  ipcMainHandle('getStaticData', () => {
    return getStaticData();
  });

});
