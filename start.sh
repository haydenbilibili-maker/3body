#!/usr/bin/env bash
# 3body 本地一键启动：后端 FastAPI（:8000）+ 前端 Vite（:5173）
#   ./start.sh          安装核心依赖并启动（不含 RAG，智子对话为无检索模式）
#   ./start.sh --rag    额外安装 RAG 依赖（含 torch，约 1 GB），智子对话检索三体原著
set -euo pipefail
cd "$(dirname "$0")"

WITH_RAG=0
for arg in "$@"; do
  case "$arg" in
    --rag) WITH_RAG=1 ;;
    -h|--help) sed -n '2,4p' "$0"; exit 0 ;;
    *) echo "未知参数: $arg" >&2; exit 1 ;;
  esac
done

if [ ! -d .venv ]; then
  echo "[setup] 创建虚拟环境 .venv"
  python3 -m venv .venv
fi
PY=.venv/bin/python
"$PY" -m pip install -q -r backend/requirements-core.txt
if [ "$WITH_RAG" = 1 ]; then
  "$PY" -m pip install -q -r backend/requirements-rag.txt
fi

if [ ! -d frontend/node_modules ]; then
  echo "[setup] 安装前端依赖"
  (cd frontend && npm install)
fi

cleanup() {
  echo
  echo "[shutdown] 正在停止前后端…"
  kill "${BACKEND_PID:-}" "${FRONTEND_PID:-}" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

# 只监听本机：后端没有鉴权，不要直接暴露到局域网/公网
"$PY" -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!
(cd frontend && npm run dev) &
FRONTEND_PID=$!

echo "=================================================="
echo "  3body 已启动"
echo "  前端:     http://localhost:5173"
echo "  API 文档: http://127.0.0.1:8000/docs"
echo "  健康检查: http://127.0.0.1:8000/health（含 LLM / RAG 状态）"
echo "  Ctrl+C 停止"
echo "=================================================="
wait
