import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import { supabase } from '../api/supabase';
import { parseIsoDateParam, parsePositiveIntParam } from '../utils/launchContext';

export default function PlanFact() {
  const { project, facades, loadFacades } = useAppStore();
  const [searchParams] = useSearchParams();
  const linkedTaskId = parsePositiveIntParam(searchParams.get('task_id'));
  const linkedDate = parseIsoDateParam(searchParams.get('date'));

  const [date, setDate] = useState(linkedDate || new Date().toISOString().split('T')[0]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (linkedDate) setDate(linkedDate);
  }, [linkedDate]);

  useEffect(() => {
    if (!project) return;
    loadFacades(project.id);
    loadLogs();
  }, [project, date, linkedTaskId]);

  async function loadLogs() {
    if (!project) return;
    setLoading(true);
    let query = supabase
      .from('daily_work_logs')
      .select('*, task_instances(task_templates(name, code)), facades(name)')
      .eq('date', date)
      .order('id');

    if (linkedTaskId) {
      query = query.eq('task_instance_id', linkedTaskId);
    }

    const { data } = await query;
    setLogs(data || []);
    setLoading(false);
  }

  async function updateFact(logId: number, factDay: number) {
    await supabase
      .from('daily_work_logs')
      .update({
        fact_day: factDay,
        deviation: undefined, // will be recalculated
      })
      .eq('id', logId);
    loadLogs();
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">📝 План-Факт</h1>

      {linkedTaskId && (
        <div className="mb-3 rounded-lg bg-tg-secondary border border-gray-700/30 p-3 text-xs text-tg-text">
          Контекст: ввод факта по задаче #{linkedTaskId}
        </div>
      )}

      {/* Date picker */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => {
            const d = new Date(date);
            d.setDate(d.getDate() - 1);
            setDate(d.toISOString().split('T')[0]);
          }}
          className="bg-tg-secondary px-3 py-1.5 rounded-lg text-tg-text"
        >
          ◀
        </button>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="bg-tg-secondary text-tg-text text-sm px-3 py-1.5 rounded-lg border border-gray-700/30 flex-1"
        />
        <button
          onClick={() => {
            const d = new Date(date);
            d.setDate(d.getDate() + 1);
            setDate(d.toISOString().split('T')[0]);
          }}
          className="bg-tg-secondary px-3 py-1.5 rounded-lg text-tg-text"
        >
          ▶
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center text-tg-hint py-8">Загрузка...</div>
      ) : logs.length > 0 ? (
        <div className="space-y-2">
          {logs.map((log: any) => (
            <div key={log.id} className="bg-tg-secondary rounded-xl p-3 border border-gray-700/30">
              <div className="text-sm font-medium text-tg-text mb-2">
                {log.task_instances?.task_templates?.name || log.work_name || 'Работа'}
              </div>
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div>
                  <div className="text-tg-hint">План</div>
                  <div className="text-tg-text font-semibold">{Number(log.plan_day || 0).toFixed(1)}</div>
                </div>
                <div>
                  <div className="text-tg-hint">Факт</div>
                  <input
                    type="number"
                    value={Number(log.fact_day || 0)}
                    onChange={(e) => updateFact(log.id, Number(e.target.value))}
                    className="w-full bg-tg-bg text-tg-text text-sm px-2 py-1 rounded border border-gray-700/50 font-semibold"
                  />
                </div>
                <div>
                  <div className="text-tg-hint">Откл.</div>
                  <div className={`font-semibold ${Number(log.deviation) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {log.deviation !== null ? Number(log.deviation).toFixed(1) : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-tg-hint">%</div>
                  <div className="font-semibold text-tg-text">
                    {log.pct_day !== null ? Number(log.pct_day).toFixed(0) + '%' : '—'}
                  </div>
                </div>
              </div>
              {log.facades?.name && (
                <div className="text-[10px] text-tg-hint mt-1">🏢 {log.facades.name}</div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-tg-hint py-8">
          <p className="mb-2">Нет записей за {date}</p>
          <p className="text-xs">Записи создаются автоматически для активных задач</p>
        </div>
      )}
    </div>
  );
}
