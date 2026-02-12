import { useEffect, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { StatusBadge } from '../components/StatusBadge';

const MODULE_STATUSES = ['PLANNED', 'IN_PRODUCTION', 'PRODUCED', 'SHIPPED', 'ON_SITE', 'MOUNTED', 'INSPECTED'];
const STATUS_LABELS: Record<string, string> = {
  PLANNED: 'Запланирован',
  IN_PRODUCTION: 'Производство',
  PRODUCED: 'Произведён',
  SHIPPED: 'Отгружен',
  ON_SITE: 'На площадке',
  MOUNTED: 'Смонтирован',
  INSPECTED: 'Принят ОТК',
};

export default function Modules() {
  const { modules, loadModules, project, facades, loadFacades, updateModuleStatus } = useAppStore();
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterFacade, setFilterFacade] = useState<number | ''>('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [view, setView] = useState<'list' | 'pipeline'>('list');

  useEffect(() => {
    if (!project) return;
    loadModules(project.id);
    loadFacades(project.id);
  }, [project]);

  const filtered = modules.filter((m: any) => {
    if (filterStatus && m.status !== filterStatus) return false;
    if (filterFacade && m.facade_id !== filterFacade) return false;
    return true;
  });

  function getNextStatus(current: string): string | null {
    const idx = MODULE_STATUSES.indexOf(current);
    if (idx < 0 || idx >= MODULE_STATUSES.length - 1) return null;
    return MODULE_STATUSES[idx + 1];
  }

  async function handleAdvance(moduleId: number, currentStatus: string) {
    const next = getNextStatus(currentStatus);
    if (!next) return;
    await updateModuleStatus(moduleId, next);
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-3 text-tg-text">📦 Модули</h1>

      {/* View toggle + filters */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
        <button
          onClick={() => setView(view === 'pipeline' ? 'list' : 'pipeline')}
          className="bg-tg-secondary text-tg-hint text-xs px-3 py-1.5 rounded-lg border border-gray-700/30 whitespace-nowrap"
        >
          {view === 'pipeline' ? '📋 Список' : '🔄 Pipeline'}
        </button>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-tg-secondary text-tg-text text-xs px-3 py-1.5 rounded-lg border border-gray-700/30"
        >
          <option value="">Все статусы</option>
          {MODULE_STATUSES.map((s) => (
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
      </div>

      <p className="text-xs text-tg-hint mb-3">
        Модулей: {filtered.length}
      </p>

      {/* Pipeline view */}
      {view === 'pipeline' && (
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4">
          {MODULE_STATUSES.map((status) => {
            const colModules = filtered.filter((m: any) => m.status === status);
            return (
              <div key={status} className="min-w-[160px] flex-shrink-0">
                <div className="text-[10px] font-semibold text-tg-hint mb-2 sticky top-0 bg-tg-bg py-1">
                  {STATUS_LABELS[status]} ({colModules.length})
                </div>
                <div className="space-y-2">
                  {colModules.map((m: any) => (
                    <ModuleCardCompact
                      key={m.id}
                      module={m}
                      onAdvance={() => handleAdvance(m.id, m.status)}
                      nextLabel={getNextStatus(m.status) ? STATUS_LABELS[getNextStatus(m.status)!] : null}
                    />
                  ))}
                  {colModules.length === 0 && (
                    <div className="text-center text-tg-hint/50 text-[10px] py-4">Пусто</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List view */}
      {view === 'list' && (
        <div className="space-y-2">
          {filtered.map((m: any) => (
            <ModuleCard
              key={m.id}
              module={m}
              expanded={expandedId === m.id}
              onToggle={() => setExpandedId(expandedId === m.id ? null : m.id)}
              onAdvance={() => handleAdvance(m.id, m.status)}
              nextLabel={getNextStatus(m.status) ? STATUS_LABELS[getNextStatus(m.status)!] : null}
            />
          ))}
          {filtered.length === 0 && (
            <div className="text-center text-tg-hint py-8">
              <p className="text-3xl mb-2">📦</p>
              <p>Модули не найдены</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ModuleCard({
  module: m,
  expanded,
  onToggle,
  onAdvance,
  nextLabel,
}: {
  module: any;
  expanded: boolean;
  onToggle: () => void;
  onAdvance: () => void;
  nextLabel: string | null;
}) {
  // Status progress
  const currentIdx = MODULE_STATUSES.indexOf(m.status);
  const progressPct = ((currentIdx + 1) / MODULE_STATUSES.length) * 100;

  return (
    <div
      className="bg-tg-secondary rounded-xl p-3 border border-gray-700/30"
      onClick={onToggle}
    >
      <div className="flex items-start justify-between mb-1">
        <div>
          <span className="text-sm font-medium text-tg-text">{m.code}</span>
          <span className="text-xs text-tg-hint ml-2">{m.module_type}</span>
        </div>
        <StatusBadge status={m.status} />
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-700 rounded-full h-1 mt-2">
        <div
          className="bg-tg-button h-1 rounded-full transition-all"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-2 text-[10px] text-tg-hint mt-2">
        <div>
          <div>Производство</div>
          <div className="text-tg-text">{m.production_date || '—'}</div>
          {m.actual_production_date && (
            <div className="text-green-400">{m.actual_production_date}</div>
          )}
        </div>
        <div>
          <div>Отгрузка</div>
          <div className="text-tg-text">{m.shipment_date || '—'}</div>
          {m.actual_shipment_date && (
            <div className="text-green-400">{m.actual_shipment_date}</div>
          )}
        </div>
        <div>
          <div>Монтаж</div>
          <div className="text-tg-text">{m.mount_date || '—'}</div>
          {m.actual_mount_date && (
            <div className="text-green-400">{m.actual_mount_date}</div>
          )}
        </div>
      </div>

      <div className="flex gap-3 text-[10px] text-tg-hint mt-2">
        <span>📦 {m.quantity} шт.</span>
        {m.facades?.name && <span>🏢 {m.facades.name}</span>}
        {m.floors && <span>🏠 {m.floors}</span>}
        {m.size_mm && <span>📏 {m.size_mm}</span>}
      </div>

      {/* Expanded section */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-700/30 space-y-2">
          {m.notes && (
            <div className="text-xs text-tg-hint">
              <span className="font-medium text-tg-text">Примечание:</span> {m.notes}
            </div>
          )}

          {/* Status timeline */}
          <div className="flex items-center gap-1">
            {MODULE_STATUSES.map((s, i) => {
              const isActive = MODULE_STATUSES.indexOf(m.status) >= i;
              const isCurrent = m.status === s;
              return (
                <div key={s} className="flex items-center">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      isCurrent ? 'bg-tg-button ring-2 ring-tg-button/30' :
                      isActive ? 'bg-tg-button' : 'bg-gray-600'
                    }`}
                  />
                  {i < MODULE_STATUSES.length - 1 && (
                    <div className={`w-4 h-0.5 ${isActive ? 'bg-tg-button' : 'bg-gray-600'}`} />
                  )}
                </div>
              );
            })}
          </div>
          <div className="text-[9px] text-tg-hint">
            {MODULE_STATUSES.map((s) => STATUS_LABELS[s]).join(' → ')}
          </div>
        </div>
      )}

      {/* Advance button */}
      {nextLabel && (
        <button
          onClick={(e) => { e.stopPropagation(); onAdvance(); }}
          className="mt-2 text-xs bg-tg-button text-tg-buttonText px-3 py-1 rounded-lg active:opacity-80 w-full"
        >
          ▶ {nextLabel}
        </button>
      )}
    </div>
  );
}

function ModuleCardCompact({
  module: m,
  onAdvance,
  nextLabel,
}: {
  module: any;
  onAdvance: () => void;
  nextLabel: string | null;
}) {
  return (
    <div className="bg-tg-secondary rounded-xl p-2 border border-gray-700/30">
      <div className="text-xs font-medium text-tg-text">{m.code}</div>
      <div className="text-[10px] text-tg-hint">{m.module_type}</div>
      <div className="text-[10px] text-tg-hint mt-1">📦 {m.quantity} шт.</div>
      {nextLabel && (
        <button
          onClick={onAdvance}
          className="mt-1 text-[10px] bg-tg-button/20 text-tg-button px-2 py-0.5 rounded active:opacity-80 w-full"
        >
          ▶ {nextLabel}
        </button>
      )}
    </div>
  );
}
