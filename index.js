// TabPilot — 内部 Index 页面逻辑
// 输入文字或网址：实时下拉展示已打开的页签，点选跳转；输入网址且无匹配页签时，回车用新页签打开。

const input = document.getElementById('query');
const dropdown = document.getElementById('dropdown');
const clearBtn = document.getElementById('search-clear');

// 打开页面后自动将光标焦点落在搜索框
input.focus();

// ── 标星页面 ─────────────────────────────
// 与 popup 共用同一 storage key「starredTabId」，两处入口标星/跳转状态实时互通。
let starredTabId = null;

async function loadStarredTab() {
  const r = await chrome.storage.local.get('starredTabId');
  starredTabId = r.starredTabId ?? null;
  updateStarBtnState();
}

function updateStarBtnState() {
  const btn = document.getElementById('index-star-btn');
  if (!btn) return;
  if (starredTabId !== null) {
    btn.classList.add('active');
    btn.title = '跳转到标星的页面 (Alt+K)';
  } else {
    btn.classList.remove('active');
    btn.title = '暂无标星的页面，请在下拉中给某页点星';
  }
}

async function toggleStarTab(tabId) {
  starredTabId = starredTabId === tabId ? null : tabId;
  await chrome.storage.local.set({ starredTabId });
  updateStarBtnState();
  render(currentList); // 刷新下拉中的星标态
}

async function switchToStarredFromBackground(tabId) {
  try {
    await chrome.runtime.sendMessage({ type: 'SWITCH_TO_STARRED', tabId });
  } catch (err) {
    console.error('[TabPilot] switch to starred failed:', err);
  }
}

function initStarJump() {
  const btn = document.getElementById('index-star-btn');
  btn.addEventListener('click', () => {
    if (starredTabId !== null) switchToStarredFromBackground(starredTabId);
  });
}

loadStarredTab();
initStarJump();

// ── 跨页面同步标星状态 ─────────────────────
// popup 等入口改写 starredTabId 时，storage 会广播变化到所有扩展页面，
// 本页据此更新内存变量并刷新下拉星标态，保证两处标星状态实时一致。
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes.starredTabId) return;
  starredTabId = changes.starredTabId.newValue ?? null;
  updateStarBtnState();
  render(currentList);
});

// 点击清除按钮 → 快速清空输入框并收起下拉
clearBtn.addEventListener('click', () => {
  input.value = '';
  collapseDropdown();
  updateClearBtn();
  input.focus();
});
const extUrlSpan = document.getElementById('ext-url');

if (extUrlSpan) extUrlSpan.textContent = chrome.runtime.id;

// ── 帮助浮窗 ─────────────────────────────────

const helpLink = document.getElementById('help-link');
const helpModal = document.getElementById('help-modal');
const modalClose = document.getElementById('modal-close');

function openHelp() {
  helpModal.classList.add('show');
  helpModal.addEventListener('click', onMaskClick);
  document.addEventListener('keydown', onModalKey);
}

function closeHelp() {
  helpModal.classList.remove('show');
  helpModal.removeEventListener('click', onMaskClick);
  document.removeEventListener('keydown', onModalKey);
}

function onMaskClick(e) {
  if (e.target === helpModal) closeHelp();
}

function onModalKey(e) {
  if (e.key === 'Escape') closeHelp();
}

helpLink.addEventListener('click', (e) => {
  e.preventDefault();
  openHelp();
});
modalClose.addEventListener('click', closeHelp);

// ── 帮助浮窗中的「快捷键设置」链接 ─────────────
// chrome:// 地址无法在扩展页通过 <a href> 直接跳转，改用 chrome.tabs.create 打开。
const shortcutsLink = document.getElementById('shortcuts-link');
shortcutsLink.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});

// 轻提示：显示若干秒后自动消失
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

let allTabs = [];
let activeIndex = -1;
let currentList = [];

// ── 数据加载 ─────────────────────────────────

async function loadTabs() {
  allTabs = await chrome.tabs.query({});
}

// ── 过滤 ─────────────────────────────────────

function filterTabs(q) {
  q = q.trim().toLowerCase();
  if (!q) return [];
  return allTabs.filter(
    (t) =>
      (t.title || '').toLowerCase().includes(q) ||
      (t.url || '').toLowerCase().includes(q)
  );
}

