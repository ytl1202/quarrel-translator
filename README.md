# 吵架翻译器

[![Live Demo](https://img.shields.io/badge/Live%20Demo-online-2f6f6b)](https://ytl1202.github.io/quarrel-translator/) [![License: MIT](https://img.shields.io/badge/License-MIT-9a5b2c)](./LICENSE) [![PRs welcome](https://img.shields.io/badge/PRs-welcome-3b4a6b)](./CONTRIBUTING.md)

三份可以直接复制进大模型的系统提示词：逐句翻译两个人的聊天记录、读微信 / QQ 聊天截图、给正在进行的对话推荐回复。不劝和，不判对错，只做一件事：把指责翻成需求，把情绪翻成在意的东西。

*Translate blame into needs — reusable LLM prompts for chat screenshots and reply suggestions. Not mediation, not therapy.*

**它是翻译器，不是调解员，也不是心理评估。**

---

## 30 秒上手

1. 想翻译聊天记录：复制 [SYSTEM_PROMPT.md](./SYSTEM_PROMPT.md)。
2. 输入是微信 / QQ 截图：在上面那份后面再接 [SCREENSHOT_PROMPT.md](./SCREENSHOT_PROMPT.md)。
3. 正在对话、想要推荐回复：改用 [REPLY_PROMPT.md](./REPLY_PROMPT.md)。
4. 粘贴到任意大模型的「系统提示词 / 自定义指令」位置，再把聊天记录或截图贴进去。

不用安装，不用改代码。也可以直接用下面这个网页版。

## 网页 Demo

- **项目介绍页**：https://ytl1202.github.io/quarrel-translator/ （中英切换、明暗主题自适应）
- **在线工具**：https://ytl1202.github.io/quarrel-translator/app.html （内置示例不需要 API Key）
- **下载 v0.1.0 提示词包**：[Releases](https://github.com/ytl1202/quarrel-translator/releases)

打开 [docs/app.html](./docs/app.html)：纯静态页面，双击就能用，两个可切换的板块。

- **截图分析**：拖入 / 粘贴微信、QQ 聊天截图，由你配置的、支持图片输入的模型读图，逐句翻出两个人真正的意思。页面不做本地 OCR，截图以 base64 发往你自己填的端点。
- **对话回复**：贴对方刚说的话（可加一句你想表达的意思），得到 3 条不同语气的回复——克制版 / 直说需求版 / 先缓一缓版，每条附一句说明、可单独复制；页面会标出违反禁止句式的地方。

两个板块都有不联网的内置示例，先看效果不需要 API Key。发布到 GitHub Pages：Settings → Pages → Source 选 `main` / `/docs`。详见 [docs/README.md](./docs/README.md)。

## 它不会做什么

- 不判断谁对谁错，不写「其实双方都有问题」，不劝和。
- 不给关系下结论，不写「多换位思考」这类空话。
- 不使用「回避型依恋」「煤气灯效应」「PUA」「原生家庭」这类标签。
- 不把威胁美化成在乎：原话是威胁就标成威胁。
- 遇到人身威胁、暴力、跟踪、限制人身自由、自伤自杀表述、涉及未成年人的伤害、明显的经济或社交控制，**立刻停机**，只输出固定的一句提示和简短原因，不做任何逐句分析，也不给回复建议。

停机优先于其他全部规则。这不是免责声明，是产品设计：有些对话不该被逐句拆解，交给模型去「翻译」反而会稀释风险。

## 一条消息被翻成什么样

```text
【A】原话：你从来都不回我消息，你心里根本没我。
情绪：委屈（4/5）
事实：过去 24 小时有 3 条消息未获回复（请核对，不符请改）
需求：我希望你忙的时候给我一句"晚点回"，因为我在意的是"被丢下"的感觉，不是你回得快不快。
（推测：A 怕的是"我不重要"，不是"你不回"。）
```

| 格子 | 规矩 |
| --- | --- |
| 原话 | 一字不改，包括脏话、省略号、错别字 |
| 情绪 | 一个词 + 1–5 强度；脏话保留原词，只在这里标强度 |
| 事实 | 去掉评价、形容词、绝对化措辞后，剩下能被第三方验证的部分；没有就写「无」 |
| 需求 | 一个具体行为 + 一个具体在意的东西 |

对动机的猜测不能混进这四格，必须单独成行并写明「推测，可能不准」。

## 为什么这么设计

- **把事实和评价拆开**：「你从来都不回我」里的「从来」是不可验证的绝对化措辞。拆出来之后，分歧才有能落到实处的讨论点。
- **把推测单独放**：翻译必然会猜，但猜测要能被一眼划掉。原文没给证据时就不写。
- **不软化攻击性**：把一句威胁翻成「他其实很在乎你」，会抹掉真实信息，比不翻译更糟。
- **停机线画在最前面**：先判断这段对话能不能翻，再谈格式。

三份完整规则以根目录的 md 为准，这里不复述。

## 目录

| 路径 | 内容 |
| --- | --- |
| `SYSTEM_PROMPT.md` | 逐句翻译的规则原文，复制即用 |
| `SCREENSHOT_PROMPT.md` | 输入是聊天截图时的附加规则，接在上面那份之后 |
| `REPLY_PROMPT.md` | 推荐回复的规则原文，3 条语气 + 说明 |
| `examples/01-basic.md` | 基准示例（规则内置的那一组） |
| `examples/02-input-edge-cases.md` | 未标说话人、语音转写、语气标记、脏话、威胁标注、超过 6 条 |
| `examples/03-hard-stops.md` | 四类停机情形与统一输出 |
| `examples/04-screenshot.md` | 聊天截图读图示例（气泡左右、时间戳、表情包） |
| `examples/05-reply.md` | 推荐回复示例、停机示例、禁止句式校验示例 |
| `tests/CHECKLIST.md` | 人工验收清单 |
| `tests/cases.md` | 用例编号表，新增示例时对照 |
| `docs/index.html` | 项目落地页，中英切换 + 明暗主题自适应 |
| `docs/app.html` | 工具页：截图分析 / 对话回复两个板块 |
| `docs/` | 上述页面与样式、脚本、数据，可直接用 GitHub Pages 发布 |
| `CHANGELOG.md` | 版本更新记录 |
| `ISSUE_TEMPLATE.md` | 根目录单文件 issue 模板（GitHub 社区标准识别用） |
| `CONTRIBUTING.md` | 怎么加示例、怎么改规则 |
| `CODE_OF_CONDUCT.md` | 讨论与反馈的行为准则 |
| `SECURITY.md` | 隐私边界与问题报告方式 |
| `.github/ISSUE_TEMPLATE/` | 两类 issue 模板 |
| `PULL_REQUEST_TEMPLATE.md` | PR 自检清单 |
| `LICENSE` | MIT |

## 使用提示

- **基准示例里的事实栏有具体数字，那是演示占位。** 实际输入里没提供的信息，事实栏写「无」或标注需核对，不要补数字。
- **聊天记录是私人信息。** 贴给任何第三方模型之前，先自行去掉姓名、手机号、住址、公司、账号和具体日期。本仓库的示例全部做过脱敏。
- **截图会离开浏览器。** 网页 Demo 的截图板块不做本地 OCR，图片以 base64 发给你配置的端点；先遮掉头像、昵称、手机号，公共或共用电脑上不要填真实 API Key。

## 贡献

欢迎补充脱敏后的真实语料示例、边界用例和错别字修正。规则原文默认不动，改动方式见 [CONTRIBUTING.md](./CONTRIBUTING.md)；提 issue 可以直接用 [模板](./.github/ISSUE_TEMPLATE/)。

## 许可

MIT，见 [LICENSE](./LICENSE)。
