# 11. Backlog (Epics → Stories)

## 11.1 Epics

| Epic ID | Название | Описание | Приоритет MVP | Связь REQ |
|---------|---------|----------|:---:|-----------|
| E-01 | **Auth & User Management** | Аутентификация через Telegram, регистрация, управление ролями | P0 | REQ-BOT-001, REQ-MINI-001, REQ-SEC-001, REQ-SEC-002 |
| E-02 | **Task Management** | Шаблоны задач, экземпляры, канбан, DAG-зависимости | P0 | REQ-MINI-003, REQ-BE-005 |
| E-03 | **Daily Plan/Fact** | Ежедневный ввод плана и факта, пересчёт накоплений | P0 | REQ-BOT-002, REQ-MINI-004, REQ-BE-003 |
| E-04 | **Telegram Bot Core** | Bot handlers, inline-кнопки, deep-link, фото, дефекты | P0-P1 | REQ-BOT-002..REQ-BOT-006 |
| E-05 | **Notifications & Escalations** | Сценарии уведомлений, cron-джобы, шаблоны, эскалации | P0-P1 | REQ-NOTIF-001..REQ-NOTIF-005, REQ-BE-004 |
| E-06 | **ETL / Excel Import** | Парсинг, валидация, импорт ГПР, план-факт, модулей | P0-P1 | REQ-BE-002 |
| E-07 | **GPR / Gantt** | Просмотр и управление ГПР, диаграмма Ганта | P1 | REQ-MINI-002 |
| E-08 | **Module Management** | План модулей, статусы, связь с СМР | P1 | REQ-MINI-005, REQ-NOTIF-005 |
| E-09 | **Analytics & Dashboard** | Сводки по фасадам, накопительные графики, прогресс | P1 | REQ-MINI-006 |
| E-10 | **Document Management** | Загрузка, просмотр, версионность, базовый workflow | P1-P2 | REQ-MINI-007 |
| E-11 | **Audit & Logging** | AuditLog для всех мутаций, просмотр логов | P0 (запись), P2 (UI) | REQ-AUD-001 |
| E-12 | **Infrastructure & DevOps** | Docker, CI/CD, мониторинг | P0 (dev), P1 (prod), P2 (CI) | — |

---

## 11.2 Stories по Epics

### E-01: Auth & User Management

| Story ID | Название | Описание | Приоритет | Estimate (SP) | Зависимости |
|----------|---------|----------|:---:|:---:|-------------|
| S-01.01 | Setup NestJS project + DB schema | Инициализация монорепо, Prisma schema для User, Role, Department, UserRole, RbacPermission, RolePermission | P0 | 5 | — |
| S-01.02 | Telegram Bot webhook + /start handler | grammY bot, webhook endpoint, создание User при /start | P0 | 3 | S-01.01 |
| S-01.03 | JWT auth module | Генерация access+refresh JWT, middleware проверки | P0 | 3 | S-01.01 |
| S-01.04 | Telegram initData validation | Валидация HMAC-SHA256 для Mini App, endpoint POST /api/auth/telegram | P0 | 2 | S-01.03 |
| S-01.05 | RBAC Guards | NestJS guards для проверки permissions; декоратор @RequirePermission | P0 | 5 | S-01.03 |
| S-01.06 | User management API | CRUD User, назначение ролей (admin), список пользователей | P0 | 3 | S-01.05 |
| S-01.07 | Seed roles & permissions | Скрипт инициализации 10 ролей + матрица permissions из раздела 4 | P0 | 2 | S-01.01 |
| S-01.08 | Mini App: auth flow + routing | React app, TG SDK init, auth request, protected routes | P0 | 5 | S-01.04 |

---

### E-02: Task Management

| Story ID | Название | Описание | Приоритет | Estimate (SP) | Зависимости |
|----------|---------|----------|:---:|:---:|-------------|
| S-02.01 | DB schema: TaskTemplate, TaskInstance, TaskDependency | Prisma schema + миграции | P0 | 3 | S-01.01 |
| S-02.02 | TaskInstance CRUD API | Create, read (list + detail), update status, assign, filter | P0 | 5 | S-02.01, S-01.05 |
| S-02.03 | Task status state machine | Валидация переходов (Guards из WF-02), блокировка при зависимостях | P0 | 5 | S-02.02 |
| S-02.04 | Mini App: Kanban board | React компонент: колонки по статусам, drag-and-drop, фильтры | P0 | 8 | S-02.02, S-01.08 |
| S-02.05 | DAG validation service | Проверка ацикличности, конфликтов дат при создании зависимостей | P1 | 5 | S-02.01 |
| S-02.06 | TaskDependency API | CRUD зависимостей с DAG-валидацией | P1 | 3 | S-02.05 |
| S-02.07 | Template → Instance generation | Алгоритм порождения TaskInstance из TaskTemplate при создании проекта | P1 | 5 | S-02.01 |

