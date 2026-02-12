const statusConfig: Record<string, { label: string; color: string }> = {
  // Task statuses
  CREATED: { label: 'Создана', color: 'bg-gray-500' },
  ASSIGNED: { label: 'Назначена', color: 'bg-blue-500' },
  IN_PROGRESS: { label: 'В работе', color: 'bg-green-500' },
  DONE: { label: 'Выполнена', color: 'bg-teal-500' },
  VERIFIED: { label: 'Принята', color: 'bg-emerald-600' },
  BLOCKED: { label: 'Блокирована', color: 'bg-red-500' },
  CANCELLED: { label: 'Отменена', color: 'bg-gray-600' },
  REPORTED: { label: 'Сообщено', color: 'bg-orange-500' },
  // Module statuses
  PLANNED: { label: 'Запланирован', color: 'bg-gray-500' },
  IN_PRODUCTION: { label: 'Производство', color: 'bg-yellow-500' },
  PRODUCED: { label: 'Произведён', color: 'bg-amber-500' },
  SHIPPED: { label: 'Отгружен', color: 'bg-blue-500' },
  ON_SITE: { label: 'На площадке', color: 'bg-cyan-500' },
  MOUNTED: { label: 'Смонтирован', color: 'bg-green-500' },
  INSPECTED: { label: 'Принят ОТК', color: 'bg-emerald-600' },
  // Document statuses
  DRAFT: { label: 'Черновик', color: 'bg-gray-500' },
  ON_REVIEW: { label: 'На проверке', color: 'bg-yellow-500' },
  APPROVED: { label: 'Утверждён', color: 'bg-green-500' },
  ARCHIVED: { label: 'В архиве', color: 'bg-gray-600' },
  // User statuses
  ACTIVE: { label: 'Активен', color: 'bg-green-500' },
  PENDING: { label: 'Ожидание', color: 'bg-yellow-500' },
  // Daily log statuses
  REVIEW: { label: 'На проверке', color: 'bg-yellow-500' },
};

export function StatusBadge({ status, size = 'sm' }: { status: string; size?: 'sm' | 'xs' }) {
  const cfg = statusConfig[status] || { label: status, color: 'bg-gray-500' };
  const sizeClass = size === 'xs' ? 'text-[9px] px-1.5 py-0' : 'text-[10px] px-2 py-0.5';
  return (
    <span className={`${cfg.color} text-white ${sizeClass} rounded-full font-medium whitespace-nowrap`}>
      {cfg.label}
    </span>
  );
}
