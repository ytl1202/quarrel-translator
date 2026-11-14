# Security policy

完整中文说明见仓库根目录 [SECURITY.md](https://github.com/ytl1202/quarrel-translator/blob/main/SECURITY.md)。这里保留一份等效副本，便于 GitHub 从 `.github/` 目录识别安全政策。

## Scope

This repository contains only Markdown text, a static site (`docs/`) and sample data. There is no server, no dependency tree, no build step and no data collection, so there is no traditional vulnerability-patching or bug-bounty process.

## Privacy boundaries

- The screenshot feature does **not** run local OCR. Images are sent as base64 to the model endpoint **you** configure. Mask avatars, names and phone numbers first.
- API keys stay in page memory only; they are never persisted or sent anywhere except the endpoint you enter.
- GitHub Pages sites are public even when the source repository is private.

## Reporting

| Situation | What to do |
| --- | --- |
| Rule violations, display bugs, documentation errors | Open a public [issue](https://github.com/ytl1202/quarrel-translator/issues) |
| Real credentials, someone else's private data, unredacted screenshots | Do **not** open a public issue — contact the maintainer privately, without pasting the raw content |
| Red-line cases | Describe the category only, never quote the original lines |

Red lines that trigger an immediate stop are defined in [SYSTEM_PROMPT.md](https://github.com/ytl1202/quarrel-translator/blob/main/SYSTEM_PROMPT.md) and [examples/03-hard-stops.md](https://github.com/ytl1202/quarrel-translator/blob/main/examples/03-hard-stops.md). This tool is not a substitute for real-world help or professional services.
