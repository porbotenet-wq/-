# 4. Role & Permission Matrix (RBAC)

## 4.1 Роли (из Excel "Ответственные" + ТЗ)

Роли извлечены из листа **Ответственные** (`СИТИ_4_ПОЛНАЯ_ЭКОСИСТЕМА.xlsx`) и ТЗ. Где данные отсутствуют — помечено `[Assumption]`.

| # | Роль (system_name) | Название (RU) | Отдел | Зона ответственности | Уровень доступа | Получает уведомления |
|---|-------------------|---------------|-------|---------------------|----------------|---------------------|
| R-01 | `project_director` | Руководитель проекта | Управление проектом | Весь проект, стратегические решения, эскалации | Full | Эскалации, сводки, критические отклонения |
| R-02 | `site_manager` | Начальник участка | Производство | Участок / набор фасадов, контроль прорабов | Write + Approve | Эскалации от прорабов, ежедневные сводки, просрочки |
| R-03 | `foreman` | Прораб | Производство | Фасад / зона, управление бригадами, ежедневный план-факт | Write | Задачи, план-факт, дефекты, напоминания |
| R-04 | `brigadier` | Бригадир | Производство | Бригада, ввод факта, фото-фиксация | Write (limited) | Назначенные задачи, напоминания |
| R-05 | `qc_inspector` | Инспектор ОТК | Контроль качества | Приёмка работ, проверка модулей, дефекты | Write + Verify | Задачи на проверку, дефекты |
| R-06 | `logistics_manager` | Менеджер логистики | Логистика | Отгрузка / доставка модулей | Write (modules) | Статусы модулей, отгрузки |
| R-07 | `production_manager` | Менеджер производства | Производство модулей | Производство модулей, план производства | Write (modules) | План производства, отклонения |
| R-08 | `engineer` | Инженер ПТО | ПТО | Документация, ГПР, объёмы | Write + Docs | Документы на согласование, изменения ГПР |
| R-09 | `admin` | Администратор системы | IT | Настройки, пользователи, импорт, RBAC | Full | Системные ошибки, импорт |
| R-10 | `viewer` | Наблюдатель | Разные | Только просмотр дашбордов и сводок | Read-only | Сводки (по подписке) [Assumption] |

> **[Assumption] ASMP-001**: Конкретные ФИО и Telegram ID ответственных не специфицированы в доступных данных. Система должна предусматривать поле `telegram_id` в таблице `User` и маппинг при первом входе пользователя через Bot.

## 4.2 Разрешения (Permissions)

### Ресурсы и действия

| Ресурс | Действия | Описание |
|--------|----------|----------|
| `project` | `read`, `write`, `delete`, `manage` | Управление проектом |
| `task` | `read`, `create`, `update`, `assign`, `verify`, `delete` | Задачи (TaskInstance) |
| `plan_fact` | `read`, `create`, `update`, `approve` | Ежедневный план-факт |
| `module` | `read`, `create`, `update`, `status_change` | Модули (ModulePlanItem) |
| `gpr` | `read`, `create`, `update`, `approve` | График производства работ |
| `defect` | `read`, `report`, `assign`, `fix`, `verify` | Дефекты |
| `document` | `read`, `upload`, `review`, `approve` | Документы |
| `analytics` | `read`, `export` | Сводки и аналитика |
| `notification_settings` | `read`, `update` | Настройки уведомлений |
| `user_management` | `read`, `create`, `update`, `delete`, `assign_role` | Управление пользователями |
| `import` | `upload`, `execute`, `view_log` | Импорт Excel |
| `audit_log` | `read` | Просмотр аудит-лога |

## 4.3 Матрица Роль × Разрешение

Обозначения: **C** = Create, **R** = Read, **U** = Update, **D** = Delete, **A** = Approve/Verify, **X** = Execute, **—** = нет доступа.

