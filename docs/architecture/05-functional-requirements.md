# 5. Functional Requirements (REQ-*)

> Каждое требование содержит: Trigger, Actor, System Behavior, Data Writes, Notifications, Acceptance Criteria, Errors/Edge Cases.

---

## 5.1 Telegram Bot Requirements (REQ-BOT-*)

### REQ-BOT-001: Регистрация / первый вход пользователя

| Параметр | Значение |
|----------|----------|
| **ID** | REQ-BOT-001 |
| **Trigger** | `UI_ACTION` — пользователь отправляет `/start` боту |
| **Actor** | Любой Telegram-пользователь |
| **System Behavior** | 1. Бот получает `telegram_id`, `first_name`, `last_name`, `username` из Telegram Update. 2. Backend ищет User по `telegram_id`. 3a. Найден → приветствие + главное меню. 3b. Не найден → создаёт `User(status=PENDING)`, отправляет уведомление admin, отвечает "Ожидайте активации". |
| **Data Writes** | `User`: INSERT (telegram_id, first_name, last_name, username, status=PENDING, created_at). `AuditLog`: INSERT (action=USER_REGISTERED). |
| **Notifications** | Пользователю: "Добро пожаловать! Ваша заявка на рассмотрении." Admin: "Новый пользователь: {name} (@{username}). Назначьте роль." + кнопки [Назначить роль]. |
| **Acceptance Criteria** | AC1: При `/start` от нового пользователя создаётся запись User со status=PENDING. AC2: Admin получает уведомление в течение 5 секунд. AC3: Повторный `/start` от существующего пользователя не создаёт дубликат. |
| **Errors / Edge cases** | E1: telegram_id уже существует → показать меню, не создавать дубликат. E2: Admin не назначен → системная ошибка в логах. |

---

### REQ-BOT-002: Быстрый ввод факта (объём)

| Параметр | Значение |
|----------|----------|
| **ID** | REQ-BOT-002 |
| **Trigger** | `UI_ACTION` — пользователь нажимает inline-кнопку [Ввести факт] из уведомления или команду `/fact` |
| **Actor** | Прораб (`foreman`), Бригадир (`brigadier`) |
| **System Behavior** | 1. Бот запрашивает выбор задачи (список активных TaskInstance, назначенных на пользователя). 2. Пользователь выбирает задачу (inline keyboard). 3. Бот запрашивает числовое значение факта. 4. Пользователь вводит число (reply). 5. Backend создаёт запись DailyWorkLog. 6. Пересчитывает накопления. 7. Подтверждение пользователю. |
| **Data Writes** | `DailyWorkLog`: INSERT (task_instance_id, date=TODAY, fact_day=value, created_by). Обновление `TaskInstance.actual_volume` (пересчёт). `AuditLog`: INSERT (action=FACT_ENTERED, entity=DailyWorkLog). |
| **Notifications** | Пользователю: "Факт по задаче '{task_name}' записан: {value} {unit}. Итого: {acc_fact}/{acc_plan} ({pct}%)". При отклонении > 20% [Assumption]: уведомление site_manager. |
| **Acceptance Criteria** | AC1: Факт записывается за текущую дату. AC2: Накопительные суммы пересчитываются. AC3: Нельзя ввести факт за задачу, не назначенную на пользователя. AC4: Нельзя ввести отрицательное число. |
| **Errors / Edge cases** | E1: Ввод текста вместо числа → "Введите числовое значение". E2: Факт за сегодня уже введён → предложить обновить. E3: Нет активных задач → "У вас нет активных задач". |

---

### REQ-BOT-003: Быстрый ввод факта (фото-фиксация)

| Параметр | Значение |
|----------|----------|
| **ID** | REQ-BOT-003 |
| **Trigger** | `UI_ACTION` — пользователь отправляет фото в контексте задачи или команда `/photo` |
| **Actor** | Прораб (`foreman`), Бригадир (`brigadier`), Инспектор ОТК (`qc_inspector`) |
| **System Behavior** | 1. Бот определяет контекст (текущая задача через state machine диалога). 2. Получает фото (file_id из Telegram). 3. Скачивает файл через Bot API → загружает в S3/MinIO. 4. Создаёт запись Document(type=PHOTO, entity_type=TASK_INSTANCE, entity_id=...). 5. Подтверждение пользователю. |
| **Data Writes** | `Document`: INSERT (type=PHOTO, url=s3_path, entity_type, entity_id, uploaded_by, created_at). `AuditLog`: INSERT (action=PHOTO_UPLOADED). |
| **Notifications** | Пользователю: "Фото прикреплено к задаче '{task_name}'". |
| **Acceptance Criteria** | AC1: Фото сохраняется в S3 с уникальным именем. AC2: Запись в БД ссылается на правильную задачу. AC3: Поддерживаются JPEG и PNG. |
| **Errors / Edge cases** | E1: Файл > 20MB → "Файл слишком большой, максимум 20MB". E2: Нет контекста задачи → предложить выбрать задачу. E3: Неподдерживаемый формат → "Отправьте фото в формате JPEG или PNG". |

