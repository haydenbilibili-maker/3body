---
title: 3body API
emoji: 🌌
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
license: mit
short_description: 三体宇宙体验沙盒的 FastAPI 后端
---

# 3body API

三体宇宙 AI 沉浸式社区（[3body](https://github.com/haydenbilibili-maker/3body)）的 FastAPI 后端。

## 接口

- 健康检查：`GET /health`（含 LLM / RAG 配置状态）
- 文档：`GET /docs`（OpenAPI）
- 业务接口：`/api/chat`、`/api/chronicle/*`、`/api/gallery/*`、`/api/universe/*`、`/api/figures/*`、`/api/sector-*/*`、`/api/llm/*`

## 配置

通过 Space 的 **Settings → Variables and secrets** 注入：

| 变量 | 说明 |
|---|---|
| `THREEBODY_LLM_BASE_URL` | OpenAI 兼容端点，如 `https://api.deepseek.com` |
| `THREEBODY_LLM_MODEL` | 模型名，如 `deepseek-chat` |
| `THREEBODY_LLM_API_KEY` | API Key（secret） |
| `THREEBODY_CORS_ORIGINS` | 允许的前端来源，逗号分隔 |

> 容器文件系统为临时存储：重启后 SQLite 会重新由种子数据初始化，用户产生的数据不会持久化。
