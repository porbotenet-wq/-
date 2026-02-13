import { useEffect, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { supabase } from '../api/supabase';

export default function ProjectInfo() {
  const { project, facades, loadFacades, user } = useAppStore();
  const [activeUsers, setActiveUsers] = useState<any[]>([]);
  const [showUsers, setShowUsers] = useState(false);

  useEffect(() => {
    if (project) {
      loadFacades(project.id);
      loadUsers(project.id);
    }
  }, [project]);

  async function loadUsers(projectId: number) {
    const { data } = await supabase
      .from('user_roles')
      .select('*, users!user_roles_user_id_fkey(id, first_name, last_name, username, status), roles(*)')
      .eq('project_id', projectId);
    setActiveUsers(data || []);
  }

  if (!project) {
    return (
      <div className="p-4 text-center text-tg-hint py-12">
        <p className="text-3xl mb-2">🏗</p>
        <p>Проект не найден</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4 text-tg-text">🏗 {project.name}</h1>

      {/* Project details */}
      <div className="bg-tg-secondary rounded-xl p-4 border border-gray-700/30 mb-4">
        <div className="space-y-2 text-sm">
          <Row label="Код" value={project.code} />
          <Row label="Статус" value={project.status} highlight />
          <Row label="Описание" value={project.description || '—'} />
          <Row label="Начало" value={project.start_date || '—'} />
          <Row label="Окончание" value={project.end_date || '—'} />
        </div>
      </div>

      {/* Facades */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-3 text-tg-text">🏢 Фасады ({facades.length})</h2>
        <div className="space-y-2">
          {facades.map((f: any) => (
            <FacadeCard key={f.id} facade={f} />
          ))}
          {facades.length === 0 && (
            <div className="text-center text-tg-hint py-4">Фасады не добавлены</div>
          )}
        </div>
      </div>

      {/* Team */}
      <div>
        <button
          onClick={() => setShowUsers(!showUsers)}
          className="flex items-center justify-between w-full mb-3"
        >
          <h2 className="text-lg font-semibold text-tg-text">👥 Команда ({activeUsers.length})</h2>
          <span className="text-tg-hint text-sm">{showUsers ? '▲' : '▼'}</span>
        </button>

        {showUsers && (
          <div className="space-y-2">
            {activeUsers.map((ur: any) => (
              <div key={ur.id} className="bg-tg-secondary rounded-xl p-3 border border-gray-700/30 flex items-center gap-3">
                <div className="w-8 h-8 bg-tg-button/20 rounded-full flex items-center justify-center text-sm">
                  {ur.users?.first_name?.[0] || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-tg-text font-medium truncate">
                    {ur.users?.first_name || ''} {ur.users?.last_name || ''}
                  </div>
                  <div className="text-[10px] text-tg-hint">
                    {ur.roles?.display_name || '—'}
                    {ur.users?.username && ` • @${ur.users.username}`}
                  </div>
                </div>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                  ur.users?.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400' :
                  ur.users?.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {ur.users?.status}
                </span>
              </div>
            ))}
            {activeUsers.length === 0 && (
              <div className="text-center text-tg-hint py-4">Нет назначенных пользователей</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FacadeCard({ facade: f }: { facade: any }) {
  return (
    <div className="bg-tg-secondary rounded-xl p-3 border border-gray-700/30">
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
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-tg-hint">{label}</span>
      <span className={`font-medium ${highlight ? 'text-tg-button' : 'text-tg-text'}`}>{value}</span>
    </div>
  );
}
