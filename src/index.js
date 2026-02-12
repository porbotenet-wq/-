const dotenv = require('dotenv');
const { createBot, launchBot } = require('./bot');
const { startMiniAppServer } = require('./server');

dotenv.config();

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function normalizeBaseUrl(url) {
  return url.replace(/\/+$/, '');
}

function buildMiniAppUrl(baseUrl, miniAppPath) {
  const sanitizedPath = miniAppPath.startsWith('/') ? miniAppPath : `/${miniAppPath}`;
  return `${normalizeBaseUrl(baseUrl)}${sanitizedPath}`;
}

async function main() {
  const token = getRequiredEnv('BOT_TOKEN');
  const port = Number(process.env.PORT || 3000);
  if (Number.isNaN(port) || port <= 0) {
    throw new Error('PORT must be a positive number');
  }

  const publicUrl = normalizeBaseUrl(
    process.env.PUBLIC_URL || `http://localhost:${port}`,
  );
  const miniAppPath = process.env.MINI_APP_PATH || '/';
  const miniAppUrl = buildMiniAppUrl(publicUrl, miniAppPath);

  const { server } = await startMiniAppServer({ port, miniAppPath });
  const bot = createBot({ token, miniAppUrl });
  await launchBot(bot);

  console.log(`Mini app server is running on port ${port}`);
  console.log(`Mini app URL: ${miniAppUrl}`);

  const stop = (signal) => {
    console.log(`Received ${signal}, shutting down...`);
    bot.stop(signal);
    server.close(() => {
      process.exit(0);
    });
  };

  process.once('SIGINT', () => stop('SIGINT'));
  process.once('SIGTERM', () => stop('SIGTERM'));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
