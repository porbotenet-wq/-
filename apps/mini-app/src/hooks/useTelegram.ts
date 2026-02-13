import { useEffect, useState } from 'react';

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
          show: () => void;
          hide: () => void;
          onClick: (fn: () => void) => void;
        };
        BackButton: {
          show: () => void;
          hide: () => void;
          onClick: (fn: () => void) => void;
        };
        themeParams: Record<string, string>;
        colorScheme: 'light' | 'dark';
        headerColor: string;
        backgroundColor: string;
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

  return {
    webApp: webApp?.WebApp,
    user,
    startParam,
    isInTelegram: !!webApp,
  };
}
