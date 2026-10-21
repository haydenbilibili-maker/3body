"""
零点计划 · 统一 LLM 网关：POST /api/llm/gateway {task, payload} → {data}.

契约见 docs/PROJECT-ZERO-V2-API-CONTRACT.md。状态码约定（前端 api/llm_gateway.ts 据此决定是否重试 / 回退 mock）：

- 200 ``{"data": ...}``  成功
- 400 未知 task；422 payload 不合法 —— 不重试，直接走前端 mock
- 503 LLM 不可达 / 认证失败 —— 不重试，直接走前端 mock
- 502 LLM 返回内容无法解析 —— 可重试
"""
from __future__ import annotations

import json
import re
from typing import Any, Awaitable, Callable, Literal

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, ValidationError

from backend.services.llm_service import ChatTurn, complete

router = APIRouter()


class GatewayRequest(BaseModel):
    task: str = Field(..., min_length=1, max_length=64)
    payload: dict[str, Any] = Field(default_factory=dict)


class GatewayResponse(BaseModel):
    data: Any


# --------------------------------------------------------------------------- payloads


class WallbreakerPayload(BaseModel):
    directive: str = Field(..., min_length=1, max_length=500)


class EncodePayload(BaseModel):
    secret: str = Field(..., min_length=1, max_length=500)


class DecodePayload(BaseModel):
    original: str = Field(..., min_length=1, max_length=2000)
    guess: str = Field(..., min_length=1, max_length=2000)


class InjectPayload(BaseModel):
    source: str = Field(..., min_length=1, max_length=1000)
    theme: str = Field(..., min_length=1, max_length=100)


class WallbreakerAnalysis(BaseModel):
    inferred: Literal["ESCAPISM", "MUTUAL_DESTRUCTION", "DISGUISE"]
    delta: int = Field(..., ge=0, le=30)
    verdict: Literal["APPROVED", "REJECTED"]
    reason: str = Field(..., min_length=1, max_length=120)


# --------------------------------------------------------------------------- helpers


class LLMOutputError(ValueError):
    """模型输出无法解析为契约要求的结构."""


def strip_code_fence(text: str) -> str:
    text = text.strip()
    m = re.match(r"^```[a-zA-Z]*\s*\n?(.*?)\n?```$", text, re.S)
    return m.group(1).strip() if m else text


def extract_json_object(text: str) -> dict[str, Any]:
    """从模型输出中取出第一个 JSON 对象（容忍代码块包裹与前后说明文字）."""
    text = strip_code_fence(text)
    try:
        obj = json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", text, re.S)
        if not m:
            raise LLMOutputError("模型输出中没有 JSON 对象")
        try:
            obj = json.loads(m.group(0))
        except json.JSONDecodeError as e:
            raise LLMOutputError(f"JSON 解析失败: {e}") from e
    if not isinstance(obj, dict):
        raise LLMOutputError("模型输出不是 JSON 对象")
    return obj


def _messages(system: str, user: str) -> list[ChatTurn]:
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


# --------------------------------------------------------------------------- tasks

WALLBREAKER_SYSTEM = (
    "你是《三体》中的破壁人，任务是识破面壁者的真实战略。"
    "面壁者会下达看似无关的资源调度指令。你需要从指令推断其隐藏战略，归为以下之一："
    "ESCAPISM（逃亡主义：远航、冬眠、移民）、MUTUAL_DESTRUCTION（同归于尽威慑：引爆、广播坐标、毁灭性武器）、"
    "DISGUISE（伪装：表面温和、意图被遮蔽）。"
    "同时给出疑心增量 delta（0-30 的整数，越可疑越高）；若指令调动资源过大（如全球、半数以上）或暴露战略，"
    "verdict 为 REJECTED，否则为 APPROVED。reason 用一句冷峻的中文说明（不超过 40 字）。"
    '只输出一个 JSON 对象：{"inferred": "...", "delta": 0, "verdict": "...", "reason": "..."}'
)


