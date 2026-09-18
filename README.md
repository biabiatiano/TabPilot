# TabPilot

> 中英双语 | Bilingual (中文 / English)

A lightweight Chrome browser extension (Manifest V3) that lets you **browse all open tabs across every window**, **filter them instantly**, and **switch to a specific tab in one keystroke or click**. It also ships with a Google-style quick launcher page and an optional quick-access card feature.

一个轻量级 Chrome 浏览器插件（Manifest V3），支持**浏览所有窗口的已打开页签**、**实时过滤**、**一键切换到指定页签**。内置一个谷歌风格的快速启动页，以及可自定义的「快速备选卡片」功能。

![icons/icon128.png](icons/icon128.png)

---

## 📖 Table of Contents / 目录

- [Features / 功能特性](#features--功能特性)
- [Screenshots / 界面预览](#screenshots--界面预览)
- [Installation / 安装](#installation--安装)
- [Usage / 使用说明](#usage--使用说明)
- [Project Structure / 项目结构](#project-structure--项目结构)
- [Development / 开发](#development--开发)
- [Specification / 规格文档](#specification--规格文档)
- [Contributing / 参与贡献](#contributing--参与贡献)
- [License / 许可证](#license--许可证)

---

## Features / 功能特性

### Popup — 页签管理弹窗
- **浏览所有页签**：跨所有窗口展示全部已打开页签，按窗口 → 页签顺序排列。
- **实时过滤**：输入关键字即可按标题/网址即时筛选，数量角标显示 `匹配数/总数`。
- **一键切换**：点击某页签快速激活并聚焦其所在窗口。
- **星标页签**：可收藏/置顶唯一一个页签，通过头部星标按钮一键直达；状态持久保存。
- **复制 Tab ID**：右键页签复制其 ID。
- **中键关闭**：中键点击快速关闭页签。
- **刷新**：一键重新拉取页签列表。

### Index Page — 谷歌风格快速启动页
- **输入即搜索**：在单一输入框中输入汉字或网址，实时下拉展示匹配的已打开页签。
- **跳转方式**：鼠标点击、`↑/↓` + `Enter` 均能跳转到选中页签（跳转后自动清空输入框）。
- **网址直达**：输入网址且无匹配页签时，按 `Enter` 用新页签打开。
- **快速备选卡片**：最多自定义 6 张卡片，每张可设置「名称 + 内容/网址」并调整顺序；点击卡片写入搜索框，仅一项匹配时直接打开。
- **星标常用页面**：唯一标星页签，popup / index 均可标记或一键跳转，状态实时同步。
- **反馈 & 使用帮助**：右上角提供 GitHub 仓库 / Issues / Star 入口与使用帮助浮窗。
- **键盘快捷键**：`Alt+P` 随时呼出快速启动页；`Alt+K` 一键跳转标星页；`Alt+L` 快速标星/取消。

### Bridge — 外部页面联动
- 通过 `chrome.runtime.onConnectExternal` / `onMessage`，**任意网页**可在知道扩展 ID 的情况下触发指定页签切换。

---

## Screenshots / 界面预览

> 可在安装后自行体验；本仓库不内置运行时截图。

- **Popup**：点击工具栏图标即可打开，460 × 520 的弹出面板。
- **Index**：在插件内新建页签访问 `chrome-extension://<扩展ID>/index.html`；
  或点击 Popup 头部右侧的「Demo」按钮进入。

---

## Installation / 安装

1. 打开 Chrome，进入 `chrome://extensions`。
2. 打开右上角「开发者模式」。
3. 点击「加载已解压的扩展程序」，选择本项目的根目录（包含 `manifest.json` 的文件夹）。
4. 加载完成后，工具栏会出现 TabPilot 图标，点击即可使用。

> 每次改动代码后，需在 `chrome://extensions` 中点击「刷新」重新加载扩展。

---

## Usage / 使用说明

### Popup 弹窗
1. 点击工具栏 TabPilot 图标，弹出页签列表。
2. 直接在搜索框输入关键字即可实时过滤。
3. 点击某个页签即可切换；中键点击可关闭；右键可复制 Tab ID。
4. 点击某页签右侧的星标可置顶该页签，再次点击取消；头部星标按钮一键切回置顶页签。

### Index 快速启动页
- **跳转页签**：输入文字或网址，在下拉中选择后按 `Enter` 或直接点击。
- **键盘操作**：`↑/↓` 选择、`Enter` 确认、`Esc` 收起下拉。
- **快速卡片**：点击卡片填入搜索内容；仅一项匹配时自动打开；编辑模式下可增删改、调整顺序。
- **快捷键**：`Alt+P` 随时打开本页；`Alt+K` 一键跳转到标星页面；`Alt+L` 对下拉选中项或当前所在页签快速标星/取消（可在 `chrome://extensions/shortcuts` 自定义）。

---

## Project Structure / 项目结构

```
tab-activator/
├── manifest.json        # 扩展清单 (Manifest V3)
├── background.js        # Service Worker：跨页签切换与外部联动
├── popup.html/popup.js/popup.css   # 弹窗页（页签管理）
├── index.html / index.js           # 谷歌风格快速启动页
├── logo.svg             # 扩展 Logo / 图标源文件
├── icons/               # 生成的多尺寸图标 (16/48/128)
├── SPEC.md              # 规格文档
├── CONTRIBUTING.md      # 贡献指南
├── LICENSE              # MIT 许可证
└── .gitignore
```

---

## Development / 开发

### 技术栈
- **纯 Vanilla JavaScript + 原生 HTML/CSS**，**无任何第三方依赖**。
- Chrome 扩展 **Manifest V3**：Service Worker、CSP、`externally_connectable`。

### 本地验证
```bash
# 静态语法检查（可选，Node.js 环境）
node --check background.js
node --check popup.js
node --check index.js
```

### 生成/更新图标
`icons/icon{N}.png` 由 `logo.svg` 导出得到（16/48/128）。若更换 Logo，请同步重新导出对应尺寸，并保持 `manifest.json` 中的 `icons` 与 `action.default_icon` 指向一致。

### 权限说明
- `tabs`：读取页签标题/URL、切换/关闭页签。
- `storage`：持久化星标页签与快速备选卡片。
- `notifications`：`Alt+L` 标星/取消时弹出系统通知。

---

## Specification / 规格文档

完整的功能、交互与边界条件规格请参见 **[SPEC.md](SPEC.md)**。

---

## Contributing / 参与贡献

欢迎提交 Issue 与 Pull Request。具体约定请参见 **[CONTRIBUTING.md](CONTRIBUTING.md)**。

---

## License / 许可证

[MIT](LICENSE) © 2026 TabPilot contributors