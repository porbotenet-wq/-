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
import Gantt from './pages/Gantt';
import Documents from './pages/Documents';

export default function App() {
  const { user: tgUser, startParam, isInTelegram } = useTelegram();
  const { loadUser, loadProject, user, error } = useAppStore();
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
      else if (startParam.startsWith('plan_fact') || startParam === 'plan_fact') navigate('/plan-fact');
      else if (startParam.startsWith('modules') || startParam === 'modules') navigate('/modules');
      else if (startParam === 'gantt') navigate('/gantt');
      else if (startParam === 'documents') navigate('/documents');
      else if (startParam === 'tasks') navigate('/tasks');
    }
  }, [startParam]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <div className="text-lg text-tg-text mb-2">Ошибка подключения</div>
          <div className="text-sm text-tg-hint mb-4">{error}</div>
          <button
            onClick={() => {
              const telegramId = tgUser?.id || 8059235604;
              loadUser(telegramId);
              loadProject();
            }}
            className="bg-tg-button text-tg-buttonText px-4 py-2 rounded-lg"
          >
            Повторить
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">🏗</div>
          <div className="text-lg text-tg-hint">Загрузка STSphera...</div>
        </div>
      </div>
    );
  }

  if (user.status === 'PENDING') {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <div className="text-lg text-tg-text mb-2">Ожидание активации</div>
          <div className="text-sm text-tg-hint">
            Ваша заявка на рассмотрении. Администратор назначит вам роль.
          </div>
        </div>
      </div>
    );
  }

  if (user.status === 'BLOCKED') {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="text-center">
          <div className="text-4xl mb-4">🚫</div>
          <div className="text-lg text-tg-text mb-2">Аккаунт заблокирован</div>
          <div className="text-sm text-tg-hint">
            Обратитесь к администратору проекта.
          </div>
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
        <Route path="/gantt" element={<Gantt />} />
        <Route path="/documents" element={<Documents />} />
      </Routes>
      <NavBar />
    </div>
  );
}
