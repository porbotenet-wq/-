import { useEffect } from 'react';
import { useAppStore } from '../stores/appStore';
import { StatusBadge } from '../components/StatusBadge';

export default function Modules() {
  const { modules, loadModules, project } = useAppStore();

  useEffect(() => {
    if (project) loadModules(project.id);
  }, [project]);

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">📦 Модули</h1>

      <p className="text-xs text-tg-hint mb-3">
        Всего: {modules.length} модулей
      </p>

      <div className="space-y-2">
        {modules.map((m: any) => (
          <div key={m.id} className="bg-tg-secondary rounded-xl p-3 border border-gray-700/30">
            <div className="flex items-start justify-between mb-1">
              <div>
                <span className="text-sm font-medium text-tg-text">{m.code}</span>
                <span className="text-xs text-tg-hint ml-2">{m.module_type}</span>
              </div>
              <StatusBadge status={m.status} />
            </div>
            <div className="grid grid-cols-3 gap-2 text-[10px] text-tg-hint mt-2">
              <div>
                <div>Производство</div>
                <div className="text-tg-text">{m.production_date || '—'}</div>
              </div>
              <div>
                <div>Отгрузка</div>
                <div className="text-tg-text">{m.shipment_date || '—'}</div>
              </div>
              <div>
                <div>Монтаж</div>
                <div className="text-tg-text">{m.mount_date || '—'}</div>
              </div>
            </div>
            <div className="flex gap-3 text-[10px] text-tg-hint mt-2">
              <span>📦 {m.quantity} шт.</span>
              {m.facades?.name && <span>🏢 {m.facades.name}</span>}
              {m.floors && <span>🏠 {m.floors}</span>}
            </div>
          </div>
        ))}
        {modules.length === 0 && (
          <div className="text-center text-tg-hint py-8">
            Модули ещё не добавлены
          </div>
        )}
      </div>
    </div>
  );
}
