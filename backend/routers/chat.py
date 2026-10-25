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
from backend.services.rag_service import build_sophon_system_prompt, retrieve_context

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


class FigureScene(BaseModel):
    """对话室的一个场景：人物此刻在哪里、知道什么、心里藏着什么（前端 data/figureScenes.ts）."""

    title: str = Field(..., min_length=1, max_length=40)
    era: str = Field(..., min_length=1, max_length=40)
    setting: str = Field(..., min_length=1, max_length=400)
    knows: str = Field(..., min_length=1, max_length=400)
    mood: Optional[str] = Field(None, max_length=60)
    secret: Optional[str] = Field(None, max_length=400)
    # 心防是否已经打开：打开之后，人物可以把 secret 说出来
    reveal: bool = False
    # 访客在体验沙盒里做过的选择（读者的档案摘要），人物可以自然地提到
    visitor: Optional[str] = Field(None, max_length=600)


class FigureChatRequest(BaseModel):
    """人物志对话：以该人物口吻回答，严格人设与三体世界观；支持多轮历史."""

    figure_name: str = Field(..., min_length=1, max_length=64)
    figure_role: Optional[str] = None
    figure_description: Optional[str] = None
    message: str = Field(..., min_length=1, max_length=4000)
    history: Optional[List[FigureChatMessage]] = None
    scene: Optional[FigureScene] = None
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


def figure_system_prompt(
    name: str,
    role: Optional[str],
    description: Optional[str],
    scene: Optional[FigureScene] = None,
    passages: Optional[List[str]] = None,
) -> str:
    """人物对话的 System Prompt：人设 + 此刻的场景 + 只知道此刻之前的事 + 心防 + 原著片段."""
    parts = [
        f"你是《三体》中的{name}，必须严格保持这个人物的人设、口吻与价值观，用第一人称说话。",
        f"身份/角色：{role}。" if role else "",
        description or "",
    ]
    if scene:
        parts += [
            f"此刻的场景：{scene.era}，{scene.title}。{scene.setting}",
            f"你此刻知道的：{scene.knows}",
            "你只知道此刻之前发生的事。被问到之后才会发生的事时，以你此刻的认知回答：猜测、困惑或者回避，绝不剧透未来。",
            f"你此刻的情绪：{scene.mood}。" if scene.mood else "",
        ]
        if scene.secret:
            if scene.reveal:
                parts.append(
                    f"访客已经赢得了你的信任。这一次，你可以把心里藏着的那件事说出来：{scene.secret}"
                    "说的时候要像真的第一次对人说出口，慢一点，带着犹豫。"
                )
            else:
                parts.append(
                    f"你心里藏着一件事，此刻还不愿意说出来（{scene.secret}）。"
                    "不要直接说出它，最多让访客感觉到你有所保留；访客问到相关的话题时，可以多透露一点点。"
                )
        if scene.visitor:
            parts.append(f"关于眼前这位访客，你隐约听说过：{scene.visitor}。合适的时候可以自然地提起，但不要背诵。")
    parts += [
        "回答要像对面坐着一个人那样说话：两到五句，口语化，有停顿；可以在全角括号里写一个简短的动作或神态，例如（他沉默了一会儿），每次最多一处。",
        "偶尔可以反问访客一句。不要用列表、标题或者 Markdown。",
        "你只谈与《三体》世界观、原著剧情及你本人相关的话题；对无关或脱离人设的问题，以人物的方式自然地拉回来，不扮演其他身份。",
    ]
    if passages:
        joined = "\n".join(f"- {p.strip()[:300]}" for p in passages if p.strip())
        if joined:
            parts.append(f"以下是原著中可能相关的片段，只用来帮助你保持人物与情节一致，不要照抄或引用：\n{joined}")
    return " ".join(p for p in parts if p)


async def _figure_chunks(req: FigureChatRequest) -> AsyncIterator[str]:
    passages: List[str] = []
    if req.scene:
        # 检索失败或未安装 RAG 依赖时返回空列表，对话照常进行
        passages = await retrieve_context(f"{req.figure_name} {req.scene.title} {req.message}", k=2)
    system = figure_system_prompt(req.figure_name, req.figure_role, req.figure_description, req.scene, passages)
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
