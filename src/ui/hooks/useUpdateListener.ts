import { useEffect } from 'react';
import { useUpdateStore } from './useUpdateStore';

export const useUpdateListener = () => {
  const {
    setUpdateAvailable,
    setUpdateDownloaded,
    setCheckingForUpdates,
    setDownloadingUpdate,
    setDownloadProgress,
    setUpdateError
  } = useUpdateStore();

  useEffect(() => {
    // 设置更新事件监听器
    const unsubscribeChecking = window.electron.onUpdateChecking(() => {
      console.log('Checking for updates...');
      setCheckingForUpdates(true);
    });

    const unsubscribeAvailable = window.electron.onUpdateAvailable((info) => {
      console.log('Update available:', info);
      setUpdateAvailable(true, info);
      setCheckingForUpdates(false);
    });

    const unsubscribeNotAvailable = window.electron.onUpdateNotAvailable(() => {
      console.log('No updates available');
      setUpdateAvailable(false);
      setCheckingForUpdates(false);
    });

    const unsubscribeDownloadProgress = window.electron.onUpdateDownloadProgress((progress) => {
      console.log('Download progress:', progress);
      setDownloadProgress(progress);
      setDownloadingUpdate(true);
    });

    const unsubscribeDownloaded = window.electron.onUpdateDownloaded((info) => {
      console.log('Update downloaded:', info);
      setUpdateDownloaded(true, info);
      setDownloadingUpdate(false);
    });

    const unsubscribeError = window.electron.onUpdateError((error) => {
      console.error('Update error:', error);
      setUpdateError(error);
    });

    // 清理函数
    return () => {
      unsubscribeChecking();
      unsubscribeAvailable();
      unsubscribeNotAvailable();
      unsubscribeDownloadProgress();
      unsubscribeDownloaded();
      unsubscribeError();
    };
  }, [
    setUpdateAvailable,
    setUpdateDownloaded,
    setCheckingForUpdates,
    setDownloadingUpdate,
    setDownloadProgress,
    setUpdateError
  ]);
};
