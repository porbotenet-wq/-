import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import { StatusBadge } from '../components/StatusBadge';

const STATUS_COLUMNS = ['CREATED', 'ASSIGNED', 'IN_PROGRESS', 'DONE', 'VERIFIED'];
const STATUS_LABELS: Record<string, string> = {
  CREATED: '⚪ Новые',
  ASSIGNED: '🔵 Назначены',
  IN_PROGRESS: '🟢 В работе',
  DONE: '✅ Выполнены',
  VERIFIED: '✔️ Приняты',
};

export default function Tasks() {
  const { tasks, loadTasks, project, facades, loadFacades, user, changeTaskStatus } = useAppStore();
  const [searchParams] = useSearchParams();
  const [view, setView] = useState<'kanban' | 'list'>('list');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterFacade, setFilterFacade] = useState<number | ''>('');
  const [myOnly, setMyOnly] = useState(searchParams.get('my') === 'true');
  const [showOverdue, setShowOverdue] = useState(searchParams.get('filter') === 'overdue');
  const [expandedTask, setExpandedTask] = useState<number | null>(null);

  useEffect(() => {
    if (!project) return;
    const filters: any = {};
    if (filterStatus) filters.status = filterStatus;
    if (filterFacade) filters.facadeId = filterFacade;
    if (myOnly && user) filters.assigneeId = user.id;
    loadTasks(project.id, filters);
    loadFacades(project.id);
  }, [project, filterStatus, filterFacade, myOnly]);

  const today = new Date().toISOString().split('T')[0];
  const displayTasks = showOverdue
    ? tasks.filter((t: any) => t.planned_end < today && ['CREATED', 'ASSIGNED', 'IN_PROGRESS'].includes(t.status))
    : tasks;

  async function handleChangeStatus(taskId: number, newStatus: string) {
    await changeTaskStatus(taskId, newStatus);
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-3 text-tg-text">📋 Задачи</h1>

      {/* Filter toggles */}
      <div className="flex gap-2 mb-3 flex-wrap">
        <button
          onClick={() => { setMyOnly(!myOnly); setShowOverdue(false); }}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
            myOnly
              ? 'bg-tg-button text-tg-buttonText border-tg-button'
              : 'bg-tg-secondary text-tg-hint border-gray-700/30'
          }`}
        >
          👤 Мои задачи
        </button>
        <button
          onClick={() => { setShowOverdue(!showOverdue); setMyOnly(false); }}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
            showOverdue
              ? 'bg-red-500 text-white border-red-500'
              : 'bg-tg-secondary text-tg-hint border-gray-700/30'
          }`}
        >
          🔴 Просроченные
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-tg-secondary text-tg-text text-xs px-3 py-1.5 rounded-lg border border-gray-700/30 min-w-0"
        >
          <option value="">Все статусы</option>
          {STATUS_COLUMNS.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>

        <select
          value={filterFacade}
          onChange={(e) => setFilterFacade(e.target.value ? Number(e.target.value) : '')}
          className="bg-tg-secondary text-tg-text text-xs px-3 py-1.5 rounded-lg border border-gray-700/30 min-w-0"
        >
          <option value="">Все фасады</option>
          {facades.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>

        <button
          onClick={() => setView(view === 'kanban' ? 'list' : 'kanban')}
          className="bg-tg-secondary text-tg-hint text-xs px-3 py-1.5 rounded-lg border border-gray-700/30 whitespace-nowrap"
        >
          {view === 'kanban' ? '📋 Список' : '📊 Канбан'}
        </button>
      </div>

      {/* Task count */}
      <p className="text-xs text-tg-hint mb-3">
        Найдено: {displayTasks.length} задач
        {myOnly && ' (мои)'}
        {showOverdue && ' (просроченные)'}
      </p>

      {/* List view */}
      {view === 'list' && (
        <div className="space-y-2">
          {displayTasks.map((task: any) => (
            <TaskCard
              key={task.id}
              task={task}
              expanded={expandedTask === task.id}
              onToggle={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
              onChangeStatus={handleChangeStatus}
              currentUserId={user?.id}
            />
          ))}
          {displayTasks.length === 0 && (
            <div className="text-center text-tg-hint py-8">
              <p className="text-3xl mb-2">📋</p>
              <p>Нет задач по выбранным фильтрам</p>
            </div>
          )}
        </div>
      )}

      {/* Kanban view */}
      {view === 'kanban' && (
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4">
          {STATUS_COLUMNS.map((status) => {
            const columnTasks = displayTasks.filter((t: any) => t.status === status);
            return (
              <div key={status} className="min-w-[180px] flex-shrink-0">
                <div className="text-xs font-semibold text-tg-hint mb-2 sticky top-0 bg-tg-bg py-1">
                  {STATUS_LABELS[status]} ({columnTasks.length})
                </div>
                <div className="space-y-2">
                  {columnTasks.map((task: any) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      compact
                      expanded={false}
                      onToggle={() => {}}
                      onChangeStatus={handleChangeStatus}
                      currentUserId={user?.id}
                    />
                  ))}
                  {columnTasks.length === 0 && (
                    <div className="text-center text-tg-hint/50 text-[10px] py-4">Пусто</div>
                  )}
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
  expanded,
  onToggle,
  onChangeStatus,
  currentUserId,
}: {
  task: any;
  compact?: boolean;
  expanded: boolean;
  onToggle: () => void;
  onChangeStatus: (id: number, status: string) => void;
  currentUserId?: number;
}) {
  const name = task.task_templates?.name || `Задача #${task.id}`;
  const code = task.task_templates?.code || '';
  const assignee = task.users
    ? `${task.users.first_name || ''} ${task.users.last_name || ''}`.trim()
    : '—';
  const facade = task.facades?.name || '—';
  const pct = Number(task.completion_pct || 0).toFixed(0);
  const isMyTask = task.assignee_id === currentUserId;
  const today = new Date().toISOString().split('T')[0];
  const isOverdue = task.planned_end && task.planned_end < today && !['DONE', 'VERIFIED', 'CANCELLED'].includes(task.status);
  const isDefect = task.type === 'DEFECT';

  const priorityColors: Record<string, string> = {
    HIGH: 'border-l-red-500',
    MEDIUM: 'border-l-yellow-500',
    LOW: 'border-l-green-500',
  };

  return (
    <div
      className={`bg-tg-secondary rounded-xl p-3 border border-gray-700/30 border-l-4 ${
        priorityColors[task.priority] || 'border-l-gray-500'
      } ${isOverdue ? 'ring-1 ring-red-500/30' : ''} ${isMyTask ? 'bg-tg-button/5' : ''}`}
      onClick={compact ? undefined : onToggle}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex-1 min-w-0">
          <span className={`font-medium ${compact ? 'text-xs' : 'text-sm'} text-tg-text leading-tight block`}>
            {isDefect && '🔴 '}{name}
          </span>
          {code && !compact && (
            <span className="text-[10px] text-tg-hint">{code}</span>
          )}
        </div>
        <StatusBadge status={task.status} />
      </div>

      {!compact && (
        <>
          <div className="flex gap-3 text-[10px] text-tg-hint mt-2 flex-wrap">
            <span className={isMyTask ? 'text-tg-button font-medium' : ''}>👤 {assignee}</span>
            <span>🏢 {facade}</span>
            {task.task_templates?.phase && <span>📋 {task.task_templates.phase}</span>}
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="text-[10px] text-tg-hint">
              📅 {task.planned_start || '—'} → {task.planned_end || '—'}
              {isOverdue && <span className="text-red-400 ml-1 font-medium">Просрочено!</span>}
            </div>
            <span className="text-xs font-semibold text-tg-button">{pct}%</span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-gray-700 rounded-full h-1 mt-1">
            <div
              className={`h-1 rounded-full transition-all ${isOverdue ? 'bg-red-500' : 'bg-tg-button'}`}
              style={{ width: `${Math.min(Number(pct), 100)}%` }}
            />
          </div>

          {/* Expanded details */}
          {expanded && (
            <div className="mt-3 pt-3 border-t border-gray-700/30 space-y-2">
              {task.notes && (
                <div className="text-xs text-tg-hint">
                  <span className="font-medium text-tg-text">Примечание:</span> {task.notes}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div>
                  <span className="text-tg-hint">Факт. начало:</span>
                  <span className="text-tg-text ml-1">{task.actual_start || '—'}</span>
                </div>
                <div>
                  <span className="text-tg-hint">Факт. конец:</span>
                  <span className="text-tg-text ml-1">{task.actual_end || '—'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Quick actions */}
          <div className="flex gap-2 mt-2">
            {task.status === 'ASSIGNED' && isMyTask && (
              <button
                onClick={(e) => { e.stopPropagation(); onChangeStatus(task.id, 'IN_PROGRESS'); }}
                className="text-xs bg-tg-button text-tg-buttonText px-3 py-1 rounded-lg active:opacity-80"
              >
                ▶ Начать
              </button>
            )}
            {task.status === 'IN_PROGRESS' && isMyTask && (
              <button
                onClick={(e) => { e.stopPropagation(); onChangeStatus(task.id, 'DONE'); }}
                className="text-xs bg-green-600 text-white px-3 py-1 rounded-lg active:opacity-80"
              >
                ✅ Завершить
              </button>
            )}
            {task.status === 'DONE' && (
              <button
                onClick={(e) => { e.stopPropagation(); onChangeStatus(task.id, 'VERIFIED'); }}
                className="text-xs bg-emerald-600 text-white px-3 py-1 rounded-lg active:opacity-80"
              >
                ✔️ Принять
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
