import { useNavigate, useLocation } from 'react-router-dom';

const tabs = [
  { path: '/', icon: '📊', label: 'Сводка' },
  { path: '/tasks', icon: '📋', label: 'Задачи' },
  { path: '/plan-fact', icon: '📝', label: 'План-Факт' },
  { path: '/modules', icon: '📦', label: 'Модули' },
  { path: '/project', icon: '🏗', label: 'Объект' },
];

export function NavBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

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
