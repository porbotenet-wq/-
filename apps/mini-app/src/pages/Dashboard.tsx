import { useEffect, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { supabase } from '../api/supabase';

export default function Dashboard() {
  const { user, project } = useAppStore();
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (!project) return;
    loadStats(project.id);
  }, [project]);

  async function loadStats(projectId: number) {
    const [tasks, facades, modules, users, logs] = await Promise.all([
      supabase.from('task_instances').select('status', { count: 'exact' }).eq('project_id', projectId),
      supabase.from('facades').select('id', { count: 'exact' }).eq('project_id', projectId),
      supabase.from('module_plan_items').select('status', { count: 'exact' }).eq('project_id', projectId),
      supabase.from('users').select('id', { count: 'exact' }).eq('status', 'ACTIVE'),
      supabase.from('daily_work_logs').select('id', { count: 'exact' }),
    ]);

    // Count by status
    const tasksByStatus: Record<string, number> = {};
    tasks.data?.forEach((t: any) => {
      tasksByStatus[t.status] = (tasksByStatus[t.status] || 0) + 1;
    });

    const modulesByStatus: Record<string, number> = {};
    modules.data?.forEach((m: any) => {
      modulesByStatus[m.status] = (modulesByStatus[m.status] || 0) + 1;
    });

    setStats({
      totalTasks: tasks.count || 0,
      tasksByStatus,
      totalFacades: facades.count || 0,
      totalModules: modules.count || 0,
      modulesByStatus,
      activeUsers: users.count || 0,
      dailyLogs: logs.count || 0,
    });
  }

  const role = user?.user_roles?.[0]?.roles;

  return (
    <div className="p-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-tg-text">📊 STSphera</h1>
        <p className="text-sm text-tg-hint">
          {user?.first_name} — {role?.display_name || 'Пользователь'}
        </p>
      </div>

      {/* Project card */}
      {project && (
        <div className="bg-tg-secondary rounded-xl p-4 mb-4 border border-gray-700/30">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">🏗 {project.name}</h2>
            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
              {project.status}
            </span>
          </div>
          <p className="text-xs text-tg-hint">{project.description}</p>
        </div>
      )}

      {/* Stats grid */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <StatCard icon="📋" label="Задачи" value={stats.totalTasks} sub={Object.entries(stats.tasksByStatus).map(([s, c]) => `${s}: ${c}`).join(' | ')} />
          <StatCard icon="🏢" label="Фасады" value={stats.totalFacades} />
          <StatCard icon="📦" label="Модули" value={stats.totalModules} sub={Object.entries(stats.modulesByStatus).map(([s, c]) => `${s}: ${c}`).join(' | ')} />
          <StatCard icon="👥" label="Пользователи" value={stats.activeUsers} />
        </div>
      )}

      {/* Quick actions */}
      <div className="bg-tg-secondary rounded-xl p-4 border border-gray-700/30">
        <h3 className="text-sm font-semibold mb-3 text-tg-hint">Быстрые действия</h3>
        <div className="grid grid-cols-2 gap-2">
          <ActionButton icon="📝" label="Ввести факт" href="/plan-fact" />
          <ActionButton icon="📋" label="Задачи" href="/tasks" />
          <ActionButton icon="📦" label="Модули" href="/modules" />
          <ActionButton icon="🏗" label="Объект" href="/project" />
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: string; label: string; value: number; sub?: string }) {
  return (
    <div className="bg-tg-secondary rounded-xl p-3 border border-gray-700/30">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{icon}</span>
        <span className="text-xs text-tg-hint">{label}</span>
      </div>
      <div className="text-2xl font-bold text-tg-text">{value}</div>
      {sub && <div className="text-[10px] text-tg-hint mt-1 truncate">{sub}</div>}
    </div>
  );
}

function ActionButton({ icon, label, href }: { icon: string; label: string; href: string }) {
  return (
    <a href={href}
      className="flex items-center gap-2 bg-tg-bg rounded-lg p-3 hover:bg-gray-700/30 transition-colors">
      <span>{icon}</span>
      <span className="text-sm text-tg-text">{label}</span>
    </a>
  );
}
