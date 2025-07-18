import { create } from 'zustand';

interface UpdateState {
  // 更新状态
  isUpdateAvailable: boolean;
  isUpdateDownloaded: boolean;
  isCheckingForUpdates: boolean;
  isDownloadingUpdate: boolean;
  
  // 更新信息
  updateInfo: UpdateInfo | null;
  downloadProgress: UpdateProgress | null;
  updateError: UpdateError | null;
  
  // 操作函数
  setUpdateAvailable: (available: boolean, info?: UpdateInfo) => void;
  setUpdateDownloaded: (downloaded: boolean, info?: UpdateInfo) => void;
  setCheckingForUpdates: (checking: boolean) => void;
  setDownloadingUpdate: (downloading: boolean) => void;
  setDownloadProgress: (progress: UpdateProgress | null) => void;
  setUpdateError: (error: UpdateError | null) => void;
  
  // 业务操作
  checkForUpdates: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
  clearUpdateState: () => void;
}

export const useUpdateStore = create<UpdateState>((set, get) => ({
  // 初始状态
  isUpdateAvailable: false,
  isUpdateDownloaded: false,
  isCheckingForUpdates: false,
  isDownloadingUpdate: false,
  updateInfo: null,
  downloadProgress: null,
  updateError: null,
  
  // 状态设置函数
  setUpdateAvailable: (available: boolean, info?: UpdateInfo) => {
    set({ 
      isUpdateAvailable: available,
      updateInfo: info || null,
      updateError: null
    });
  },
  
  setUpdateDownloaded: (downloaded: boolean, info?: UpdateInfo) => {
    set({ 
      isUpdateDownloaded: downloaded,
      updateInfo: info || get().updateInfo,
      isDownloadingUpdate: false
    });
  },
  
  setCheckingForUpdates: (checking: boolean) => {
    set({ 
      isCheckingForUpdates: checking,
      updateError: checking ? null : get().updateError
    });
  },
  
  setDownloadingUpdate: (downloading: boolean) => {
    set({ 
      isDownloadingUpdate: downloading,
      downloadProgress: downloading ? get().downloadProgress : null
    });
  },
  
  setDownloadProgress: (progress: UpdateProgress | null) => {
    set({ downloadProgress: progress });
  },
  
  setUpdateError: (error: UpdateError | null) => {
    set({ 
      updateError: error,
      isCheckingForUpdates: false,
      isDownloadingUpdate: false
    });
  },
  
  // 业务操作
  checkForUpdates: async () => {
    try {
      set({ isCheckingForUpdates: true, updateError: null });
      await window.electron.checkForUpdates();
    } catch (error) {
      console.error('Error checking for updates:', error);
      set({ 
        isCheckingForUpdates: false,
        updateError: { message: 'Failed to check for updates' }
      });
    }
  },
  
  downloadUpdate: async () => {
    try {
      set({ isDownloadingUpdate: true, updateError: null });
      await window.electron.downloadUpdate();
    } catch (error) {
      console.error('Error downloading update:', error);
      set({ 
        isDownloadingUpdate: false,
        updateError: { message: 'Failed to download update' }
      });
    }
  },
  
  installUpdate: async () => {
    try {
      await window.electron.installUpdate();
    } catch (error) {
      console.error('Error installing update:', error);
      set({ 
        updateError: { message: 'Failed to install update' }
      });
    }
  },
  
  clearUpdateState: () => {
    set({
      isUpdateAvailable: false,
      isUpdateDownloaded: false,
      isCheckingForUpdates: false,
      isDownloadingUpdate: false,
      updateInfo: null,
      downloadProgress: null,
      updateError: null
    });
  }
}));
