#!/usr/bin/env node
/**
 * STSphera — Telegram Bot Setup Script (Node.js)
 * 
 * Configures:
 *   1. Webhook → Supabase Edge Function
 *   2. Bot commands
 *   3. Chat Menu Button → Mini App (GitHub Pages)
 *
 * Usage:
 *   TELEGRAM_BOT_TOKEN=xxx SUPABASE_URL=xxx node scripts/setup-bot.mjs
 * 
 * Or with defaults from this project:
 *   TELEGRAM_BOT_TOKEN=xxx node scripts/setup-bot.mjs
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zerddyzvmuapdpllewht.supabase.co';
const MINI_APP_URL = process.env.MINI_APP_URL || 'https://porbotenet-wq.github.io/-/';

if (!BOT_TOKEN) {
  console.error('ERROR: Set TELEGRAM_BOT_TOKEN environment variable');
  console.error('  export TELEGRAM_BOT_TOKEN="your_token"');
  process.exit(1);
}

const TG = `https://api.telegram.org/bot${BOT_TOKEN}`;
const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/telegram-bot`;

async function tg(method, body) {
  const res = await fetch(`${TG}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function main() {
  console.log('========================================');
  console.log('  STSphera — Bot Setup');
  console.log('========================================\n');

  // 1. Get bot info
  console.log('1. Getting bot info...');
  const me = await tg('getMe', {});
  if (!me.ok) {
    console.error('   ERROR: Invalid bot token', me);
    process.exit(1);
  }
  console.log(`   Bot: @${me.result.username} (${me.result.first_name})`);
  console.log(`   ID: ${me.result.id}\n`);

  // 2. Set webhook
  console.log('2. Setting webhook...');
  console.log(`   URL: ${WEBHOOK_URL}`);
  const wh = await tg('setWebhook', {
    url: WEBHOOK_URL,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: true,
  });
  console.log(`   OK: ${wh.ok} — ${wh.description || ''}\n`);

  // 3. Set bot commands
  console.log('3. Setting bot commands...');
  const cmds = await tg('setMyCommands', {
    commands: [
      { command: 'start', description: 'Главное меню' },
      { command: 'menu', description: 'Показать меню' },
      { command: 'tasks', description: 'Мои задачи' },
      { command: 'fact', description: 'Ввод факта' },
      { command: 'defect', description: 'Фиксация дефекта' },
      { command: 'help', description: 'Помощь' },
    ],
  });
  console.log(`   OK: ${cmds.ok}\n`);

  // 4. Set chat menu button → Mini App
  console.log('4. Setting chat menu button (Mini App)...');
  console.log(`   Mini App URL: ${MINI_APP_URL}`);
  const menu = await tg('setChatMenuButton', {
    menu_button: {
      type: 'web_app',
      text: 'STSphera',
      web_app: { url: MINI_APP_URL },
    },
  });
  console.log(`   OK: ${menu.ok} — ${menu.description || ''}\n`);

  // 5. Verify
  console.log('5. Verifying...');
  const info = await tg('getWebhookInfo', {});
  console.log(`   Webhook URL: ${info.result?.url || 'NOT SET'}`);
  console.log(`   Pending updates: ${info.result?.pending_update_count || 0}`);
  console.log(`   Last error: ${info.result?.last_error_message || 'none'}\n`);

  console.log('========================================');
  console.log('  Setup Complete!');
  console.log('========================================\n');
  console.log(`  Bot:       @${me.result.username}`);
  console.log(`  Webhook:   ${WEBHOOK_URL}`);
  console.log(`  Mini App:  ${MINI_APP_URL}`);
  console.log('');
  console.log('  How it works:');
  console.log('  1. User opens bot → /start → main menu with inline buttons');
  console.log('  2. "STSphera" button next to input field opens Mini App');
  console.log('  3. Bot webhook processes commands via Supabase Edge Function');
  console.log('');
  console.log('  NOTE: You need to enable GitHub Pages:');
  console.log('    Repo Settings → Pages → Source: Deploy from branch');
  console.log('    Branch: gh-pages → / (root) → Save');
  console.log('');
}

main().catch(console.error);