| Ресурс / Действие | project_director | site_manager | foreman | brigadier | qc_inspector | logistics_manager | production_manager | engineer | admin | viewer |
|-------------------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **project.read** | R | R | R | R | R | R | R | R | R | R |
| **project.write** | CU | — | — | — | — | — | — | — | CU | — |
| **project.manage** | X | — | — | — | — | — | — | — | X | — |
| **task.read** | R | R | R | R (own) | R | R (modules) | R (modules) | R | R | R |
| **task.create** | C | C | C | — | — | — | — | C | C | — |
| **task.update** | U | U | U | U (own) | — | — | — | U | U | — |
| **task.assign** | X | X | X | — | — | — | — | — | X | — |
| **task.verify** | A | A | — | — | A | — | — | — | A | — |
| **task.delete** | D | — | — | — | — | — | — | — | D | — |
| **plan_fact.read** | R | R | R | R (own) | R | — | — | R | R | R |
| **plan_fact.create** | — | C | C | C | — | — | — | — | C | — |
| **plan_fact.update** | — | U | U | U (own) | — | — | — | — | U | — |
| **plan_fact.approve** | A | A | — | — | — | — | — | — | A | — |
| **module.read** | R | R | R | R | R | R | R | R | R | R |
| **module.create** | C | — | — | — | — | — | C | C | C | — |
| **module.update** | U | U | — | — | — | U | U | U | U | — |
| **module.status_change** | X | X | — | — | X | X | X | — | X | — |
| **gpr.read** | R | R | R | R | R | — | — | R | R | R |
| **gpr.create** | C | C | — | — | — | — | — | C | C | — |
| **gpr.update** | U | U | — | — | — | — | — | U | U | — |
| **gpr.approve** | A | — | — | — | — | — | — | — | A | — |
| **defect.read** | R | R | R | R | R | — | — | R | R | R |
| **defect.report** | C | C | C | C | C | — | — | C | C | — |
| **defect.assign** | X | X | — | — | X | — | — | — | X | — |
| **defect.verify** | — | A | — | — | A | — | — | — | A | — |
| **document.read** | R | R | R | R | R | R | R | R | R | R |
| **document.upload** | C | C | C | — | C | — | — | C | C | — |
| **document.approve** | A | A | — | — | — | — | — | — | A | — |
| **analytics.read** | R | R | R | — | R | R | R | R | R | R |
| **analytics.export** | X | X | — | — | — | — | — | X | X | — |
| **notification_settings.read** | R | R | R | R | R | R | R | R | R | — |
| **notification_settings.update** | — | — | — | — | — | — | — | — | U | — |
| **user_management** | — | — | — | — | — | — | — | — | CRUD+X | — |
| **import.upload** | X | X | — | — | — | — | — | X | X | — |
| **import.execute** | — | — | — | — | — | — | — | — | X | — |
| **audit_log.read** | R | R | — | — | — | — | — | — | R | — |

## 4.4 Scope-ограничения (Data-level RBAC)

Помимо ресурсных разрешений, действует ограничение по данным:

| Роль | Scope данных |
|------|-------------|
| `project_director` | Все данные проекта |
| `site_manager` | Данные своего участка (набор фасадов) |
| `foreman` | Данные своего фасада / зоны |
| `brigadier` | Только свои задачи и записи |
| `qc_inspector` | Все данные для проверки в рамках проекта |
| `logistics_manager` | Модули + логистика |
| `production_manager` | Модули + производство |
| `engineer` | ГПР + документы + объёмы |
| `admin` | Все данные (системный) |
| `viewer` | Только чтение, scope настраивается [Assumption] |

> **[Assumption] ASMP-002**: Точная гранулярность scope (по фасаду, по участку) не специфицирована. Для MVP: scope = `project_id` + `facade_ids[]`. Более детальная фильтрация — post-MVP.

## 4.5 Аутентификация и авторизация

### Поток аутентификации

```
1. Пользователь запускает Telegram Bot → /start
2. Bot получает telegram_id из Update.message.from.id
3. Backend ищет User по telegram_id:
   a. Найден → возвращает JWT-токен с ролью и scope
   b. Не найден → создаёт User (status=PENDING), уведомляет admin для назначения роли
4. Для Mini App: initData из Telegram Web Apps SDK → валидация подписи → JWT
5. JWT содержит: user_id, role, project_id, facade_ids[], permissions[]
6. Каждый API-запрос проверяется через RBAC middleware
```

### Технические детали

| Аспект | Решение |
|--------|---------|
| Token | JWT (access 15 min + refresh 7 days) [Assumption] |
| Хранение ролей | БД: таблица `UserRole` (user_id, role_id, project_id, facade_ids) |
| Permission resolution | Role → Permissions (из таблицы `RbacPermission`) + scope filtering |
| TG initData validation | HMAC-SHA256 по bot token (стандарт Telegram) |
| Superadmin | Роль `admin` с bypass scope [Assumption] |