// ── 渲染下拉 ─────────────────────────────────

function placeholderIcon(title) {
  // 字母占位图标：取标题首字 + 稳定配色，作为 favicon 缺失/加载失败时的兜底
  const ch = (String(title || '?').trim().charAt(0) || '?').toUpperCase();
  const palette = ['#4285F4', '#34A853', '#EA4335', '#FBBC05', '#5F6368', '#0F9D58'];
  const colorIdx = (String(title) + '|').charCodeAt(0) % palette.length;
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>` +
    `<rect width='24' height='24' rx='5' fill='${palette[colorIdx]}'/>` +
    `<text x='12' y='17' font-family='-apple-system,sans-serif' font-size='13' ` +
    `font-weight='600' fill='#fff' text-anchor='middle'>${ch}</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function render(list) {
  currentList = list;
  dropdown.innerHTML = '';

  if (list.length === 0) {
    dropdown.classList.remove('show');
    return;
  }

  dropdown.classList.add('show');
  list.forEach((tab, i) => {
    const el = document.createElement('div');
    el.className = 'dd-item' + (i === activeIndex ? ' active' : '');
    el.dataset.idx = i;

    const title = tab.title || '(No title)';
    const ph = placeholderIcon(title);
    const faviconSrc = tab.favIconUrl || ph;

    const isStarred = starredTabId === tab.id;
    el.innerHTML = `
      <img src="${faviconSrc}" alt="" />
      <div class="info">
        <div class="t">${escapeHtml(title)}</div>
        <div class="u">${escapeHtml(tab.url || '')}</div>
      </div>
      <button type="button" class="star-btn${isStarred ? ' starred' : ''}" data-tab-id="${tab.id}" title="${isStarred ? '取消标星' : '标星此页'}">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="${isStarred ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      </button>`;

    // 真实 favicon 加载失败时，兜底为首字母占位图标
    const favImg = el.querySelector('img');
    favImg.addEventListener('error', () => {
      favImg.src = ph; // data URI 不会二次失败
    });

    // 星标按钮：打星/取消标星，不触发下拉项的跳转
    const starBtn = el.querySelector('.star-btn');
    starBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleStarTab(tab.id);
    });

    el.addEventListener('click', () => {
      clearInput(); // 与键盘回车跳转保持一致：跳转后清除搜索框
      switchToTab(tab.id);
    });
    el.addEventListener('mousemove', () => setActive(i));
    dropdown.appendChild(el);
  });

  const lis = dropdown.children;
  for (let i = 0; i < lis.length; i++) {
    if (i !== activeIndex) lis[i].classList.remove('active');
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function setActive(i) {
  activeIndex = i;
  const lis = dropdown.children;
  for (let j = 0; j < lis.length; j++) {
    lis[j].classList.toggle('active', j === i);
  }
}

// ── 页签操作 ─────────────────────────────────

async function switchToTab(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    await chrome.tabs.update(tabId, { active: true, highlighted: true });
    if (tab.windowId) {
      await chrome.windows.update(tab.windowId, { focused: true });
    }
  } catch (err) {
    console.error('[TabPilot] switch failed:', err);
  }
}

function looksLikeUrl(v) {
  if (!v) return false;
  if (/^(https?|ftp):\/\//i.test(v)) return true;
  if (/^\s/.test(v) || /[\u4e00-\u9fa5]/.test(v)) return false; // 纯汉字/带空格不算网址
  return /[a-z0-9-]+\.([a-z]{2,}|xn--[a-z0-9]+)(\/\S*)?$/i.test(v) || /^www\./i.test(v);
}

function normalizeUrl(v) {
  return /^(https?|ftp):\/\//i.test(v) ? v : 'https://' + v;
}

// ── 事件 ─────────────────────────────────────

input.addEventListener('input', async () => {
  const q = input.value.trim();

  updateClearBtn();

  if (!q) {
    dropdown.classList.remove('show');
    dropdown.innerHTML = '';
    activeIndex = -1;
    return;
  }

  await loadTabs();
  activeIndex = -1;
  render(filterTabs(q));
});

input.addEventListener('keydown', (e) => {
  // Alt+L：对下拉中被选中的页签执行标星/取消标星
  // 用 e.code 判断物理按键，避免 macOS 上 Option+L 组合出 "¬" 导致 e.key 不是 'l' 而失配；
  // 无论有无选中项都 preventDefault，防止特殊符号被插入输入框。
  if (e.altKey && e.code === 'KeyL') {
    e.preventDefault();
    if (activeIndex >= 0 && currentList[activeIndex]) {
      toggleStarTab(currentList[activeIndex].id);
    }
    return;
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (currentList.length) setActive((activeIndex + 1) % currentList.length);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (currentList.length) setActive((activeIndex - 1 + currentList.length) % currentList.length);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    choose();
  }
  // Escape 统一交给全局监听处理（收起下拉）
});

// 无论焦点在何处，按 Esc 均收起下拉
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') collapseDropdown();
});

