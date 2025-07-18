import pkg from 'electron-updater';
const { autoUpdater } = pkg;
import { BrowserWindow, dialog } from 'electron';
import { isDev } from './utils.js';

export class AutoUpdaterManager {
  private mainWindow: BrowserWindow;
  private updateCheckInterval: NodeJS.Timeout | null = null;
  private isUpdateAvailable = false;
  private isUpdateDownloaded = false;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
    this.setupUpdater();
  }

  private setupUpdater() {
    // 在开发环境中禁用自动更新
    if (isDev()) {
      console.log('Auto-updater disabled in development mode');
      return;
    }

    // 配置更新器
    autoUpdater.autoDownload = false; // 不自动下载，让用户选择
    autoUpdater.allowPrerelease = false; // 不允许预发布版本
    autoUpdater.allowDowngrade = false; // 不允许降级

    // 设置更新检查间隔（每小时检查一次）
    this.updateCheckInterval = setInterval(() => {
      this.checkForUpdates();
    }, 60 * 60 * 1000); // 1小时

    // 监听更新事件
    this.setupUpdateListeners();

    // 应用启动后延迟5秒检查更新
    setTimeout(() => {
      this.checkForUpdates();
    }, 5000);
  }

  private setupUpdateListeners() {
    // 检查更新时
    autoUpdater.on('checking-for-update', () => {
      console.log('Checking for updates...');
      this.sendToRenderer('update-checking');
    });

    // 发现可用更新
    autoUpdater.on('update-available', (info) => {
      console.log('Update available:', info.version);
      this.isUpdateAvailable = true;
      this.sendToRenderer('update-available', {
        version: info.version,
        releaseNotes: info.releaseNotes,
        releaseDate: info.releaseDate
      });
    });

    // 没有可用更新
    autoUpdater.on('update-not-available', (info) => {
      console.log('Update not available:', info.version);
      this.sendToRenderer('update-not-available');
    });

    // 下载进度
    autoUpdater.on('download-progress', (progress) => {
      console.log(`Download progress: ${progress.percent.toFixed(2)}%`);
      this.sendToRenderer('update-download-progress', {
        percent: progress.percent,
        bytesPerSecond: progress.bytesPerSecond,
        total: progress.total,
        transferred: progress.transferred
      });
    });

    // 更新下载完成
    autoUpdater.on('update-downloaded', (info) => {
      console.log('Update downloaded:', info.version);
      this.isUpdateDownloaded = true;
      this.sendToRenderer('update-downloaded', {
        version: info.version
      });
    });

    // 错误处理
    autoUpdater.on('error', (error) => {
      console.error('Auto-updater error:', error);
      this.sendToRenderer('update-error', {
        message: error.message
      });
    });
  }

  private sendToRenderer(channel: string, data?: unknown) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  // 手动检查更新
  public checkForUpdates() {
    if (isDev()) {
      console.log('Auto-updater disabled in development mode');
      return;
    }

    console.log('Manually checking for updates...');
    autoUpdater.checkForUpdates().catch(error => {
      console.error('Error checking for updates:', error);
    });
  }

  // 开始下载更新
  public downloadUpdate() {
    if (!this.isUpdateAvailable) {
      console.log('No update available to download');
      return;
    }

    console.log('Starting update download...');
    autoUpdater.downloadUpdate().catch(error => {
      console.error('Error downloading update:', error);
    });
  }

  // 安装更新并重启
  public installUpdate() {
    if (!this.isUpdateDownloaded) {
      console.log('No update downloaded to install');
      return;
    }

    console.log('Installing update and restarting...');
    // 给用户一个确认对话框
    const choice = dialog.showMessageBoxSync(this.mainWindow, {
      type: 'question',
      buttons: ['Install and Restart', 'Cancel'],
      defaultId: 0,
      title: 'Install Update',
      message: 'A new version has been downloaded. The application will restart to apply the update.',
      detail: 'All unsaved data will be lost. Are you sure you want to continue?'
    });

    if (choice === 0) {
      autoUpdater.quitAndInstall();
    }
  }

  // 清理资源
  public destroy() {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
      this.updateCheckInterval = null;
    }
  }

  // 获取更新状态
  public getUpdateStatus() {
    return {
      isUpdateAvailable: this.isUpdateAvailable,
      isUpdateDownloaded: this.isUpdateDownloaded
    };
  }
}
