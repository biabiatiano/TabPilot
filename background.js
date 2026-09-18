// ============================================
// TabPilot — Background Service Worker
// Manifest V3 requires a background service worker.
// ============================================

chrome.runtime.onInstalled.addListener((details) => {
  console.log('[TabPilot] Extension installed:', details.reason);
});

chrome.runtime.onStartup.addListener(() => {
  console.log('[TabPilot] Browser started');
});

// ── Keyboard command: open the quick-launch page ──
chrome.commands.onCommand.addListener((command) => {
  if (command === 'open-index') {
    const url = chrome.runtime.getURL('index.html');
    // If the index page is already open, activate it; otherwise create a new tab.
    chrome.tabs.query({ url }, (tabs) => {
      const existing = tabs && tabs.length ? tabs[0] : null;
      if (existing) {
        chrome.tabs.update(existing.id, { active: true, highlighted: true });
        chrome.windows.update(existing.windowId, { focused: true });
        // 页面可能已打开且焦点在搜索框之外，通知其重新聚焦输入框
        chrome.tabs.sendMessage(existing.id, { type: 'FOCUS_INPUT' }).catch(() => {});
      } else {
        chrome.tabs.create({ url });
      }
    });
  } else if (command === 'go-to-starred') {
    // 快捷键跳转到用户标星的页面；未设置标星时忽略。
    chrome.storage.local.get('starredTabId', ({ starredTabId }) => {
      if (starredTabId) switchToStarredTab(starredTabId, null);
    });
  } else if (command === 'set-starred') {
    // 快捷键将当前活动页签设为星标页面。
    setStarredFromShortcut();
  }
});

// ── Alt+L: toggle the currently active tab as the starred tab ──
async function setStarredFromShortcut() {
  try {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const tab = tabs && tabs.length ? tabs[0] : null;
    if (!tab) return;
    if (tab.id == null) return; // e.g. the new-tab page has no id
    // 焦点在 index 页面时，通知页面对其下拉选中项执行标星/取消（交由页面内处理）
    if (tab.url === chrome.runtime.getURL('index.html')) {
      chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_DROPDOWN_STAR' }).catch(() => {});
      return;
    }

    const { starredTabId } = await chrome.storage.local.get('starredTabId');
    const label = tab.title ? `「${truncate(tab.title, 40)}」` : '当前页签';
    if (starredTabId === tab.id) {
      // 已标星则取消
      await chrome.storage.local.set({ starredTabId: null });
      showSuccessNotification('已取消标星', label);
    } else {
      // 否则标记为星标
      await chrome.storage.local.set({ starredTabId: tab.id });
      showSuccessNotification('已标记为星标', label);
    }
  } catch (err) {
    console.error('[TabPilot] set-starred failed:', err);
  }
}

// ── System notification ───────────────────────
function showSuccessNotification(title, message) {
  chrome.notifications.create('', {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title,
    message,
    priority: 1,
  });
}

function truncate(str, maxLen) {
  if (!str) return '';
  return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
}

// ── Port Handler (for external web pages) ──────
// External pages open a long-lived port; the service worker
// wakes up when the port is first opened.

chrome.runtime.onConnectExternal.addListener((port) => {
  console.log('[TabPilot] External port connected from:', port.sender?.url);
  port.onMessage.addListener((message) => {
    if (message.type === 'SWITCH_TO_STARRED') {
      switchToStarredTab(message.tabId, port);
    }
  });
});

// ── Message Handler ──────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SWITCH_TO_STARRED') {
    switchToStarredTab(message.tabId, null, sendResponse);
    return true; // keep channel open for async sendResponse
  }
});

async function switchToStarredTab(tabId, port, sendResponse) {
  try {
    const tab = await chrome.tabs.get(tabId);
    await chrome.tabs.update(tabId, { active: true, highlighted: true });
    if (tab.windowId) {
      await chrome.windows.update(tab.windowId, { focused: true });
    }
    const result = { ok: true };
    if (port) port.postMessage(result);
    else sendResponse?.(result);
  } catch (err) {
    const result = { ok: false, error: err.message };
    if (port) port.postMessage(result);
    else sendResponse?.(result);
  }
}