---

### REQ-BOT-004: Фиксация дефекта

| Параметр | Значение |
|----------|----------|
| **ID** | REQ-BOT-004 |
| **Trigger** | `UI_ACTION` — команда `/defect` или inline-кнопка [Дефект] |
| **Actor** | Прораб (`foreman`), Инспектор ОТК (`qc_inspector`), Бригадир (`brigadier`) |
| **System Behavior** | 1. Бот запрашивает: фасад/зону, описание дефекта, критичность (inline: Критический / Обычный). 2. Пользователь может прикрепить фото. 3. Backend создаёт TaskInstance (type=DEFECT, status=REPORTED). 4. Автоматическое назначение: если в зоне есть прораб → ему; иначе → site_manager. |
| **Data Writes** | `TaskInstance`: INSERT (type=DEFECT, status=REPORTED, facade_id, floor_zone, notes=description, priority). `Document`: INSERT (если фото прикреплено). `AuditLog`: INSERT (action=DEFECT_REPORTED). |
| **Notifications** | Назначенному: "Зафиксирован дефект в {facade}/{zone}: {description}. Критичность: {priority}." + кнопки [Принять] [Делегировать]. site_manager: уведомление о критическом дефекте. |
| **Acceptance Criteria** | AC1: Дефект создаётся со статусом REPORTED. AC2: Критический дефект немедленно уведомляет site_manager. AC3: AuditLog содержит запись. |
| **Errors / Edge cases** | E1: Не выбран фасад → "Выберите фасад/зону". E2: Пустое описание → "Введите описание дефекта". |

---

### REQ-BOT-005: Обработка inline-кнопок подтверждения

| Параметр | Значение |
|----------|----------|
| **ID** | REQ-BOT-005 |
| **Trigger** | `UI_ACTION` — нажатие inline-кнопки (callback_query) |
| **Actor** | Любой авторизованный пользователь (в зависимости от контекста) |
| **System Behavior** | 1. Backend получает callback_data (формат: `action:entity_type:entity_id`). 2. Проверяет RBAC: имеет ли пользователь право на действие. 3. Выполняет действие (смена статуса, назначение, эскалация). 4. Обновляет сообщение (edit inline keyboard / текст). 5. AuditLog. |
| **Data Writes** | Зависит от действия: UPDATE status в TaskInstance / DailyWorkLog / ModulePlanItem. `AuditLog`: INSERT. |
| **Notifications** | Зависит от действия. Подтверждение нажавшему. Уведомление связанным ролям. |
| **Acceptance Criteria** | AC1: Callback обработан < 3 секунд (Telegram timeout). AC2: RBAC проверен до выполнения действия. AC3: Сообщение обновлено после нажатия. AC4: Повторное нажатие → "Действие уже выполнено". |
| **Errors / Edge cases** | E1: Нет прав → "У вас нет прав для этого действия". E2: Сущность уже в финальном статусе → "Задача уже завершена". E3: Telegram callback timeout → retry с idempotency key. |

---

### REQ-BOT-006: Deep-link навигация в Mini App

| Параметр | Значение |
|----------|----------|
| **ID** | REQ-BOT-006 |
| **Trigger** | `UI_ACTION` — кнопка [Открыть в приложении] / [Подробнее] |
| **Actor** | Любой авторизованный пользователь |
| **System Behavior** | 1. Бот формирует URL Mini App с контекстом: `https://t.me/STSpheraBot/app?startapp=task_{id}` или `?startapp=plan_fact_{date}`. 2. Отправляет WebApp button. 3. Mini App парсит startapp параметр и открывает соответствующий экран. |
| **Data Writes** | Нет (навигационное действие). |
| **Notifications** | Нет. |
| **Acceptance Criteria** | AC1: Deep-link корректно открывает Mini App на нужном экране. AC2: Контекст (task_id, date) передаётся и используется. |
| **Errors / Edge cases** | E1: Mini App недоступна → fallback-сообщение "Приложение временно недоступно". |

