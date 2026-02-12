# Telegram Bot + Mini App

Minimal working project of a Telegram bot with an embedded mini app (WebApp).

## Included features

- Bot built on `telegraf`
- Web server built on `express`
- Mini app (HTML/CSS/JS) in `public/`
- Data flow from mini app back to bot via `web_app_data`

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

4. Run:

```bash
npm start
```

## Bot commands

- `/start` - greeting and keyboard button
- `/miniapp` - open mini app with inline button
- `/help` - show command list

## Check

```bash
npm test
```