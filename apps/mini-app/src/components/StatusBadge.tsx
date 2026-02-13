const statusConfig: Record<string, { label: string; color: string }> = {
  CREATED: { label: 'Создана', color: 'bg-gray-500' },
  ASSIGNED: { label: 'Назначена', color: 'bg-blue-500' },
  IN_PROGRESS: { label: 'В работе', color: 'bg-green-500' },
  DONE: { label: 'Выполнена', color: 'bg-teal-500' },
  VERIFIED: { label: 'Принята', color: 'bg-emerald-600' },
  BLOCKED: { label: 'Блокирована', color: 'bg-red-500' },
  CANCELLED: { label: 'Отменена', color: 'bg-gray-600' },
  PLANNED: { label: 'Запланирован', color: 'bg-gray-500' },
  IN_PRODUCTION: { label: 'Производство', color: 'bg-yellow-500' },
  PRODUCED: { label: 'Произведён', color: 'bg-amber-500' },
  SHIPPED: { label: 'Отгружен', color: 'bg-blue-500' },
  ON_SITE: { label: 'На площадке', color: 'bg-cyan-500' },
  MOUNTED: { label: 'Смонтирован', color: 'bg-green-500' },
  INSPECTED: { label: 'Принят ОТК', color: 'bg-emerald-600' },
};

export function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] || { label: status, color: 'bg-gray-500' };
  return (
    <span className={`${cfg.color} text-white text-[10px] px-2 py-0.5 rounded-full font-medium`}>
      {cfg.label}
    </span>
  );
}
