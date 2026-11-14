# 更新记录

格式参考 Keep a Changelog，版本号遵循语义化版本。规则原文的改动会在这里和对应 PR 里同时说明。

## [0.1.0] - 2026-11-14

首个正式发布。11 月 12 日完成提示词、示例与网页工具，11 月 14 日补齐社区文件、落地页与离线发布包。

### 新增

- `SYSTEM_PROMPT.md`：逐句翻译的规则原文（五条铁律、四格输出、固定三段收尾、停机红线）。
- `SCREENSHOT_PROMPT.md`：微信 / QQ 聊天截图输入的附加规则（气泡左右推断说话人、过滤时间戳与系统灰字、翻译范围）。
- `REPLY_PROMPT.md`：推荐回复规则，固定 3 条语气 + 说明，含禁止句式与停机红线。
- `examples/`：5 组示例，覆盖基准、输入边界、截图读图、推荐回复与四类停机情形。
- `tests/`：人工验收清单与 21 条用例编号表。
- `docs/app.html`：工具页，两个可切换板块（截图分析 / 对话回复），零依赖。
- `docs/index.html`：项目落地页，中英一键切换、明暗主题自适应、隐私与已知限制说明。
- 社区文件：`CONTRIBUTING.md`、`CODE_OF_CONDUCT.md`、`SECURITY.md`、`ISSUE_TEMPLATE.md`（根目录单文件兜底）、`.github/ISSUE_TEMPLATE/` 下 bug / feature / 求助三套模板、`PULL_REQUEST_TEMPLATE.md`。
- README 首屏加在线 Demo 徽章、英文简介与站点 / 下载链接。
- GitHub Pages 发布（落地页在站根，工具页在 `/app.html`），MIT 许可。

### 已知

- 规则内置示例的事实栏含演示占位数字，推测行简写成「推测」。新增示例按更严格的规则文字书写，原文保持不动。
- 截图板块依赖用户配置的支持图片输入的模型；页面不做本地 OCR，图片会离开浏览器。
- 图片内容无法做本地停机预检，词表兜底会漏也会误判。

### 踩坑记录

- GitHub 社区标准清单一开始不认 `.github/ISSUE_TEMPLATE/` 目录式模板；补了根目录单文件 `ISSUE_TEMPLATE.md` 并把 front matter 简化为只保留 `name` / `about` 后才识别。