// 收起下拉（保留输入框内容）
function collapseDropdown() {
  dropdown.classList.remove('show');
  dropdown.innerHTML = '';
  activeIndex = -1;
  currentList = [];
}

function clearInput() {
  input.value = '';
  collapseDropdown();
  updateClearBtn();
}

// 根据输入框内容显示/隐藏清除按钮
function updateClearBtn() {
  clearBtn.hidden = !input.value;
}

function choose() {
  const q = input.value.trim();

  // 1. 有高亮项 → 跳转到该页签
  if (activeIndex >= 0 && currentList[activeIndex]) {
    const tabId = currentList[activeIndex].id;
    clearInput();
    switchToTab(tabId);
    return;
  }

  // 2. 有匹配页签 → 跳转到第一个匹配项
  loadTabs().then(() => {
    const match = filterTabs(q)[0];
    if (match) {
      clearInput();
      switchToTab(match.id);
      return;
    }

    // 3. 输入的是网址且无匹配页签 → 用新页签打开
    if (looksLikeUrl(q)) {
      clearInput();
      chrome.tabs.create({ url: normalizeUrl(q) });
    }
  });
}

// ── 快速备选卡片 ─────────────────────────────
// 每个卡片 { id, label(可选显示名), value(文字/网址) }，最多 6 个，存于 storage。
const QC_STORAGE_KEY = 'quickCards';
const QC_MAX = 6;

const qcView = document.getElementById('qc-view');
const qcEditWrap = document.getElementById('qc-edit');
const qcEditToggle = document.getElementById('qc-edit-toggle');

let quickCards = [];
let qcEditing = false;

async function loadQuickCards() {
  const r = await chrome.storage.local.get(QC_STORAGE_KEY);
  const stored = r[QC_STORAGE_KEY];
  quickCards = Array.isArray(stored) ? stored : [];
  renderQuickCards();
}

async function saveQuickCards() {
  await persistQuickCards();
  renderQuickCards();
}

// 仅写入 storage，不触发重渲染（供输入框逐字保存，保持焦点不丢失）
async function persistQuickCards() {
  await chrome.storage.local.set({ [QC_STORAGE_KEY]: quickCards });
}

// ── 查看模式 ────────────────────────────────

function renderQuickCards() {
  if (qcEditing) {
    renderQcEdit();
    return;
  }
  qcEditWrap.hidden = true;
  qcView.hidden = false;
  qcView.innerHTML = '';

  const visibleCards = quickCards.filter((c) => (c.value || '').trim() !== '');
  if (visibleCards.length === 0) {
    qcView.innerHTML = '<span class="qc-empty">暂无卡片，点击右上角 ✎ 添加</span>';
    return;
  }

  visibleCards.forEach((c) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'qc-chip';
    chip.title = c.value || '';
    const label = (c.label || '').trim();
    const value = (c.value || '').trim();
    const labelHtml = label
      ? `<span class="lbl">${escapeHtml(label)}</span><span class="val">${escapeHtml(value)}</span>`
      : `<span class="lbl">${escapeHtml(value)}</span>`;
    chip.innerHTML = labelHtml;
    chip.addEventListener('click', () => onQuickCardClick(value));
    qcView.appendChild(chip);
  });
}

// 点击卡片：写入搜索框；仅一项直接打开；多项待选；无匹配按网址新开或仅填入
async function onQuickCardClick(value) {
  input.value = value;
  updateClearBtn();
  input.focus(); // 让 Esc / 方向键立即生效，输入框聚焦并保留光标
  await loadTabs();
  const matches = filterTabs(value);

  if (matches.length === 1) {
    clearInput();
    switchToTab(matches[0].id);
  } else if (matches.length > 1) {
    activeIndex = -1;
    render(matches);
  } else {
    if (looksLikeUrl(value)) {
      clearInput();
      chrome.tabs.create({ url: normalizeUrl(value) });
    } else {
      dropdown.classList.remove('show');
    }
  }
}

