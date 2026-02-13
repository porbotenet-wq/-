# 6. Data Entities (ER-логика)

## 6.1 Обзор сущностей

Полный список сущностей БД с указанием источника данных из Excel-файлов.

| # | Сущность | Описание | Основной источник (Excel) | Примечание |
|---|----------|----------|--------------------------|------------|
| 1 | `Project` | Строительный проект | — (создаётся в системе) | Корневая сущность |
| 2 | `Facade` | Фасад / Зона | Сводка по фасадам (СИТИ_4) | |
| 3 | `WorkType` | Тип СМР | СМР - Объемы работ (СИТИ_4) | Справочник |
| 4 | `WorkVolumeContract` | Объём работ по договору | СМР - Объемы работ (СИТИ_4) | |
| 5 | `DailyWorkLog` | Ежедневный план-факт | Ежедневный план-факт (СИТИ_4) | Основная таблица ввода |
| 6 | `ModulePlanItem` | Элемент плана модулей | План модулей (СИТИ_4) + План запуска | |
| 7 | `TaskTemplate` | Шаблон задачи | ГПР (Образец ГПР) | |
| 8 | `TaskInstance` | Экземпляр задачи | Порождается из TaskTemplate | |
| 9 | `TaskDependency` | Зависимость между задачами | Устанавливается вручную / при импорте [Assumption] | DAG |
| 10 | `NotificationScenario` | Сценарий уведомления | Сценарии уведомлений (СИТИ_4) | |
| 11 | `NotificationSetting` | Настройка уведомлений | Настройки уведомлений (СИТИ_4) | |
| 12 | `MessageTemplate` | Шаблон сообщения | Шаблоны сообщений (СИТИ_4) | |
| 13 | `NotificationLog` | Лог отправленных уведомлений | — (генерируется системой) | |
| 14 | `User` | Пользователь | Ответственные (СИТИ_4) | |
| 15 | `Role` | Роль в системе | Ответственные (СИТИ_4) | Справочник |
| 16 | `Department` | Отдел | Ответственные (СИТИ_4) | Справочник |
| 17 | `UserRole` | Связь User ↔ Role (в контексте проекта) | — | M:N |
| 18 | `RbacPermission` | Разрешение RBAC | — (конфигурация) | |
| 19 | `RolePermission` | Связь Role ↔ Permission | — (конфигурация) | M:N |
| 20 | `AuditLog` | Журнал аудита | — (генерируется системой) | Immutable |
| 21 | `Document` | Документ / Файл | — [Assumption: нет колонок в Excel] | С версионностью |
| 22 | `ImportLog` | Лог импортов | — (генерируется системой) | |
| 23 | `ModuleSummary` | Сводка по модулям | модуль (Схемы со сводой) | |
| 24 | `AccumulativeSeries` | Накопительные данные (time-series) | Накопительная (Схемы со сводой) | |

---

## 6.2 Детализация сущностей

### 6.2.1 Project

| Поле | Тип | Constraints | Описание | Маппинг Excel |
|------|-----|------------|----------|---------------|
| `id` | SERIAL | PK | — | — |
| `name` | VARCHAR(255) | NOT NULL | Название проекта | — |
| `code` | VARCHAR(50) | UNIQUE, NOT NULL | Код проекта (напр. "СИТИ-4") | — |
| `description` | TEXT | — | Описание | — |
| `status` | ENUM('ACTIVE','PAUSED','COMPLETED','ARCHIVED') | NOT NULL, DEFAULT 'ACTIVE' | Статус | — |
| `start_date` | DATE | — | Дата начала | — |
| `end_date` | DATE | — | Плановая дата окончания | — |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | — | — |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | — | — |

---

### 6.2.2 Facade

| Поле | Тип | Constraints | Описание | Маппинг Excel |
|------|-----|------------|----------|---------------|
| `id` | SERIAL | PK | — | — |
| `project_id` | INT | FK → Project, NOT NULL | Проект | — |
| `name` | VARCHAR(100) | NOT NULL | Название фасада | `Фасад` (Сводка по фасадам) |
| `area_m2` | DECIMAL(12,2) | — | Площадь | `Площадь (м²)` |
| `module_count` | INT | — | Кол-во модулей | `Кол-во модулей` |
| `floors` | VARCHAR(100) | — | Этажи | `Этажи` |
| `axes` | VARCHAR(100) | — | Оси | `Оси` |
| `priority` | ENUM('HIGH','MEDIUM','LOW') | DEFAULT 'MEDIUM' | Приоритет | `Приоритет` |
| `planned_start` | DATE | — | Срок начала | `Срок начала` |
| `planned_end` | DATE | — | Срок окончания | `Срок окончания` |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | — | — |

