"""
3body - 三体宇宙 AI 沉浸式社区
Backend Entry: FastAPI + Uvicorn
"""
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware

from backend.config import settings
from backend.database import init_db
from backend.routers import (
    chat,
    chronicle,
    dark_forest,
    figures,
    gallery,
    llm_gateway,
    mental_seal,
    mini_universe,
    red_coast,
    sophon,
    universe,
)
from backend.services.rag_service import rag_status


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期：仅初始化数据库；RAG 在首次智子对话时懒加载以加快启动."""
    await init_db()
    yield
    # shutdown 可在此做清理


app = FastAPI(
    title="3body API",
    description="三体宇宙 - 质子终端 / 编年史 / 宇宙广播 / 二向箔画廊",
    version="0.1.0",
    lifespan=lifespan,
)

# 本项目不使用 Cookie 鉴权，因此不允许携带凭证；"*" 与 allow_credentials=True 同时使用会被浏览器拒绝。
# 公网部署时用 3BODY_CORS_ORIGINS 限定前端域名（逗号分隔）。
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
# 响应压缩，减少传输体积，提升加载速度
app.add_middleware(GZipMiddleware, minimum_size=500)

app.include_router(chat.router, prefix="/api/chat", tags=["Sophon Chat"])
app.include_router(chronicle.router, prefix="/api/chronicle", tags=["Chronicle"])
app.include_router(gallery.router, prefix="/api/gallery", tags=["Gallery"])
app.include_router(universe.router, prefix="/api/universe", tags=["Universe"])
app.include_router(sophon.router, prefix="/api/sophon", tags=["Sophon Audit"])
app.include_router(figures.router, prefix="/api/figures", tags=["Figures"])
app.include_router(mini_universe.router, prefix="/api/sector-u", tags=["Mini Universe"])
app.include_router(mental_seal.router, prefix="/api/sector-f", tags=["Mental Seal"])
app.include_router(red_coast.router, prefix="/api/sector-r", tags=["Red Coast"])
app.include_router(dark_forest.router, prefix="/api/sector-e", tags=["Dark Forest"])
app.include_router(llm_gateway.router, prefix="/api/llm", tags=["LLM Gateway"])


@app.get("/")
async def root():
    return {"message": "3body API", "status": "ok"}


@app.get("/health")
async def health():
    """健康检查；附带 LLM 与 RAG 配置状态，便于排查「智子没有回答」."""
    return {
        "status": "healthy",
        # 部署版本标记：Render 会注入 RENDER_GIT_COMMIT / RENDER_GIT_BRANCH，
        # 本地或其它平台缺失时回退为 dev，便于线上确认「部署的是哪个提交」。
        "version": {
            "commit": (os.environ.get("RENDER_GIT_COMMIT") or os.environ.get("GIT_COMMIT") or "dev")[:7],
            "branch": os.environ.get("RENDER_GIT_BRANCH", ""),
        },
        "llm": {
            "base_url": settings.llm_base_url,
            "model": settings.llm_model,
            "api_key_configured": bool(settings.llm_api_key),
            "client_override_allowed": settings.llm_allow_client_override,
        },
        "rag": rag_status(),
    }