---

## 5.2 Mini App Requirements (REQ-MINI-*)

### REQ-MINI-001: Авторизация Mini App через Telegram initData

| Параметр | Значение |
|----------|----------|
| **ID** | REQ-MINI-001 |
| **Trigger** | `UI_ACTION` — открытие Mini App |
| **Actor** | Любой Telegram-пользователь |
| **System Behavior** | 1. Mini App считывает `window.Telegram.WebApp.initData`. 2. Отправляет POST /api/auth/telegram с initData. 3. Backend валидирует HMAC-SHA256 подпись. 4. Находит/создаёт User. 5. Возвращает JWT (access + refresh). 6. Mini App сохраняет токен в memory (не localStorage). |
| **Data Writes** | `User`: UPDATE last_login. `AuditLog`: INSERT (action=MINI_APP_LOGIN). |
| **Notifications** | Нет. |
| **Acceptance Criteria** | AC1: initData с невалидной подписью → HTTP 401. AC2: JWT содержит user_id, role, permissions. AC3: Токен не хранится в localStorage (XSS-защита). |
| **Errors / Edge cases** | E1: initData отсутствует (не из Telegram) → HTTP 403. E2: User status=PENDING → показать экран ожидания. |

---

### REQ-MINI-002: Просмотр и управление ГПР (Гант)

| Параметр | Значение |
|----------|----------|
| **ID** | REQ-MINI-002 |
| **Trigger** | `UI_ACTION` — переход в раздел "ГПР" |
| **Actor** | Начальник участка (`site_manager`), Инженер ПТО (`engineer`), Прораб (`foreman`), Руководитель проекта (`project_director`) |
| **System Behavior** | 1. Загрузка TaskInstance-дерева (секции + задачи + зависимости) для текущего проекта. 2. Отображение диаграммы Ганта (горизонтальная шкала времени). 3. Цветовая индикация: зелёный — в срок, жёлтый — < 3 дней до deadline, красный — просрочен. 4. Фильтры: по фасаду, по ответственному, по статусу. 5. При наличии прав — редактирование дат (drag&drop на десктопе, форма на мобильном). |
| **Data Writes** | При редактировании: UPDATE TaskInstance (planned_start, planned_end). `AuditLog`: INSERT (action=TASK_DATE_CHANGED, old_value, new_value). |
| **Notifications** | При изменении дат: уведомление assignee через Bot. При конфликте с зависимостями: предупреждение в UI. |
| **Acceptance Criteria** | AC1: Гант отображает все задачи проекта с корректными датами. AC2: Зависимости визуализированы стрелками. AC3: Фильтры работают комбинаторно. AC4: Изменение дат проверяет DAG-ограничения. |
| **Errors / Edge cases** | E1: > 500 задач — пагинация/виртуализация. E2: Циклическая зависимость при редактировании → ошибка. E3: Read-only для ролей без permission `gpr.update`. |

---

### REQ-MINI-003: Канбан-доска задач

| Параметр | Значение |
|----------|----------|
| **ID** | REQ-MINI-003 |
| **Trigger** | `UI_ACTION` — переход в раздел "Задачи" |
| **Actor** | Прораб (`foreman`), Начальник участка (`site_manager`), Бригадир (`brigadier`), Инженер (`engineer`) |
| **System Behavior** | 1. Загрузка TaskInstance по статусам (колонки: CREATED, ASSIGNED, IN_PROGRESS, DONE, VERIFIED). 2. Фильтры: мои задачи / все / по фасаду / по типу. 3. Drag-and-drop между колонками (= смена статуса). 4. Карточка задачи: название, assignee, deadline, % выполнения, приоритет (цвет). 5. Клик по карточке → детальный вид. |
| **Data Writes** | При перетаскивании: UPDATE TaskInstance.status. `AuditLog`: INSERT (action=TASK_STATUS_CHANGED). |
| **Notifications** | При смене статуса → уведомления по правилам WF-02 (через Bot). |
| **Acceptance Criteria** | AC1: Колонки соответствуют статусам WF-02. AC2: Drag-and-drop соблюдает Guards (см. раздел 2.5). AC3: brigadier видит только свои задачи. |
| **Errors / Edge cases** | E1: Попытка перетащить в запрещённый статус → тост "Переход невозможен: {причина}". E2: Нет задач → "Нет задач по выбранным фильтрам". |

---

### REQ-MINI-004: Табличный ввод план-факт

