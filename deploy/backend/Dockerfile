# 3body 后端 · 通用 Docker 镜像（Render / Hugging Face PRO / 任意 Docker 主机）
#
# - 只安装核心依赖（不含 RAG 的 torch/chromadb，约 1GB）
# - 智子对话自动降级为「无原著检索」，其余 API 全部可用
# - 端口通过 $PORT 注入（Render 默认 10000；HF Spaces 为 7860）
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# 依赖单独一层，便于缓存
COPY backend/requirements-core.txt /tmp/requirements-core.txt
RUN pip install --no-cache-dir -r /tmp/requirements-core.txt

# 应用代码 + 种子数据（scripts/ 负责建表与导入 data/*.json）
COPY backend /app/backend
COPY scripts /app/scripts
COPY data /app/data

# 构建期预热一次，运行期再做一次（已有数据自动跳过）
RUN python scripts/seed_db.py

# 容器一般以非 root 运行，确保可写（SQLite 落在 /app/3body.db）
RUN chmod -R a+rwX /app

ENV PORT=7860
EXPOSE 7860

CMD ["sh", "-c", "python scripts/seed_db.py && exec uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-7860} --proxy-headers --forwarded-allow-ips='*'"]
