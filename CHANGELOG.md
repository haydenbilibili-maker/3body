# Changelog

## [Unreleased] — 2.1 地基修复

### AI
- 智子终端（Sector A）接通后端：此前前端固定返回本地写死的回复
- 统一 OpenAI 兼容协议，一份 `3BODY_LLM_*` 配置覆盖智子、人物对话、零点计划；默认模型 `qwen2.5:7b`
- 新增 `POST /api/llm/gateway`：破壁分析、云天明童话编码/解码评分、思想钢印注入；LLM 不可用时前端回退离线规则
- 原著语料由 RTF 转为 UTF-8 纯文本，RAG 检索结果终于是中文原文；向量库目录统一、不再入库
- RAG 依赖可选：未安装或入库失败时智子对话降级为无检索模式
- 智子审计：嵌入与对话统一到一个 SiliconFlow 端点；审计基础设施失败不再导致编年史录入被拒

### 安全
- 默认忽略前端传入的 LLM 地址 / Key（防 SSRF），本机可用 `3BODY_LLM_ALLOW_CLIENT_OVERRIDE=true` 开启
- 原著阅读导入的本地文本先转义再渲染（XSS）
- CORS 不再与通配来源同时允许凭证；`start.sh` 只监听 127.0.0.1

### 修复
- GitHub Pages 子路径下人物与编年史图片 404
- 同步审计调用阻塞事件循环；面壁会话查询；SQLite 绝对路径迁移；`.env` 读取位置
- `app.py`（Streamlit 审计终端）语法错误导致无法启动；`rag/retriever.py` 导入即报错（已删除）

### 工程
- pytest：全接口冒烟 + LLM / 网关 / RAG 单元测试；商业化测试随商业化冻结整体跳过
- 新增 PR CI（前端构建 + 后端测试）；依赖拆分为 core / rag
- 删除死代码：SectorZeroV2（已拆分到面壁者 / 阶梯计划 / 黑暗森林）、SectorT、SophonView、SophonChat
- `vue-tsc -b` 产物不再生成到源码目录、不再入库

### 冻结
- 商业化（会员、支付、鉴权）暂停推进，`tests/test_payment_auth.py` 保留为将来的验收标准

## [2.0.0] - 2026-02（前端封板）

全站构建稳定性与视觉质感统一，详见 `docs/RELEASE-2.0-FREEZE.md`。

## [1.0.0] - 2025-03（GitHub 封板交付）

### 功能

- **智子终端**：RAG 检索 + 流式对话，支持 Ollama / 自定义 API
- **人物志**：10 位核心人物档案，选择式对话 + **人物 AI 对话**（人设严格约束、多轮历史）
- **人物对话**：对话式气泡 UI，预埋问题引导，支持 API Key / Base URL / Model 配置（默认本地 Ollama）
- **宇宙广播**：威慑度、纪元、舰队距离等仪表盘
- **编年史**：时间轴、百科、外传
- **二向箔画廊**：作品展示与收藏
- **小宇宙 (647)**：维生系统模拟、时间胶囊、质量归还
- **黑暗森林**、**面壁计划**、**红岸**、**三体摆** 等扇区

### 后端

- FastAPI + SQLite + 可选 ChromaDB RAG
- 人物对话接口 `POST /api/chat/figure`（多轮 history、严格人设与三体世界观）
- RAG 懒加载、GZip 压缩、人物列表/宇宙指标短缓存
- 环境变量：`3BODY_LLM_BASE_URL`、`3BODY_LLM_MODEL`、`3BODY_LLM_API_KEY`（可选）

### 前端

- Vue 3 + TypeScript + Vite + Naive UI + Pinia
- 路由懒加载、构建分包（vue-vendor、naive-ui）
- 字体异步加载、首屏请求延后，API 基址统一（`apiUrl`）

### 文档与交付

- README 快速开始、环境变量说明
- `.gitignore`、`LICENSE`（MIT）
- 封板报告：`docs/RELEASE-1.0-FREEZE.md`