---

### 6.2.3 WorkType

| Поле | Тип | Constraints | Описание | Маппинг Excel |
|------|-----|------------|----------|---------------|
| `id` | SERIAL | PK | — | — |
| `project_id` | INT | FK → Project, NOT NULL | Проект | — |
| `code` | VARCHAR(50) | NOT NULL | Код работы | `Код работы` (СМР - Объемы работ) |
| `name` | TEXT | NOT NULL | Наименование | `Наименование работ` |
| `unit` | VARCHAR(20) | — | Единица измерения | `Ед.изм.` |
| `phase` | VARCHAR(100) | — | Этап | `Этап` |
| `priority` | ENUM('HIGH','MEDIUM','LOW') | DEFAULT 'MEDIUM' | Приоритет | `Приоритет` |
| `status` | ENUM('ACTIVE','PAUSED','COMPLETED') | DEFAULT 'ACTIVE' | Статус | `Статус` |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | — | — |

**UNIQUE**: (project_id, code)

---

### 6.2.4 WorkVolumeContract

| Поле | Тип | Constraints | Описание | Маппинг Excel |
|------|-----|------------|----------|---------------|
| `id` | SERIAL | PK | — | `ID` (СМР) |
| `work_type_id` | INT | FK → WorkType, NOT NULL | Тип работы | через `Код работы` |
| `facade_id` | INT | FK → Facade | Фасад/Зона | `Фасад/Зона` |
| `contract_volume` | DECIMAL(14,4) | NOT NULL | Объём по договору | `Объем по договору` |
| `completed_volume` | DECIMAL(14,4) | DEFAULT 0 | Выполнено | `Выполнено` |
| `remaining_volume` | DECIMAL(14,4) | GENERATED (contract - completed) | Остаток | `Остаток` |
| `completion_pct` | DECIMAL(5,2) | GENERATED | % выполнения | `% выполнения` |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | — | — |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | — | — |

---

### 6.2.5 DailyWorkLog

| Поле | Тип | Constraints | Описание | Маппинг Excel |
|------|-----|------------|----------|---------------|
| `id` | SERIAL | PK | — | `ID записи` (Ежедневный план-факт) |
| `task_instance_id` | INT | FK → TaskInstance, NOT NULL | Задача | через `Код работы` |
| `date` | DATE | NOT NULL | Дата | `Дата` |
| `day_of_week` | VARCHAR(20) | — | День недели | `День недели` |
| `work_type_code` | VARCHAR(50) | — | Код работы (денормализация для отчётов) | `Код работы` |
| `work_name` | TEXT | — | Наименование (денормализация) | `Наименование работ` |
| `facade_id` | INT | FK → Facade | Фасад | `Фасад` |
| `floor_zone` | VARCHAR(100) | — | Этаж/Зона | `Этаж/Зона` |
| `unit` | VARCHAR(20) | — | Ед.изм. | `Ед.изм.` |
| `plan_day` | DECIMAL(12,4) | DEFAULT 0 | План на день | `План на день` |
| `fact_day` | DECIMAL(12,4) | DEFAULT 0 | Факт на день | `Факт на день` |
| `deviation` | DECIMAL(12,4) | GENERATED (fact_day - plan_day) | Отклонение | `Отклонение` |
| `pct_day` | DECIMAL(7,2) | — (NULL если plan_day = 0) | % дня | `% дня` |
| `acc_plan` | DECIMAL(14,4) | — | Накопл. план | `Накопл. план` |
| `acc_fact` | DECIMAL(14,4) | — | Накопл. факт | `Накопл. факт` |
| `brigade` | VARCHAR(100) | — | Бригада | `Бригада` |
| `notes` | TEXT | — | Примечание | `Примечание` |
| `status` | ENUM('DRAFT','SUBMITTED','REVIEW','APPROVED','REJECTED') | DEFAULT 'DRAFT' | Статус записи | — |
| `created_by` | INT | FK → User | Кто создал | — |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | — | — |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | — | — |

