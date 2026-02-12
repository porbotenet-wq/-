import { useEffect, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { StatusBadge } from '../components/StatusBadge';
import { supabase } from '../api/supabase';

const STATUS_COLUMNS = ['CREATED', 'ASSIGNED', 'IN_PROGRESS', 'DONE', 'VERIFIED'];
const STATUS_LABELS: Record<string, string> = {
  CREATED: '⚪ Новые',
  ASSIGNED: '🔵 Назначены',
  IN_PROGRESS: '🟢 В работе',
  DONE: '✅ Выполнены',
  VERIFIED: '✔️ Приняты',
};

export default function Tasks() {
  const { tasks, loadTasks, project, facades, loadFacades } = useAppStore();
  const [view, setView] = useState<'kanban' | 'list'>('list');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterFacade, setFilterFacade] = useState<number | ''>('');

  useEffect(() => {
    if (!project) return;
    loadTasks(project.id, {
      status: filterStatus || undefined,
      facadeId: filterFacade || undefined,
    });
    loadFacades(project.id);
  }, [project, filterStatus, filterFacade]);

  async function changeStatus(taskId: number, newStatus: string) {
    await supabase.from('task_instances').update({ status: newStatus }).eq('id', taskId);
    if (project) loadTasks(project.id);
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">📋 Задачи</h1>

      {/* Filters */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-tg-secondary text-tg-text text-xs px-3 py-1.5 rounded-lg border border-gray-700/30"
        >
          <option value="">Все статусы</option>
          {STATUS_COLUMNS.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>

        <select
          value={filterFacade}
          onChange={(e) => setFilterFacade(e.target.value ? Number(e.target.value) : '')}
          className="bg-tg-secondary text-tg-text text-xs px-3 py-1.5 rounded-lg border border-gray-700/30"
        >
          <option value="">Все фасады</option>
          {facades.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>

        <button
          onClick={() => setView(view === 'kanban' ? 'list' : 'kanban')}
          className="bg-tg-secondary text-tg-hint text-xs px-3 py-1.5 rounded-lg border border-gray-700/30"
        >
          {view === 'kanban' ? '📋 Список' : '📊 Канбан'}
        </button>
      </div>

      {/* Task count */}
      <p className="text-xs text-tg-hint mb-3">
        Найдено: {tasks.length} задач
      </p>

      {/* List view */}
      {view === 'list' && (
        <div className="space-y-2">
          {tasks.map((task: any) => (
            <TaskCard key={task.id} task={task} onChangeStatus={changeStatus} />
          ))}
          {tasks.length === 0 && (
            <div className="text-center text-tg-hint py-8">
              Нет задач по выбранным фильтрам
            </div>
          )}
        </div>
      )}

      {/* Kanban view */}
      {view === 'kanban' && (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {STATUS_COLUMNS.map((status) => {
            const columnTasks = tasks.filter((t: any) => t.status === status);
            return (
              <div key={status} className="min-w-[200px] flex-shrink-0">
                <div className="text-xs font-semibold text-tg-hint mb-2">
                  {STATUS_LABELS[status]} ({columnTasks.length})
                </div>
                <div className="space-y-2">
                  {columnTasks.map((task: any) => (
                    <TaskCard key={task.id} task={task} compact onChangeStatus={changeStatus} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TaskCard({
  task,
  compact,
  onChangeStatus,
}: {
  task: any;
  compact?: boolean;
  onChangeStatus: (id: number, status: string) => void;
}) {
  const name = task.task_templates?.name || `Задача #${task.id}`;
  const assignee = task.users
    ? `${task.users.first_name || ''} ${task.users.last_name || ''}`.trim()
    : '—';
  const facade = task.facades?.name || '—';
  const pct = Number(task.completion_pct || 0).toFixed(0);

  return (
    <div className="bg-tg-secondary rounded-xl p-3 border border-gray-700/30">
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className={`font-medium ${compact ? 'text-xs' : 'text-sm'} text-tg-text leading-tight`}>
          {name}
        </span>
        <StatusBadge status={task.status} />
      </div>

      {!compact && (
        <>
          <div className="flex gap-3 text-[10px] text-tg-hint mt-2">
            <span>👤 {assignee}</span>
            <span>🏢 {facade}</span>
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="flex gap-2 text-[10px] text-tg-hint">
              <span>📅 {task.planned_start || '—'} → {task.planned_end || '—'}</span>
            </div>
            <span className="text-xs font-semibold text-tg-button">{pct}%</span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-gray-700 rounded-full h-1 mt-1">
            <div
              className="bg-tg-button h-1 rounded-full transition-all"
              style={{ width: `${Math.min(Number(pct), 100)}%` }}
            />
          </div>
          {/* Quick actions */}
          {task.status === 'ASSIGNED' && (
            <button
              onClick={() => onChangeStatus(task.id, 'IN_PROGRESS')}
              className="mt-2 text-xs bg-tg-button text-tg-buttonText px-3 py-1 rounded-lg"
            >
              ▶ Начать
            </button>
          )}
          {task.status === 'IN_PROGRESS' && (
            <button
              onClick={() => onChangeStatus(task.id, 'DONE')}
              className="mt-2 text-xs bg-green-600 text-white px-3 py-1 rounded-lg"
            >
              ✅ Завершить
            </button>
          )}
        </>
      )}
    </div>
  );
}
