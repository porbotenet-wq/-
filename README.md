# STSphera

Telegram Bot + Mini App для управления строительными проектами.

## Архитектура

```
┌─────────────┐     ┌──────────────────┐     ┌────────────────┐
│  Telegram    │────▶│  Supabase Edge   │────▶│   Supabase     │
│  Bot Users   │     │  Function (Bot)  │     │   PostgreSQL   │
└─────────────┘     └──────────────────┘     └────────────────┘
       │                                            ▲
       │            ┌──────────────────┐            │
       └───────────▶│  Mini App        │────────────┘
                    │  (GitHub Pages)  │
                    │  React + TailwindCSS
                    └──────────────────┘
```

## Быстрый старт

### 1. Настройка бота

```bash
export TELEGRAM_BOT_TOKEN="your_bot_token_from_BotFather"
node scripts/setup-bot.mjs
```

Скрипт автоматически:
- Установит webhook на Supabase Edge Function
- Зарегистрирует команды бота (/start, /tasks, /fact, /defect, /menu, /help)
- Настроит кнопку **STSphera** (Menu Button) — открывает Mini App

### 2. Включение GitHub Pages (Mini App)

1. Перейдите в **Settings → Pages** репозитория
2. Source: **Deploy from a branch**
3. Branch: **gh-pages** → **/ (root)**
4. Нажмите **Save**

Mini App будет доступен по адресу: `https://porbotenet-wq.github.io/-/`

### 3. Переменные окружения Supabase

В Supabase Dashboard → Edge Functions → Secrets:

| Переменная | Значение |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Токен от @BotFather |
| `SUPABASE_URL` | URL вашего Supabase проекта |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role Key |
| `MINI_APP_URL` | `https://porbotenet-wq.github.io/-/` |

## Структура проекта

```
├── apps/
│   ├── api/                    # NestJS Backend (REST API)
│   └── mini-app/               # React Mini App (Vite + Tailwind)
│       ├── src/
│       │   ├── pages/          # Dashboard, Tasks, PlanFact, Gantt,
│       │   │                   # Modules, Documents, ProjectInfo
│       │   ├── components/     # NavBar, StatusBadge
│       │   ├── stores/         # Zustand store
│       │   ├── hooks/          # useTelegram hook
│       │   └── api/            # Supabase client
│       └── dist/               # Production build
├── packages/shared/            # Shared constants/enums
├── supabase/
│   ├── functions/
│   │   ├── telegram-bot/       # Bot webhook (Edge Function)
│   │   └── project-workflow/   # Workflow engine (Edge Function)
│   └── migrations/             # SQL migrations (24 tables)
├── scripts/
│   ├── setup-bot.mjs           # Bot setup script
│   └── setup-bot.sh            # Bash version
├── docs/architecture/          # Product docs (11 sections)
└── .github/workflows/          # Auto-deploy Mini App
```

## Функциональность

### Telegram Bot
- `/start` — регистрация + главное меню
- `/tasks` — список задач с кнопками (принять/завершить)
- `/fact` — ввод факта (выбор задачи → ввод числа → сохранение)
- `/defect` — фиксация дефекта (фасад → критичность → описание + фото)
- `/menu` — главное меню с inline-кнопками
- Назначение ролей (для админов)
- Уведомления при назначении задач, просрочках, дефектах
- Фото-фиксация (сохранение в документы)
- Deep-link в Mini App

### Mini App (7 экранов)
- **Дашборд** — KPI, круговые диаграммы задач/модулей, прогресс по фасадам
- **Задачи** — список + канбан, фильтры (мои/просроченные/фасад/статус), смена статусов
- **План-Факт** — табличный ввод, автопересчёт отклонений, итоги, отправка на проверку
- **Диаграмма Ганта** — временная шкала задач, группировка по секциям, прогресс
- **Модули** — pipeline-вид, продвижение статусов, фильтры
- **Документы** — загрузка файлов, workflow (черновик → проверка → утверждение)
- **Объект** — информация о проекте, фасады, команда

## Технологии

- **Bot**: Deno + Supabase Edge Functions
- **Mini App**: React 18 + TypeScript + Vite + Tailwind CSS + Recharts + Zustand
- **Database**: Supabase PostgreSQL (24 таблицы)
- **Hosting**: GitHub Pages (Mini App), Supabase (Bot + DB)
- **SDK**: Telegram Web App JS SDK
