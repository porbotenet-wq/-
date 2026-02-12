const tg = window.Telegram?.WebApp;

const statusEl = document.getElementById('status');
const userNameEl = document.getElementById('user-name');
const counterValueEl = document.getElementById('counter-value');
const decrementBtn = document.getElementById('decrement-btn');
const incrementBtn = document.getElementById('increment-btn');
const sendBtn = document.getElementById('send-btn');

const state = {
  counter: 0,
};

function renderCounter() {
  counterValueEl.textContent = String(state.counter);
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

function sendDataToBot() {
  if (!tg?.sendData) {
    statusEl.textContent = 'Send data is available only inside Telegram';
    return;
  }

  const payload = {
    counter: state.counter,
    sentAt: new Date().toISOString(),
  };

  tg.sendData(JSON.stringify(payload));
  statusEl.textContent = 'Data sent to bot';
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

renderCounter();
updateUserInfo();
applyTelegramTheme();
