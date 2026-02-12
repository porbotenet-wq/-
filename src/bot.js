const { Telegraf } = require('telegraf');

function parsePayload(data) {
  try {
    const payload = JSON.parse(data);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return null;
    }
    return payload;
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

function formatProfile(profile) {
  if (!profile) {
    return 'No profile yet. Open mini app and send data first.';
  }

  const fullName = [profile.firstName, profile.lastName]
    .filter(Boolean)
    .join(' ');
  const displayName = fullName || profile.username || `id:${profile.id}`;
  const lastPayload = profile.lastPayload;
  const lastPayloadLine = lastPayload
    ? `last_payload_counter=${lastPayload.counter ?? 'n/a'}\nlast_payload_category=${lastPayload.category ?? 'n/a'}`
    : 'last_payload=n/a';

  return [
    `profile=${displayName}`,
    `submissions=${profile.submissions}`,
    `last_counter=${profile.lastCounter}`,
    lastPayloadLine,
    `updated_at=${profile.updatedAt}`,
  ].join('\n');
}

function formatSavedPayload(payload, profile) {
  return [
    'Saved mini app payload.',
    `counter=${payload.counter ?? 'n/a'}`,
    `category=${payload.category ?? 'n/a'}`,
    `note=${payload.note ?? 'n/a'}`,
    `sent_at=${payload.sentAt ?? 'n/a'}`,
    `submissions_total=${profile?.submissions ?? 'n/a'}`,
  ].join('\n');
}

async function safeTrackUser(store, user) {
  if (!store || !user) {
    return;
  }
  await store.trackUser(user);
}

function createBot({ token, miniAppUrl, store }) {
  const bot = new Telegraf(token);

  bot.start(async (ctx) => {
    await safeTrackUser(store, ctx.from);

    await ctx.reply(
      'Hi! I am a bot with mini app support. Tap the button below to open it.\nUse /profile to view your saved state.',
      {
        reply_markup: {
          keyboard: [[createMiniAppButton(miniAppUrl)]],
          resize_keyboard: true,
        },
      },
    );
  });

  bot.command('miniapp', async (ctx) => {
    await safeTrackUser(store, ctx.from);

    await ctx.reply('Opening mini app:', {
      reply_markup: {
        inline_keyboard: [[createMiniAppButton(miniAppUrl)]],
      },
    });
  });

  bot.command('profile', async (ctx) => {
    await safeTrackUser(store, ctx.from);

    if (!store || !ctx.from?.id) {
      await ctx.reply('Profile storage is not configured.');
      return;
    }

    const profile = store.getUserProfile(ctx.from.id);
    await ctx.reply(formatProfile(profile));
  });

  bot.command('reset', async (ctx) => {
    await safeTrackUser(store, ctx.from);

    if (!store || !ctx.from?.id) {
      await ctx.reply('Profile storage is not configured.');
      return;
    }

    const profile = await store.resetUser(ctx.from.id);
    if (!profile) {
      await ctx.reply('Nothing to reset yet.');
      return;
    }

    await ctx.reply('Your profile state has been reset.');
  });

  bot.command('stats', async (ctx) => {
    await safeTrackUser(store, ctx.from);

    if (!store) {
      await ctx.reply('Stats are not available right now.');
      return;
    }

    const stats = store.getGlobalStats();
    await ctx.reply(
      [
        'Global stats:',
        `users=${stats.users}`,
        `total_submissions=${stats.totalSubmissions}`,
        `last_activity_at=${stats.lastActivityAt ?? 'n/a'}`,
      ].join('\n'),
    );
  });

  bot.command('help', async (ctx) => {
    await ctx.reply(
      [
        'Available commands:',
        '/start - greeting and button',
        '/miniapp - open mini app',
        '/profile - show your saved profile',
        '/reset - reset your profile state',
        '/stats - show global stats',
      ].join('\n'),
    );
  });

  bot.on('message', async (ctx) => {
    await safeTrackUser(store, ctx.from);

    const rawData = ctx.message?.web_app_data?.data;
    if (!rawData) {
      return;
    }

    const payload = parsePayload(rawData);
    if (!payload) {
      await ctx.reply('Invalid mini app payload received.');
      return;
    }

    if (!store) {
      await ctx.reply(
        [
          'Received data from mini app.',
          `counter=${payload.counter ?? 'n/a'}`,
          `sent_at=${payload.sentAt ?? 'n/a'}`,
        ].join('\n'),
      );
      return;
    }

    const savedProfile = await store.saveMiniAppPayload(ctx.from, payload);
    await ctx.reply(formatSavedPayload(payload, savedProfile));
  });

  return bot;
}

async function launchBot(bot) {
  await bot.telegram.setMyCommands([
    { command: 'start', description: 'Start bot' },
    { command: 'miniapp', description: 'Open mini app' },
    { command: 'profile', description: 'Show your profile state' },
    { command: 'reset', description: 'Reset your profile state' },
    { command: 'stats', description: 'Show global stats' },
    { command: 'help', description: 'Show help' },
  ]);

  await bot.launch();
}

module.exports = {
  createBot,
  launchBot,
};
