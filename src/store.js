const fs = require('node:fs/promises');
const path = require('node:path');

function nowIso() {
  return new Date().toISOString();
}

function createDefaultState() {
  return {
    users: {},
  };
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function toOptionalString(value, maxLength) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, maxLength);
}

function toOptionalNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return null;
}

function sanitizePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }

  const sentAt =
    typeof payload.sentAt === 'string' && !Number.isNaN(Date.parse(payload.sentAt))
      ? payload.sentAt
      : nowIso();

  return {
    counter: toOptionalNumber(payload.counter),
    category: toOptionalString(payload.category, 60),
    note: toOptionalString(payload.note, 300),
    sentAt,
  };
}

function normalizeUserRecord(userId, existingRecord) {
  const fallbackDate = nowIso();
  const record = existingRecord || {};
  const submissions =
    typeof record.submissions === 'number' && Number.isFinite(record.submissions)
      ? Math.max(0, Math.floor(record.submissions))
      : 0;

  const lastCounter =
    typeof record.lastCounter === 'number' && Number.isFinite(record.lastCounter)
      ? record.lastCounter
      : 0;

  return {
    id: Number(userId),
    username: toOptionalString(record.username, 120),
    firstName: toOptionalString(record.firstName, 120),
    lastName: toOptionalString(record.lastName, 120),
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : fallbackDate,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : fallbackDate,
    submissions,
    lastCounter,
    lastPayload: sanitizePayload(record.lastPayload),
  };
}

class JsonStateStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.state = createDefaultState();
    this.writeQueue = Promise.resolve();
  }

  async initialize() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });

    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      const parsedUsers =
        parsed && typeof parsed === 'object' && parsed.users && typeof parsed.users === 'object'
          ? parsed.users
          : {};

      this.state.users = Object.fromEntries(
        Object.entries(parsedUsers).map(([userId, record]) => [
          userId,
          normalizeUserRecord(userId, record),
        ]),
      );
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      await this.persist();
    }
  }

  upsertUserRecord(user) {
    if (!user || typeof user.id !== 'number') {
      return null;
    }

    const userId = String(user.id);
    const existing = this.state.users[userId];
    const record = normalizeUserRecord(userId, existing);

    record.username = toOptionalString(user.username, 120);
    record.firstName = toOptionalString(user.first_name, 120);
    record.lastName = toOptionalString(user.last_name, 120);
    record.updatedAt = nowIso();

    this.state.users[userId] = record;
    return record;
  }

  async persist() {
    const snapshot = `${JSON.stringify(this.state, null, 2)}\n`;

    this.writeQueue = this.writeQueue.then(() =>
      fs.writeFile(this.filePath, snapshot, 'utf8'),
    );

    await this.writeQueue;
  }

  async trackUser(user) {
    const record = this.upsertUserRecord(user);
    if (!record) {
      return null;
    }

    await this.persist();
    return deepClone(record);
  }

  async saveMiniAppPayload(user, payload) {
    const record = this.upsertUserRecord(user);
    if (!record) {
      return null;
    }

    const sanitizedPayload = sanitizePayload(payload);
    record.submissions += 1;
    record.lastPayload = sanitizedPayload;
    if (typeof sanitizedPayload.counter === 'number') {
      record.lastCounter = sanitizedPayload.counter;
    }

    await this.persist();
    return deepClone(record);
  }

  getUserProfile(userId) {
    const record = this.state.users[String(userId)];
    if (!record) {
      return null;
    }
    return deepClone(record);
  }

  async resetUser(userId) {
    const record = this.state.users[String(userId)];
    if (!record) {
      return null;
    }

    record.submissions = 0;
    record.lastCounter = 0;
    record.lastPayload = null;
    record.updatedAt = nowIso();

    await this.persist();
    return deepClone(record);
  }

  getGlobalStats() {
    const allUsers = Object.values(this.state.users);
    const totalSubmissions = allUsers.reduce(
      (sum, user) => sum + (user.submissions || 0),
      0,
    );

    const lastActivityAt = allUsers
      .map((user) => user.updatedAt)
      .filter((updatedAt) => typeof updatedAt === 'string')
      .sort()
      .pop() || null;

    return {
      users: allUsers.length,
      totalSubmissions,
      lastActivityAt,
    };
  }
}

async function createStore({ filePath }) {
  const resolvedPath =
    filePath
      ? path.resolve(filePath)
      : path.resolve(__dirname, '..', 'data', 'state.json');

  const store = new JsonStateStore(resolvedPath);
  await store.initialize();
  return store;
}

module.exports = {
  createStore,
};
