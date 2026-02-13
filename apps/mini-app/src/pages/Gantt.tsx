import { useEffect, useState, useRef } from 'react';
import { useAppStore } from '../stores/appStore';
import { StatusBadge } from '../components/StatusBadge';
import { supabase } from '../api/supabase';
import { format, differenceInDays, addDays, startOfWeek, endOfWeek, eachWeekOfInterval, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';

const PHASE_COLORS: Record<string, string> = {
  'Подготовка': '#8b5cf6',
  'Каркас': '#3b82f6',
  'Фасад': '#22c55e',
  'Кровля': '#f59e0b',
  'Инженерия': '#06b6d4',
  'Контроль': '#ef4444',
};

const STATUS_COLORS: Record<string, string> = {
  CREATED: '#6b7280',
  ASSIGNED: '#3b82f6',
  IN_PROGRESS: '#22c55e',
  DONE: '#14b8a6',
  VERIFIED: '#059669',
  BLOCKED: '#ef4444',
};

export default function Gantt() {
  const { project, facades, loadFacades } = useAppStore();
  const [tasks, setTasks] = useState<any[]>([]);
  const [filterFacade, setFilterFacade] = useState<number | ''>('');
  const [filterPhase, setFilterPhase] = useState<string>('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!project) return;
    loadFacades(project.id);
    loadGanttTasks();
  }, [project, filterFacade, filterPhase]);

  async function loadGanttTasks() {
    if (!project) return;

    let query = supabase
      .from('task_instances')
      .select('*, task_templates(name, code, phase, sort_order, is_section_header, section_name), facades(name), users!task_instances_assignee_id_fkey(first_name, last_name)')
      .eq('project_id', project.id)
      .order('task_templates(sort_order)', { ascending: true });

    if (filterFacade) query = query.eq('facade_id', filterFacade);

    const { data } = await query.limit(200);

    let filtered = data || [];
    if (filterPhase) {
      filtered = filtered.filter((t: any) => t.task_templates?.phase === filterPhase);
    }

    setTasks(filtered);
  }

  // Calculate date range
  const allDates = tasks
    .filter((t) => t.planned_start && t.planned_end)
    .flatMap((t) => [t.planned_start, t.planned_end]);

  if (allDates.length === 0) {
    return (
      <div className="p-4">
        <h1 className="text-xl font-bold mb-4 text-tg-text">📊 Диаграмма Ганта</h1>
        <div className="text-center text-tg-hint py-12">
          <p className="text-3xl mb-2">📊</p>
          <p>Нет задач с датами для отображения</p>
          <p className="text-xs mt-1">Настройте демо-объект через бота</p>
        </div>
      </div>
    );
  }

  const minDate = new Date(allDates.sort()[0]);
  const maxDate = new Date(allDates.sort().reverse()[0]);
  const totalDays = differenceInDays(maxDate, minDate) + 1;
  const weeks = eachWeekOfInterval({ start: minDate, end: maxDate }, { weekStartsOn: 1 });

  const DAY_WIDTH = 8; // pixels per day
  const ROW_HEIGHT = 32;
  const LABEL_WIDTH = 180;
  const today = new Date().toISOString().split('T')[0];

  // Group by section
  const sections: Array<{ name: string; tasks: any[] }> = [];
  let currentSection = { name: 'Другие', tasks: [] as any[] };

  const sorted = [...tasks].sort((a, b) => {
    const sa = a.task_templates?.sort_order || 0;
    const sb = b.task_templates?.sort_order || 0;
    return sa - sb;
  });

  for (const task of sorted) {
    if (task.task_templates?.is_section_header) {
      if (currentSection.tasks.length > 0) sections.push(currentSection);
      currentSection = { name: task.task_templates.section_name || task.task_templates.name, tasks: [] };
    } else {
      currentSection.tasks.push(task);
    }
  }
  if (currentSection.tasks.length > 0) sections.push(currentSection);

  const phases = [...new Set(tasks.map((t) => t.task_templates?.phase).filter(Boolean))];

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-3 text-tg-text">📊 Диаграмма Ганта</h1>

      {/* Filters */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
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

        <select
          value={filterPhase}
          onChange={(e) => setFilterPhase(e.target.value)}
          className="bg-tg-secondary text-tg-text text-xs px-3 py-1.5 rounded-lg border border-gray-700/30"
        >
          <option value="">Все фазы</option>
          {phases.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {/* Legend */}
      <div className="flex gap-3 mb-3 flex-wrap">
        {phases.map((phase) => (
          <div key={phase} className="flex items-center gap-1 text-[10px] text-tg-hint">
            <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: PHASE_COLORS[phase] || '#6b7280' }} />
            {phase}
          </div>
        ))}
      </div>

      {/* Gantt chart */}
      <div className="bg-tg-secondary rounded-xl border border-gray-700/30 overflow-hidden">
        <div className="overflow-x-auto" ref={scrollRef}>
          <div style={{ minWidth: LABEL_WIDTH + totalDays * DAY_WIDTH + 20 }}>
            {/* Week headers */}
            <div className="flex border-b border-gray-700/30 sticky top-0 bg-tg-secondary z-10">
              <div className="flex-shrink-0 text-[10px] text-tg-hint p-2 font-medium" style={{ width: LABEL_WIDTH }}>
                Задача
              </div>
              <div className="flex-1 flex relative">
                {weeks.map((weekStart, i) => {
                  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
                  const offset = Math.max(0, differenceInDays(weekStart, minDate));
                  const width = Math.min(7, differenceInDays(weekEnd, weekStart) + 1) * DAY_WIDTH;
                  return (
                    <div
                      key={i}
                      className="text-[9px] text-tg-hint text-center border-r border-gray-700/20 flex-shrink-0 py-1"
                      style={{ width, minWidth: width }}
                    >
                      {format(weekStart, 'dd.MM', { locale: ru })}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Rows by section */}
            {sections.map((section, si) => (
              <div key={si}>
                {/* Section header */}
                <div className="flex items-center border-b border-gray-700/20 bg-tg-bg/50">
                  <div className="text-[10px] font-semibold text-tg-text px-2 py-1" style={{ width: LABEL_WIDTH }}>
                    {section.name}
                  </div>
                </div>

                {/* Task rows */}
                {section.tasks.map((task: any) => {
                  const name = task.task_templates?.name || `#${task.id}`;
                  const phase = task.task_templates?.phase || '';
                  const barColor = PHASE_COLORS[phase] || STATUS_COLORS[task.status] || '#6b7280';

                  let barLeft = 0;
                  let barWidth = 30;
                  let hasBar = false;

                  if (task.planned_start && task.planned_end) {
                    barLeft = differenceInDays(parseISO(task.planned_start), minDate) * DAY_WIDTH;
                    barWidth = Math.max(1, differenceInDays(parseISO(task.planned_end), parseISO(task.planned_start)) + 1) * DAY_WIDTH;
                    hasBar = true;
                  }

                  const pct = Number(task.completion_pct || 0);
                  const isOverdue = task.planned_end && task.planned_end < today && !['DONE', 'VERIFIED', 'CANCELLED'].includes(task.status);

                  return (
                    <div
                      key={task.id}
                      className="flex items-center border-b border-gray-700/10 hover:bg-gray-700/10"
                      style={{ height: ROW_HEIGHT }}
                    >
                      {/* Label */}
                      <div
                        className="flex-shrink-0 px-2 truncate text-[10px] text-tg-text"
                        style={{ width: LABEL_WIDTH }}
                        title={name}
                      >
                        {name}
                      </div>

                      {/* Bar area */}
                      <div className="flex-1 relative" style={{ height: ROW_HEIGHT }}>
                        {/* Today line */}
                        {(() => {
                          const todayOffset = differenceInDays(new Date(), minDate) * DAY_WIDTH;
                          if (todayOffset >= 0 && todayOffset <= totalDays * DAY_WIDTH) {
                            return (
                              <div
                                className="absolute top-0 bottom-0 w-px bg-red-500/40 z-10"
                                style={{ left: todayOffset }}
                              />
                            );
                          }
                          return null;
                        })()}

                        {hasBar && (
                          <div
                            className={`absolute top-1.5 rounded-sm ${isOverdue ? 'ring-1 ring-red-500' : ''}`}
                            style={{
                              left: barLeft,
                              width: barWidth,
                              height: ROW_HEIGHT - 12,
                              backgroundColor: barColor + '33',
                              borderLeft: `3px solid ${barColor}`,
                            }}
                          >
                            {/* Progress fill */}
                            <div
                              className="absolute top-0 left-0 bottom-0 rounded-sm opacity-60"
                              style={{
                                width: `${Math.min(pct, 100)}%`,
                                backgroundColor: barColor,
                              }}
                            />
                            {/* Label on bar */}
                            {barWidth > 40 && (
                              <span className="absolute text-[8px] text-white font-medium px-1 top-0.5 left-1 truncate"
                                style={{ maxWidth: barWidth - 10 }}>
                                {pct > 0 ? `${pct.toFixed(0)}%` : ''}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="mt-3 text-xs text-tg-hint">
        Задач: {tasks.filter((t) => !t.task_templates?.is_section_header).length} | 
        Период: {format(minDate, 'dd.MM.yyyy')} — {format(maxDate, 'dd.MM.yyyy')} | 
        Дней: {totalDays}
      </div>
    </div>
  );
}
