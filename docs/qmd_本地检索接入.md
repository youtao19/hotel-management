# QMD 本地检索接入

本文记录本项目接入 qmd 的本地开发配置。qmd 只作为 AI 辅助编程检索工具使用，不是酒店系统运行时依赖，不写入 `package.json`。

## 参考资料

- QMD 官方仓库：https://github.com/tobi/qmd
- QMD MCP 配置说明：https://github.com/tobi/qmd/blob/main/skills/qmd/references/mcp-setup.md
- 用户提供的视频参考：https://www.youtube.com/watch?v=123cqKLy6lc
- 用户提供的转存链接：http://googleusercontent.com/youtube_content/2

## 本机安装

当前机器已通过 npm 全局安装：

```bash
npm install -g @tobilu/qmd
qmd --version
```

当前版本：

```text
qmd 2.1.0
```

qmd 可执行文件路径：

```text
/Users/peach/.nvm/versions/node/v22.20.0/bin/qmd
```

Cursor 和 Codex 都通过绝对路径启动 qmd，避免图形界面启动时找不到 nvm 的 `PATH`。

## Cursor MCP 配置

项目内配置文件：

```text
.cursor/mcp.config.json
```

已增加的 MCP 服务名：

```text
qmd-hotel-management
```

它使用独立命名索引：

```text
hotel-management
```

qmd 索引和模型缓存位于用户目录，不进入仓库：

```text
~/.cache/qmd/hotel-management.sqlite
~/.cache/qmd/models/
~/.config/qmd/hotel-management.yml
```

## Codex MCP 配置

Codex 使用全局配置文件：

```text
~/.codex/config.toml
```

已增加的 MCP 服务名：

```text
qmd-hotel-management
```

配置由 Codex CLI 写入：

```bash
codex mcp add qmd-hotel-management --env 'QMD_EDITOR_URI=cursor://file/{path}:{line}:{col}' -- /Users/peach/.nvm/versions/node/v22.20.0/bin/qmd --index hotel-management mcp
```

检查配置：

```bash
codex mcp get qmd-hotel-management
codex mcp list
```

如需移除：

```bash
codex mcp remove qmd-hotel-management
```

## 已索引范围

本项目按模块建立集合，便于 AI 按范围检索：

| 集合名 | 路径 | 文件匹配 |
| --- | --- | --- |
| `hotel-backend` | `backend/` | `**/*.{js,json,sql,md}` |
| `hotel-frontend` | `frontend/src/` | `**/*.{vue,js,ts,json,md}` |
| `hotel-docs` | `docs/` | `**/*.md` |
| `hotel-e2e` | `e2e/` | `**/*.js` |
| `hotel-sql` | `sql/` | `**/*.{sql,md,py}` |
| `hotel-root-docs` | 项目根目录 | `*.md` |

未把 `node_modules`、构建产物、测试报告、`.git` 和本地环境变量作为集合索引范围。`sql/*.csv` 也未纳入，避免把大体量数据样本混进 AI 检索上下文。

## 常用命令

查看索引健康状态：

```bash
qmd --index hotel-management status
```

更新文件索引：

```bash
qmd --index hotel-management update
```

生成或刷新向量嵌入：

```bash
qmd --index hotel-management embed --max-docs-per-batch 80 --max-batch-mb 32
```

按自然语言检索：

```bash
qmd --index hotel-management query "抖音订单同步逻辑在哪里"
```

注意：单行 `query` 会触发查询扩展和重排序能力，首次运行可能继续下载额外 GGUF 模型。只想快速检索时优先用 `search`，或使用下面这种结构化查询并关闭重排序：

```bash
qmd --index hotel-management query $'lex: 抖音 订单同步\nvec: 抖音订单同步逻辑在哪里' -c hotel-backend --no-rerank
```

限定集合检索：

```bash
qmd --index hotel-management query "订单入住状态流转" -c hotel-backend
```

快速关键词检索：

```bash
qmd --index hotel-management search "autoBillJob" -c hotel-backend
```

读取检索结果中的文件：

```bash
qmd --index hotel-management get qmd://hotel-backend/modules/douyin/rate-plan/product.service.js -l 80
```

## 维护规则

当新增、移动或删除大量源码/文档后，先运行：

```bash
qmd --index hotel-management update
qmd --index hotel-management embed --max-docs-per-batch 80 --max-batch-mb 32
```

如果 Cursor 里 qmd MCP 没有结果，按顺序检查：

```bash
which qmd
qmd --index hotel-management status
qmd --index hotel-management mcp
```

如果只是普通命令行检索，不需要启动 MCP；MCP 是给 Cursor 等 AI 工具调用的入口。
