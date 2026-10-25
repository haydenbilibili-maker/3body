# 后端部署说明（Render 免费版 / 任意 Docker 主机）

> 目标：把 `backend/`（FastAPI）部署到公网，并把前端 `VITE_API_BASE` 指向它，
> 让 Cloudflare Pages / GitHub Pages 上的站点具备真实 API。

## 当前线上实例

| 项 | 值 |
|---|---|
| 后端地址 | **https://threebody-api.onrender.com** |
| 平台 | Render 免费 Web Service（Docker，Singapore） |
| 健康检查 | `GET https://threebody-api.onrender.com/health` |
| LLM | DeepSeek `deepseek-chat`（Key 存于 Render 环境变量，不入库） |
| 前端接入 | `frontend/.env.production` 中 `VITE_API_BASE` |
| 已知限制 | 15 分钟无访问休眠（冷启动 30–60s）；SQLite 临时存储，重启由种子脚本重建；未装 RAG |

---

## 1. 架构

```
Cloudflare Pages (3body-5px.pages.dev)  ──fetch──▶  Render Web Service (Docker)
        /api/*                                          └── FastAPI (backend/main.py)
                                                            ├── SQLite（种子数据，重启重置）
                                                            └── DeepSeek（OpenAI 兼容协议）
```

- 镜像只装核心依赖，**不含 RAG**（ChromaDB + torch ≈ 1GB）：智子对话自动降级为「无原著检索」，其余接口不受影响。
- Render 免费版：512MB 内存、**15 分钟无访问休眠**（冷启动约 30–60s）、磁盘临时（重启后由 `scripts/seed_db.py` 重建数据）。
- 后端镜像与平台无关：`deploy/backend/Dockerfile` 通过 `$PORT` 适配 Render / HF Spaces / 任意 Docker 主机。

---

## 2. Render 免费版部署（推荐）

仓库已包含 Blueprint `render.yaml`，一条龙创建服务：

1. 打开 <https://render.com>，用 **GitHub 账号**登录（无需信用卡）。
2. Dashboard → **New** → **Blueprint**。
3. 选择仓库 **`haydenbilibili-maker/3body`**（首次需授权 Render 访问该仓库）。
4. Render 会读取 `render.yaml`，显示服务 `3body-api`（Free / Docker / Singapore）。
5. Apply 时按提示填写密钥：
   - `THREEBODY_LLM_API_KEY` = 你的 DeepSeek Key（不写入仓库）
6. 点击 **Apply / Deploy**，等待首次构建（约 3–5 分钟）。
7. 服务地址形如 **`https://3body-api.onrender.com`**（若名称被占用会带随机后缀）。

> 也可以用「Deploy to Render」按钮直接进入 Blueprint 流程：
> `https://render.com/deploy?repo=https://github.com/haydenbilibili-maker/3body`

### 部署后验证

```bash
BASE=https://3body-api.onrender.com
curl -s $BASE/health
curl -s $BASE/api/chronicle/events | head -c 200
curl -s $BASE/api/figures/list    | head -c 200
```

`/health` 应返回：

```json
{"status":"healthy","llm":{"base_url":"https://api.deepseek.com","model":"deepseek-chat","api_key_configured":true,...}}
```

首次访问可能等待 30–60s（休眠唤醒）。

---

## 3. 本地 Docker 验证（改代码后自测）

```bash
docker build -f deploy/backend/Dockerfile -t 3body-backend .
docker run --rm -p 8000:8000 -e PORT=8000 \
  -e THREEBODY_LLM_BASE_URL=https://api.deepseek.com \
  -e THREEBODY_LLM_MODEL=deepseek-chat \
  -e THREEBODY_LLM_API_KEY=sk-xxx \
  3body-backend
curl -s http://127.0.0.1:8000/health
```

---

## 4. 前端接入

后端上线后，构建时注入 `VITE_API_BASE`：

```bash
cd frontend
VITE_API_BASE=https://3body-api.onrender.com npm run build
npm run deploy:cloudflare
```

推荐把该地址写入 `frontend/.env.production`（非密钥，可提交），并给
`.github/workflows/deploy-pages.yml` 的构建步骤加同名环境变量，
这样 Cloudflare Pages 与 GitHub Pages 两条发布线都指向线上后端。

---

## 5. 备选：Hugging Face PRO（$9/月）

HF 已不再免费提供 Docker Space（需 PRO）。若已有 PRO，可直接用脚本：

```bash
export THREEBODY_LLM_BASE_URL=https://api.deepseek.com
export THREEBODY_LLM_MODEL=deepseek-chat
export THREEBODY_LLM_API_KEY=sk-xxx
/tmp/hf-venv/bin/python deploy/huggingface/deploy.py   # 需先 hf auth login
```

脚本会打包 `backend/ + scripts/ + data/ + deploy/backend/Dockerfile`，
创建 Space 并写入 secrets，等待构建后自动做 `/health` 验证。

---

## 6. 常见问题

| 现象 | 处理 |
|---|---|
| Render 构建失败 | 看 Render 的 Logs；常见为 Dockerfile 路径或依赖问题 |
| `/health` 中 `api_key_configured: false` | 检查 Render 环境变量 `THREEBODY_LLM_API_KEY`，保存后会自动重启 |
| 前端跨域失败 | 把实际域名加入 `THREEBODY_CORS_ORIGINS`（逗号分隔）后重启 |
| 首次请求很慢 | 免费版休眠后冷启动，属正常现象 |
| 数据被重置 | 免费版无持久磁盘，重启即重置；需要持久化请改用付费磁盘或外部数据库 |
| 智子回答没有原著引用 | 未安装 RAG 依赖，属预期降级 |