async def task_wallbreaker_analyze(payload: dict[str, Any]) -> dict[str, Any]:
    p = WallbreakerPayload.model_validate(payload)
    raw = await complete(_messages(WALLBREAKER_SYSTEM, f"面壁者指令：{p.directive}"), temperature=0.4)
    obj = extract_json_object(raw)
    try:
        delta = int(round(float(obj.get("delta", 0))))
        obj["delta"] = max(0, min(30, delta))
        obj["reason"] = str(obj.get("reason", "")).strip()[:120]
        return WallbreakerAnalysis.model_validate(obj).model_dump()
    except (ValidationError, TypeError, ValueError) as e:
        raise LLMOutputError(f"破壁分析结构不符合契约: {e}") from e


ENCODE_SYSTEM = (
    "你是《三体》中的云天明。你要把一段机密信息藏进一则童话，只有懂得双层隐喻的人才能读懂，"
    "就像《王国的新画师》《饕餮海》《深水王子》那样。"
    "要求：第一行是用书名号包裹的标题；正文 150 到 300 字；用意象与双关代替原文的关键词，绝不直接出现原文词语。"
    "只输出童话本身，不要解释。"
)


async def task_encode(payload: dict[str, Any]) -> str:
    p = EncodePayload.model_validate(payload)
    text = strip_code_fence(await complete(_messages(ENCODE_SYSTEM, f"机密信息：{p.secret}"), temperature=0.9))
    if not text:
        raise LLMOutputError("模型返回空童话")
    return text


DECODE_SYSTEM = (
    "你是情报解密评估员。比较「机密原文」与「解读」的语义一致程度，"
    "关注关键对象、动作、时间与条件是否被正确还原，不看字面重合。"
    '给出 0 到 100 的整数分数，只输出 JSON：{"score": 0}'
)


async def task_decode(payload: dict[str, Any]) -> int:
    p = DecodePayload.model_validate(payload)
    raw = await complete(
        _messages(DECODE_SYSTEM, f"机密原文：{p.original}\n解读：{p.guess}"),
        temperature=0.0,
    )
    try:
        score = extract_json_object(raw).get("score")
    except LLMOutputError:
        m = re.search(r"\d{1,3}", raw)
        score = m.group(0) if m else None
    try:
        return max(0, min(100, int(round(float(score)))))
    except (TypeError, ValueError) as e:
        raise LLMOutputError(f"解密评分无法解析: {raw[:80]!r}") from e


INJECT_SYSTEM = (
    "你是《三体》思想钢印的操作者。把给定的「钢印主题」以潜移默化的方式植入「原文」："
    "保留原文的全部事实与语序，只在句间加入暗示、感官细节或旁白，让读者不自觉地接受该主题；"
    "不要直接下结论，长度不超过原文的两倍。只输出改写后的文本。"
)


async def task_inject(payload: dict[str, Any]) -> str:
    p = InjectPayload.model_validate(payload)
    text = strip_code_fence(
        await complete(_messages(INJECT_SYSTEM, f"钢印主题：{p.theme}\n原文：{p.source}"), temperature=0.7)
    )
    if not text:
        raise LLMOutputError("模型返回空文本")
    return text


TASKS: dict[str, Callable[[dict[str, Any]], Awaitable[Any]]] = {
    "wallbreaker.analyze": task_wallbreaker_analyze,
    "yun-tianming.encode": task_encode,
    "yun-tianming.decode": task_decode,
    "mental-seal.inject": task_inject,
}


@router.get("/tasks")
async def list_tasks() -> dict[str, list[str]]:
    """列出网关支持的 task."""
    return {"tasks": sorted(TASKS)}


@router.post("/gateway", response_model=GatewayResponse)
async def gateway(req: GatewayRequest) -> GatewayResponse:
    handler = TASKS.get(req.task)
    if handler is None:
        raise HTTPException(status_code=400, detail=f"未知 task: {req.task}（可用: {', '.join(sorted(TASKS))}）")
    try:
        return GatewayResponse(data=await handler(req.payload))
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=json.loads(e.json(include_url=False))) from e
    except LLMOutputError as e:
        raise HTTPException(status_code=502, detail=f"智子解析失败：{e}") from e
    except httpx.HTTPStatusError as e:
        code = e.response.status_code
        raise HTTPException(status_code=503, detail=f"LLM 返回 {code}") from e
    except httpx.HTTPError as e:
        raise HTTPException(status_code=503, detail=f"LLM 不可达：{type(e).__name__}") from e
