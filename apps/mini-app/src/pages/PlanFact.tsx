import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '../stores/appStore';
import { supabase } from '../api/supabase';

export default function PlanFact() {
  const { project, facades, loadFacades, user } = useAppStore();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<number | null>(null);
  const [filterFacade, setFilterFacade] = useState<number | ''>('');
  const [totals, setTotals] = useState({ plan: 0, fact: 0, deviation: 0 });

  useEffect(() => {
    if (!project) return;
    loadFacades(project.id);
    loadLogs();
  }, [project, date, filterFacade]);

  async function loadLogs() {
    if (!project) return;
    setLoading(true);
    
    let query = supabase
      .from('daily_work_logs')
      .select('*, task_instances(id, task_templates(name, code, unit)), facades(name)')
      .eq('date', date)
      .order('id');

    if (filterFacade) {
      query = query.eq('facade_id', filterFacade);
    }

    const { data } = await query;
    const logData = data || [];
    setLogs(logData);

    // Calculate totals
    const plan = logData.reduce((s: number, l: any) => s + Number(l.plan_day || 0), 0);
    const fact = logData.reduce((s: number, l: any) => s + Number(l.fact_day || 0), 0);
    setTotals({ plan, fact, deviation: fact - plan });

    setLoading(false);
  }

  const updateFact = useCallback(async (logId: number, factDay: number) => {
    setSaving(logId);
    
    const log = logs.find((l) => l.id === logId);
    const planDay = Number(log?.plan_day || 0);
    const deviation = factDay - planDay;
    const pctDay = planDay > 0 ? (factDay / planDay) * 100 : null;

    await supabase
      .from('daily_work_logs')
      .update({
        fact_day: factDay,
        deviation,
        pct_day: pctDay,
        updated_at: new Date().toISOString(),
      })
      .eq('id', logId);

    // Recalculate task accumulation
    if (log?.task_instances?.id) {
      const { data: allLogs } = await supabase
        .from('daily_work_logs')
        .select('fact_day, plan_day')
        .eq('task_instance_id', log.task_instances.id)
        .lte('date', date);

      if (allLogs) {
        const accFact = allLogs.reduce((s: number, l: any) => s + Number(l.fact_day || 0), 0);
        const accPlan = allLogs.reduce((s: number, l: any) => s + Number(l.plan_day || 0), 0);

        await supabase
          .from('task_instances')
          .update({
            actual_volume: accFact,
            completion_pct: accPlan > 0 ? Math.min((accFact / accPlan) * 100, 100) : 0,
          })
          .eq('id', log.task_instances.id);

        // Update accumulation fields on the log
        await supabase
          .from('daily_work_logs')
          .update({ acc_plan: accPlan, acc_fact: accFact })
          .eq('id', logId);
      }
    }

    // AuditLog
    if (user) {
      await supabase.from('audit_logs').insert({
        action: 'PLAN_FACT_UPDATED',
        entity_type: 'DailyWorkLog',
        entity_id: logId,
        user_id: user.id,
        new_value: { fact_day: factDay, date },
      });
    }

    setSaving(null);
    loadLogs();
  }, [logs, date, user]);

  async function sendForReview() {
    if (!user) return;
    
    const logIds = logs.map((l) => l.id);
    await supabase
      .from('daily_work_logs')
      .update({ status: 'REVIEW' })
      .in('id', logIds);

    await supabase.from('audit_logs').insert({
      action: 'PLAN_FACT_SENT_FOR_REVIEW',
      entity_type: 'DailyWorkLog',
      user_id: user.id,
      new_value: { date, count: logIds.length },
    });

    loadLogs();
  }

  const draftLogs = logs.filter((l) => l.status === 'DRAFT');
  const hasData = logs.length > 0;

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-3 text-tg-text">📝 План-Факт</h1>

      {/* Date picker */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => {
            const d = new Date(date);
            d.setDate(d.getDate() - 1);
            setDate(d.toISOString().split('T')[0]);
          }}
          className="bg-tg-secondary px-3 py-1.5 rounded-lg text-tg-text active:opacity-80"
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
          className="bg-tg-secondary px-3 py-1.5 rounded-lg text-tg-text active:opacity-80"
        >
          ▶
        </button>
        <button
          onClick={() => setDate(new Date().toISOString().split('T')[0])}
          className="bg-tg-button/20 text-tg-button text-xs px-2 py-1.5 rounded-lg"
        >
          Сегодня
        </button>
      </div>

      {/* Facade filter */}
      <div className="flex gap-2 mb-3">
        <select
          value={filterFacade}
          onChange={(e) => setFilterFacade(e.target.value ? Number(e.target.value) : '')}
          className="bg-tg-secondary text-tg-text text-xs px-3 py-1.5 rounded-lg border border-gray-700/30 flex-1"
        >
          <option value="">Все фасады</option>
          {facades.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
      </div>

      {/* Totals */}
      {hasData && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-tg-secondary rounded-xl p-2 border border-gray-700/30 text-center">
            <div className="text-[10px] text-tg-hint">План</div>
            <div className="text-sm font-bold text-tg-text">{totals.plan.toFixed(1)}</div>
          </div>
          <div className="bg-tg-secondary rounded-xl p-2 border border-gray-700/30 text-center">
            <div className="text-[10px] text-tg-hint">Факт</div>
            <div className="text-sm font-bold text-tg-text">{totals.fact.toFixed(1)}</div>
          </div>
          <div className={`bg-tg-secondary rounded-xl p-2 border text-center ${
            totals.deviation >= 0 ? 'border-green-500/30' : 'border-red-500/30'
          }`}>
            <div className="text-[10px] text-tg-hint">Откл.</div>
            <div className={`text-sm font-bold ${
              totals.deviation >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {totals.deviation >= 0 ? '+' : ''}{totals.deviation.toFixed(1)}
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="text-center text-tg-hint py-8">
          <div className="text-3xl mb-2 animate-pulse">📊</div>
          <p>Загрузка...</p>
        </div>
      ) : hasData ? (
        <>
          <div className="space-y-2">
            {logs.map((log: any) => (
              <PlanFactRow
                key={log.id}
                log={log}
                saving={saving === log.id}
                onUpdateFact={updateFact}
              />
            ))}
          </div>

          {/* Send for review button */}
          {draftLogs.length > 0 && (
            <button
              onClick={sendForReview}
              className="mt-4 w-full bg-tg-button text-tg-buttonText py-2.5 rounded-xl font-medium active:opacity-80"
            >
              📤 Отправить на проверку ({draftLogs.length})
            </button>
          )}
        </>
      ) : (
        <div className="text-center text-tg-hint py-8">
          <p className="text-3xl mb-2">📝</p>
          <p className="mb-2">Нет записей за {date}</p>
          <p className="text-xs">Записи создаются автоматически для активных задач</p>
        </div>
      )}
    </div>
  );
}

function PlanFactRow({
  log,
  saving,
  onUpdateFact,
}: {
  log: any;
  saving: boolean;
  onUpdateFact: (logId: number, factDay: number) => void;
}) {
  const [localFact, setLocalFact] = useState(Number(log.fact_day || 0));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setLocalFact(Number(log.fact_day || 0));
  }, [log.fact_day]);

  function handleBlur() {
    setEditing(false);
    if (localFact !== Number(log.fact_day || 0)) {
      onUpdateFact(log.id, localFact);
    }
  }

  const deviation = Number(log.deviation || 0);
  const pctDay = log.pct_day !== null ? Number(log.pct_day).toFixed(0) + '%' : '—';
  const isReview = log.status === 'REVIEW';

  return (
    <div className={`bg-tg-secondary rounded-xl p-3 border border-gray-700/30 ${saving ? 'opacity-60' : ''} ${isReview ? 'border-l-4 border-l-yellow-500' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium text-tg-text flex-1 min-w-0 truncate">
          {log.task_instances?.task_templates?.name || log.work_name || 'Работа'}
        </div>
        {isReview && (
          <span className="text-[9px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full ml-1">
            На проверке
          </span>
        )}
      </div>
      <div className="grid grid-cols-4 gap-2 text-xs">
        <div>
          <div className="text-tg-hint text-[10px]">План</div>
          <div className="text-tg-text font-semibold">{Number(log.plan_day || 0).toFixed(1)}</div>
        </div>
        <div>
          <div className="text-tg-hint text-[10px]">Факт</div>
          <input
            type="number"
            inputMode="decimal"
            value={editing ? localFact : Number(log.fact_day || 0)}
            onFocus={() => setEditing(true)}
            onChange={(e) => setLocalFact(Number(e.target.value))}
            onBlur={handleBlur}
            disabled={saving}
            className="w-full bg-tg-bg text-tg-text text-sm px-2 py-0.5 rounded border border-gray-700/50 font-semibold focus:border-tg-button focus:ring-1 focus:ring-tg-button/30"
          />
        </div>
        <div>
          <div className="text-tg-hint text-[10px]">Откл.</div>
          <div className={`font-semibold ${deviation >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {log.deviation !== null ? (deviation >= 0 ? '+' : '') + deviation.toFixed(1) : '—'}
          </div>
        </div>
        <div>
          <div className="text-tg-hint text-[10px]">% дня</div>
          <div className="font-semibold text-tg-text">{pctDay}</div>
        </div>
      </div>
      {/* Accumulation row */}
      {(log.acc_plan || log.acc_fact) && (
        <div className="flex gap-4 text-[10px] text-tg-hint mt-2 pt-2 border-t border-gray-700/20">
          <span>Накопл. план: {Number(log.acc_plan || 0).toFixed(1)}</span>
          <span>Накопл. факт: {Number(log.acc_fact || 0).toFixed(1)}</span>
        </div>
      )}
      {log.facades?.name && (
        <div className="text-[10px] text-tg-hint mt-1">🏢 {log.facades.name}</div>
      )}
    </div>
  );
}
