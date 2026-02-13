# 7. Notifications & Escalations

## 7.1 Сводная таблица сценариев уведомлений

Источники: лист `Сценарии уведомлений`, `Настройки уведомлений`, `Шаблоны сообщений`, `Ответственные` из `СИТИ_4_ПОЛНАЯ_ЭКОСИСТЕМА.xlsx`.

| # | Код сценария | Событие / Задача | Trigger | Тип уведомления | Получатели (роли) | Шаблон сообщения | Кнопки действий | Эскалация | Время до эскалации | AuditLog action |
|---|-------------|-----------------|---------|----------------|-------------------|-----------------|----------------|-----------|-------------------|-----------------|
| NS-01 | `TASK_ASSIGNED` | Назначение задачи исполнителю | `DATA_CHANGE` | Push (Bot) | assignee (foreman / brigadier) | "Вам назначена задача:\n{task_name}\nФасад: {facade}\nСрок: {deadline}\nПриоритет: {priority}" | [Принять] [Подробнее] | Нет принятия → 2ч → site_manager | 120 мин | NOTIFICATION_TASK_ASSIGNED |
| NS-02 | `TASK_OVERDUE_L1` | Задача просрочена на 1 день | `SCHEDULE` | Push (Bot) | assignee + foreman | "Задача просрочена на {days} дн.:\n{task_name}\nОтветственный: {assignee_name}\nДедлайн: {deadline}" | [Обновить статус] [Перенести срок] | Нет реакции → +2 дня → NS-03 | auto | NOTIFICATION_TASK_OVERDUE |
| NS-03 | `TASK_OVERDUE_L2` | Задача просрочена на 3 дня | `SCHEDULE` | Push (Bot) | site_manager | "ЭСКАЛАЦИЯ L2: Задача просрочена на {days} дн.:\n{task_name}\nОтветственный: {assignee_name}" | [Принять меры] [Подробнее] | Нет реакции → +4 дня → NS-04 | auto | NOTIFICATION_TASK_OVERDUE_L2 |
| NS-04 | `TASK_OVERDUE_L3` | Задача просрочена на 7+ дней | `SCHEDULE` | Push (Bot) | project_director | "КРИТИЧЕСКАЯ ЭСКАЛАЦИЯ: Задача просрочена на {days} дн.:\n{task_name}\nУчасток: {site}" | [Подробнее] | — (финальный уровень) | — | NOTIFICATION_TASK_OVERDUE_L3 |
| NS-05 | `FACT_REMINDER` | Факт дня не введён (19:00) | `SCHEDULE` | Push (Bot) | assignee (foreman) | "Факт за {date} не введён по задаче:\n{task_name}\nПожалуйста, внесите данные." | [Ввести факт] | 21:00 → NS-06 | 120 мин [Assumption] | NOTIFICATION_FACT_REMINDER |
| NS-06 | `FACT_ESCALATION` | Факт дня не введён (21:00) — эскалация | `SCHEDULE` | Push (Bot) | site_manager | "ЭСКАЛАЦИЯ: {foreman_name} не внёс факт за {date}.\nЗадачи без факта: {task_list}" | [Связаться] [Подробнее] | — | — | NOTIFICATION_FACT_ESCALATION |
| NS-07 | `PLAN_MORNING` | Утреннее напоминание (08:00) | `SCHEDULE` | Push (Bot) | foreman (с активными задачами) | "Доброе утро! Ваши задачи на сегодня:\n{task_list}\nОбщий план: {plan_total} {unit}" | [Открыть план-факт] | — | — | NOTIFICATION_PLAN_MORNING |
| NS-08 | `DAILY_SUMMARY` | Ежедневная сводка (23:00) | `SCHEDULE` | Push (Bot) | project_director, site_manager | "Сводка за {date}:\nПрогресс: {pct}%\nВыполнено: {done}/{total}\nПросрочено: {overdue}\nОтклонения: {deviations}" | [Открыть дашборд] | — | — | NOTIFICATION_DAILY_SUMMARY |
| NS-09 | `MODULE_STATUS_CHANGED` | Смена статуса модуля | `DATA_CHANGE` | Push (Bot) | Следующий ответственный в цепочке WF-03 | "Модуль {code} ({type}): {old_status} → {new_status}\nФасад: {facade}\nСледующий этап: {next_stage}" | [Принять] [Подробнее] | Нет принятия → 4ч → site_manager [Assumption] | 240 мин | NOTIFICATION_MODULE_STATUS |
| NS-10 | `MODULE_OVERDUE` | Модуль: просрочка отгрузки/монтажа | `SCHEDULE` | Push (Bot) | Ответственный за этап + site_manager | "Модуль {code} просрочен:\nПлановая дата: {planned_date}\nТекущий статус: {status}" | [Обновить статус] [Подробнее] | +3 дня → project_director [Assumption] | auto | NOTIFICATION_MODULE_OVERDUE |
| NS-11 | `DEVIATION_CRITICAL` | Отклонение факта > 20% от плана | `DATA_CHANGE` | Push (Bot) | site_manager | "Критическое отклонение!\nЗадача: {task_name}\nПлан: {plan}\nФакт: {fact}\nОтклонение: {deviation_pct}%" | [Подробнее] | — | — | NOTIFICATION_DEVIATION |
| NS-12 | `DEFECT_REPORTED` | Зафиксирован дефект | `UI_ACTION` | Push (Bot) | assignee + site_manager (если критический) | "Дефект в {facade}/{zone}:\n{description}\nКритичность: {priority}\nАвтор: {reporter_name}" | [Принять] [Делегировать] | Критический: 24ч → project_director [Assumption] | 1440 мин (крит.) | NOTIFICATION_DEFECT_REPORTED |
| NS-13 | `DEFECT_FIXED` | Дефект исправлен | `DATA_CHANGE` | Push (Bot) | qc_inspector + reporter | "Дефект исправлен:\n{description}\nИсправил: {fixer_name}\nТребуется проверка." | [Проверить] [Подробнее] | Нет проверки → 24ч → site_manager | 1440 мин | NOTIFICATION_DEFECT_FIXED |
| NS-14 | `DOCUMENT_ON_REVIEW` | Документ отправлен на ревью | `UI_ACTION` | Push (Bot) | reviewer (engineer / site_manager) | "Документ на согласование:\n{doc_name}\nАвтор: {author_name}\nТип: {doc_type}" | [Открыть] [Утвердить] [Отклонить] | +2 рабочих дня → project_director [Assumption] | 2880 мин | NOTIFICATION_DOC_REVIEW |
| NS-15 | `IMPORT_COMPLETED` | Импорт Excel завершён | `IMPORT` | Push (Bot) | Загрузивший пользователь | "Импорт завершён: {file_name}\nЗаписей: {imported}/{total}\nОшибок: {errors}\nПредупреждений: {warnings}" | [Открыть лог] | При ошибках → admin | — | NOTIFICATION_IMPORT_DONE |
| NS-16 | `USER_REGISTERED` | Новый пользователь зарегистрировался | `UI_ACTION` | Push (Bot) | admin | "Новый пользователь: {name} (@{username})\nTelegram ID: {tg_id}\nТребуется назначение роли." | [Назначить роль] | — | — | NOTIFICATION_USER_REGISTERED |
| NS-17 | `TASK_COMPLETED` | Задача завершена (DONE) | `DATA_CHANGE` | Push (Bot) | reviewer (foreman / site_manager) | "Задача завершена:\n{task_name}\nИсполнитель: {assignee_name}\nФакт: {actual_volume}/{planned_volume}" | [Принять] [Вернуть на доработку] | +24ч → site_manager | 1440 мин | NOTIFICATION_TASK_COMPLETED |
| NS-18 | `GPR_APPROVED` | ГПР утверждён | `UI_ACTION` | Push (Bot) | site_manager, foreman (участники) | "ГПР утверждён:\n{gpr_name}\nЗадач: {task_count}\nПериод: {start} — {end}" | [Открыть ГПР] | — | — | NOTIFICATION_GPR_APPROVED |

