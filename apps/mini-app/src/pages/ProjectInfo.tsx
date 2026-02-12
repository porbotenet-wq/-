import { useEffect } from 'react';
import { useAppStore } from '../stores/appStore';

export default function ProjectInfo() {
  const { project, facades, loadFacades } = useAppStore();

  useEffect(() => {
    if (project) loadFacades(project.id);
  }, [project]);

  if (!project) {
    return <div className="p-4 text-tg-hint">Проект не найден</div>;
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">🏗 {project.name}</h1>

      <div className="bg-tg-secondary rounded-xl p-4 border border-gray-700/30 mb-4">
        <div className="space-y-2 text-sm">
          <Row label="Код" value={project.code} />
          <Row label="Статус" value={project.status} />
          <Row label="Описание" value={project.description || '—'} />
          <Row label="Начало" value={project.start_date || '—'} />
          <Row label="Окончание" value={project.end_date || '—'} />
        </div>
      </div>

      <h2 className="text-lg font-semibold mb-3">🏢 Фасады ({facades.length})</h2>
      <div className="space-y-2">
        {facades.map((f: any) => (
          <div key={f.id} className="bg-tg-secondary rounded-xl p-3 border border-gray-700/30">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-tg-text">{f.name}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                f.priority === 'HIGH' ? 'bg-red-500/20 text-red-400' :
                f.priority === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>{f.priority}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[10px] text-tg-hint">
              {f.area_m2 && <span>📐 {f.area_m2} м²</span>}
              {f.floors && <span>🏠 Этажи: {f.floors}</span>}
              {f.axes && <span>📏 Оси: {f.axes}</span>}
            </div>
            {(f.planned_start || f.planned_end) && (
              <div className="text-[10px] text-tg-hint mt-1">
                📅 {f.planned_start || '?'} → {f.planned_end || '?'}
              </div>
            )}
          </div>
        ))}
        {facades.length === 0 && (
          <div className="text-center text-tg-hint py-4">Фасады не добавлены</div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-tg-hint">{label}</span>
      <span className="text-tg-text font-medium">{value}</span>
    </div>
  );
}
