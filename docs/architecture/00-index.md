# STSphera — Product Architecture & Requirements

## AI Agent Spec: Telegram Bot + Mini App (Construction Tech)

**Версия документа**: 1.0
**Дата**: 2026-02-12
**Роль автора**: Lead MVP Architect + Tech Lead

---

## Содержание

1. [Product Architecture (Bot vs Mini App vs Backend)](./01-product-architecture.md) — таблица распределения функциональности
2. [Workflow Logic](./02-workflow-logic.md) — цепочки/стадии/сроки/триггеры (7 workflows)
3. [Task Model (Templates → Instances)](./03-task-model.md) — DAG-зависимости, порождение экземпляров
4. [Role & Permission Matrix (RBAC)](./04-rbac.md) — 10 ролей, 30+ permissions, data-level scope
5. [Functional Requirements (REQ-*)](./05-functional-requirements.md) — 20 атомарных требований
6. [Data Entities (ER-логика)](./06-data-entities.md) — 24 сущности, маппинг на Excel
7. [Notifications & Escalations](./07-notifications-escalations.md) — 18 сценариев, настройки, шаблоны
8. [Technical Stack Selection](./08-technical-stack.md) — Node.js + NestJS + React, обоснование
9. [Assumptions & Critical Gaps](./09-assumptions-gaps.md) — 20 допущений, 5 критических разрывов
10. [MVP Scope & Cutline](./10-mvp-scope-cutline.md) — 32 IN / 10 LATER / 4 OUT
11. [Backlog (Epics → Stories)](./11-backlog.md) — 12 Epics, 79 Stories, ~344 SP

---

## Ключевые метрики документа

| Метрика | Значение |
|---------|----------|
| Требования (REQ-*) | 20 (BOT: 6, MINI: 7, BE: 5, NOTIF: 5, SEC: 2, AUD: 1) |
| Все требования имеют Trigger | Yes |
| Все требования имеют Acceptance Criteria | Yes |
| Workflows | 7 (WF-01..WF-07) |
| Роли RBAC | 10 (из файла "Ответственные" + [Assumption]) |
| Сущности БД | 24 |
| Сценарии уведомлений | 18 (NS-01..NS-18) |
| Шаблоны сообщений | 12 (MT-01..MT-12) |
| Допущения [Assumption] | 20 (ASMP-001..ASMP-020) |
| Критические разрывы | 5 (CG-01..CG-05) |
| Epics | 12 |
| Stories | 79 |
| Story Points | ~344 |
| MVP Scope (IN) | 32 функции |

---

## Входные файлы (source of truth)

| Файл | Назначение | Использование |
|------|-----------|---------------|
| `Техническое задание для STSphera.docx` | Правила, триггеры, целевая архитектура | Разделы 2, 5, 7 |
| `СИТИ_4_ПОЛНАЯ_ЭКОСИСТЕМА.xlsx` | Референс-объект: 8 ключевых листов | Разделы 3, 4, 6, 7 |
| `Образец ГПР, для БОТА.xlsx` | Структура ГПР | Разделы 3, 6 |
| `План запуска модулей Сити 4.xlsx` | Этапы/статусы модулей | Разделы 3, 6 |
| `Схемы со сводой.xlsx` | Сводки/накопительные | Раздел 6 |

---

## Self-Check (критерии качества)

- [x] Нет требований без Trigger
- [x] Нет требований без Acceptance Criteria
- [x] RBAC роли из файлов (или [Assumption])
- [x] Все уведомления привязаны к событиям/данным
- [x] Все сущности БД привязаны к колонкам Excel (или [Assumption])
- [x] Типы триггеров — только 4: UI_ACTION, DATA_CHANGE, SCHEDULE, IMPORT
- [x] Формат ID: REQ-BOT-###, REQ-MINI-###, REQ-BE-###, REQ-NOTIF-###, REQ-SEC-###, REQ-AUD-###
- [x] Каждое требование содержит: Trigger, Actor, System Behavior, Data Writes, Notifications, Acceptance Criteria, Errors/Edge Cases
- [x] Все неопределённости оформлены как [Assumption] ASMP-###