## 7.2 Настройки уведомлений (конфигурируемые параметры)

Источник: лист `Настройки уведомлений`.

| # | Параметр | Значение (default) | Описание | Применяется к | Настраиваемый |
|---|----------|-------------------|----------|---------------|---------------|
| 1 | `morning_reminder_time` | `08:00` | Время утреннего напоминания | NS-07 | Да |
| 2 | `fact_reminder_time` | `19:00` [Assumption] | Время напоминания о вводе факта | NS-05 | Да |
| 3 | `fact_escalation_time` | `21:00` [Assumption] | Время эскалации при отсутствии факта | NS-06 | Да |
| 4 | `daily_summary_time` | `23:00` | Время ежедневной сводки | NS-08 | Да |
| 5 | `overdue_check_time` | `07:00` | Время проверки просроченных задач | NS-02..NS-04, NS-10 | Да |
| 6 | `escalation_l1_days` | `1` | Дней просрочки до L1 эскалации | NS-02 | Да |
| 7 | `escalation_l2_days` | `3` | Дней просрочки до L2 эскалации | NS-03 | Да |
| 8 | `escalation_l3_days` | `7` | Дней просрочки до L3 эскалации | NS-04 | Да |
| 9 | `deviation_threshold_pct` | `20` | % отклонения для критического уведомления | NS-11 | Да |
| 10 | `task_accept_timeout_min` | `120` | Минут на принятие назначенной задачи | NS-01 | Да |
| 11 | `module_accept_timeout_min` | `240` [Assumption] | Минут на принятие статуса модуля | NS-09 | Да |
| 12 | `defect_critical_timeout_min` | `1440` | Минут на реакцию на критический дефект | NS-12 | Да |
| 13 | `doc_review_timeout_min` | `2880` [Assumption] | Минут на ревью документа | NS-14 | Да |
| 14 | `retry_count` | `3` | Количество повторов отправки при ошибке | Все | Нет |
| 15 | `retry_backoff_seconds` | `30,60,120` | Задержки между повторами | Все | Нет |
| 16 | `quiet_hours_start` | `23:00` [Assumption] | Начало тихих часов (не отправлять push) | Все кроме критических | Да |
| 17 | `quiet_hours_end` | `07:00` [Assumption] | Конец тихих часов | Все кроме критических | Да |
| 18 | `weekend_notifications` | `false` [Assumption] | Отправлять ли в выходные | Все кроме критических | Да |

