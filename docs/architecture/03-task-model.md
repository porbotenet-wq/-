# 3. Task Model (Templates → Instances)

## 3.1 Концепция Template → Instance

Система использует двухуровневую модель задач:

- **TaskTemplate** — эталонный справочник работ (из ГПР, из Excel). Описывает "что делать", длительности, зависимости.
- **TaskInstance** — конкретный экземпляр задачи в рамках проекта с реальными датами, назначениями, статусами.

```
┌────────────────────┐          1:N           ┌─────────────────────┐
│   TaskTemplate     │ ◄────────────────────► │   TaskInstance      │
│                    │   "порождает при"       │                     │
│ - code             │   "создании проекта"    │ - template_id (FK)  │
│ - name             │                         │ - project_id (FK)   │
│ - work_type_id     │                         │ - assignee_id (FK)  │
│ - unit             │                         │ - status            │
│ - duration_days    │                         │ - planned_start     │
│ - section_header   │                         │ - planned_end       │
│ - sort_order       │                         │ - actual_start      │
│                    │                         │ - actual_end        │
└────────────────────┘                         │ - facade_id (FK)    │
                                               │ - floor/zone        │
                                               └─────────────────────┘
```

## 3.2 Таблица — TaskTemplate (поля и маппинг на Excel)

| Поле | Тип | Источник Excel | Описание |
|------|-----|---------------|----------|
| `id` | UUID / SERIAL | — | PK |
| `code` | VARCHAR(50) | `Код работы` (СИТИ_4: СМР, План модулей) / `№` (ГПР) | Уникальный код работы |
| `name` | TEXT | `Наименование работ` (все файлы) | Название работы |
| `work_type_id` | FK → WorkType | Связь по `Код работы` | Тип СМР |
| `unit` | VARCHAR(20) | `Ед.изм` / `Ед.изм.` | Единица измерения |
| `duration_days` | INTEGER | Расчёт: `окончание - начало` (ГПР) | Плановая длительность |
| `is_section_header` | BOOLEAN | Определяется при парсинге (групповые строки ГПР, этапные заголовки) | Является ли заголовком секции |
| `section_name` | TEXT | Текст заголовка (если `is_section_header = true`) | Название раздела/этапа |
| `sort_order` | INTEGER | Порядковый номер в исходном файле | Порядок отображения |
| `default_responsible_role` | VARCHAR | `ответственный` (ГПР) | Роль по умолчанию [Assumption: маппинг текста → role_id] |
| `phase` | VARCHAR(50) | `Этап` (СМР) / заголовок этапа (План запуска) | Фаза/этап проекта |
| `priority` | ENUM | `Приоритет` (СМР) | HIGH / MEDIUM / LOW |
| `notes` | TEXT | `примечание` | Примечания |
| `created_at` | TIMESTAMP | — | Дата создания записи |

## 3.3 Таблица — TaskInstance (поля и маппинг)

| Поле | Тип | Источник | Описание |
|------|-----|----------|----------|
| `id` | UUID / SERIAL | — | PK |
| `template_id` | FK → TaskTemplate | Связь с шаблоном | Ссылка на шаблон |
| `project_id` | FK → Project | — | Проект |
| `status` | ENUM | — | `CREATED`, `ASSIGNED`, `IN_PROGRESS`, `DONE`, `VERIFIED`, `BLOCKED`, `CANCELLED` |
| `assignee_id` | FK → User | — | Исполнитель |
| `reviewer_id` | FK → User | — | Проверяющий [Assumption] |
| `facade_id` | FK → Facade | `Фасад/Зона` (СМР), `Оси/Фасад` (План модулей) | Фасад/зона |
| `floor_zone` | VARCHAR(100) | `Этаж/Зона` (Ежедневный план-факт) | Этаж или зона |
| `planned_start` | DATE | `начало` (ГПР), `Дата производства` / `Дата монтажа` (модули) | Плановая дата начала |
| `planned_end` | DATE | `окончание` (ГПР), вычислена из duration | Плановая дата окончания |
| `actual_start` | DATE | — (вводится при переходе в IN_PROGRESS) | Фактическая дата начала |
| `actual_end` | DATE | — (вводится при переходе в DONE) | Фактическая дата окончания |
| `planned_volume` | DECIMAL | `Объем по договору` (СМР) / `Кол-во` (модули) | Плановый объём |
| `actual_volume` | DECIMAL | Сумма из DailyWorkLog | Фактический объём |
| `completion_pct` | DECIMAL | `% выполнения` или расчёт: `actual_volume / planned_volume * 100` | Процент выполнения |
| `brigade` | VARCHAR(100) | `Бригада` (план-факт) | Бригада [Assumption: текстовое поле, нет справочника бригад в исходных данных] |
| `module_plan_item_id` | FK → ModulePlanItem | `Связь СМР` (план модулей) | Связь с модулем (если задача связана с модулем) |
| `notes` | TEXT | `Примечание` | Примечания |
| `created_at` | TIMESTAMP | — | |
| `updated_at` | TIMESTAMP | — | |
| `created_by` | FK → User | — | Кто создал |

