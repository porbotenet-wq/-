# 8. Technical Stack Selection (финал)

## 8.1 Выбранный стек

| Компонент | Технология | Версия | Обоснование |
|-----------|-----------|--------|-------------|
| **Backend Runtime** | Node.js | 20 LTS | Единый язык с фронтендом (TypeScript); нативная асинхронность для I/O-bound задач (Bot API, DB, S3); зрелая экосистема для Telegram ботов |
| **Backend Framework** | NestJS | 10.x | Модульная архитектура (модули = bounded contexts); встроенные Guards (RBAC), Interceptors (AuditLog), Pipes (валидация); OpenAPI из коробки; DI-контейнер |
| **Language** | TypeScript | 5.x | Строгая типизация для доменной модели (24 сущности); рефакторинг-friendly; единый язык backend + frontend |
| **Database** | Supabase (PostgreSQL 15) | — | Managed PostgreSQL: JSONB, GENERATED columns, массивы, window functions. Плюс: Supabase Storage (файлы/фото вместо MinIO), Realtime (подписки), Dashboard для администрирования |
| **ORM** | Prisma | 5.x | Type-safe queries; auto-generated типы из schema; миграции; подключение к Supabase PostgreSQL через `DATABASE_URL` |
| **Queue / Jobs** | BullMQ + Redis | 5.x / 7.x | Cron-задачи (уведомления, эскалации, сводки); retry с backoff; приоритеты; dashboard (Bull Board) для мониторинга |
| **Cache** | Redis | 7.x | Кэш агрегаций (дашборд), сессии, rate limiting |
| **Telegram Bot** | grammY | 1.x | TypeScript-native; middleware-архитектура (совместима с NestJS); sessions, conversations, inline keyboards; хорошая документация |
| **Mini App Frontend** | React | 18.x | Компонентная архитектура; богатая экосистема UI-библиотек; совместимость с Telegram Web Apps SDK |
| **UI Framework** | Tailwind CSS + shadcn/ui | 3.x / latest | Быстрая разработка UI; адаптивность; кастомизация под тёмную/светлую тему Telegram |
| **Telegram Mini App SDK** | @telegram-apps/sdk-react | latest | Официальный SDK; валидация initData; theme params; back button; haptic feedback |
| **Charts** | Recharts | 2.x | Гант (кастомный), графики накоплений, круговые диаграммы статусов |
| **Gantt Chart** | @dhx/gantt (DHTMLX) или custom | — | [Assumption: для MVP возможен кастомный компонент на базе React + SVG; DHTMLX если бюджет позволяет лицензию] |
| **Table** | TanStack Table | 8.x | Виртуализация для больших таблиц план-факт; inline editing; сортировка/фильтрация |
| **State Management** | Zustand | 4.x | Лёгкий, без boilerplate; подходит для Mini App (ограниченный scope) |
| **API Client** | Axios + React Query | 5.x / 5.x | Кэширование, retry, optimistic updates |
| **File Storage** | Supabase Storage | — | S3-совместимый API (встроен в Supabase); фото, документы; pre-signed URLs; RLS policies для доступа |
| **Excel Parsing** | ExcelJS | 4.x | Чтение .xlsx; поддержка merged cells, формул; streaming для больших файлов |
| **Validation** | Zod | 3.x | Schema validation для API + import; type inference |
| **Auth** | JWT (jsonwebtoken) + Telegram initData HMAC | — | Stateless auth; refresh token rotation |
| **Logging** | Pino | 8.x | Структурированные JSON логи; быстрый; совместим с NestJS |
| **Monitoring** | Prometheus + Grafana | — | Метрики API, очередей, ботa [Assumption: post-MVP] |
| **Containerization** | Docker + Docker Compose | — | Dev + prod; reproducible builds |
| **CI/CD** | GitHub Actions | — | Lint, test, build, deploy [Assumption] |

## 8.2 Обоснование выбора Node.js+NestJS vs Python+FastAPI

