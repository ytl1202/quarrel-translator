## 改了什么

<!-- 一句话说明。只改错别字也可以直接写 -->

## 改动类型

- [ ] 新增 / 修正示例（`examples/`）
- [ ] 边界用例或验收清单（`tests/`）
- [ ] 网页 Demo（`docs/`）
- [ ] 文档错别字、链接、排版
- [ ] 规则原文（`SYSTEM_PROMPT.md` / `SCREENSHOT_PROMPT.md` / `REPLY_PROMPT.md`）

## 改规则时必填

> 没改规则就删掉这一节。

- [ ] 这是单独一个 PR，没有夹带其他改动
- [ ] 说明了改了哪一条、为什么、哪些示例需要跟着更新
- [ ] `docs/data.js` 里对应的 `FALLBACK_*` 副本已同步

## 提交前自检

- [ ] 过了一遍 [tests/CHECKLIST.md](./tests/CHECKLIST.md)
- [ ] `tests/cases.md` 有对应编号（新增示例时）
- [ ] `docs/data.js` 的 `SHOT_DEMOS` / `REPLY_DEMOS` 已同步（改了示例输出时）
- [ ] 没有真实姓名、手机号、账号、住址、公司名、具体日期
- [ ] 没有禁用标签、劝和空话、关系结论
- [ ] 停机用例优先于格式用例
