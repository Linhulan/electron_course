
const electron = require('electron');

electron.contextBridge.exposeInMainWorld('electron', {
  subscribeStatistics: (callback: (statistics: any) => void) => {
    electron.ipcRenderer.on('statistics', (_: any, statistics: any) => {
      callback(statistics);
    });
  },
  getStaticData: () => electron.ipcRenderer.invoke('getStaticData'),
})