## 7.3 Шаблоны сообщений (MessageTemplate)

Источник: лист `Шаблоны сообщений`.

| # | Тип сообщения | Шаблон | Переменные | Пример заполнения |
|---|--------------|--------|------------|-------------------|
| MT-01 | Назначение задачи | `Вам назначена задача:\n📋 {task_name}\n📍 Фасад: {facade}\n📅 Срок: {deadline}\n⚡ Приоритет: {priority}` | task_name, facade, deadline, priority | "Вам назначена задача:\n📋 Монтаж панелей Ф1-3\n📍 Фасад: Ф1\n📅 Срок: 15.03.2026\n⚡ Приоритет: HIGH" |
| MT-02 | Просрочка задачи | `⚠️ Задача просрочена на {days} дн.:\n📋 {task_name}\n👤 Ответственный: {assignee_name}\n📅 Дедлайн: {deadline}` | days, task_name, assignee_name, deadline | "⚠️ Задача просрочена на 2 дн.:\n📋 Бетонирование плиты\n👤 Иванов И.И.\n📅 10.03.2026" |
| MT-03 | Эскалация L2/L3 | `🚨 ЭСКАЛАЦИЯ ({level}): Задача просрочена на {days} дн.:\n📋 {task_name}\n👤 {assignee_name}\n📍 Участок: {site}` | level, days, task_name, assignee_name, site | — |
| MT-04 | Напоминание о факте | `📝 Факт за {date} не введён:\n📋 {task_name}\nВнесите данные до конца дня.` | date, task_name | — |
| MT-05 | Эскалация факта | `🚨 ЭСКАЛАЦИЯ: {foreman_name} не внёс факт за {date}.\n📋 Задачи: {task_list}` | foreman_name, date, task_list | — |
| MT-06 | Утренний план | `☀️ Доброе утро! Задачи на сегодня:\n{task_list}\n📊 Общий план: {plan_total} {unit}` | task_list, plan_total, unit | — |
| MT-07 | Ежедневная сводка | `📊 Сводка за {date}:\n✅ Прогресс: {pct}%\n📋 Выполнено: {done}/{total}\n⏰ Просрочено: {overdue}\n⚠️ Отклонения: {deviations}` | date, pct, done, total, overdue, deviations | — |
| MT-08 | Статус модуля | `🔄 Модуль {code} ({type}):\n{old_status} → {new_status}\n📍 Фасад: {facade}` | code, type, old_status, new_status, facade | — |
| MT-09 | Дефект зафиксирован | `🔴 Дефект в {facade}/{zone}:\n{description}\n⚡ Критичность: {priority}\n👤 Автор: {reporter_name}` | facade, zone, description, priority, reporter_name | — |
| MT-10 | Импорт завершён | `📥 Импорт завершён: {file_name}\n✅ Записей: {imported}/{total}\n❌ Ошибок: {errors}\n⚠️ Предупреждений: {warnings}` | file_name, imported, total, errors, warnings | — |
| MT-11 | Новый пользователь | `👤 Новый пользователь: {name} (@{username})\n🆔 TG ID: {tg_id}\nТребуется назначение роли.` | name, username, tg_id | — |
| MT-12 | Задача завершена | `✅ Задача завершена:\n📋 {task_name}\n👤 {assignee_name}\n📊 Факт: {actual}/{planned} ({pct}%)` | task_name, assignee_name, actual, planned, pct | — |

