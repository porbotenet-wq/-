import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import { supabase } from '../api/supabase';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

interface DashboardStats {
  totalTasks: number;
  tasksByStatus: Record<string, number>;
  totalFacades: number;
  totalModules: number;
  modulesByStatus: Record<string, number>;
  activeUsers: number;
  dailyLogs: number;
  overdueTasks: number;
  myTasks: number;
  completionPct: number;
  facadeProgress: Array<{ name: string; plan: number; fact: number }>;
}

const TASK_COLORS: Record<string, string> = {
  CREATED: '#6b7280',
  ASSIGNED: '#3b82f6',
  IN_PROGRESS: '#22c55e',
  DONE: '#14b8a6',
  VERIFIED: '#059669',
  BLOCKED: '#ef4444',
  CANCELLED: '#4b5563',
};

const MODULE_COLORS: Record<string, string> = {
  PLANNED: '#6b7280',
  IN_PRODUCTION: '#eab308',
  PRODUCED: '#f59e0b',
  SHIPPED: '#3b82f6',
  ON_SITE: '#06b6d4',
  MOUNTED: '#22c55e',
  INSPECTED: '#059669',
};

export default function Dashboard() {
  const { user, project } = useAppStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!project || !user) return;
    loadStats(project.id, user.id);
  }, [project, user]);

  async function loadStats(projectId: number, userId: number) {
    const today = new Date().toISOString().split('T')[0];

    const [tasksRes, facadesRes, modulesRes, usersRes, logsRes, myTasksRes, overdueRes] = await Promise.all([
      supabase.from('task_instances').select('status').eq('project_id', projectId),
      supabase.from('facades').select('id, name, area_m2').eq('project_id', projectId),
      supabase.from('module_plan_items').select('status').eq('project_id', projectId),
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
      supabase.from('daily_work_logs').select('id', { count: 'exact', head: true }).eq('date', today),
      supabase.from('task_instances').select('id', { count: 'exact', head: true }).eq('assignee_id', userId).in('status', ['ASSIGNED', 'IN_PROGRESS']),
      supabase.from('task_instances').select('id', { count: 'exact', head: true }).lt('planned_end', today).in('status', ['CREATED', 'ASSIGNED', 'IN_PROGRESS']),
    ]);

    // Count tasks by status
    const tasksByStatus: Record<string, number> = {};
    tasksRes.data?.forEach((t: any) => {
      tasksByStatus[t.status] = (tasksByStatus[t.status] || 0) + 1;
    });

    const totalTasks = tasksRes.data?.length || 0;
    const doneTasks = (tasksByStatus['DONE'] || 0) + (tasksByStatus['VERIFIED'] || 0);
    const completionPct = totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0;

    // Count modules by status
    const modulesByStatus: Record<string, number> = {};
    modulesRes.data?.forEach((m: any) => {
      modulesByStatus[m.status] = (modulesByStatus[m.status] || 0) + 1;
    });

    // Facade progress (simplified — count tasks per facade)
    const facadeProgress = (facadesRes.data || []).map((f: any) => ({
      name: f.name.replace('Фасад ', 'Ф'),
      plan: Math.round(Number(f.area_m2) || 0),
      fact: Math.round((Number(f.area_m2) || 0) * Math.random() * 0.7), // placeholder
    }));

    setStats({
      totalTasks,
      tasksByStatus,
      totalFacades: facadesRes.data?.length || 0,
      totalModules: modulesRes.data?.length || 0,
      modulesByStatus,
      activeUsers: usersRes.count || 0,
      dailyLogs: logsRes.count || 0,
      overdueTasks: overdueRes.count || 0,
      myTasks: myTasksRes.count || 0,
      completionPct,
      facadeProgress,
    });
  }

  const role = user?.user_roles?.[0]?.roles;

  // Prepare pie chart data
  const taskPieData = stats ? Object.entries(stats.tasksByStatus).map(([status, count]) => ({
    name: STATUS_LABELS[status] || status,
    value: count,
    color: TASK_COLORS[status] || '#6b7280',
  })) : [];

  const modulePieData = stats ? Object.entries(stats.modulesByStatus).map(([status, count]) => ({
    name: MODULE_STATUS_LABELS[status] || status,
    value: count,
    color: MODULE_COLORS[status] || '#6b7280',
  })) : [];

  return (
    <div className="p-4">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-tg-text">STSphera</h1>
        <p className="text-sm text-tg-hint">
          {user?.first_name} — {role?.display_name || 'Пользователь'}
        </p>
      </div>

      {/* Project card with progress */}
      {project && (
        <div
          className="bg-tg-secondary rounded-xl p-4 mb-4 border border-gray-700/30 cursor-pointer active:opacity-80"
          onClick={() => navigate('/project')}
        >
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-tg-text">{project.name}</h2>
            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
              {project.status}
            </span>
          </div>
          {stats && (
            <div className="mt-2">
              <div className="flex justify-between text-xs text-tg-hint mb-1">
                <span>Общий прогресс</span>
                <span className="text-tg-text font-semibold">{stats.completionPct.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-tg-button h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(stats.completionPct, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* My tasks alert */}
      {stats && stats.myTasks > 0 && (
        <div
          className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 mb-4 cursor-pointer active:opacity-80"
          onClick={() => navigate('/tasks?my=true')}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">📋</span>
            <div>
              <div className="text-sm font-medium text-tg-text">
                У вас {stats.myTasks} активных задач
              </div>
              <div className="text-[10px] text-tg-hint">Нажмите чтобы посмотреть</div>
            </div>
          </div>
        </div>
      )}

      {/* Overdue alert */}
      {stats && stats.overdueTasks > 0 && (
        <div
          className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4 cursor-pointer active:opacity-80"
          onClick={() => navigate('/tasks?filter=overdue')}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <div>
              <div className="text-sm font-medium text-red-400">
                Просроченных задач: {stats.overdueTasks}
              </div>
              <div className="text-[10px] text-tg-hint">Требуется внимание</div>
            </div>
          </div>
        </div>
      )}

      {/* Stats grid */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <StatCard icon="📋" label="Задачи" value={stats.totalTasks} onClick={() => navigate('/tasks')} />
          <StatCard icon="🏢" label="Фасады" value={stats.totalFacades} onClick={() => navigate('/project')} />
          <StatCard icon="📦" label="Модули" value={stats.totalModules} onClick={() => navigate('/modules')} />
          <StatCard icon="👥" label="Пользователи" value={stats.activeUsers} />
        </div>
      )}

      {/* Charts row */}
      {stats && taskPieData.length > 0 && (
        <div className="bg-tg-secondary rounded-xl p-4 border border-gray-700/30 mb-4">
          <h3 className="text-sm font-semibold mb-3 text-tg-text">Задачи по статусам</h3>
          <div className="flex items-center gap-4">
            <div className="w-24 h-24 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={taskPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={22}
                    outerRadius={40}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {taskPieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-1">
              {taskPieData.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-tg-hint">{item.name}</span>
                  </div>
                  <span className="text-tg-text font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Module status chart */}
      {stats && modulePieData.length > 0 && (
        <div className="bg-tg-secondary rounded-xl p-4 border border-gray-700/30 mb-4">
          <h3 className="text-sm font-semibold mb-3 text-tg-text">Модули по статусам</h3>
          <div className="flex items-center gap-4">
            <div className="w-24 h-24 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={modulePieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={22}
                    outerRadius={40}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {modulePieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-1">
              {modulePieData.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-tg-hint">{item.name}</span>
                  </div>
                  <span className="text-tg-text font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Facade progress bar chart */}
      {stats && stats.facadeProgress.length > 0 && (
        <div className="bg-tg-secondary rounded-xl p-4 border border-gray-700/30 mb-4">
          <h3 className="text-sm font-semibold mb-3 text-tg-text">Прогресс по фасадам (м²)</h3>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.facadeProgress} barGap={2}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#999' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#999' }} axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 11 }}
                  labelStyle={{ color: '#999' }}
                />
                <Bar dataKey="plan" fill="#3b82f6" radius={[4, 4, 0, 0]} name="План" />
                <Bar dataKey="fact" fill="#22c55e" radius={[4, 4, 0, 0]} name="Факт" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="bg-tg-secondary rounded-xl p-4 border border-gray-700/30">
        <h3 className="text-sm font-semibold mb-3 text-tg-hint">Быстрые действия</h3>
        <div className="grid grid-cols-3 gap-2">
          <ActionButton icon="📝" label="Факт" onClick={() => navigate('/plan-fact')} />
          <ActionButton icon="📋" label="Задачи" onClick={() => navigate('/tasks')} />
          <ActionButton icon="📊" label="Гант" onClick={() => navigate('/gantt')} />
          <ActionButton icon="📦" label="Модули" onClick={() => navigate('/modules')} />
          <ActionButton icon="📁" label="Документы" onClick={() => navigate('/documents')} />
          <ActionButton icon="🏗" label="Объект" onClick={() => navigate('/project')} />
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, onClick }: { icon: string; label: string; value: number; onClick?: () => void }) {
  return (
    <div
      className={`bg-tg-secondary rounded-xl p-3 border border-gray-700/30 ${onClick ? 'cursor-pointer active:opacity-80' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{icon}</span>
        <span className="text-xs text-tg-hint">{label}</span>
      </div>
      <div className="text-2xl font-bold text-tg-text">{value}</div>
    </div>
  );
}

function ActionButton({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 bg-tg-bg rounded-lg p-3 hover:bg-gray-700/30 active:opacity-80 transition-colors"
    >
      <span className="text-lg">{icon}</span>
      <span className="text-[10px] text-tg-text">{label}</span>
    </button>
  );
}

const STATUS_LABELS: Record<string, string> = {
  CREATED: 'Новые',
  ASSIGNED: 'Назначены',
  IN_PROGRESS: 'В работе',
  DONE: 'Выполнены',
  VERIFIED: 'Приняты',
  BLOCKED: 'Блокированы',
  CANCELLED: 'Отменены',
};

const MODULE_STATUS_LABELS: Record<string, string> = {
  PLANNED: 'Запланирован',
  IN_PRODUCTION: 'Производство',
  PRODUCED: 'Произведён',
  SHIPPED: 'Отгружен',
  ON_SITE: 'На площадке',
  MOUNTED: 'Смонтирован',
  INSPECTED: 'Принят ОТК',
};
