# TabPilot — Chrome 扩展规格文档 / Specifications

> 中英双语 / Bilingual — 本文档描述 TabPilot 的全量功能、交互与边界条件。本规格是当前实现的权威描述（doe-style），改动代码时请同步更新。

## 1. Project Overview / 项目概述

- **Project Name / 项目名**：TabPilot
- **Type / 类型**：Chrome 浏览器扩展（Manifest V3）
- **Core Functionality / 核心功能**：浏览并快速切换所有已打开的页签（支持跨窗口与无痕窗口）。提供两种入口：
  1. **Popup 弹窗**：页签列表管理。
  2. **Index 快速启动页**：谷歌风格搜索式页签跳转 + 快速备选卡片。
  3. **外部联动**：任意网页可通过运行时消息触发指定页签切换。

---

## 2. Visual & Rendering / 视觉与渲染

### 2.1 Popup（460 × 520 px）
```
┌──────────────────────────────────────┐
│  TabPilot            [star] [Demo]   │
├──────────────────────────────────────┤
│  Open Tabs (N / M)              [↻]  │
│  ┌──────────────────────────────┐    │
│  │ [search input (×)]            │    │
│  ├──────────────────────────────┤    │
│  │ Tab 1 · title / url     [#1] │    │
│  │ Tab 2 · title / url     [#2] │    │
│  └──────────────────────────────┘    │
└──────────────────────────────────────┘
```
- 深色/浅色取：浅色主题，背景 `#f5f6fa`，强调色 `#6c63ff`。
- 列表项高 36px：favicon(16px) + 截断标题 + 截断 URL。
- 激活页签：左缘 `3px solid #6c63ff` + 背景 `#e8e5ff`。
- Toast 提示自顶部滑入，2.2s 后自动消失；刷新按钮点击旋转 360°。

### 2.2 Index（谷歌风格，全屏）
- **Logo**：居中顶部，扁平化多彩浏览器页签环绕放大镜图标（`logo.svg`）。
- **搜索框**：620px 胶囊，hover/focus 带柔和阴影，右侧内含清除「×」按钮。
- **快速备选卡片**：位于搜索框下方，固定 3 列网格，最多 6 张；每张展示「名称 + 内容/网址」，内容整体居中。
- **右上角链接组**：星标按钮 → GitHub（仓库 / Issues / Star）→ 更新日志 → 使用帮助。
- **帮助浮窗**：深色半透明遮罩 + 白色居中卡片；支持遮罩点击 / 按钮 / `Esc` 关闭。

---

## 3. Functional Specification / 功能规格

### 3.1 Popup — 页签列表
- 打开时通过 `chrome.tabs.query({})` 拉取所有窗口页签（`incognito: "split"` 支持无痕）。
- 按 `windowId` 分组、组内按 `index` 排序；显示页签序号（1 基）。
- 标题截断 42 字、URL 截断 50 字。
- 点击列表项 → 切到该页签并聚焦窗口。
- 中键（auxclick）→ 关闭页签；右键（contextmenu）→ 复制 Tab ID 到剪贴板。
- 刷新按钮重新拉取。

### 3.2 Popup — 过滤
- 顶部搜索框实时过滤（`input` 事件），对标题 + URL 做**不区分大小写**的包含匹配。
- 空查询显示全部；筛选时角标显示 `N/M`。
- 输入框内含清除「×」，点击重置过滤并聚焦。

### 3.3 Popup — 星标页签
- 每个列表项右侧星标按钮：置顶唯一页签；再次点击取消；重新置顶会替换上一个。
- 状态持久化于 `chrome.storage.local` 的 `starredTabId`。
- 头部星标按钮一键切换到置顶页签；未置顶时弹错误 Toast「No starred tab set」。
- 置顶页签被关闭时不会自动清除星标；若其仍被标记，后续切换会回传「No tab with id」失败。

### 3.4 Background — 服务进程
- `background.js` 为 Manifest V3 Service Worker。
- 监听 `chrome.runtime.onMessage` 与 `chrome.runtime.onConnectExternal` 的 `{ type: 'SWITCH_TO_STARRED', tabId }`。
- 处理函数 `switchToStarredTab`：`tabs.update(active + highlighted)` → 聚焦所在窗口；通过端口或 `sendResponse` 回传 `{ ok }`。
- 安装/启动时打印调试日志。

### 3.5 外部页面联动
- `externally_connectable.matches: ["<all_urls>"]`：任意网页可连接扩展。
- **端口方式（推荐）**：`chrome.runtime.connect(EXTENSION_ID)` 建立长连接以唤醒 Service Worker，再 `port.postMessage({ type: 'SWITCH_TO_STARRED', tabId })`。
- **sendMessage 方式**：`chrome.runtime.sendMessage({ type: 'SWITCH_TO_STARRED', tabId })`。
- `tabId` 必须为当前有效的页签 ID；页签不存在时回传 `{ ok:false, error:"No tab with id N" }`。