| Параметр | Значение |
|----------|----------|
| **ID** | REQ-MINI-004 |
| **Trigger** | `UI_ACTION` — переход в раздел "План-Факт" |
| **Actor** | Прораб (`foreman`), Бригадир (`brigadier`), Начальник участка (`site_manager`) |
| **System Behavior** | 1. Загрузка таблицы DailyWorkLog за выбранную дату (по умолчанию — сегодня). 2. Колонки: Код, Наименование, Ед.изм, Фасад, Этаж/Зона, План на день, Факт на день, Отклонение (авторасчёт), % дня (авторасчёт), Накопл. план, Накопл. факт, Бригада, Примечание. 3. Inline-редактирование ячеек: Факт, Бригада, Примечание. 4. Автосохранение при потере фокуса ячейки (debounce 500ms). 5. Кнопка [Отправить на проверку] → статус = REVIEW. |
| **Data Writes** | `DailyWorkLog`: INSERT/UPDATE (fact_day, brigade, notes). Пересчёт: deviation, pct_day, acc_plan, acc_fact. `AuditLog`: INSERT (action=PLAN_FACT_UPDATED). |
| **Notifications** | При [Отправить на проверку]: site_manager получает уведомление через Bot. |
| **Acceptance Criteria** | AC1: Таблица загружает данные за выбранную дату. AC2: deviation = fact_day - plan_day (автоматически). AC3: % дня = fact_day / plan_day * 100 (если plan_day > 0). AC4: Накопления пересчитываются. AC5: Данные сохраняются при потере фокуса. |
| **Errors / Edge cases** | E1: plan_day = 0 → % дня = "—" (не делить на ноль). E2: Offline-ввод [Assumption: MVP не поддерживает offline, показать предупреждение]. E3: Одновременный ввод двумя пользователями → optimistic locking (updated_at). |

---

### REQ-MINI-005: План модулей (статусы, производство → монтаж)

| Параметр | Значение |
|----------|----------|
| **ID** | REQ-MINI-005 |
| **Trigger** | `UI_ACTION` — переход в раздел "Модули" |
| **Actor** | Менеджер производства (`production_manager`), Менеджер логистики (`logistics_manager`), Начальник участка (`site_manager`), Прораб (`foreman`) |
| **System Behavior** | 1. Таблица/канбан ModulePlanItem: ID, Этап, Тип модуля, Код, Размер, Кол-во, Оси/Фасад, Этажи, Даты (производство/отгрузка/монтаж), Статус. 2. Фильтры: по этапу, по фасаду, по статусу. 3. Смена статуса через кнопки или drag-and-drop (с Guards из WF-03). 4. Связь с СМР: ссылка на связанный TaskInstance. |
| **Data Writes** | `ModulePlanItem`: UPDATE status, actual dates. `AuditLog`: INSERT (action=MODULE_STATUS_CHANGED). |
| **Notifications** | При смене статуса → уведомления по WF-03 (через Bot): следующему ответственному в цепочке. |
| **Acceptance Criteria** | AC1: Все модули из плана отображаются. AC2: Статусы соответствуют WF-03. AC3: Связь с СМР кликабельна. |
| **Errors / Edge cases** | E1: Модуль без связи СМР → показывать "—". E2: Попытка перескочить статус → "Нельзя пропустить этап {stage}". |

---

### REQ-MINI-006: Сводки и аналитика (дашборд)

| Параметр | Значение |
|----------|----------|
| **ID** | REQ-MINI-006 |
| **Trigger** | `UI_ACTION` — переход в раздел "Аналитика" |
| **Actor** | Руководитель проекта (`project_director`), Начальник участка (`site_manager`), Инженер (`engineer`) |
| **System Behavior** | 1. Сводка по фасадам: таблица (Фасад, Площадь, Кол-во модулей, Этажи, Оси, Приоритет, Сроки). Источник: лист "Сводка по фасадам". 2. Накопительный график план vs факт (time-series). Источник: DailyWorkLog (агрегация). 3. Прогресс по СМР: % выполнения по типам работ. 4. Статус модулей: круговая диаграмма по статусам. 5. Просроченные задачи: список с группировкой по ответственным. |
| **Data Writes** | Нет (read-only). `AuditLog`: INSERT (action=ANALYTICS_VIEWED) [Assumption: опционально]. |
| **Notifications** | Нет. |
| **Acceptance Criteria** | AC1: Данные дашборда обновляются при каждом открытии (или кэш < 5 мин). AC2: Графики отзывчивы (responsive). AC3: Фильтр по дате/фасаду. |
| **Errors / Edge cases** | E1: Нет данных → "Нет данных для отображения. Импортируйте данные." |

