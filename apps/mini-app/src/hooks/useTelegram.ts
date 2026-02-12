import { useEffect, useState, useCallback } from 'react';

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
          };
          start_param?: string;
        };
        ready: () => void;
        expand: () => void;
        close: () => void;
        MainButton: {
          text: string;
          color: string;
          textColor: string;
          isVisible: boolean;
          isActive: boolean;
          show: () => void;
          hide: () => void;
          onClick: (fn: () => void) => void;
          offClick: (fn: () => void) => void;
          setText: (text: string) => void;
          enable: () => void;
          disable: () => void;
        };
        BackButton: {
          isVisible: boolean;
          show: () => void;
          hide: () => void;
          onClick: (fn: () => void) => void;
          offClick: (fn: () => void) => void;
        };
        HapticFeedback: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
        showAlert: (message: string) => void;
        showConfirm: (message: string, callback: (ok: boolean) => void) => void;
        showPopup: (params: { title?: string; message: string; buttons?: any[] }, callback?: (id: string) => void) => void;
        themeParams: Record<string, string>;
        colorScheme: 'light' | 'dark';
        headerColor: string;
        backgroundColor: string;
        setHeaderColor: (color: string) => void;
        setBackgroundColor: (color: string) => void;
        isVersionAtLeast: (version: string) => boolean;
        platform: string;
        version: string;
      };
    };
  }
}

export function useTelegram() {
  const [webApp, setWebApp] = useState<Window['Telegram']>(undefined);

  useEffect(() => {
    const tg = window.Telegram;
    if (tg?.WebApp) {
      tg.WebApp.ready();
      tg.WebApp.expand();
      setWebApp(tg);
    }
  }, []);

  const user = webApp?.WebApp.initDataUnsafe.user;
  const startParam = webApp?.WebApp.initDataUnsafe.start_param;

  const haptic = useCallback((type: 'light' | 'medium' | 'heavy' = 'light') => {
    try {
      webApp?.WebApp.HapticFeedback?.impactOccurred(type);
    } catch {}
  }, [webApp]);

  const showAlert = useCallback((message: string) => {
    if (webApp?.WebApp.showAlert) {
      webApp.WebApp.showAlert(message);
    } else {
      alert(message);
    }
  }, [webApp]);

  const showConfirm = useCallback((message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      if (webApp?.WebApp.showConfirm) {
        webApp.WebApp.showConfirm(message, (ok) => resolve(ok));
      } else {
        resolve(confirm(message));
      }
    });
  }, [webApp]);

  return {
    webApp: webApp?.WebApp,
    user,
    startParam,
    isInTelegram: !!webApp,
    haptic,
    showAlert,
    showConfirm,
    initData: webApp?.WebApp.initData || '',
    colorScheme: webApp?.WebApp.colorScheme || 'dark',
    platform: webApp?.WebApp.platform || 'unknown',
  };
}
