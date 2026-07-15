const USER_STORAGE_KEY = 'ten-user-v1';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function loadUserFromStorage() {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.id) return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

function authHeaders(extra = {}) {
  const stored = loadUserFromStorage();
  const headers = { ...extra };
  if (stored?.id) headers['X-User-Id'] = String(stored.id);
  return headers;
}

async function apiFetch(url, options = {}) {
  const headers = authHeaders(options.headers || {});
  return fetch(url, { ...options, headers });
}

function formatDays(days) {
  const formatted = Number.isInteger(days) ? String(days) : days.toFixed(1);
  const unit = days === 1 ? 'day' : 'days';
  return `~${formatted} ${unit}`;
}

function showError(message) {
  document.getElementById('ops-loading')?.classList.add('hidden');
  document.getElementById('ops-main')?.classList.add('hidden');
  const errorEl = document.getElementById('ops-error');
  if (!errorEl) return;
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
}

function renderPoolHealth(languages) {
  const list = document.getElementById('ops-pool-list');
  if (!list) return;
  if (!languages.length) {
    list.innerHTML = '<p class="status-line">Could not load pool data.</p>';
    return;
  }
  list.innerHTML = languages.map(lang => {
    const cardClass = lang.warning ? 'ops-lang-row surface-card warning' : 'ops-lang-row surface-card';
    return `<article class="${cardClass}"><span class="ops-lang-title">${lang.flagEmoji} ${escapeHtml(lang.label)}</span><span class="ops-lang-runway">${formatDays(lang.minDaysLeft)}</span></article>`;
  }).join('');
}

function renderFeedback(entries) {
  const list = document.getElementById('ops-feedback-list');
  if (!list) return;
  if (!entries.length) {
    list.innerHTML = '<p class="status-line">No feedback yet.</p>';
    return;
  }
  list.innerHTML = entries.map(entry => {
    const when = entry.createdAt
      ? new Date(entry.createdAt * 1000).toLocaleString()
      : '';
    return `<article class="ops-feedback-item"><div class="ops-feedback-meta">${escapeHtml(entry.username || 'user')} · ${escapeHtml(when)}</div><p>${escapeHtml(entry.body || '')}</p></article>`;
  }).join('');
}

async function initOps() {
  const stored = loadUserFromStorage();
  if (!stored?.id) {
    window.location.replace('/');
    return;
  }

  const meResponse = await apiFetch('/api/me', { cache: 'no-store' });
  if (!meResponse.ok) {
    showError('Sign in on the main app first.');
    return;
  }
  const me = await meResponse.json();
  if (!me.isDev) {
    window.location.replace('/');
    return;
  }

  const opsResponse = await apiFetch('/api/dev/ops', { cache: 'no-store' });
  if (!opsResponse.ok) {
    showError('Could not load ops data.');
    return;
  }
  const payload = await opsResponse.json();
  document.getElementById('ops-loading')?.classList.add('hidden');
  document.getElementById('ops-main')?.classList.remove('hidden');
  renderPoolHealth(Array.isArray(payload.languages) ? payload.languages : []);
  renderFeedback(Array.isArray(payload.feedback) ? payload.feedback : []);
}

initOps().catch(() => showError('Could not load ops data.'));