---

### REQ-MINI-007: Управление документами

| Параметр | Значение |
|----------|----------|
| **ID** | REQ-MINI-007 |
| **Trigger** | `UI_ACTION` — переход в раздел "Документы" |
| **Actor** | Инженер (`engineer`), Начальник участка (`site_manager`), Прораб (`foreman`) |
| **System Behavior** | 1. Список документов с фильтрами: тип, статус, привязка (к задаче/модулю/проекту). 2. Загрузка документа: файл + метаданные (тип, описание, привязка). 3. Версионность: при повторной загрузке для того же документа — создаётся новая версия. 4. Workflow: DRAFT → ON_REVIEW → APPROVED → ARCHIVED (WF-07). |
| **Data Writes** | `Document`: INSERT (name, type, url, version, status=DRAFT, entity_type, entity_id, uploaded_by). `AuditLog`: INSERT (action=DOCUMENT_UPLOADED). |
| **Notifications** | При отправке на ревью: рецензенту через Bot. При утверждении: автору через Bot. |
| **Acceptance Criteria** | AC1: Файлы до 50MB [Assumption]. AC2: Поддержка PDF, DOCX, XLSX, DWG, JPG, PNG. AC3: Версии отображаются хронологически. |
| **Errors / Edge cases** | E1: Неподдерживаемый формат → "Формат не поддерживается". E2: Превышен размер → ошибка. |

---

## 5.3 Backend Requirements (REQ-BE-*)

### REQ-BE-001: REST API для Mini App

| Параметр | Значение |
|----------|----------|
| **ID** | REQ-BE-001 |
| **Trigger** | `UI_ACTION` — любой HTTP-запрос от Mini App |
| **Actor** | Mini App (от имени авторизованного пользователя) |
| **System Behavior** | 1. Все endpoint-ы под `/api/v1/`. 2. JWT-аутентификация (Bearer token). 3. RBAC middleware проверяет permissions. 4. Стандартный формат ответа: `{data, meta, errors}`. 5. Pagination: `?page=1&limit=50`. 6. Фильтрация: `?filter[status]=IN_PROGRESS&filter[facade_id]=5`. |
| **Data Writes** | Зависит от endpoint. |
| **Notifications** | Нет (API — транспортный слой). |
| **Acceptance Criteria** | AC1: Все мутации защищены RBAC. AC2: Все мутации записываются в AuditLog. AC3: API отвечает < 500ms (p95). AC4: OpenAPI/Swagger документация. |
| **Errors / Edge cases** | E1: 401 — невалидный/просроченный токен. E2: 403 — нет прав. E3: 422 — ошибки валидации. E4: 500 — внутренняя ошибка (логирование). |

---

### REQ-BE-002: ETL-импорт Excel

| Параметр | Значение |
|----------|----------|
| **ID** | REQ-BE-002 |
| **Trigger** | `IMPORT` — загрузка Excel-файла через Mini App или Bot |
| **Actor** | Администратор (`admin`), Начальник участка (`site_manager`), Инженер (`engineer`) |
| **System Behavior** | 1. Файл загружается в S3/временное хранилище. 2. Определение типа файла (ГПР, план-факт, модули, сводки) по структуре листов. 3. Валидация: проверка обязательных колонок, типов данных, ссылочной целостности. 4. Маппинг колонок → сущности БД (см. раздел 4 спецификации). 5. Импорт: bulk INSERT/UPSERT в транзакции. 6. Лог результатов: количество записей, предупреждения, ошибки. |
| **Data Writes** | В зависимости от типа: `TaskTemplate`, `DailyWorkLog`, `ModulePlanItem`, `WorkVolumeContract` и др. `ImportLog`: INSERT (file_name, type, status, records_total, records_imported, records_failed, errors_json). `AuditLog`: INSERT (action=IMPORT_COMPLETED). |
| **Notifications** | Загрузившему: "Импорт завершён: {imported}/{total} записей. {warnings} предупреждений." При критической ошибке: admin. |
| **Acceptance Criteria** | AC1: Распознаются все 4 типа файлов (ГПР, план-факт, модули, сводки). AC2: section_header и phase_header распознаются. AC3: Ошибочные строки не блокируют импорт остальных (partial import). AC4: Результат доступен в логе. |
| **Errors / Edge cases** | E1: Нераспознанный формат → "Не удалось определить тип файла". E2: Нет обязательных колонок → "Отсутствуют колонки: {list}". E3: Дубликаты кодов → UPSERT (обновление существующих). E4: Файл > 10MB → отправить в фоновую очередь (BullMQ). |

