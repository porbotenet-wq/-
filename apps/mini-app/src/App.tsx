import { useEffect } from 'react';
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

export default function App() {
  const { user: tgUser, startParam, isInTelegram } = useTelegram();
  const { loadUser, loadProject, user } = useAppStore();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Load user by Telegram ID (or mock for dev)
    const telegramId = tgUser?.id || 8059235604; // fallback for dev
    loadUser(telegramId);
    loadProject();
  }, [tgUser]);

  useEffect(() => {
    // Handle deep-link from bot
    const launchRoute = resolveLaunchRoute(startParam, window.location.search);
    if (!launchRoute) return;

    const currentRoute = `${location.pathname}${location.search}`;
    if (launchRoute !== currentRoute) {
      navigate(launchRoute, { replace: true });
    }
  }, [startParam, location.pathname, location.search, navigate]);

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