---

### E-03: Daily Plan/Fact

| Story ID | Название | Описание | Приоритет | Estimate (SP) | Зависимости |
|----------|---------|----------|:---:|:---:|-------------|
| S-03.01 | DB schema: DailyWorkLog, WorkType, WorkVolumeContract | Prisma schema + миграции | P0 | 3 | S-01.01 |
| S-03.02 | DailyWorkLog CRUD API | Create/update факт, фильтр по дате/задаче/фасаду | P0 | 5 | S-03.01, S-01.05 |
| S-03.03 | Accumulation recalculation service | deviation, pct_day, acc_plan, acc_fact, TaskInstance.actual_volume/completion_pct | P0 | 5 | S-03.02 |
| S-03.04 | Mini App: Plan/Fact table | React компонент: таблица с inline-editing, autosave, формулы | P0 | 8 | S-03.02, S-01.08 |
| S-03.05 | Plan/Fact submission workflow | Кнопка "Отправить на проверку" → status=REVIEW, уведомление | P1 | 3 | S-03.04, S-05.01 |

---

### E-04: Telegram Bot Core

| Story ID | Название | Описание | Приоритет | Estimate (SP) | Зависимости |
|----------|---------|----------|:---:|:---:|-------------|
| S-04.01 | Bot: quick fact entry dialog | Conversation: выбор задачи → ввод числа → сохранение → подтверждение | P0 | 5 | S-01.02, S-03.02 |
| S-04.02 | Bot: inline keyboard callbacks | Обработка callback_query, dispatch по action:entity:id, RBAC check | P0 | 5 | S-01.02, S-01.05 |
| S-04.03 | Bot: deep-link to Mini App | Формирование WebApp button с контекстом (task_id, date) | P0 | 2 | S-01.02, S-01.08 |
| S-04.04 | Bot: photo upload handler | Приём фото, download, upload to S3/MinIO, create Document | P1 | 5 | S-01.02, S-10.01 |
| S-04.05 | Bot: defect reporting dialog | Conversation: фасад → описание → критичность → фото (опц.) → create TaskInstance(type=DEFECT) | P1 | 5 | S-01.02, S-02.02 |
| S-04.06 | Bot: main menu | Inline keyboard: [Мои задачи] [Ввести факт] [Дефект] [Приложение] | P0 | 2 | S-01.02 |

---

### E-05: Notifications & Escalations

| Story ID | Название | Описание | Приоритет | Estimate (SP) | Зависимости |
|----------|---------|----------|:---:|:---:|-------------|
| S-05.01 | Notification service + templates | NotificationScenario, MessageTemplate, NotificationLog DB + render engine | P0 | 5 | S-01.01 |
| S-05.02 | Event-driven notifications | Listeners на DATA_CHANGE: task assigned, status changed, fact entered | P0 | 5 | S-05.01, S-04.02 |
| S-05.03 | Cron: morning reminder (08:00) | BullMQ scheduled job: найти задачи, отправить напоминания прорабам | P0 | 3 | S-05.01 |
| S-05.04 | Cron: fact reminder (19:00) + escalation (21:00) | Проверка ввода факта, напоминание, эскалация | P0 | 5 | S-05.01, S-03.01 |
| S-05.05 | Cron: overdue tasks check (07:00) | Проверка просрочки, эскалация L1/L2/L3 | P1 | 5 | S-05.01, S-02.01 |
| S-05.06 | Cron: daily summary (23:00) | Агрегация данных за день, формирование сводки, отправка руководству | P1 | 5 | S-05.01, S-03.01 |
| S-05.07 | NotificationSetting CRUD | API для настройки параметров уведомлений (admin) | P1 | 3 | S-05.01 |
| S-05.08 | Idempotency + deduplication | Проверка: не отправлять повторно за тот же день + entity_id | P1 | 3 | S-05.01 |

---

### E-06: ETL / Excel Import