---

### REQ-BE-003: Пересчёт накоплений (Plan/Fact)

| Параметр | Значение |
|----------|----------|
| **ID** | REQ-BE-003 |
| **Trigger** | `DATA_CHANGE` — создание/обновление DailyWorkLog |
| **Actor** | Система (автоматически) |
| **System Behavior** | 1. При INSERT/UPDATE DailyWorkLog: пересчитать для данного task_instance_id и date: `deviation = fact_day - plan_day`, `pct_day = fact_day / plan_day * 100` (если plan_day > 0, иначе NULL), `acc_plan = SUM(plan_day) WHERE date <= current_date`, `acc_fact = SUM(fact_day) WHERE date <= current_date`. 2. Обновить TaskInstance.actual_volume = SUM(fact_day). 3. Обновить TaskInstance.completion_pct = actual_volume / planned_volume * 100. |
| **Data Writes** | `DailyWorkLog`: UPDATE (deviation, pct_day, acc_plan, acc_fact). `TaskInstance`: UPDATE (actual_volume, completion_pct). |
| **Notifications** | Нет (внутренний расчёт). Триггер для проверки отклонений (связь с REQ-NOTIF-*). |
| **Acceptance Criteria** | AC1: Формулы соответствуют разделу 6 спецификации. AC2: Пересчёт < 1 секунды. AC3: При plan_day = 0 → pct_day = NULL. |
| **Errors / Edge cases** | E1: Отрицательный fact_day → ошибка валидации (reject). E2: Нет plan_day → создать запись с plan_day = 0, отметить предупреждение. |

---

### REQ-BE-004: Cron-джобы (дедлайны, отчёты)

| Параметр | Значение |
|----------|----------|
| **ID** | REQ-BE-004 |
| **Trigger** | `SCHEDULE` — по расписанию |
| **Actor** | Система (автоматически) |
| **System Behavior** | Набор scheduled jobs: 1. **08:00** — Напоминание о вводе плана на день (прорабам с активными задачами). 2. **19:00** [Assumption] — Проверка ввода факта. Нет факта → напоминание прорабу. 3. **21:00** [Assumption] — Эскалация: нет факта → site_manager. 4. **07:00** — Проверка просроченных задач. Для каждой: уведомление по правилам WF-02. 5. **23:00** — Генерация ежедневной сводки для project_director и site_manager. 6. **Каждые 6 часов** — Проверка модулей: просрочка отгрузки/монтажа. |
| **Data Writes** | `NotificationLog`: INSERT для каждого отправленного уведомления. `AuditLog`: INSERT (action=CRON_JOB_EXECUTED, details). |
| **Notifications** | См. конкретные сценарии в разделе 7 (Notifications & Escalations). |
| **Acceptance Criteria** | AC1: Jobs выполняются в указанное время (±1 мин). AC2: Повторный запуск не дублирует уведомления (idempotency). AC3: Ошибка одного job не блокирует остальные. |
| **Errors / Edge cases** | E1: Job упал → retry 3 раза с backoff; если всё ещё ошибка → alert admin. E2: Нет данных для сводки → "Нет данных за {date}". |

---

### REQ-BE-005: DAG-валидация зависимостей

| Параметр | Значение |
|----------|----------|
| **ID** | REQ-BE-005 |
| **Trigger** | `DATA_CHANGE` — создание/изменение TaskDependency |
| **Actor** | Система (при вызове из API) |
| **System Behavior** | 1. При добавлении зависимости: выполнить DFS/BFS из successor, проверить достижимость predecessor → цикл. 2. При обнаружении цикла → отклонить с ошибкой. 3. При успешном добавлении → проверить конфликты дат (predecessor.planned_end > successor.planned_start + lag). 4. При конфликте → предупреждение (не блокировка). |
| **Data Writes** | `TaskDependency`: INSERT/UPDATE. `AuditLog`: INSERT (action=DEPENDENCY_CREATED/UPDATED). |
| **Notifications** | При конфликте дат: уведомление assignee successor через Bot. |
| **Acceptance Criteria** | AC1: Циклическая зависимость невозможна (гарантия системы). AC2: Конфликт дат определяется и сообщается. |
| **Errors / Edge cases** | E1: Зависимость на саму себя → "Задача не может зависеть от себя". E2: Зависимость уже существует → "Зависимость уже создана". |

---

## 5.4 Notification Requirements (REQ-NOTIF-*)