// ── 编辑模式 ────────────────────────────────

function renderQcEdit() {
  qcView.hidden = true;
  qcEditWrap.hidden = false;
  qcEditWrap.innerHTML = '';

  quickCards.forEach((c, idx) => {
    const row = document.createElement('div');
    row.className = 'qc-edit-row';

    const lbl = document.createElement('input');
    lbl.className = 'lbl-input';
    lbl.placeholder = '名称(可选)';
    lbl.value = c.label || '';
    lbl.addEventListener('input', () => { c.label = lbl.value; persistQuickCards(); });

    const val = document.createElement('input');
    val.className = 'val-input';
    val.placeholder = '文字或网址';
    val.value = c.value || '';
    val.addEventListener('input', () => { c.value = val.value; persistQuickCards(); });

    const up = makeEditBtn('↑', '上移', () => moveCard(idx, -1));
    const down = makeEditBtn('↓', '下移', () => moveCard(idx, 1));
    const del = makeEditBtn('✕', '删除', () => {
      quickCards.splice(idx, 1);
      saveQuickCards();
    });
    del.classList.add('del');

    up.disabled = idx === 0;
    down.disabled = idx === quickCards.length - 1;

    row.append(lbl, val, up, down, del);
    qcEditWrap.appendChild(row);
  });

  const footer = document.createElement('div');
  footer.className = 'qc-edit-footer';

  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'qc-add';
  add.innerHTML = '+ 添加卡片';
  add.disabled = quickCards.length >= QC_MAX;
  add.addEventListener('click', () => {
    if (quickCards.length >= QC_MAX) return;
    quickCards.push({ id: String(Date.now()), label: '', value: '' });
    saveQuickCards();
  });

  const done = document.createElement('button');
  done.type = 'button';
  done.className = 'qc-done';
  done.textContent = '完成';
  done.addEventListener('click', () => {
    // 过滤掉内容为空的卡片
    quickCards = quickCards.filter((c) => (c.value || '').trim() !== '');
    qcEditing = false;
    qcEditToggle.textContent = '✎';
    saveQuickCards();
  });

  footer.append(add, done);
  qcEditWrap.appendChild(footer);
}

function makeEditBtn(text, title, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'qc-ico';
  b.textContent = text;
  b.title = title;
  b.addEventListener('click', onClick);
  return b;
}

function moveCard(idx, dir) {
  const toIdx = idx + dir;
  if (toIdx < 0 || toIdx >= quickCards.length) return;
  const tmp = quickCards[idx];
  quickCards[idx] = quickCards[toIdx];
  quickCards[toIdx] = tmp;
  saveQuickCards();
}

// 编辑开关
qcEditToggle.addEventListener('click', () => {
  qcEditing = !qcEditing;
  qcEditToggle.textContent = qcEditing ? '✓' : '✎';
  if (qcEditing) {
    renderQcEdit(); // 编辑态：把存储中的空卡片也显示出来方便新增
  } else {
    quickCards = quickCards.filter((c) => (c.value || '').trim() !== '');
    saveQuickCards();
  }
});

loadQuickCards();

// ── 接收 background 通知 ──────────────────────
// 通过快捷键再次打开（激活）本页时，若焦点已在搜索框之外，收到 FOCUS_INPUT 后重新聚焦输入框。
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'FOCUS_INPUT') input.focus();
});

// ── 更新日志 ─────────────────────────────────
// 优先读取本地 CHANGELOG.md 渲染；读取失败时回退到内置数据。
// 版本号统一以 manifest 中的 version 为准。

const CHANGELOG_FALLBACK = [
  {
    version: '1.0.0',
    date: '2026-09-17',
    items: [
      { tag: 'new', text: '搜索并快速切换已打开的页签' },
      { tag: 'new', text: '快速备选卡片与使用帮助' },
      { tag: 'new', text: 'Alt+P 快捷打开快速启动页' },
      { tag: 'new', text: 'Alt+K 一键跳转到标星页面' },
      { tag: 'new', text: 'Alt+L 对下拉选中页签快速标星 / 取消标星' },
      { tag: 'new', text: '标星状态在 index / popup 间实时同步' },
      { tag: 'imp', text: '弹出页标星页签，顶部星标图标一键跳转' },
    ],
  },
];