| Критерий | Node.js + NestJS | Python + FastAPI |
|----------|:---:|:---:|
| Единый язык (backend + frontend) | **TypeScript** — один язык | Python backend + TypeScript frontend — два языка |
| Telegram Bot SDK | grammY (TS-native, отличная поддержка) | python-telegram-bot / aiogram (хорошие, но отдельная экосистема) |
| Асинхронность | Нативная (event loop) | asyncio (хорошо, но GIL для CPU-bound) |
| Type safety для 24+ сущностей | TypeScript + Prisma = полная типизация | Pydantic — хорошо, но менее интегрировано с ORM |
| Модульная архитектура | NestJS — enterprise-grade DI/modules | Нет встроенного DI (можно добавить dependency-injector) |
| Очереди (BullMQ vs Celery) | BullMQ — проще, in-process, dashboard | Celery — мощнее, но тяжелее, отдельный worker |
| Команда MVP | Один TS-разработчик может работать fullstack | Нужен Python-backend + TS-frontend (2 компетенции) |
| Excel parsing | ExcelJS — хорошо | openpyxl — хорошо |

**Решение**: Node.js + NestJS. Ключевой аргумент — **единый язык TypeScript** для всего стека (Bot + API + Mini App), что критично для MVP с ограниченной командой.

## 8.3 Архитектура деплоя (MVP)

```
┌────────────────────────────────────────────────────┐
│                   Docker Compose                    │
│                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │  app         │  │  worker      │  │  mini-app  │ │
│  │  (NestJS +   │  │  (BullMQ     │  │  (React    │ │
│  │   Bot webhook│  │   processors)│  │   build →  │ │
│  │   + REST API)│  │              │  │   nginx)   │ │
│  └──────┬───────┘  └──────┬──────┘  └─────┬──────┘ │
│         │                  │                │        │
│  ┌──────┴──────────────────┴────────────────┘       │
│  │                                                   │
│  ▼                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │
│  │ PostgreSQL   │  │ Redis       │  │ MinIO      │  │
│  │ :5432       │  │ :6379       │  │ :9000      │  │
│  └─────────────┘  └─────────────┘  └────────────┘  │
│                                                      │
│  ┌─────────────┐                                     │
│  │ Nginx       │ ← reverse proxy + SSL              │
│  │ :443        │                                     │
│  └─────────────┘                                     │
└────────────────────────────────────────────────────┘
```

## 8.4 Структура проекта (монорепо)

```
stsphera/
├── apps/
│   ├── api/                    # NestJS backend
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/       # JWT + Telegram validation
│   │   │   │   ├── bot/        # grammY bot handlers
│   │   │   │   ├── task/       # TaskTemplate, TaskInstance, TaskDependency
│   │   │   │   ├── plan-fact/  # DailyWorkLog, accumulations
│   │   │   │   ├── module/     # ModulePlanItem
│   │   │   │   ├── project/    # Project, Facade
│   │   │   │   ├── document/   # Document management
│   │   │   │   ├── analytics/  # Aggregations, dashboards
│   │   │   │   ├── notification/ # Scenarios, templates, sending
│   │   │   │   ├── import/     # ETL Excel
│   │   │   │   ├── user/       # User, Role, RBAC
│   │   │   │   └── audit/      # AuditLog
│   │   │   ├── common/
│   │   │   │   ├── guards/     # RBAC guards
│   │   │   │   ├── interceptors/ # AuditLog interceptor
│   │   │   │   ├── pipes/      # Validation pipes
│   │   │   │   └── filters/    # Exception filters
│   │   │   └── jobs/           # BullMQ processors
│   │   └── prisma/
│   │       └── schema.prisma
│   │
│   └── mini-app/               # React Mini App
│       ├── src/
│       │   ├── pages/
│       │   │   ├── Dashboard/
│       │   │   ├── Tasks/      # Kanban
│       │   │   ├── Gantt/      # GPR
│       │   │   ├── PlanFact/   # Table input
│       │   │   ├── Modules/
│       │   │   ├── Documents/
│       │   │   └── Settings/
│       │   ├── components/
│       │   ├── hooks/
│       │   ├── stores/         # Zustand
│       │   └── api/            # React Query + Axios
│       └── public/
│
├── packages/
│   └── shared/                 # Shared types, enums, constants
│       └── src/
│           ├── types/
│           ├── enums/
│           └── constants/
│
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.example
├── turbo.json                  # Turborepo config
└── package.json
```