外部页面端调用示例：
```javascript
const port = chrome.runtime.connect(EXTENSION_ID);
port.onDisconnect.addListener(() => console.error('disconnected', chrome.runtime.lastError.message));
port.onMessage.addListener((msg) => { msg && msg.ok ? console.log('switched') : console.error(msg?.error); port.disconnect(); });
port.postMessage({ type: 'SWITCH_TO_STARRED', tabId });
```

### 3.6 Index — 输入即搜索
- 单一输入框，支持汉字或网址。
- `input` 事件触实时过滤（`loadTabs` + `filterTabs`），下拉展示匹配页签（favicon + 标题 + URL）。
- **键盘**：`↑/↓` 切换高亮、`Enter` 确认、`Esc`（全局，任意焦点）收起下拉。
- **跳转后清空输入框**：无论是键盘回车还是鼠标点击选中，跳转后均清空输入框、收起下拉。
- **favicon 兜底**：真实 favicon 缺失或加载失败时，用「标题首字符 + 稳定配色」的 SVG 占位图标。

### 3.7 Index — 回车行为（`choose`）
按优先级处理：
1. 有高亮项 → 跳到该页签。
2. 有匹配页签 → 跳到第一个匹配项。
3. 输入是网址（`looksLikeUrl`）且无匹配页签 → 用新页签打开（自动补 `https://`）。
- `looksLikeUrl`：识别 `http(s)/ftp` 前缀、`域名.顶级域(/路径)`、`www.`；汉字段落与带空格文本不算网址。

### 3.8 Index — 快速备选卡片
- 数据存于 `chrome.storage.local` 的 `quickCards`，每条 `{ id, label, value }`，最多 **6** 个。
- **查看模式**：卡片定位搜索框下方，3 列网格；点击卡片把 `value` 写入搜索框。
  - 匹配 **1** 个页签 → 直接打开并清空。
  - 匹配 **多个** → 展示下拉，交由用户选择后跳转。
  - 无匹配且为网址 → 新页签打开；无匹配且非网址 → 仅填入，收起下拉。
- **编辑模式**：`✎` 进入，每张卡片可编辑名称/内容、上移、下移、删除；`+ 添加卡片` 到上限自动禁用；`完成` 剔除空卡片并保存。逐字输入仅写 storage 不重绘，避免失焦。

### 3.9 Index — 标星页签
- 顶部星标按钮（`index-star-btn`）：显示当前星标页签，点击跳转到标星页（`Alt+K` 等价）；未标星时提示「暂无标星的页面，请在下拉中给某页点星」。
- 下拉列表中每项右侧星标按钮：对该页签标星/取消标星；状态持久化于 `chrome.storage.local` 的 `starredTabId`。
- `chrome.storage.onChanged` 跨页同步：index / popup 任一侧改动 `starredTabId`，另一侧实时刷新星标态。

### 3.10 Index — 右上角链接
- **星标按钮**：`index-star-btn`（同 3.9）。
- **GitHub**：仓库（`gh-repo`）/ Issues（`gh-issues`）/ Star（`gh-star`），均以新标签页打开对应链接。
- **更新日志**：`changelog-btn` 打开更新日志浮窗（优先读取本地 `CHANGELOG.md` 渲染，读取失败回退内置 `CHANGELOG_FALLBACK`；版本号取 `chrome.runtime.getManifest().version`）。
- **使用帮助**：`使用帮助` 打开帮助浮窗。
- **页脚开源协议**：`license-link` → `https://github.com/biabiatiano/TabPilot/blob/main/LICENSE`。

### 3.11 Keyboard — 快捷键
- manifest `commands` 声明三个命令，`chrome.commands.onCommand` 统一响应；默认 `suggested_key` 见上文（Mac/Windows 一致），用户可在 `chrome://extensions/shortcuts` 自定义。
- **`open-index`（Alt+P）**：若 index 页已打开则激活其页签、聚焦窗口，并发送 `FOCUS_INPUT` 让其重新聚焦搜索框；否则新标签页打开 `index.html`。
- **`go-to-starred`（Alt+K）**：读取 `starredTabId`，若存在则 `switchToStarredTab` 跳转；未标星时忽略。
- **`set-starred`（Alt+L）**：对当前活动页签执行**标星/取消标星**（toggle）：
  - 若焦点页签是 index 页面 → 发送 `TOGGLE_DROPDOWN_STAR`，由页面对其下拉选中项标星/取消。
  - 否则读取 `starredTabId`：已是星标则取消并提示「已取消标星」，否则标星并提示「已标记为星标」，均通过 `chrome.notifications` 系统通知提示。

