"""
智子终端 / 人物志对话 — 流式对话 API.

三个接口统一使用同一种 SSE 格式（前端 ``utils/sse.ts`` 解析）::

    data: "<JSON 字符串编码的文本片段>"\\n\\n
    ...
    data: [DONE]\\n\\n

片段做 JSON 编码，保证模型输出中的换行不会破坏 SSE 分帧。
"""
import json
from typing import AsyncIterator, List, Literal, Optional

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from backend.services.llm_service import stream_chat, stream_chat_messages
from backend.services.rag_service import build_sophon_system_prompt

router = APIRouter()

SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}


class ChatMessage(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)


class FigureChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class FigureChatRequest(BaseModel):
    """人物志对话：以该人物口吻回答，严格人设与三体世界观；支持多轮历史."""

    figure_name: str = Field(..., min_length=1, max_length=64)
    figure_role: Optional[str] = None
    figure_description: Optional[str] = None
    message: str = Field(..., min_length=1, max_length=4000)
    history: Optional[List[FigureChatMessage]] = None
    # 仅当服务端开启 3BODY_LLM_ALLOW_CLIENT_OVERRIDE 时生效，否则忽略
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    model: Optional[str] = None


def sse_event(chunk: str) -> str:
    return f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"


def sse_response(chunks: AsyncIterator[str]) -> StreamingResponse:
    async def gen():
        async for chunk in chunks:
            if chunk:
                yield sse_event(chunk)
        yield "data: [DONE]\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream", headers=SSE_HEADERS)


async def _sophon_chunks(message: str) -> AsyncIterator[str]:
    """先检索三体原文（RAG 不可用时自动降级），再以智子人格流式生成."""
    system_prompt = await build_sophon_system_prompt(message)
    async for chunk in stream_chat(message, system_prompt=system_prompt):
        yield chunk


@router.post("")
async def chat(req: ChatMessage):
    """POST /api/chat：智子对话（RAG + 流式 SSE）."""
    return sse_response(_sophon_chunks(req.message))


@router.post("/stream")
async def chat_stream(req: ChatMessage):
    """POST /api/chat/stream：与 /api/chat 相同，保留给旧前端调用."""
    return sse_response(_sophon_chunks(req.message))


def figure_system_prompt(name: str, role: Optional[str], description: Optional[str]) -> str:
    parts = [
        f"你是《三体》中的{name}，必须严格保持该人物的人设与口吻。",
        f"身份/角色：{role}。" if role else "",
        description or "",
        "你只回答与《三体》世界观、原著剧情及你本人设相关的问题；以第一人称简短回答，符合人物性格与原著。",
        "对与三体无关或脱离人设的问题，礼貌拒绝或自然拉回主题，不扮演其他身份、不回答无关领域。",
    ]
    return " ".join(p for p in parts if p)


async def _figure_chunks(req: FigureChatRequest) -> AsyncIterator[str]:
    system = figure_system_prompt(req.figure_name, req.figure_role, req.figure_description)
    history = [m.model_dump() for m in (req.history or [])]
    async for chunk in stream_chat_messages(
        system,
        history,
        req.message,
        base_url=req.base_url,
        model=req.model,
        api_key=req.api_key,
    ):
        yield chunk


@router.post("/figure")
async def chat_figure(req: FigureChatRequest):
    """POST /api/chat/figure：人物志对话（多轮、流式 SSE）."""
    return sse_response(_figure_chunks(req))