## 3.4 Правила DAG-зависимостей (TaskDependency)

### Таблица связей

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | SERIAL | PK |
| `predecessor_id` | FK → TaskInstance | Предшествующая задача |
| `successor_id` | FK → TaskInstance | Последующая задача |
| `dependency_type` | ENUM | `FS` (Finish-to-Start), `SS` (Start-to-Start), `FF` (Finish-to-Finish), `SF` (Start-to-Finish) |
| `lag_days` | INTEGER | Задержка (в днях). 0 = без задержки. Отрицательное = перекрытие |

### Правила DAG

1. **Ацикличность**: Система ОБЯЗАНА проверять отсутствие циклов при создании/изменении зависимости (топологическая сортировка). При обнаружении цикла — отклонить операцию с ошибкой.

2. **Типы зависимостей по умолчанию**:
   - Основной тип: `FS` (Finish-to-Start) — последующая задача не может начаться, пока предыдущая не завершена.
   - [Assumption] Из Excel-файлов не извлекаются явные зависимости между задачами. Зависимости устанавливаются вручную или при импорте ГПР (если в файле есть колонка связей).

3. **Каскадное обновление дат**:
   - При изменении `actual_end` у predecessor: если `predecessor.actual_end > successor.planned_start`, система генерирует уведомление о конфликте (не двигает даты автоматически — [Assumption]).
   - Автоматический пересчёт критического пути (CPM) — [Assumption: MVP может обойтись без CPM, ручной контроль].

4. **Guard при переходе статуса**:
   - `IN_PROGRESS` → `DONE`: все predecessors должны быть в статусе `DONE` или `VERIFIED` (для зависимости типа `FS`).
   - При блокировке predecessor → successor автоматически помечается `BLOCKED` (если зависимость `FS`).

5. **Структурная иерархия** (секции ГПР):
   - Задачи-заголовки (`is_section_header = true`) НЕ участвуют в DAG зависимостей.
   - Они служат только для группировки / визуализации.
   - Их `completion_pct` рассчитывается как средневзвешенное дочерних задач.

### Пример DAG (из ГПР)

```
[Подготовительные работы]        ← section_header, не в DAG
  ├── Разбивка осей (T-001)      FS→ Устройство фундамента (T-002)
  └── Планировка (T-003)         FS→ Устройство фундамента (T-002)

[Фундаментные работы]           ← section_header
  └── Устройство фундамента     FS→ Монтаж каркаса (T-004)
       (T-002)

[Монтаж каркаса]                ← section_header
  └── Монтаж каркаса (T-004)    FS→ Монтаж модулей (T-005)
```

## 3.5 Порождение Instances из Templates

### Алгоритм (при создании проекта или импорте ГПР)

```
1. Для каждого TaskTemplate (WHERE is_section_header = false):
   a. Создать TaskInstance:
      - template_id = template.id
      - project_id = current_project.id
      - status = CREATED
      - planned_start = template.default_start (из импорта) или NULL
      - planned_end = planned_start + template.duration_days
   b. Если template имеет default_responsible_role:
      - Найти User с этой ролью в проекте → assignee_id
      - Если не найден → assignee_id = NULL, создать уведомление "Не назначен исполнитель"
2. Для каждой зависимости в шаблоне (TemplateDependency):
   a. Найти соответствующие TaskInstance-пары
   b. Создать TaskDependency
3. Валидация DAG (проверка ацикличности)
4. AuditLog: записать событие "PROJECT_TASKS_GENERATED"
```

## 3.6 Связь TaskInstance с другими сущностями

| Связь | Кардинальность | Описание |
|-------|---------------|----------|
| TaskInstance → WorkType | N:1 | Через template.work_type_id. Тип СМР |
| TaskInstance → ModulePlanItem | N:1 (опц.) | Если задача связана с конкретным модулем (`Связь СМР`) |
| TaskInstance → DailyWorkLog | 1:N | Ежедневные записи факта по задаче |
| TaskInstance → Facade | N:1 | Фасад/зона привязки |
| TaskInstance → User (assignee) | N:1 | Исполнитель |
| TaskInstance → User (reviewer) | N:1 | Проверяющий [Assumption] |
| TaskInstance → Document | N:M | Документы, прикреплённые к задаче [Assumption] |
| TaskInstance → TaskDependency | 1:N (as pred/succ) | DAG-зависимости |

## 3.7 Вычисляемые поля и накопления

| Поле | Формула | Источник данных |
|------|---------|----------------|
| `completion_pct` | `(actual_volume / planned_volume) * 100` | TaskInstance.actual_volume, TaskInstance.planned_volume |
| `deviation_days` | `actual_end - planned_end` (если обе даты заполнены) | TaskInstance |
| `is_overdue` | `CURRENT_DATE > planned_end AND status NOT IN ('DONE','VERIFIED','CANCELLED')` | TaskInstance |
| Section `completion_pct` | `SUM(child.actual_volume * weight) / SUM(child.planned_volume * weight)` [Assumption: равные веса] | Дочерние TaskInstance |
