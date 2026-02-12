# Telegram Bot + Mini App

Minimal working project of a Telegram bot with an embedded mini app (WebApp).

## Included features

- Bot built on `telegraf`
- Web server built on `express`
- Mini app (HTML/CSS/JS) in `public/`
- Data flow from mini app back to bot via `web_app_data`
- Persistent user state in JSON storage (`data/state.json`)
- User profile and global stats commands

## Quick start

1. Install dependencies:

```bash
npm install
```

2. Create `.env`:

```bash
cp .env.example .env
```

3. Fill environment variables:

- `BOT_TOKEN` - bot token from BotFather
- `PUBLIC_URL` - external HTTPS URL (domain or tunnel) reachable by Telegram
- `PORT` - web server port (default: 3000)
- `MINI_APP_PATH` - mini app path (default: `/`)
- `STORE_FILE` - optional path for JSON state file (default: `./data/state.json`)

4. Run:

```bash
npm start
```

## Bot commands

- `/start` - greeting and keyboard button
- `/miniapp` - open mini app with inline button
- `/profile` - show your saved profile data
- `/reset` - reset your profile data
- `/stats` - show global stats across users
- `/help` - show command list

## HTTP endpoints

- `GET /health` - health check
- `GET /api/users/:userId` - user profile for mini app hydration
- `GET /api/stats` - global statistics

## Check

```bash
npm test
```