**UNIQUE**: (task_instance_id, date) — одна запись на задачу в день.

---

### 6.2.6 ModulePlanItem

| Поле | Тип | Constraints | Описание | Маппинг Excel |
|------|-----|------------|----------|---------------|
| `id` | SERIAL | PK | — | `ID` (План модулей) |
| `project_id` | INT | FK → Project, NOT NULL | Проект | — |
| `phase` | VARCHAR(100) | — | Этап | `Этап` |
| `module_type` | VARCHAR(100) | NOT NULL | Тип модуля | `Тип модуля` |
| `code` | VARCHAR(50) | NOT NULL | Код | `Код` |
| `size_mm` | VARCHAR(100) | — | Размер | `Размер (мм)` |
| `quantity` | INT | NOT NULL | Кол-во | `Кол-во` |
| `axes_facade` | VARCHAR(100) | — | Оси/Фасад | `Оси/Фасад` |
| `facade_id` | INT | FK → Facade | Фасад (нормализованная ссылка) | resolved from `Оси/Фасад` |
| `floors` | VARCHAR(100) | — | Этажи | `Этажи` |
| `production_date` | DATE | — | Дата производства | `Дата производства` |
| `shipment_date` | DATE | — | Дата отгрузки | `Дата отгрузки` |
| `mount_date` | DATE | — | Дата монтажа | `Дата монтажа` |
| `actual_production_date` | DATE | — | Факт. дата производства | — |
| `actual_shipment_date` | DATE | — | Факт. дата отгрузки | — |
| `actual_mount_date` | DATE | — | Факт. дата монтажа | — |
| `smr_link_task_id` | INT | FK → TaskInstance | Связь СМР | `Связь СМР` |
| `status` | ENUM('PLANNED','IN_PRODUCTION','PRODUCED','SHIPPED','ON_SITE','MOUNTED','INSPECTED') | DEFAULT 'PLANNED' | Статус | `Статус` |
| `notes` | TEXT | — | Примечание | `примечание` (План запуска) |
| `facade_type` | VARCHAR(100) | — | Тип фасада | `тип фасада` (План запуска) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | — | — |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | — | — |

**UNIQUE**: (project_id, code)

---

### 6.2.7 TaskTemplate

| Поле | Тип | Constraints | Описание | Маппинг Excel |
|------|-----|------------|----------|---------------|
| `id` | SERIAL | PK | — | — |
| `project_id` | INT | FK → Project, NOT NULL | Проект | — |
| `code` | VARCHAR(50) | NOT NULL | Код | `№` (ГПР) / `Код работы` |
| `name` | TEXT | NOT NULL | Наименование | `Наименование работ` |
| `work_type_id` | INT | FK → WorkType | Тип СМР | через `Код работы` |
| `unit` | VARCHAR(20) | — | Ед.изм | `Ед.изм` |
| `duration_days` | INT | — | Длительность | `окончание - начало` |
| `default_start` | DATE | — | Дата начала по умолчанию | `начало` (ГПР) |
| `default_end` | DATE | — | Дата окончания по умолчанию | `окончание` (ГПР) |
| `is_section_header` | BOOLEAN | DEFAULT false | Заголовок секции | Определяется при импорте |
| `section_name` | TEXT | — | Название секции | Текст заголовка |
| `parent_template_id` | INT | FK → TaskTemplate (self) | Родительский шаблон (секция) | Иерархия из ГПР |
| `sort_order` | INT | NOT NULL | Порядок | `№` |
| `default_responsible_role` | VARCHAR(50) | — | Роль ответственного | `ответственный` |
| `phase` | VARCHAR(100) | — | Этап | Заголовок этапа |
| `priority` | ENUM('HIGH','MEDIUM','LOW') | DEFAULT 'MEDIUM' | Приоритет | — |
| `notes` | TEXT | — | Примечание | `примечание` |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | — | — |

---

### 6.2.8 TaskInstance