---

## 4. Technical Specification / 技术规格

- **Manifest Version**：3
- **Permissions**：`tabs`, `storage`, `notifications`
- **externally_connectable**：`{ "matches": ["<all_urls>"] }`
- **Incognito**：`split`
- **CSP（extension_pages）**：
  ```
  img-src 'self' chrome://favicon/ data: https: http:; script-src 'self'
  ```
- **文件结构**：
  - `manifest.json`、`background.js`
  - `popup.html` / `popup.js` / `popup.css`
  - `index.html` / `index.js`（快速启动页）
  - `logo.svg`、`icons/icon{16,48,128}.png`
- **依赖**：无三方依赖，纯 Vanilla JS + CSS。

### 数据流
```
popup.js / index.js (UI)
  ├── chrome.tabs.query()         → 页签列表 / 查找已打开的 index 页签
  ├── chrome.tabs.update()        → 切换/激活
  ├── chrome.tabs.create()        → 新页签打开网址 / index.html
  ├── chrome.tabs.remove()        → 关闭页签
  ├── chrome.windows.update()     → 聚焦窗口
  ├── chrome.storage.local        → 星标/卡片持久化
  ├── chrome.runtime.sendMessage()/connect() → background（SWITCH_TO_STARRED 等）
  └── chrome.runtime.onMessage    → 收 FOCUS_INPUT / TOGGLE_DROPDOWN_STAR
background.js (service worker)
  ├── chrome.runtime.onInstalled / onStartup → 日志
  ├── chrome.commands.onCommand   → open-index(Alt+P) / go-to-starred(Alt+K) / set-starred(Alt+L)
  ├── chrome.notifications.create → Alt+L 标星/取消的系统通知
  └── chrome.runtime.onMessage / onConnectExternal → SWITCH_TO_STARRED
```

---

## 5. Edge Cases / 边界条件

- 无页签：Popup 显示「No tabs open.」；Index 下拉无匹配不展示。
- 页签无标题：显示 `(No title)`。
- 页签切换失败：Popup 报错 Toast「Failed to switch tab」；Index 仅 `console.error`。
- 剪贴板复制失败：Popup 报错 Toast「Failed to copy」。
- 中文输入/全角空格/句号：不会被误判为网址，回车不会误开新页签。
- favicon 无法加载（404/跨域被拒）：回退到首字符占位图。
- 帮助浮窗打开期间，`Esc` 同时收起下拉并关闭浮窗（二者监听独立，互不冲突）。
- `set-starred`（Alt+L）时焦点页签无 `tab.id`（如新标签页）：忽略，不弹通知。
- popup「Demo」按钮打开 index 页：若已存在 index 页签则直接激活，否则新建，避免重复打开多个 index 页签。

---

## 6. Acceptance Criteria / 验收标准

### Popup
- [ ] 展示所有窗口页签（含无痕），按窗口+索引排序。
- [ ] 点击列表项切换并聚焦该页签；激活项高亮。
- [ ] 过滤实时生效，角标显示 `N/M`；清空后恢复全部。
- [ ] 中键关闭、右键复制 Tab ID。
- [ ] 星标置顶唯一页签，持久化；头部星标一键直达；再次点击取消，重新置顶替换上一个。
- [ ] 刷新按钮重新拉取并旋转反馈。

### Index
- [ ] 输入汉字或网址实时下拉出匹配页签。
- [ ] 键盘 `↑/↓/Enter` 与鼠标点击均能跳转，跳转后清空输入框。
- [ ] 输入网址且无匹配时回车新开页签。
- [ ] 中文/空白文本不会被当作网址误开页签。
- [ ] 全局 `Esc` 收起下拉。
- [ ] 下拉项 favicon 缺失/失败时展示首字符占位图。
- [ ] 快速备选卡片：最多 6 个，编辑增删改与排序，点击按 3.8 逻辑处理。
- [ ] 右上角入口（星标 / 仓库 / Issues / Star / 更新日志 / 使用帮助）功能正常。
- [ ] 按 `Alt+P` 呼出快速启动页；已打开时激活而非重复新建。
- [ ] 按 `Alt+K` 一键跳转到标星页面；未标星时忽略。
- [ ] 按 `Alt+L` 对当前页签标星/取消，并有系统通知；焦点在 index 页时对下拉选中项标星/取消。

### 外部联动
- [ ] 外部网页可用端口或 sendMessage 触发指定页签切换。
- [ ] 页签不存在时回传失败信息。