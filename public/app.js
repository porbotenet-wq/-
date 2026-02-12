const tg = window.Telegram?.WebApp;

const statusEl = document.getElementById('status');
const userNameEl = document.getElementById('user-name');
const counterValueEl = document.getElementById('counter-value');
const categoryInput = document.getElementById('category-input');
const noteInput = document.getElementById('note-input');
const submissionsValueEl = document.getElementById('submissions-value');
const decrementBtn = document.getElementById('decrement-btn');
const incrementBtn = document.getElementById('increment-btn');
const sendBtn = document.getElementById('send-btn');

const state = {
  counter: 0,
  submissions: 0,
};

function renderCounter() {
  counterValueEl.textContent = String(state.counter);
}

function renderSubmissions() {
  submissionsValueEl.textContent = String(state.submissions);
}

function setStatus(text) {
  statusEl.textContent = text;
}

function applyTelegramTheme() {
  if (!tg) {
    return;
  }

  const bgColor = tg.themeParams.bg_color || '#f6f8fb';
  const textColor = tg.themeParams.text_color || '#0f172a';
  document.body.style.backgroundColor = bgColor;
  document.body.style.color = textColor;
}

function updateUserInfo() {
  if (!tg?.initDataUnsafe?.user) {
    userNameEl.textContent = 'Opened outside Telegram';
    return;
  }

  const user = tg.initDataUnsafe.user;
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ');
  userNameEl.textContent = fullName || user.username || 'Telegram user';
}

function hasCategoryOption(value) {
  return Array.from(categoryInput.options).some((option) => option.value === value);
}

async function loadSavedProfile() {
  const userId = tg?.initDataUnsafe?.user?.id;
  if (!userId) {
    return;
  }

  try {
    const response = await fetch(`/api/users/${userId}`);
    if (!response.ok) {
      return;
    }

    const body = await response.json();
    if (!body?.ok || !body.profile) {
      return;
    }

    const profile = body.profile;
    if (typeof profile.lastCounter === 'number' && Number.isFinite(profile.lastCounter)) {
      state.counter = profile.lastCounter;
    }
    if (typeof profile.submissions === 'number' && Number.isFinite(profile.submissions)) {
      state.submissions = profile.submissions;
    }

    if (
      profile.lastPayload &&
      typeof profile.lastPayload.category === 'string' &&
      hasCategoryOption(profile.lastPayload.category)
    ) {
      categoryInput.value = profile.lastPayload.category;
    }

    if (profile.lastPayload && typeof profile.lastPayload.note === 'string') {
      noteInput.value = profile.lastPayload.note;
    }

    renderCounter();
    renderSubmissions();
    setStatus('Loaded previous profile state');
  } catch (_error) {
    setStatus('Ready');
  }
}

function sendDataToBot() {
  if (!tg?.sendData) {
    setStatus('Send data is available only inside Telegram');
    return;
  }

  const note = noteInput.value.trim().slice(0, 300);
  const payload = {
    counter: state.counter,
    category: categoryInput.value,
    note: note || null,
    sentAt: new Date().toISOString(),
  };

  tg.sendData(JSON.stringify(payload));
  state.submissions += 1;
  renderSubmissions();
  setStatus('Data sent to bot');
}

decrementBtn.addEventListener('click', () => {
  state.counter -= 1;
  renderCounter();
});

incrementBtn.addEventListener('click', () => {
  state.counter += 1;
  renderCounter();
});

sendBtn.addEventListener('click', sendDataToBot);

if (tg) {
  tg.ready();
  tg.expand();
}

async function init() {
  renderCounter();
  renderSubmissions();
  updateUserInfo();
  applyTelegramTheme();
  await loadSavedProfile();
}

void init();