| Поле | Тип | Constraints | Описание | Маппинг Excel |
|------|-----|------------|----------|---------------|
| `id` | SERIAL | PK | — | — |
| `template_id` | INT | FK → TaskTemplate | Шаблон | — |
| `project_id` | INT | FK → Project, NOT NULL | Проект | — |
| `type` | ENUM('TASK','DEFECT','MILESTONE') | DEFAULT 'TASK' | Тип | — |
| `status` | ENUM('CREATED','ASSIGNED','IN_PROGRESS','DONE','VERIFIED','BLOCKED','CANCELLED') | NOT NULL, DEFAULT 'CREATED' | Статус | — |
| `assignee_id` | INT | FK → User | Исполнитель | — |
| `reviewer_id` | INT | FK → User | Проверяющий | — [Assumption] |
| `facade_id` | INT | FK → Facade | Фасад | — |
| `floor_zone` | VARCHAR(100) | — | Этаж/зона | — |
| `planned_start` | DATE | — | План. начало | — |
| `planned_end` | DATE | — | План. окончание | — |
| `actual_start` | DATE | — | Факт. начало | — |
| `actual_end` | DATE | — | Факт. окончание | — |
| `planned_volume` | DECIMAL(14,4) | — | План. объём | — |
| `actual_volume` | DECIMAL(14,4) | DEFAULT 0 | Факт. объём | Пересчёт из DailyWorkLog |
| `completion_pct` | DECIMAL(5,2) | DEFAULT 0 | % выполнения | Пересчёт |
| `brigade` | VARCHAR(100) | — | Бригада | — [Assumption] |
| `module_plan_item_id` | INT | FK → ModulePlanItem | Связь с модулем | — |
| `priority` | ENUM('HIGH','MEDIUM','LOW') | DEFAULT 'MEDIUM' | Приоритет | — |
| `notes` | TEXT | — | Примечание | — |
| `created_by` | INT | FK → User | Создатель | — |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | — | — |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | — | — |

---

### 6.2.9 TaskDependency

| Поле | Тип | Constraints | Описание |
|------|-----|------------|----------|
| `id` | SERIAL | PK | — |
| `predecessor_id` | INT | FK → TaskInstance, NOT NULL | Предшественник |
| `successor_id` | INT | FK → TaskInstance, NOT NULL | Последователь |
| `dependency_type` | ENUM('FS','SS','FF','SF') | DEFAULT 'FS' | Тип |
| `lag_days` | INT | DEFAULT 0 | Задержка |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | — |

**UNIQUE**: (predecessor_id, successor_id)
**CHECK**: predecessor_id != successor_id

---

### 6.2.10 NotificationScenario

| Поле | Тип | Constraints | Описание | Маппинг Excel |
|------|-----|------------|----------|---------------|
| `id` | SERIAL | PK | — | `ID задачи` (Сценарии уведомлений) |
| `code` | VARCHAR(50) | UNIQUE, NOT NULL | Код сценария | `Код` |
| `task_name` | TEXT | NOT NULL | Задача/событие | `Задача` |
| `trigger_type` | ENUM('UI_ACTION','DATA_CHANGE','SCHEDULE','IMPORT') | NOT NULL | Тип триггера | `Триггер` |
| `notification_type` | VARCHAR(100) | — | Тип уведомления | `Тип уведомления` |
| `recipients_config` | JSONB | — | Конфигурация получателей (роли, условия) | `Получатели` |
| `message_template_id` | INT | FK → MessageTemplate | Шаблон сообщения | через `Текст уведомления` |
| `buttons_config` | JSONB | — | Конфигурация кнопок | `Кнопки действий` |
| `escalation_config` | JSONB | — | Правила эскалации | `Эскалация` |
| `escalation_time_minutes` | INT | — | Время до эскалации | `Время` |
| `is_active` | BOOLEAN | DEFAULT true | Активен | — |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | — | — |

---

### 6.2.11 NotificationSetting

