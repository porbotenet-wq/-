import { useEffect, useState } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { useTelegram } from './hooks/useTelegram';
import { useAppStore } from './stores/appStore';
import { NavBar } from './components/NavBar';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import PlanFact from './pages/PlanFact';
import Modules from './pages/Modules';
import ProjectInfo from './pages/ProjectInfo';
import { resolveLaunchRoute } from './utils/launchContext';
import {
  extractRoleSystemName,
  isRouteAllowed,
  loadRoleScreenContract,
  resolveRoleAccess,
  type RoleScreenContract,
} from './contracts/roleScreens';

export default function App() {
  const { user: tgUser, startParam, isInTelegram } = useTelegram();
  const { loadUser, loadProject, user } = useAppStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [screenContract, setScreenContract] = useState<RoleScreenContract | null>(null);

  useEffect(() => {
    // Load user by Telegram ID (or mock for dev)
    const telegramId = tgUser?.id || 8059235604; // fallback for dev
    loadUser(telegramId);
    loadProject();
  }, [tgUser, loadUser, loadProject]);

  useEffect(() => {
    let active = true;
    void loadRoleScreenContract().then((contract) => {
      if (active) setScreenContract(contract);
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    // Handle deep-link from bot
    const launchRoute = resolveLaunchRoute(startParam, window.location.search);
    if (!launchRoute) return;

    const currentRoute = `${location.pathname}${location.search}`;
    if (launchRoute !== currentRoute) {
      navigate(launchRoute, { replace: true });
    }
  }, [startParam, location.pathname, location.search, navigate]);

  useEffect(() => {
    if (!user || !screenContract) {
      return;
    }

    const roleName = extractRoleSystemName(user);
    const access = resolveRoleAccess(screenContract, roleName);

    if (!isRouteAllowed(access, location.pathname)) {
      navigate(access.defaultRoute, { replace: true });
    }
  }, [user, screenContract, location.pathname, navigate]);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-4xl mb-4">🏗</div>
          <div className="text-lg text-tg-hint">Загрузка STSphera...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-tg-bg pb-20">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/plan-fact" element={<PlanFact />} />
        <Route path="/modules" element={<Modules />} />
        <Route path="/project" element={<ProjectInfo />} />
      </Routes>
      <NavBar />
    </div>
  );
}
