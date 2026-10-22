# 3body — 三体体验沙盒

> 基于《三体》宇宙观的沉浸式体验沙盒：与智子对话、与书中人物交谈、穿越编年史、漫步黑暗森林、归还小宇宙质量……

## 对外访问链接

| 链接 | 说明 |
|------|------|
| **https://github.com/haydenbilibili-maker/3body** | 项目 GitHub 仓库（代码、Issues、克隆） |
| **https://haydenbilibili-maker.github.io/3body/** | GitHub Pages 在线预览（仅前端；无后端时智子与零点计划模块使用离线回复） |
| 克隆：`git clone https://github.com/haydenbilibili-maker/3body.git` | 本地运行请按下方「快速开始」启动前后端 |

GitHub Pages 由 Actions 自动部署：推送到 `main` 后触发构建并发布。**若打开 Pages 链接出现 404**，请在仓库 **Settings → Pages → Build and deployment → Source** 中选择 **GitHub Actions**（详见 [docs/GITHUB-PAGES-SETUP.md](docs/GITHUB-PAGES-SETUP.md)）。Pages 仅托管前端静态资源，编年史、人物志等依赖 API 的模块需自建后端并配置 `VITE_API_BASE` 后才有数据。

---

## 项目简介

**3body** 是一个以《三体》世界观为背景的 **体验沙盒** 项目：结合 AI 对话、编年史、人物志、宇宙广播、二向箔画廊、小宇宙等模块，让读者在本地或自托管环境中「进入」三体宇宙，与智子对话、与罗辑/叶文洁等核心人物进行符合人设的 AI 对话，并体验黑暗森林、面壁计划、红岸、三体摆等扇区互动。

- **定位**：三体宇宙体验沙盒（非官方），适合书迷、二次创作与 AI 应用实践。
- **技术**：Vue 3 + FastAPI + 可选 Ollama/LLM + 可选 RAG（原著检索增强）。
- **开源**：MIT 许可证，可自由克隆、修改与部署。

---

## 功能模块（扇区）

| 扇区 | 说明 |
|------|------|
| **智子终端** | 与智子流式对话，可选 RAG 检索三体原著后回答 |
| **人物志** | 约 80 位人物档案与关系星图；**与人物 AI 对话**（严格人设与三体世界观，多轮对话） |
| **宇宙广播** | 威慑度、纪元、舰队距离等仪表盘，全站色调随威慑度变化 |
| **编年史** | 时间轴、百科、外传，文明历程一览 |
| **二向箔画廊** | 作品展示与收藏 |
| **小宇宙 647** | 维生系统模拟、时间胶囊、质量归还 |
| **黑暗森林** | 星图、点火/打击/输血等互动 |
| **面壁计划** | 思想钢印、面壁/破壁对话 |
| **红岸控制台** | 信号与广播 |
| **三体摆** | 环境站、单摆、脱水控制台 |
| 其他扇区 | 阶梯计划、四维碎片、掩体世界、水滴、科学边界等 |

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Vue 3 (Script Setup) + TypeScript + Vite + TailwindCSS + Pinia + Vue Router + Naive UI |
| 后端 | Python FastAPI + Uvicorn + Pydantic + SQLAlchemy (SQLite) |
| AI 对话 | OpenAI 兼容协议（本地 Ollama / DeepSeek / SiliconFlow 等）；可选 LangChain + ChromaDB（三体原著 RAG） |

---

## 快速开始

### 环境要求