### REQ-NOTIF-001: Push-уведомление о назначении задачи

| Параметр | Значение |
|----------|----------|
| **ID** | REQ-NOTIF-001 |
| **Trigger** | `DATA_CHANGE` — TaskInstance.assignee_id изменён (не NULL) |
| **Actor** | Система |
| **System Behavior** | 1. Найти User по assignee_id → telegram_id. 2. Сформировать сообщение по шаблону. 3. Отправить через Bot API с inline-кнопками [Принять] [Подробнее]. |
| **Data Writes** | `NotificationLog`: INSERT (user_id, scenario=TASK_ASSIGNED, entity_id, sent_at). `AuditLog`: INSERT (action=NOTIFICATION_SENT). |
| **Notifications** | Шаблон: "Вам назначена задача:\n{task_name}\nФасад: {facade}\nСрок: {deadline}\nПриоритет: {priority}" + кнопки [Принять] [Подробнее → Mini App]. |
| **Acceptance Criteria** | AC1: Уведомление отправлено < 5 секунд после назначения. AC2: Кнопка [Принять] меняет статус на IN_PROGRESS. AC3: Кнопка [Подробнее] открывает Mini App с контекстом задачи. |
| **Errors / Edge cases** | E1: telegram_id отсутствует → лог ошибки, пропустить. E2: Telegram API недоступен → retry 3x с backoff. |

---

### REQ-NOTIF-002: Напоминание о просроченной задаче

| Параметр | Значение |
|----------|----------|
| **ID** | REQ-NOTIF-002 |
| **Trigger** | `SCHEDULE` — ежедневная проверка (07:00) |
| **Actor** | Система |
| **System Behavior** | 1. Найти TaskInstance WHERE planned_end < TODAY AND status NOT IN (DONE, VERIFIED, CANCELLED). 2. Для каждой: определить уровень эскалации (1 день → assignee+foreman, 3 дня → site_manager, 7 дней → project_director). 3. Отправить уведомления. |
| **Data Writes** | `NotificationLog`: INSERT. |
| **Notifications** | Шаблон: "Задача просрочена на {days} дн.:\n{task_name}\nОтветственный: {assignee}\nДедлайн: {deadline}" + кнопки [Обновить статус] [Перенести срок]. |
| **Acceptance Criteria** | AC1: Все просроченные задачи обнаружены. AC2: Уровень эскалации корректен. AC3: Не дублируются (idempotency по дате). |
| **Errors / Edge cases** | E1: Задача без assignee → уведомление создателю + site_manager. |

---

### REQ-NOTIF-003: Эскалация при отсутствии факта

| Параметр | Значение |
|----------|----------|
| **ID** | REQ-NOTIF-003 |
| **Trigger** | `SCHEDULE` — 19:00 (напоминание), 21:00 (эскалация) [Assumption] |
| **Actor** | Система |
| **System Behavior** | 1. Найти TaskInstance в статусе IN_PROGRESS, у которых за сегодня нет DailyWorkLog с fact_day > 0. 2. 19:00 → уведомление assignee. 3. 21:00 → если факт так и не введён → уведомление site_manager (эскалация). |
| **Data Writes** | `NotificationLog`: INSERT. |
| **Notifications** | 19:00 шаблон: "Факт за {date} не введён по задаче {task_name}. Пожалуйста, внесите данные." + [Ввести факт]. 21:00 шаблон: "ЭСКАЛАЦИЯ: {foreman_name} не внёс факт за {date} по задаче {task_name}." |
| **Acceptance Criteria** | AC1: Напоминание только для задач в IN_PROGRESS с plan_day > 0. AC2: Эскалация только если после напоминания факт не был введён. |
| **Errors / Edge cases** | E1: Выходные/праздники [Assumption: не проверяются в MVP, все дни рабочие]. |

---

### REQ-NOTIF-004: Ежедневная сводка руководству

| Параметр | Значение |
|----------|----------|
| **ID** | REQ-NOTIF-004 |
| **Trigger** | `SCHEDULE` — 23:00 |
| **Actor** | Система |
| **System Behavior** | 1. Агрегировать данные за день: прогресс по фасадам, просроченные задачи, ключевые отклонения. 2. Сформировать сводное сообщение. 3. Отправить project_director и site_manager. |
| **Data Writes** | `NotificationLog`: INSERT. |
| **Notifications** | Шаблон: "Сводка за {date}:\nОбщий прогресс: {pct}%\nВыполнено задач: {done_count}/{total_count}\nПросрочено: {overdue_count}\nКритические отклонения: {critical_list}" + [Открыть дашборд]. |
| **Acceptance Criteria** | AC1: Сводка отправляется ежедневно. AC2: Данные актуальны на момент формирования. |
| **Errors / Edge cases** | E1: Нет данных за день → "За {date} данные не вводились." |

