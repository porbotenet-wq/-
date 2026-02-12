import { useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { useTelegram } from './hooks/useTelegram';
import { useAppStore } from './stores/appStore';
import { NavBar } from './components/NavBar';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import PlanFact from './pages/PlanFact';
import Modules from './pages/Modules';
import ProjectInfo from './pages/ProjectInfo';

export default function App() {
  const { user: tgUser, startParam, isInTelegram } = useTelegram();
  const { loadUser, loadProject, user } = useAppStore();
  const navigate = useNavigate();

  useEffect(() => {
    // Load user by Telegram ID (or mock for dev)
    const telegramId = tgUser?.id || 8059235604; // fallback for dev
    loadUser(telegramId);
    loadProject();
  }, [tgUser]);

  useEffect(() => {
    // Handle deep-link from bot
    if (startParam) {
      if (startParam.startsWith('task_')) navigate('/tasks');
      else if (startParam.startsWith('plan_fact')) navigate('/plan-fact');
      else if (startParam.startsWith('modules')) navigate('/modules');
    }
  }, [startParam]);

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