| Story ID | Название | Описание | Приоритет | Estimate (SP) | Зависимости |
|----------|---------|----------|:---:|:---:|-------------|
| S-06.01 | Import infrastructure | Upload endpoint, S3 storage, ImportLog, BullMQ job | P0 | 5 | S-01.01 |
| S-06.02 | GPR parser | Парсинг `Образец ГПР`: распознавание section_header, маппинг → TaskTemplate | P0 | 8 | S-06.01, S-02.01 |
| S-06.03 | Plan/Fact parser | Парсинг `Ежедневный план-факт`: маппинг → DailyWorkLog, пересчёт | P0 | 5 | S-06.01, S-03.01 |
| S-06.04 | Module plan parser | Парсинг `План модулей` + `План запуска`: phase_header, маппинг → ModulePlanItem | P1 | 5 | S-06.01, S-08.01 |
| S-06.05 | Work volumes (СМР) parser | Парсинг `СМР - Объемы работ`: маппинг → WorkType + WorkVolumeContract | P1 | 5 | S-06.01, S-03.01 |
| S-06.06 | Facade summary parser | Парсинг `Сводка по фасадам`: маппинг → Facade | P1 | 3 | S-06.01 |
| S-06.07 | Accumulative series parser | Парсинг `Накопительная` (транспонирование time-series): маппинг → AccumulativeSeries | P2 | 5 | S-06.01 |
| S-06.08 | Module summary parser | Парсинг `модуль` (Схемы со сводой): маппинг → ModuleSummary | P2 | 3 | S-06.01 |
| S-06.09 | Import validation + error reporting | Валидация колонок, типов, referential integrity. Partial import. Error/warning log. | P0 | 5 | S-06.01 |
| S-06.10 | Mini App: import UI | Загрузка файла, выбор типа, прогресс, просмотр лога | P1 | 5 | S-06.01, S-01.08 |

---

### E-07: GPR / Gantt

| Story ID | Название | Описание | Приоритет | Estimate (SP) | Зависимости |
|----------|---------|----------|:---:|:---:|-------------|
| S-07.01 | Gantt data API | Endpoint: дерево задач (секции + tasks + зависимости) с датами, статусами | P1 | 3 | S-02.01 |
| S-07.02 | Mini App: Gantt view (read-only) | React компонент: горизонтальная шкала, цветовая индикация, фильтры | P1 | 13 | S-07.01, S-01.08 |
| S-07.03 | Mini App: Gantt edit (form-based) | Редактирование дат задачи через форму (не drag-and-drop) | P1 | 5 | S-07.02 |
| S-07.04 | Mini App: Gantt drag-and-drop | Перетаскивание полос для изменения дат (desktop-first) | P2 | 8 | S-07.02 |

---

### E-08: Module Management

| Story ID | Название | Описание | Приоритет | Estimate (SP) | Зависимости |
|----------|---------|----------|:---:|:---:|-------------|
| S-08.01 | DB schema: ModulePlanItem, ModuleSummary | Prisma schema + миграции | P1 | 2 | S-01.01 |
| S-08.02 | ModulePlanItem CRUD API | CRUD + status change с guards (WF-03) | P1 | 5 | S-08.01, S-01.05 |
| S-08.03 | Module status state machine | Валидация переходов WF-03 | P1 | 3 | S-08.02 |
| S-08.04 | Mini App: Modules list/table | Таблица модулей с фильтрами, смена статуса | P1 | 5 | S-08.02, S-01.08 |
| S-08.05 | Module ↔ SMR link | Связь модуля с TaskInstance по smr_link_task_id | P1 | 2 | S-08.02, S-02.02 |

---

### E-09: Analytics & Dashboard

| Story ID | Название | Описание | Приоритет | Estimate (SP) | Зависимости |
|----------|---------|----------|:---:|:---:|-------------|
| S-09.01 | Analytics API: facade summary | Агрегация по фасадам: площадь, модули, прогресс | P1 | 3 | S-03.01, S-08.01 |
| S-09.02 | Analytics API: plan vs fact (time-series) | Накопительные данные: acc_plan, acc_fact по дням | P1 | 3 | S-03.01 |
| S-09.03 | Analytics API: overdue tasks | Список просроченных задач с группировкой | P1 | 2 | S-02.01 |
| S-09.04 | Analytics API: module status distribution | Круговая диаграмма: кол-во модулей по статусам | P1 | 2 | S-08.01 |
| S-09.05 | Mini App: Dashboard page | React: карточки-метрики, графики, таблица просрочек | P1 | 8 | S-09.01..S-09.04, S-01.08 |
| S-09.06 | Analytics: export to Excel | Экспорт данных дашборда в XLSX | P2 | 5 | S-09.05 |

---

### E-10: Document Management