## 7.4 Логика эскалаций (диаграмма)

```
Событие
  │
  ▼
┌──────────────────┐
│ Определить       │
│ сценарий (NS-xx) │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     Тихие часы?      ┌──────────────────┐
│ Сформировать     │────── Да ──────────►│ Отложить до      │
│ сообщение (MT-xx)│                      │ quiet_hours_end   │
└────────┬─────────┘                      └────────┬─────────┘
         │ Нет                                      │
         ▼                                          │
┌──────────────────┐                                │
│ Отправить через  │◄───────────────────────────────┘
│ Bot API          │
└────────┬─────────┘
         │
    ┌────┴────┐
    │Успех?   │
    ├── Да ──►│ NotificationLog(status=SENT)
    │         │
    └── Нет ──► Retry (retry_count раз, backoff)
                   │
              ┌────┴────┐
              │Успех?   │
              ├── Да ──►│ NotificationLog(status=SENT)
              └── Нет ──► NotificationLog(status=FAILED) + alert admin
                          │
                          ▼
         ┌────────────────────────────────┐
         │ Ожидание реакции              │
         │ (escalation_time_minutes)      │
         └──────────┬─────────────────────┘
                    │
               ┌────┴─────┐
               │Реакция?  │
               ├── Да ───►│ Обработать действие (callback)
               │           │ AuditLog
               └── Нет ──►│ Эскалация → следующий уровень
                           │ (повторить цикл для нового получателя)
```

## 7.5 Обработчики кнопок (Callback handlers)

| Кнопка | Callback data pattern | Действие | Следующий шаг |
|--------|-----------------------|----------|---------------|
| [Принять] (задачу) | `accept:task:{id}` | TaskInstance.status → IN_PROGRESS, actual_start = NOW | Уведомление site_manager |
| [Подробнее] | `detail:task:{id}` | Open Mini App deep-link | — |
| [Обновить статус] | `update:task:{id}` | Предложить выбор нового статуса | Inline keyboard со статусами |
| [Перенести срок] | `reschedule:task:{id}` | Запросить новую дату | Ввод даты → UPDATE planned_end |
| [Принять меры] | `escalate_ack:task:{id}` | Подтверждение получения эскалации | AuditLog |
| [Ввести факт] | `enter_fact:task:{id}` | Запуск диалога ввода факта (REQ-BOT-002) | — |
| [Назначить роль] | `assign_role:user:{id}` | Предложить выбор роли для нового пользователя | Inline keyboard с ролями |
| [Делегировать] (дефект) | `delegate:task:{id}` | Запросить нового исполнителя | Inline keyboard с пользователями зоны |
| [Проверить] (дефект) | `verify:task:{id}` | TaskInstance.status → VERIFIED | Уведомление reporter |
| [Утвердить] (документ) | `approve:doc:{id}` | Document.status → APPROVED | Уведомление автору |
| [Отклонить] (документ) | `reject:doc:{id}` | Document.status → DRAFT + запрос комментария | Уведомление автору с комментарием |
| [Открыть дашборд] | `dashboard:project:{id}` | Open Mini App → Analytics | — |
| [Открыть ГПР] | `gpr:project:{id}` | Open Mini App → GPR | — |
| [Открыть лог] | `import_log:{id}` | Open Mini App → Import log | — |
| [Связаться] | `contact:user:{id}` | Открыть чат с пользователем в Telegram | — |
| [Вернуть на доработку] | `rework:task:{id}` | TaskInstance.status → IN_PROGRESS + запрос комментария | Уведомление assignee |
| [Открыть план-факт] | `plan_fact:date:{date}` | Open Mini App → Plan/Fact for date | — |

## 7.6 Правила дедупликации и idempotency

| Правило | Описание |
|---------|----------|
| Одно напоминание в день | Для NS-02..NS-04: не отправлять повторно, если за сегодня уже было уведомление по этому сценарию и entity_id |
| Callback idempotency | При повторном нажатии кнопки → "Действие уже выполнено", не менять данные |
| Escalation chain | Эскалация на следующий уровень только если предыдущий не прореагировал (проверка NotificationLog + действия) |
| Quiet hours buffer | Уведомления, попавшие в тихие часы, отправляются пакетом в quiet_hours_end (кроме критических NS-04, NS-12) |
