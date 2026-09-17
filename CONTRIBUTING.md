# Contributing / 参与贡献

> 中英双语 / Bilingual

Thanks for your interest in contributing to **TabPilot**! 🎉
感谢你对 **TabPilot** 的关注与贡献！

## How to contribute / 如何贡献

### 1. Report bugs & request features / 反馈问题与提出功能
- 建议使用 GitHub **Issue**：
  - **Bug**：描述环境、复现步骤、预期与实际结果。
  - **Feature**：说明动机、期望行为与使用场景。
- 提供尽可能多的信息（浏览器版本、扩展版本、控制台错误）。

### 2. Contribute code / 贡献代码（PR 流程）

1. **Fork** 本仓库并克隆到本地。
2. 创建功能分支：`git checkout -b feat/your-feature`。
3. 进行修改，**同步更新** [SPEC.md](SPEC.md) 中受影响的规格。
4. 本地验证（参见下方「验证」）。
5. 提交并推送，然后 **发起 Pull Request**，在描述中说明改动与测试情况。

### 3. Development setup / 本地开发环境

- 无需安装依赖。本项目为纯 Vanilla JS + CSS 的 Chrome 扩展。
- 加载方式：`chrome://extensions` → 开启开发者模式 → 「加载已解压的扩展程序」选择项目根目录。
- 每次修改后点击扩展的「刷新」重新加载。

## Code style / 代码风格

- 保持现有风格：4 空格缩进、单引号、行尾不加分号（与现有文件一致）。
- 关键函数写上简洁的中文注释说明意图（SSE：说明"做什么、为什么"）。
- 不使用第三方依赖；如需新增，先在 Issue 讨论。
- 文案/注释遵循「中英双语」约定：对外文档双语，代码注释中文为主。

## Verify / 验证

```bash
# 语法检查（可选，需要 Node.js）
node --check background.js
node --check popup.js
node --check index.js

# 校验 manifest 为合法 JSON
python3 -c "import json;json.load(open('manifest.json'))"
```

手工测试项参考 [SPEC.md](SPEC.md) 第 6 节验收清单。

## Commit message / 提交信息

建议使用语义化提交（Conventional Commits）：

```
feat: 新增快速备选卡片排序功能
fix: 修复搜索框清除按钮不显示的问题
docs: 更新 SPEC.md 文档
chore: 更新 .gitignore
```

## Code of Conduct / 行为准则

请保持友善、尊重与建设性的沟通。欢迎所有背景的贡献者。