const TAG_LABELS = { new: '新增', fix: '修复', imp: '改进' };

// 解析 CHANGELOG.md 为 [{ version, date, items:[{tag,text}] }]
function parseChangelog(md) {
  const versions = [];
  let cur = null;
  const tagMap = { '新增': 'new', '修复': 'fix', '改进': 'imp' };
  for (const raw of md.split('\n')) {
    const line = raw.trim();
    const verMatch = line.match(/^##\s*v?(\d+\.\d+\.\d+)\s*(?:\((.+?)\))?/);
    if (verMatch) {
      cur = { version: verMatch[1], date: verMatch[2] || '', items: [] };
      versions.push(cur);
      continue;
    }
    const itemMatch = line.match(/^[-*]\s*(新增|修复|改进)[：:]\s*(.+)$/);
    if (cur && itemMatch) {
      cur.items.push({ tag: tagMap[itemMatch[1]], text: itemMatch[2] });
    }
  }
  return versions;
}

async function loadChangelog() {
  try {
    const res = await fetch(chrome.runtime.getURL('CHANGELOG.md'));
    if (res.ok) {
      const parsed = parseChangelog(await res.text());
      if (parsed.length) return parsed;
    }
  } catch (e) {
    // 忽略，回退内置数据
  }
  return CHANGELOG_FALLBACK;
}

let changelog = [];

function renderChangelog() {
  const wrap = document.getElementById('cl-versions');
  if (!wrap) return;
  wrap.innerHTML = changelog.map((v, i) => {
    const itemsHtml = v.items
      .map((it) => {
        const tagCls = `cl-tag cl-tag-${it.tag}`;
        const label = TAG_LABELS[it.tag] || it.tag;
        return `<li class="cl-item"><span class="cl-tag ${tagCls}">${label}</span><span>${escapeHtml(it.text)}</span></li>`;
      })
      .join('');
    const badge = i === 0 ? '<span class="cl-ver-badge">当前版本</span>' : '';
    return `
      <section class="cl-ver">
        <div class="cl-ver-row">
          <span class="cl-ver-chip">v${v.version}</span>
          <span class="cl-ver-date">${v.date}</span>
          ${badge}
        </div>
        <ul class="cl-items">${itemsHtml}</ul>
      </section>`;
  }).join('');
}

async function initChangelog() {
  // 入口按钮显示 manifest 中的版本号
  const verLabel = document.getElementById('cl-ver-label');
  if (verLabel) verLabel.textContent = chrome.runtime.getManifest().version;

  // 加载更新日志数据（本地 CHANGELOG.md，失败回退内置）
  changelog = await loadChangelog();

  const btn = document.getElementById('changelog-btn');
  const modal = document.getElementById('changelog-modal');
  const closeBtn = document.getElementById('cl-close');
  const doneBtn = document.getElementById('cl-done');
  const ghLink = document.getElementById('cl-gh-link');

  function openCl() {
    renderChangelog();
    modal.classList.add('show');
    document.addEventListener('keydown', onClKey);
  }
  function closeCl() {
    modal.classList.remove('show');
    document.removeEventListener('keydown', onClKey);
  }
  function onClKey(e) {
    if (e.key === 'Escape') closeCl();
  }
  // 点击遮罩空白处关闭
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeCl();
  });

  btn.addEventListener('click', openCl);
  closeBtn.addEventListener('click', closeCl);
  doneBtn.addEventListener('click', closeCl);
  ghLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://github.com/biabiatiano/TabPilot/releases' });
  });
}

// ── GitHub 入口组 + 开源协议链接 ────────────
// 统一用 chrome.tabs.create 打开新标签页，避免扩展页内 <a href> 跳转受限。
const GH_BASE = 'https://github.com/biabiatiano/TabPilot';
const ghLinks = {
  'gh-repo': GH_BASE,
  'gh-issues': GH_BASE + '/issues',
  'gh-star': GH_BASE + '/stargazers',
  'license-link': 'https://github.com/biabiatiano/TabPilot/LICENSE',
};
for (const [id, url] of Object.entries(ghLinks)) {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url });
    });
  }
}

initChangelog();