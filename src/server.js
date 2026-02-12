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

function toPositiveInteger(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function toApiProfile(profile) {
  if (!profile) {
    return null;
  }

  return {
    id: profile.id,
    username: profile.username,
    firstName: profile.firstName,
    lastName: profile.lastName,
    submissions: profile.submissions,
    lastCounter: profile.lastCounter,
    lastPayload: profile.lastPayload,
    updatedAt: profile.updatedAt,
  };
}

function startMiniAppServer({ port, miniAppPath, store }) {
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

  app.get('/api/users/:userId', (req, res) => {
    if (!store) {
      res.status(503).json({ ok: false, error: 'store_unavailable' });
      return;
    }

    const userId = toPositiveInteger(req.params.userId);
    if (!userId) {
      res.status(400).json({ ok: false, error: 'invalid_user_id' });
      return;
    }

    const profile = store.getUserProfile(userId);
    if (!profile) {
      res.status(404).json({ ok: false, error: 'not_found' });
      return;
    }

    res.json({ ok: true, profile: toApiProfile(profile) });
  });

  app.get('/api/stats', (_req, res) => {
    if (!store) {
      res.status(503).json({ ok: false, error: 'store_unavailable' });
      return;
    }

    const stats = store.getGlobalStats();
    res.json({ ok: true, stats });
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