| Поле | Тип | Constraints | Описание | Маппинг Excel |
|------|-----|------------|----------|---------------|
| `id` | SERIAL | PK | — | — |
| `parameter` | VARCHAR(100) | UNIQUE, NOT NULL | Параметр | `Параметр` |
| `value` | TEXT | NOT NULL | Значение | `Значение` |
| `description` | TEXT | — | Описание | `Описание` |
| `applies_to` | VARCHAR(100) | — | К чему применяется | `Применяется к` |
| `is_configurable` | BOOLEAN | DEFAULT true | Настраиваемый | `Настраиваемый` |
| `example` | TEXT | — | Пример | `Пример` |

---

### 6.2.12 MessageTemplate

| Поле | Тип | Constraints | Описание | Маппинг Excel |
|------|-----|------------|----------|---------------|
| `id` | SERIAL | PK | — | — |
| `message_type` | VARCHAR(100) | UNIQUE, NOT NULL | Тип сообщения | `Тип сообщения` |
| `template_text` | TEXT | NOT NULL | Шаблон с переменными | `Шаблон` |
| `variables` | JSONB | — | Список переменных | `Переменные` |
| `example_filled` | TEXT | — | Пример заполнения | `Пример заполнения` |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | — | — |

---

### 6.2.13 NotificationLog

| Поле | Тип | Constraints | Описание |
|------|-----|------------|----------|
| `id` | BIGSERIAL | PK | — |
| `scenario_id` | INT | FK → NotificationScenario | Сценарий |
| `user_id` | INT | FK → User, NOT NULL | Получатель |
| `entity_type` | VARCHAR(50) | — | Тип сущности |
| `entity_id` | INT | — | ID сущности |
| `message_text` | TEXT | NOT NULL | Отправленный текст |
| `buttons_json` | JSONB | — | Кнопки |
| `status` | ENUM('PENDING','SENT','DELIVERED','READ','FAILED') | DEFAULT 'PENDING' | Статус |
| `telegram_message_id` | BIGINT | — | ID сообщения в Telegram |
| `sent_at` | TIMESTAMPTZ | — | Время отправки |
| `delivered_at` | TIMESTAMPTZ | — | Время доставки [Assumption] |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | — |

---

### 6.2.14 User

| Поле | Тип | Constraints | Описание | Маппинг Excel |
|------|-----|------------|----------|---------------|
| `id` | SERIAL | PK | — | — |
| `telegram_id` | BIGINT | UNIQUE, NOT NULL | Telegram ID | [Assumption: ASMP-001] `telegram_id` |
| `first_name` | VARCHAR(100) | — | Имя | Из Telegram |
| `last_name` | VARCHAR(100) | — | Фамилия | Из Telegram |
| `username` | VARCHAR(100) | — | Username | Из Telegram |
| `phone` | VARCHAR(20) | — | Телефон | [Assumption] |
| `full_name` | VARCHAR(255) | — | Полное имя (для отображения) | — |
| `department_id` | INT | FK → Department | Отдел | `Отдел` (Ответственные) |
| `status` | ENUM('PENDING','ACTIVE','BLOCKED') | DEFAULT 'PENDING' | Статус | — |
| `last_login_at` | TIMESTAMPTZ | — | Последний вход | — |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | — | — |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | — | — |

---

### 6.2.15 Role

| Поле | Тип | Constraints | Описание | Маппинг Excel |
|------|-----|------------|----------|---------------|
| `id` | SERIAL | PK | — | — |
| `system_name` | VARCHAR(50) | UNIQUE, NOT NULL | Системное имя | см. раздел 4.1 |
| `display_name` | VARCHAR(100) | NOT NULL | Отображаемое имя | `Роль` (Ответственные) |
| `description` | TEXT | — | Описание | `Зона ответственности` |
| `access_level` | VARCHAR(50) | — | Уровень доступа | `Уровень доступа` |
| `receives_notifications` | TEXT | — | Какие уведомления получает | `Получает уведомления` |

---

### 6.2.16 Department

| Поле | Тип | Constraints | Описание | Маппинг Excel |
|------|-----|------------|----------|---------------|
| `id` | SERIAL | PK | — | — |
| `name` | VARCHAR(100) | UNIQUE, NOT NULL | Название | `Отдел` (Ответственные) |

---

### 6.2.17 UserRole

