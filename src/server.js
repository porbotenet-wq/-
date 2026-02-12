const path = require('node:path');
const express = require('express');

function normalizeMiniAppPath(miniAppPath) {
  if (!miniAppPath || miniAppPath === '/') {
    return '/';
  }

  const withLeadingSlash = miniAppPath.startsWith('/')
    ? miniAppPath
    : `/${miniAppPath}`;

  return withLeadingSlash.replace(/\/+$/, '');
}

function startMiniAppServer({ port, miniAppPath }) {
  const app = express();
  const publicDir = path.resolve(__dirname, '..', 'public');
  const mountedPath = normalizeMiniAppPath(miniAppPath);

  app.use(express.static(publicDir));

  if (mountedPath !== '/') {
    app.use(mountedPath, express.static(publicDir));
    app.get(mountedPath, (_req, res) => {
      res.sendFile(path.join(publicDir, 'index.html'));
    });
  }

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  return new Promise((resolve, reject) => {
    const server = app.listen(port);

    server.once('listening', () => {
      resolve({ app, server });
    });

    server.once('error', (error) => {
      reject(error);
    });
  });
}

module.exports = {
  startMiniAppServer,
};
