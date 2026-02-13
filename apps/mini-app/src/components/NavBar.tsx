import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import {
  extractRoleSystemName,
  getTabsForRole,
  loadRoleScreenContract,
  resolveRoleAccess,
  type RoleScreenContract,
} from '../contracts/roleScreens';

export function NavBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user } = useAppStore();
  const [screenContract, setScreenContract] = useState<RoleScreenContract | null>(null);

  useEffect(() => {
    let active = true;
    void loadRoleScreenContract().then((contract) => {
      if (active) setScreenContract(contract);
    });

    return () => {
      active = false;
    };
  }, []);

  const tabs = useMemo(() => {
    if (!screenContract) {
      return [];
    }

    const roleName = extractRoleSystemName(user);
    const access = resolveRoleAccess(screenContract, roleName);
    return getTabsForRole(screenContract, access);
  }, [screenContract, user]);

  if (tabs.length === 0) {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-tg-secondary border-t border-gray-700/50 flex justify-around items-center py-2 px-1 z-50">
      {tabs.map((tab) => {
        const active = pathname === tab.path;
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors ${
              active
                ? 'text-tg-button bg-tg-button/10'
                : 'text-tg-hint hover:text-tg-text'
            }`}
          >
            <span className="text-lg">{tab.icon}</span>
            <span className="text-[10px] font-medium">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