- **Node.js** 18+（前端，CI 使用 22）
- **Python** 3.9+（后端，CI 使用 3.11）
- 可选：[Ollama](https://ollama.com)（本地 LLM，用于智子、人物对话与零点计划）

### 一键启动

```bash
git clone https://github.com/haydenbilibili-maker/3body.git
cd 3body
./start.sh          # 首次运行自动创建 .venv 并安装依赖；--rag 额外安装原著检索依赖
```

### 分别启动

```bash
# 后端
python -m venv .venv
source .venv/bin/activate                     # Windows: .venv\Scripts\activate
pip install -r backend/requirements-core.txt  # 核心依赖（不含 torch）
# pip install -r backend/requirements.txt     # 完整依赖：+ RAG + Streamlit 审计终端
uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload

# 前端（另开终端）
cd frontend
npm install
npm run dev
```

- 前端：默认 **http://localhost:5173**（被占用时 Vite 会顺延到 5174、5175…）
- API 文档：http://127.0.0.1:8000/docs
- 健康检查：http://127.0.0.1:8000/health（同时显示当前 LLM 配置与 RAG 是否可用）

### 导入初始数据（首次运行）

```bash
python scripts/seed_db.py           # 导入编年史、百科与约 80 位人物档案（只填充空表）
python scripts/seed_db.py --reset   # 清空并重建所有表后重新导入
```

> 默认可以放心重复运行：已有数据的表会跳过。`--reset` 会**清空所有表**（包括你在编年史、黑暗森林、红岸里录入的内容）。

### 配置大模型（智子 / 人物对话 / 零点计划）

后端统一使用 **OpenAI 兼容协议**（`/v1/chat/completions`），一份配置覆盖所有 AI 模块。复制 `backend/.env.example` 为 `backend/.env` 后修改：

| 场景 | 配置 |
|------|------|
| 本地 Ollama（默认） | `ollama pull qwen2.5:7b`，无需其他配置 |
| DeepSeek | `3BODY_LLM_BASE_URL=https://api.deepseek.com`、`3BODY_LLM_MODEL=deepseek-chat`、`3BODY_LLM_API_KEY=sk-...` |
| 其他兼容服务 | 填写其 base_url（带不带 `/v1` 均可）、模型名与 Key |

> 在 shell 里 `export` 时请用 `THREEBODY_` 前缀（以数字开头的变量名无法 export），写进 `.env` 时用 `3BODY_`。

「人物志 → 与 TA 对话」里填写的 Key / Base URL **默认不生效**：后端不会替请求方去访问任意地址（防止被当作开放代理）。仅在本机使用时，可设置 `3BODY_LLM_ALLOW_CLIENT_OVERRIDE=true` 开启。

未配置或连不上大模型时：智子会以三体语境提示连接中断；零点计划各模块（破壁分析、云天明童话、思想钢印注入）自动回退到前端的离线规则，仍可完整游玩。

### 可选：原著 RAG（智子检索三体原文后回答）

```bash
pip install -r backend/requirements-rag.txt   # 含 sentence-transformers / torch，约 1 GB
python -m backend.rag.ingest                  # 入库 data/ 下的 UTF-8 .txt；--force 重建
```

- 首次入库会下载中文 embedding 模型 `shibing624/text2vec-base-chinese`。不手动入库时，第一次智子对话会自动入库（较慢）。
- 向量库位于 `backend/chroma_db/`（不入 git）。
- 语料必须是 **UTF-8 纯文本**。从 macOS 文本编辑等导出的 RTF 先转换：`python scripts/rtf_to_text.py <文件>`（入库时会自动跳过 RTF 并提示）。
- 未安装 RAG 依赖或入库失败时，智子对话自动降级为无检索模式，不影响其他功能。

### 可选：智子审计（`/api/sophon/audit` 与 Streamlit 终端）

需要 SiliconFlow 账号：设置 `3BODY_SILICONFLOW_API_KEY`；国际站账号另设 `3BODY_SILICONFLOW_BASE_URL=https://api.siliconflow.com/v1`。终端界面：`streamlit run app.py`。

### 运行测试

```bash
pip install -r requirements-test.txt
pytest
```

测试不需要大模型、RAG 依赖或网络。每个 PR 与非 `main` 分支的推送都会在 GitHub Actions 上运行前端构建（`vue-tsc` + `vite build`）与后端测试（`.github/workflows/ci.yml`）。

---

## 项目结构

```
3body/
├── data/              # 三体原著 .txt（UTF-8）、百科/外传 JSON（RAG 数据源）
├── frontend/          # Vue 3 + Vite 前端
├── backend/           # FastAPI 后端：路由、LLM 网关、RAG、智子审计
├── tests/             # pytest（全接口冒烟 + LLM/网关/RAG 单元测试）
├── scripts/           # 数据脚本（RTF 转换、种子数据）
├── app.py             # 智子审计终端（Streamlit）
├── docs/              # 文档与封板报告
├── PRD/               # 产品需求文档
├── CHANGELOG.md       # 版本变更
└── README.md          # 本说明
```

---

## 环境变量（后端）

| 变量 | 说明 | 默认 |
|------|------|------|
| `3BODY_LLM_BASE_URL` | LLM 基址（OpenAI 兼容） | `http://localhost:11434` |
| `3BODY_LLM_MODEL` | 模型名 | `qwen2.5:7b` |
| `3BODY_LLM_API_KEY` | API Key（云端时填写） | 空 |
| `3BODY_LLM_TIMEOUT` | 单次请求超时（秒） | `60` |
| `3BODY_LLM_ALLOW_CLIENT_OVERRIDE` | 允许前端覆盖 Key / 地址 / 模型（仅本机） | `false` |
| `3BODY_CHROMA_PERSIST_DIR` | RAG 向量库目录 | `backend/chroma_db` |
| `3BODY_DATA_DIR` | RAG 语料目录 | `data` |
| `3BODY_SILICONFLOW_API_KEY` | 智子审计（SiliconFlow） | 空 |
| `3BODY_SILICONFLOW_BASE_URL` | 智子审计端点 | `https://api.siliconflow.cn/v1` |
| `3BODY_CORS_ORIGINS` | 允许的前端来源，逗号分隔 | `*` |
| `3BODY_DATABASE_URL` | 数据库连接 | `sqlite+aiosqlite:///3body.db` |

示例见 `backend/.env.example`。

---

## 生产部署

- **前端**：`cd frontend && npm run build`，产出在 `frontend/dist/`。部署时需设置 `VITE_API_BASE` 为后端地址（如 `https://api.example.com`），以便 API 请求正确转发。
- **后端**：使用 Uvicorn 或 Gunicorn 挂载 `backend.main:app`，并配置反向代理与 HTTPS。后端没有鉴权，公网部署时设置 `3BODY_CORS_ORIGINS` 并保持 `3BODY_LLM_ALLOW_CLIENT_OVERRIDE=false`。

---

## 设计系统

- **背景**：深空黑 `#050505` / `#000510`
- **主色**：切伦科夫蓝 `#00FFFF`
- **警示**：红岸红 `#FF3333`
- **字体**：等宽数据展示，衬线叙事

---

## 文档与链接

- 封板与测试报告：`docs/RELEASE-1.0-FREEZE.md`、`docs/RELEASE-2.0-FREEZE.md`
- 版本历史：`CHANGELOG.md`
- 《三体》为刘慈欣所著科幻作品，本项目为爱好者向体验沙盒，与官方无关。

---

## License

MIT. 详见 [LICENSE](LICENSE)。
