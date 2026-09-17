// ============================================
// TabPilot — Popup Logic
// ============================================

let starredTabId = null; // null | number

document.addEventListener('DOMContentLoaded', async () => {
  await loadStarredTab();
  initSearch();
  initTabList();
  initRefreshTabs();
  initStarBtn();
  initDemoBtn();
});

// ── Helpers ──────────────────────────────────

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icon = type === 'success'
    ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
    : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;

  toast.innerHTML = `${icon}<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 220);
  }, 2200);
}

function truncate(str, maxLen) {
  if (!str) return '';
  return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
}

// ── Starred Tab ──────────────────────────────

async function loadStarredTab() {
  const result = await chrome.storage.local.get('starredTabId');
  starredTabId = result.starredTabId ?? null;
  updateStarBtnState();
}

async function saveStarredTab(tabId) {
  starredTabId = tabId;
  await chrome.storage.local.set({ starredTabId: tabId });
  updateStarBtnState();
}

async function clearStarredTab() {
  starredTabId = null;
  await chrome.storage.local.set({ starredTabId: null });
  updateStarBtnState();
}

function updateStarBtnState() {
  const btn = document.getElementById('star-btn');
  const svg = document.getElementById('star-icon');
  if (!btn || !svg) return;

  if (starredTabId !== null) {
    btn.classList.add('active');
    svg.setAttribute('fill', 'currentColor');
    btn.title = 'Go to starred tab';
  } else {
    btn.classList.remove('active');
    svg.setAttribute('fill', 'none');
    btn.title = 'No starred tab';
  }
}

function initStarBtn() {
  const btn = document.getElementById('star-btn');
  btn.addEventListener('click', async () => {
    if (starredTabId === null) {
      showToast('No starred tab set', 'error');
      return;
    }
    await switchToStarredFromBackground(starredTabId);
  });
}

// ── Demo page ────────────────────────────────

function initDemoBtn() {
  const btn = document.getElementById('demo-btn');
  btn.addEventListener('click', () => {
    const url = chrome.runtime.getURL('index.html');
    chrome.tabs.create({ url });
    window.close(); // close the popup
  });
}

async function switchToStarredFromBackground(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    await chrome.runtime.sendMessage({ type: 'SWITCH_TO_STARRED', tabId });
    showToast(`Switched to: ${truncate(tab.title || '', 38)}`);
    renderTabListWithFilter();
  } catch (err) {
    showToast('Failed to switch tab', 'error');
  }
}

async function toggleStar(tabId) {
  if (starredTabId === tabId) {
    await clearStarredTab();
    showToast('Star removed');
  } else {
    await saveStarredTab(tabId);
    try {
      const tab = await chrome.tabs.get(tabId);
      showToast(`Starred: ${truncate(tab.title || '', 32)}`);
    } catch {
      showToast('Tab starred');
    }
  }
  renderTabList(cachedTabs);
}

// ── Search / Filter ─────────────────────────

let currentQuery = '';

function filterTabs(tabs, query) {
  if (!query) return tabs;
  const q = query.toLowerCase();
  return tabs.filter(tab => {
    const title = (tab.title || '').toLowerCase();
    const url = (tab.url || '').toLowerCase();
    return title.includes(q) || url.includes(q);
  });
}

function initSearch() {
  const input = document.getElementById('search-input');
  const clearBtn = document.getElementById('search-clear-btn');

  input.addEventListener('input', () => {
    currentQuery = input.value.trim();
    clearBtn.style.display = currentQuery ? 'flex' : 'none';
    renderTabListWithFilter();
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    currentQuery = '';
    clearBtn.style.display = 'none';
    input.focus();
    renderTabListWithFilter();
  });

  clearBtn.style.display = 'none';
}

function renderTabListWithFilter() {
  const filtered = filterTabs(cachedTabs, currentQuery);
  renderTabList(filtered);

  const countBadge = document.getElementById('tab-count');
  if (currentQuery) {
    countBadge.textContent = `${filtered.length}/${cachedTabs.length}`;
  } else {
    countBadge.textContent = cachedTabs.length;
  }
}

// ── Tab List ──────────────────────────────

let cachedTabs = [];

async function loadTabs() {
  const tabListEl = document.getElementById('tab-list');
  const countBadge = document.getElementById('tab-count');

  tabListEl.innerHTML = '<div class="tab-list-empty">Loading...</div>';

  try {
    const tabs = await chrome.tabs.query({});
    tabs.sort((a, b) => {
      if (a.windowId !== b.windowId) return a.windowId - b.windowId;
      return a.index - b.index;
    });
    cachedTabs = tabs;
    countBadge.textContent = tabs.length;
    renderTabListWithFilter();
  } catch (err) {
    tabListEl.innerHTML = '<div class="tab-list-empty">Failed to load tabs.</div>';
    console.error(err);
  }
}

function renderTabList(tabs) {
  const tabListEl = document.getElementById('tab-list');

  if (!tabs || tabs.length === 0) {
    tabListEl.innerHTML = '<div class="tab-list-empty">No tabs open.</div>';
    return;
  }

  tabListEl.innerHTML = '';

  tabs.forEach((tab) => {
    const item = document.createElement('div');
    item.className = 'tab-item';
    item.dataset.tabId = tab.id;

    const isActive = tab.active;
    const isStarred = starredTabId === tab.id;
    if (isActive) item.classList.add('active');
    if (isStarred) item.classList.add('starred');

    const faviconUrl = tab.favIconUrl || '';
    const hasFavicon = faviconUrl.startsWith('chrome://favicon/') || faviconUrl.startsWith('data:');
    const faviconHtml = hasFavicon
      ? `<img class="tab-favicon" src="${faviconUrl}" alt="" />`
      : '';
    const placeholderFavicon = !hasFavicon
      ? `<div class="tab-favicon-placeholder">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
             <circle cx="12" cy="12" r="10"/>
             <line x1="2" y1="12" x2="22" y2="12"/>
             <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
           </svg>
         </div>`
      : '';

    const title = truncate(tab.title || '(No title)', 42);
    const url = truncate(tab.url || '', 50);

    const activeDot = isActive
      ? '<div class="dot-active" title="Active"></div>'
      : '';

    item.innerHTML = `
      ${faviconHtml}
      ${placeholderFavicon}
      <div class="tab-info">
        <div class="tab-title" title="${tab.title || ''}">${title}</div>
        <div class="tab-url" title="${tab.url || ''}">${url}</div>
      </div>
      <button class="tab-star-btn${isStarred ? ' starred' : ''}" data-tab-id="${tab.id}" title="${isStarred ? 'Unstar' : 'Star this tab'}">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="${isStarred ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      </button>
      <span class="tab-index">#${tab.index + 1}</span>
      ${activeDot}
    `;

    item.addEventListener('click', (e) => {
      if (e.target.closest('.tab-star-btn')) return;
      switchToTab(tab.id);
    });

    const starBtn = item.querySelector('.tab-star-btn');
    starBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleStar(tab.id);
    });

    item.addEventListener('auxclick', (e) => {
      if (e.button === 1) closeTab(tab.id);
    });
    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      navigator.clipboard.writeText(String(tab.id)).then(() => {
        showToast(`Copied tab ID: ${tab.id}`);
      }).catch(() => {
        showToast('Failed to copy', 'error');
      });
    });

    tabListEl.appendChild(item);
  });
}

function initTabList() {
  loadTabs();
}

function initRefreshTabs() {
  const btn = document.getElementById('refresh-tabs-btn');
  const icon = document.getElementById('refresh-icon');

  btn.addEventListener('click', () => {
    icon.closest('button').classList.add('spinning');
    icon.style.animation = 'none';
    icon.offsetHeight;
    icon.style.animation = '';

    loadTabs().finally(() => {
      setTimeout(() => {
        icon.closest('button').classList.remove('spinning');
      }, 500);
    });
  });
}

// ── Utility Actions ──────────────────────────

async function switchToTab(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    await chrome.tabs.update(tabId, { active: true, highlighted: true });
    if (tab.windowId) {
      await chrome.windows.update(tab.windowId, { focused: true });
    }
    showToast(`Switched to: ${truncate(tab.title || '', 38)}`);
    renderTabListWithFilter();
  } catch (err) {
    showToast('Failed to switch tab', 'error');
  }
}

async function closeTab(tabId) {
  if (tabId === starredTabId) await clearStarredTab();
  try {
    await chrome.tabs.remove(tabId);
    showToast('Tab closed');
    setTimeout(renderTabListWithFilter, 150);
  } catch (err) {
    showToast('Failed to close tab', 'error');
  }
}
