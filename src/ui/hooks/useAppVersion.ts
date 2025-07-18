import { useState, useEffect } from 'react';

export const useAppVersion = () => {
  const [version, setVersion] = useState<string>('1.0.0');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const appVersion = await window.electron.getAppVersion();
        setVersion(appVersion);
      } catch (error) {
        console.error('Error fetching app version:', error);
        setVersion('1.0.0'); // fallback version
      } finally {
        setLoading(false);
      }
    };

    fetchVersion();
  }, []);

  return { version, loading };
};
