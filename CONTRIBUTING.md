# 贡献指南

这个仓库没有代码，只有文本。改动分三类：加示例、加边界用例、修文档错别字。

## 四条硬约束

1. **`SYSTEM_PROMPT.md` 里的规则原文一字不动。** 规则本身要改，请单独开一个 PR，只改这一处，在描述里写明改了哪一条、为什么、哪些示例需要跟着更新。
2. **示例里的「原话」必须能被逐字核对**，包括错别字、脏话、省略号。不要为了读起来顺而润色原话。
3. **保持零依赖**：不引入需要安装、编译或联网才能验证的东西。验收靠人读 [CHECKLIST.md](./tests/CHECKLIST.md)；`docs/` 的网页同样不引入框架、CDN 和构建步骤。
4. **副本要同步**：改三份提示词（`SYSTEM_PROMPT.md` / `SCREENSHOT_PROMPT.md` / `REPLY_PROMPT.md`）要同步 `docs/data.js` 里对应的 `FALLBACK_PROMPT` / `FALLBACK_SCREENSHOT_PROMPT` / `FALLBACK_REPLY_PROMPT`；改 `examples/` 的输出要同步 `SHOT_DEMOS` / `REPLY_DEMOS`。输出区可以展开「查看 / 复制当前板块的提示词」核对版本。

## 加一个示例

- 放在 `examples/`，一个文件一个主题，分成「输入」「输出」两段。
- 输出部分逐条过一遍 [tests/CHECKLIST.md](./tests/CHECKLIST.md)。
- 在 [tests/cases.md](./tests/cases.md) 补一行用例编号，写清「输入特征 / 必须出现 / 不能出现」。
- 推测行写全「推测，可能不准」，不要只写「推测」。

### 脱敏要求

- 去掉真实姓名、手机号、住址、公司名、账号；具体日期改成「上周」「那天」。
- 语音转写、表情包用文字描述，不放截图。
- 脏话按规则保留原词，但不要使用针对具体身份的侮辱性用语。

## 安全类用例

停机用例只描述情形类型，不写出具体原句。自伤、自杀、涉及未成年人伤害的内容一律不写原句，讨论时也不写。参见 [examples/03-hard-stops.md](./examples/03-hard-stops.md)。

## 提交前自检

- [ ] 三份规则原文未被改动；如已改，`docs/data.js` 的对应 `FALLBACK_*` 已同步
- [ ] 新增示例通过 CHECKLIST；如改了 `examples/` 输出，`SHOT_DEMOS` / `REPLY_DEMOS` 已同步
- [ ] `cases.md` 有对应编号
- [ ] 没有真实个人信息
- [ ] 没有禁用标签、劝和空话、关系结论
- [ ] 停机用例优先于格式用例