---

### REQ-NOTIF-005: Уведомление о смене статуса модуля

| Параметр | Значение |
|----------|----------|
| **ID** | REQ-NOTIF-005 |
| **Trigger** | `DATA_CHANGE` — ModulePlanItem.status изменён |
| **Actor** | Система |
| **System Behavior** | 1. Определить следующего ответственного в цепочке WF-03. 2. Сформировать уведомление о смене статуса. 3. Отправить через Bot. |
| **Data Writes** | `NotificationLog`: INSERT. |
| **Notifications** | Шаблон: "Модуль {code} ({type}) перешёл в статус: {new_status}\nФасад: {facade}\nОтветственный: {next_responsible}" + кнопки [Принять] [Подробнее]. |
| **Acceptance Criteria** | AC1: Уведомление < 5 секунд. AC2: Правильный получатель по цепочке WF-03. |
| **Errors / Edge cases** | E1: Нет ответственного на следующем этапе → уведомление site_manager. |

---

## 5.5 Security Requirements (REQ-SEC-*)

### REQ-SEC-001: Аутентификация через Telegram

| Параметр | Значение |
|----------|----------|
| **ID** | REQ-SEC-001 |
| **Trigger** | `UI_ACTION` — любой входящий запрос |
| **Actor** | Система |
| **System Behavior** | 1. Bot: идентификация по telegram_id из Update. 2. Mini App: валидация initData (HMAC-SHA256). 3. API: JWT Bearer token. 4. Отсутствие/невалидность → HTTP 401. |
| **Data Writes** | `AuditLog`: INSERT (action=AUTH_SUCCESS/AUTH_FAILURE). |
| **Notifications** | 5+ неудачных попыток с одного telegram_id за 10 мин → alert admin [Assumption]. |
| **Acceptance Criteria** | AC1: Невозможен доступ без Telegram аутентификации. AC2: JWT имеет expiration. AC3: Refresh token ротируется при использовании. |
| **Errors / Edge cases** | E1: Подмена initData → 401. E2: Просроченный JWT → 401 + refresh flow. |

---

### REQ-SEC-002: RBAC enforcement

| Параметр | Значение |
|----------|----------|
| **ID** | REQ-SEC-002 |
| **Trigger** | `UI_ACTION` — любой API-запрос с мутацией |
| **Actor** | Система |
| **System Behavior** | 1. Middleware извлекает role + permissions из JWT. 2. Проверяет `permission` для запрашиваемого ресурса + действия. 3. Проверяет scope (project_id, facade_ids). 4. Отказ → HTTP 403 + AuditLog. |
| **Data Writes** | `AuditLog`: INSERT (action=ACCESS_DENIED, если отказ). |
| **Notifications** | Нет. |
| **Acceptance Criteria** | AC1: Все endpoint-ы защищены RBAC. AC2: Data-level scope filtering применяется. AC3: Нет bypass (кроме admin). |
| **Errors / Edge cases** | E1: Роль не найдена → 403. E2: Scope пуст → доступ только к своим данным. |

---

## 5.6 AuditLog Requirements (REQ-AUD-*)

### REQ-AUD-001: Запись всех мутаций

| Параметр | Значение |
|----------|----------|
| **ID** | REQ-AUD-001 |
| **Trigger** | `DATA_CHANGE` — любая INSERT/UPDATE/DELETE в бизнес-сущностях |
| **Actor** | Система (middleware) |
| **System Behavior** | 1. Перехват мутации. 2. Записать: action, entity_type, entity_id, user_id, old_value (JSON), new_value (JSON), ip, user_agent, timestamp. 3. Запись асинхронная (не блокирует основную операцию). |
| **Data Writes** | `AuditLog`: INSERT (action, entity_type, entity_id, user_id, old_value, new_value, created_at). |
| **Notifications** | Нет. |
| **Acceptance Criteria** | AC1: Каждая мутация имеет запись в AuditLog. AC2: old_value и new_value сохраняются корректно. AC3: AuditLog immutable (no UPDATE/DELETE). AC4: Не влияет на latency основных операций. |
| **Errors / Edge cases** | E1: Ошибка записи в AuditLog → лог ошибки (не блокировать основную операцию). E2: Большой payload → усечение до 10KB [Assumption]. |
