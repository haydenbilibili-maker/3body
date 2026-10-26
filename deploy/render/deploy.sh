#!/usr/bin/env bash
# 触发 Render 后端重新部署，并等待线上 /health 的 version.commit 与本地 HEAD 一致。
#
# 背景：本仓库的 Render 服务是以 Public Git 方式接入的，没有 GitHub webhook，
# 因此 Render 的 Auto-Deploy 不会生效；改用 Deploy Hook 触发（可重复使用）。
#
# 用法：
#   export RENDER_DEPLOY_HOOK='https://api.render.com/deploy/srv-xxx?key=xxx'
#   ./deploy/render/deploy.sh
#
# 可选环境变量：
#   RENDER_API_BASE  线上后端地址（默认 https://threebody-api.onrender.com）
#   DEPLOY_TIMEOUT   最长等待秒数（默认 900）
set -euo pipefail

HOOK="${RENDER_DEPLOY_HOOK:?请先设置 RENDER_DEPLOY_HOOK 环境变量（Render 服务 → Settings → Deploy Hook）}"
BASE="${RENDER_API_BASE:-https://threebody-api.onrender.com}"
TIMEOUT="${DEPLOY_TIMEOUT:-900}"

SHA="$(git rev-parse --short HEAD)"
echo "▶ 触发 Render 部署（目标提交 ${SHA}）"

curl -fsS -X POST --max-time 60 "$HOOK" >/dev/null
echo "✅ 部署已触发，等待线上生效 ..."

DEADLINE=$(( $(date +%s) + TIMEOUT ))
while [ "$(date +%s)" -lt "$DEADLINE" ]; do
  sleep 15
  COMMIT="$(curl -fsS --max-time 30 "$BASE/health" 2>/dev/null \
    | grep -o '"commit":"[^"]*"' | cut -d'"' -f4 || true)"
  if [ "$COMMIT" = "$SHA" ]; then
    echo "✅ 上线完成：$BASE 正在运行 $SHA"
    exit 0
  fi
  echo "   ... 当前线上版本：${COMMIT:-旧版（无 version 字段）}"
done

echo "✘ 超时（${TIMEOUT}s）：线上仍未运行 ${SHA}，请到 Render → Deploys 查看日志"
exit 1