| Поле | Тип | Constraints | Описание |
|------|-----|------------|----------|
| `id` | SERIAL | PK | — |
| `user_id` | INT | FK → User, NOT NULL | Пользователь |
| `role_id` | INT | FK → Role, NOT NULL | Роль |
| `project_id` | INT | FK → Project, NOT NULL | Проект (scope) |
| `facade_ids` | INT[] | — | Доступные фасады (scope) |
| `assigned_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | — |
| `assigned_by` | INT | FK → User | Кто назначил |

**UNIQUE**: (user_id, role_id, project_id)

---

### 6.2.18 RbacPermission

| Поле | Тип | Constraints | Описание |
|------|-----|------------|----------|
| `id` | SERIAL | PK | — |
| `resource` | VARCHAR(50) | NOT NULL | Ресурс (task, plan_fact, module...) |
| `action` | VARCHAR(50) | NOT NULL | Действие (read, create, update...) |
| `description` | TEXT | — | Описание |

**UNIQUE**: (resource, action)

---

### 6.2.19 RolePermission

| Поле | Тип | Constraints | Описание |
|------|-----|------------|----------|
| `id` | SERIAL | PK | — |
| `role_id` | INT | FK → Role, NOT NULL | Роль |
| `permission_id` | INT | FK → RbacPermission, NOT NULL | Разрешение |

**UNIQUE**: (role_id, permission_id)

---

### 6.2.20 AuditLog

| Поле | Тип | Constraints | Описание |
|------|-----|------------|----------|
| `id` | BIGSERIAL | PK | — |
| `action` | VARCHAR(100) | NOT NULL | Действие (TASK_CREATED, STATUS_CHANGED...) |
| `entity_type` | VARCHAR(50) | NOT NULL | Тип сущности |
| `entity_id` | INT | — | ID сущности |
| `user_id` | INT | FK → User | Кто выполнил |
| `old_value` | JSONB | — | Предыдущее значение |
| `new_value` | JSONB | — | Новое значение |
| `ip_address` | INET | — | IP |
| `user_agent` | TEXT | — | User-Agent |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Время |

**Индексы**: (entity_type, entity_id), (user_id), (created_at), (action).
**Правило**: таблица immutable — только INSERT.

---

### 6.2.21 Document

| Поле | Тип | Constraints | Описание |
|------|-----|------------|----------|
| `id` | SERIAL | PK | — |
| `project_id` | INT | FK → Project, NOT NULL | Проект |
| `name` | VARCHAR(255) | NOT NULL | Имя файла |
| `type` | ENUM('PHOTO','PDF','DOCX','XLSX','DWG','OTHER') | NOT NULL | Тип |
| `url` | TEXT | NOT NULL | Путь в S3 |
| `size_bytes` | BIGINT | — | Размер |
| `version` | INT | DEFAULT 1 | Версия |
| `parent_document_id` | INT | FK → Document (self) | Предыдущая версия |
| `status` | ENUM('DRAFT','ON_REVIEW','APPROVED','ARCHIVED') | DEFAULT 'DRAFT' | Статус |
| `entity_type` | VARCHAR(50) | — | К чему привязан (TASK_INSTANCE, MODULE, PROJECT) |
| `entity_id` | INT | — | ID привязанной сущности |
| `uploaded_by` | INT | FK → User, NOT NULL | Кто загрузил |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | — |

> **[Assumption] ASMP-003**: Конкретные типы документов и их workflow не описаны в Excel-файлах. Структура `Document` сформирована на основе ТЗ.

---

### 6.2.22 ImportLog

| Поле | Тип | Constraints | Описание |
|------|-----|------------|----------|
| `id` | SERIAL | PK | — |
| `file_name` | VARCHAR(255) | NOT NULL | Имя файла |
| `file_type` | VARCHAR(50) | — | Тип (GPR, PLAN_FACT, MODULES, SUMMARY) |
| `status` | ENUM('UPLOADED','VALIDATING','VALIDATED','IMPORTING','COMPLETED','FAILED') | NOT NULL | Статус |
| `records_total` | INT | DEFAULT 0 | Всего записей |
| `records_imported` | INT | DEFAULT 0 | Импортировано |
| `records_failed` | INT | DEFAULT 0 | С ошибками |
| `errors_json` | JSONB | — | Детали ошибок |
| `warnings_json` | JSONB | — | Предупреждения |
| `uploaded_by` | INT | FK → User | Кто загрузил |
| `started_at` | TIMESTAMPTZ | — | Начало импорта |
| `completed_at` | TIMESTAMPTZ | — | Окончание |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | — |

---

### 6.2.23 ModuleSummary

| Поле | Тип | Constraints | Описание | Маппинг Excel |
|------|-----|------------|----------|---------------|
| `id` | SERIAL | PK | — | — |
| `project_id` | INT | FK → Project, NOT NULL | Проект | — |
| `name` | VARCHAR(255) | NOT NULL | Наименование | `Наименование` (модуль, Схемы со сводой) |
| `module_type` | VARCHAR(100) | — | Тип | `Тип` |
| `total_count` | INT | DEFAULT 0 | Общее кол-во | `Общее кол-во` |
| `mounted_count` | INT | DEFAULT 0 | Смонтированные | `смонтированные` |
| `missing_count` | INT | DEFAULT 0 | Отсутствуют | `отсутствуют` |
| `unit` | VARCHAR(20) | — | Ед.изм | `Ед.изм` |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | — | — |

---

### 6.2.24 AccumulativeSeries

| Поле | Тип | Constraints | Описание | Маппинг Excel |
|------|-----|------------|----------|---------------|
| `id` | BIGSERIAL | PK | — | — |
| `project_id` | INT | FK → Project, NOT NULL | Проект | — |
| `facade_id` | INT | FK → Facade | Фасад | Разрез по фасадам |
| `metric_name` | VARCHAR(100) | NOT NULL | Название метрики | Колонка "Наименование" |
| `date` | DATE | NOT NULL | Дата | Даты как колонки |
| `value` | DECIMAL(14,4) | — | Значение | Ячейка на пересечении |
| `stock_available` | DECIMAL(14,4) | — | Было в наличии | `Было в наличии` |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | — | — |

**UNIQUE**: (project_id, facade_id, metric_name, date)

---

## 6.3 ER-диаграмма (текстовая)

```
Project ──1:N──► Facade
Project ──1:N──► WorkType
Project ──1:N──► TaskTemplate
Project ──1:N──► TaskInstance
Project ──1:N──► ModulePlanItem
Project ──1:N──► Document
Project ──1:N──► ModuleSummary
Project ──1:N──► AccumulativeSeries