| Story ID | Название | Описание | Приоритет | Estimate (SP) | Зависимости |
|----------|---------|----------|:---:|:---:|-------------|
| S-10.01 | DB schema: Document + S3/MinIO setup | Prisma schema, MinIO container, upload/download service | P1 | 5 | S-01.01 |
| S-10.02 | Document CRUD API | Upload, list, download (pre-signed URL), filter by entity | P1 | 5 | S-10.01, S-01.05 |
| S-10.03 | Mini App: Documents page | Список документов, загрузка, просмотр, привязка к задаче/модулю | P1 | 5 | S-10.02, S-01.08 |
| S-10.04 | Document versioning | При повторной загрузке → новая версия, history UI | P2 | 3 | S-10.02 |
| S-10.05 | Document review workflow | Статусы DRAFT→ON_REVIEW→APPROVED, уведомления | P2 | 5 | S-10.02, S-05.01 |

---

### E-11: Audit & Logging

| Story ID | Название | Описание | Приоритет | Estimate (SP) | Зависимости |
|----------|---------|----------|:---:|:---:|-------------|
| S-11.01 | AuditLog interceptor | NestJS interceptor: перехват мутаций, запись old/new value, async | P0 | 5 | S-01.01 |
| S-11.02 | AuditLog query API | Поиск по entity_type, entity_id, user_id, date range (admin/project_director) | P2 | 3 | S-11.01 |
| S-11.03 | Mini App: Audit log viewer | React: таблица аудит-логов с фильтрами | P2 | 5 | S-11.02, S-01.08 |

---

### E-12: Infrastructure & DevOps

| Story ID | Название | Описание | Приоритет | Estimate (SP) | Зависимости |
|----------|---------|----------|:---:|:---:|-------------|
| S-12.01 | Monorepo setup (Turborepo) | package.json, turbo.json, workspaces: api, mini-app, shared | P0 | 3 | — |
| S-12.02 | Docker Compose (dev) | PostgreSQL, Redis, MinIO, app, worker, mini-app (dev server) | P0 | 3 | S-12.01 |
| S-12.03 | Docker Compose (prod) | Optimized builds, nginx, SSL, health checks | P1 | 5 | S-12.02 |
| S-12.04 | Environment config | .env.example, config module (NestJS ConfigModule), secrets management | P0 | 2 | S-12.01 |
| S-12.05 | CI/CD pipeline | GitHub Actions: lint, test, build, deploy | P2 | 5 | S-12.03 |
| S-12.06 | Monitoring setup | Prometheus metrics, Grafana dashboards | POST-MVP | 8 | S-12.03 |

---

## 11.3 Сводка бэклога

| Метрика | Значение |
|---------|----------|
| Epics | 12 |
| Stories (total) | 79 |
| Story Points (total) | ~344 SP |
| P0 Stories | 33 (~150 SP) |
| P1 Stories | 30 (~130 SP) |
| P2 Stories | 14 (~57 SP) |
| POST-MVP Stories | 2 (~16 SP) |

## 11.4 Рекомендуемый порядок спринтов (2-недельные)

| Спринт | Фокус | Stories | SP |
|--------|-------|---------|:---:|
| Sprint 1 | Infrastructure + Auth + DB Schema | S-12.01, S-12.02, S-12.04, S-01.01, S-01.02, S-01.03, S-01.04, S-01.07 | ~28 |
| Sprint 2 | RBAC + Task CRUD + Bot core | S-01.05, S-01.06, S-02.01, S-02.02, S-02.03, S-04.02, S-04.06, S-11.01 | ~36 |
| Sprint 3 | Plan/Fact + Notifications + Mini App Auth | S-03.01, S-03.02, S-03.03, S-05.01, S-05.02, S-01.08 | ~33 |
| Sprint 4 | Mini App: Kanban + Plan/Fact + Bot quick fact | S-02.04, S-03.04, S-04.01, S-04.03, S-05.03, S-05.04 | ~36 |
| Sprint 5 | ETL Import + Cron jobs | S-06.01, S-06.02, S-06.03, S-06.09, S-05.05, S-05.06 | ~36 |
| Sprint 6 (P1) | Gantt + Modules + Dashboard | S-07.01, S-07.02, S-08.01, S-08.02, S-08.03, S-09.01..S-09.05 | ~38 |
| Sprint 7 (P1) | Documents + Bot advanced + Import advanced | S-10.01..S-10.03, S-04.04, S-04.05, S-06.04..S-06.06, S-06.10 | ~43 |

> **Итого MVP (P0+P1): ~7 спринтов = 14 недель** при двух fullstack-разработчиках, с учётом code review, тестирования, и итераций.
