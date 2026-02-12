const { Telegraf } = require('telegraf');

function parsePayload(data) {
  try {
    return JSON.parse(data);
  } catch (_error) {
    return null;
  }
}

function createMiniAppButton(miniAppUrl) {
  return {
    text: 'Open mini app',
    web_app: { url: miniAppUrl },
  };
}

function createBot({ token, miniAppUrl }) {
  const bot = new Telegraf(token);

  bot.start(async (ctx) => {
    await ctx.reply(
      'Hi! I am a bot with mini app support. Tap the button below to open it.',
      {
        reply_markup: {
          keyboard: [[createMiniAppButton(miniAppUrl)]],
          resize_keyboard: true,
        },
      },
    );
  });

  bot.command('miniapp', async (ctx) => {
    await ctx.reply('Opening mini app:', {
      reply_markup: {
        inline_keyboard: [[createMiniAppButton(miniAppUrl)]],
      },
    });
  });

  bot.command('help', async (ctx) => {
    await ctx.reply(
      'Available commands:\n/start - greeting and button\n/miniapp - open mini app',
    );
  });

  bot.on('message', async (ctx) => {
    const rawData = ctx.message?.web_app_data?.data;
    if (!rawData) {
      return;
    }

    const payload = parsePayload(rawData);
    if (!payload) {
      await ctx.reply(`Received data from mini app: ${rawData}`);
      return;
    }

    const { counter, sentAt } = payload;
    await ctx.reply(
      `Received data from mini app:\ncounter=${counter ?? 'n/a'}\nsentAt=${sentAt ?? 'n/a'}`,
    );
  });

  return bot;
}

async function launchBot(bot) {
  await bot.telegram.setMyCommands([
    { command: 'start', description: 'Start bot' },
    { command: 'miniapp', description: 'Open mini app' },
    { command: 'help', description: 'Show help' },
  ]);

  await bot.launch();
}

module.exports = {
  createBot,
  launchBot,
};
