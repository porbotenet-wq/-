#!/bin/bash
# =============================================
# STSphera — Telegram Bot Setup Script
# =============================================
# This script configures:
#   1. Bot webhook (pointing to Supabase Edge Function)
#   2. Bot commands (/start, /tasks, /fact, /defect, /menu, /help)
#   3. Chat menu button (opens Mini App)
#
# Usage:
#   export TELEGRAM_BOT_TOKEN="your_bot_token"
#   export SUPABASE_URL="https://your-project.supabase.co"
#   bash scripts/setup-bot.sh
# =============================================

set -e

# Check required env vars
if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
  echo "ERROR: TELEGRAM_BOT_TOKEN is not set"
  echo "  export TELEGRAM_BOT_TOKEN=\"your_bot_token_here\""
  exit 1
fi

if [ -z "$SUPABASE_URL" ]; then
  echo "ERROR: SUPABASE_URL is not set"
  echo "  export SUPABASE_URL=\"https://your-project.supabase.co\""
  exit 1
fi

TG_API="https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}"
WEBHOOK_URL="${SUPABASE_URL}/functions/v1/telegram-bot"
MINI_APP_URL="${MINI_APP_URL:-https://porbotenet-wq.github.io/-/}"

echo "========================================"
echo "  STSphera Bot Setup"
echo "========================================"
echo ""

# 1. Get bot info
echo "1. Getting bot info..."
BOT_INFO=$(curl -s "${TG_API}/getMe")
BOT_USERNAME=$(echo "$BOT_INFO" | python3 -c "import sys,json; print(json.load(sys.stdin)['result']['username'])" 2>/dev/null || echo "unknown")
echo "   Bot: @${BOT_USERNAME}"
echo ""

# 2. Set webhook
echo "2. Setting webhook..."
echo "   URL: ${WEBHOOK_URL}"
WEBHOOK_RESULT=$(curl -s -X POST "${TG_API}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"${WEBHOOK_URL}\",
    \"allowed_updates\": [\"message\", \"callback_query\"],
    \"drop_pending_updates\": true
  }")
echo "   Result: ${WEBHOOK_RESULT}"
echo ""

# 3. Set bot commands
echo "3. Setting bot commands..."
COMMANDS_RESULT=$(curl -s -X POST "${TG_API}/setMyCommands" \
  -H "Content-Type: application/json" \
  -d '{
    "commands": [
      {"command": "start", "description": "Главное меню"},
      {"command": "menu", "description": "Показать меню"},
      {"command": "tasks", "description": "Мои задачи"},
      {"command": "fact", "description": "Ввод факта"},
      {"command": "defect", "description": "Фиксация дефекта"},
      {"command": "help", "description": "Помощь"}
    ]
  }')
echo "   Result: ${COMMANDS_RESULT}"
echo ""

# 4. Set chat menu button (opens Mini App)
echo "4. Setting chat menu button (Mini App)..."
echo "   Mini App URL: ${MINI_APP_URL}"
MENU_RESULT=$(curl -s -X POST "${TG_API}/setChatMenuButton" \
  -H "Content-Type: application/json" \
  -d "{
    \"menu_button\": {
      \"type\": \"web_app\",
      \"text\": \"STSphera\",
      \"web_app\": {
        \"url\": \"${MINI_APP_URL}\"
      }
    }
  }")
echo "   Result: ${MENU_RESULT}"
echo ""

# 5. Verify
echo "5. Verifying webhook..."
WEBHOOK_INFO=$(curl -s "${TG_API}/getWebhookInfo")
echo "   Webhook info: ${WEBHOOK_INFO}"
echo ""

echo "========================================"
echo "  Setup Complete!"
echo "========================================"
echo ""
echo "  Bot: @${BOT_USERNAME}"
echo "  Webhook: ${WEBHOOK_URL}"
echo "  Mini App: ${MINI_APP_URL}"
echo ""
echo "  Next steps:"
echo "    1. Enable GitHub Pages: Settings → Pages → Branch: gh-pages → Save"
echo "    2. Open the bot in Telegram and press /start"
echo "    3. The 'STSphera' button next to input opens the Mini App"
echo ""