WorkType ──1:N──► WorkVolumeContract
WorkType ──1:1──► TaskTemplate (optional)

TaskTemplate ──1:N──► TaskInstance
TaskTemplate ──N:1──► TaskTemplate (parent, self-ref)

TaskInstance ──1:N──► DailyWorkLog
TaskInstance ──N:1──► Facade
TaskInstance ──N:1──► User (assignee)
TaskInstance ──N:1──► User (reviewer)
TaskInstance ──N:1──► ModulePlanItem (optional)
TaskInstance ──M:N──► TaskInstance (via TaskDependency)
TaskInstance ──1:N──► Document (via entity_type/entity_id)

ModulePlanItem ──N:1──► Facade

User ──M:N──► Role (via UserRole, scoped by Project)
User ──N:1──► Department
Role ──M:N──► RbacPermission (via RolePermission)

NotificationScenario ──N:1──► MessageTemplate
NotificationScenario ──1:N──► NotificationLog
NotificationLog ──N:1──► User (recipient)

WorkVolumeContract ──N:1──► Facade

AccumulativeSeries ──N:1──► Facade
```

## 6.4 Индексы (рекомендация)

| Таблица | Индекс | Тип |
|---------|--------|-----|
| DailyWorkLog | (task_instance_id, date) | UNIQUE |
| DailyWorkLog | (date) | BTREE |
| DailyWorkLog | (facade_id, date) | BTREE |
| TaskInstance | (project_id, status) | BTREE |
| TaskInstance | (assignee_id, status) | BTREE |
| TaskInstance | (planned_end) | BTREE (для поиска просроченных) |
| ModulePlanItem | (project_id, status) | BTREE |
| AuditLog | (entity_type, entity_id) | BTREE |
| AuditLog | (user_id) | BTREE |
| AuditLog | (created_at) | BTREE |
| NotificationLog | (user_id, created_at) | BTREE |
| User | (telegram_id) | UNIQUE |
