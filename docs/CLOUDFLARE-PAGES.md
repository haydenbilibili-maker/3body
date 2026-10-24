# Cloudflare Pages 部署说明

> 目标：把 `frontend/` 构建出的静态站点发布到 Cloudflare Pages。
> 当前线上地址：**https://3body-5px.pages.dev/**

---

## 1. 线上信息

| 项 | 值 |
|---|---|
| Cloudflare 项目名 | `3body` |
| 生产分支 | `main` |
| 默认域名 | https://3body-5px.pages.dev/ |
| 构建产物目录 | `frontend/dist` |

---

## 2. 首次准备：登录 wrangler

```bash
npx wrangler@4 login
```

浏览器弹窗授权后，凭据写入本机 wrangler 全局配置，后续命令不再需要登录。

校验登录态与账号：

```bash
npx wrangler@4 whoami
```

> CI / 非交互环境无法走浏览器 OAuth，需改用 **API Token**：
> 在 Cloudflare Dashboard → My Profile → API Tokens 创建带 **Cloudflare Pages: Edit** 权限的 Token，
> 然后设置 `CLOUDFLARE_API_TOKEN`（以及 `CLOUDFLARE_ACCOUNT_ID`）环境变量。

---

## 3. 构建与部署

```bash
cd frontend
npm ci          # 首次或依赖变更时
npm run build
npm run deploy:cloudflare
```

`deploy:cloudflare` 等价于：

```bash
wrangler pages deploy dist --project-name=3body --branch=main
```

部署成功后输出形如 `https://<hash>.3body-5px.pages.dev` 的预览地址；生产地址始终是
https://3body-5px.pages.dev/ 。

首次创建项目（仅需一次）：

```bash
wrangler pages project create 3body --production-branch=main
```

---

## 4. 为什么 SPA 深链可以直接访问

`frontend/dist` 中没有 `404.html`，Cloudflare Pages 会把未匹配的路径回退到 `index.html`，
因此 `/chronicle`、`/figures`、`/universe/647` 等 vue-router 深链都能直接打开。

> 注意：如果以后在 `dist` 根目录放了 `404.html`，Pages 会改为返回该文件，SPA 回退行为随之改变。

---

## 5. 后端说明（重要）

本项目后端是 **Python FastAPI + 可选 RAG（ChromaDB）**，无法直接运行在 Cloudflare Pages 上。
当前部署**只包含前端静态资源**：

- 纯展示/本地交互页面可正常浏览；
- 智子终端、人物对话、宇宙广播等依赖 `/api` 的模块，需要：
  1. 自建后端并公网可达；且
  2. 构建时设置 `VITE_API_BASE=https://<你的后端域名>`（见 `frontend/.env.example`）后重新构建部署。

在未配置后端时，这些模块会走相对路径 `/api` 并失败，属预期行为。

---

## 6. 可选：接入 Git 自动部署

两种方式任选其一：

1. **Cloudflare Dashboard Git 直连**（零令牌）：Pages → Create → 连接 GitHub 仓库，
   构建命令 `cd frontend && npm ci && npm run build`，输出目录 `frontend/dist`。
2. **GitHub Actions + API Token**：在仓库 Secrets 配置 `CLOUDFLARE_API_TOKEN`、
   `CLOUDFLARE_ACCOUNT_ID`，用 `cloudflare/wrangler-action` 执行 `pages deploy`。

> 目前仓库只配置了 GitHub Pages 的 Actions（`.github/workflows/deploy-pages.yml`），
> Cloudflare 走上面的手动命令部署。
