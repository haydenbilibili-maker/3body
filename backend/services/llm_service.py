"""
LLM 服务：统一使用 OpenAI 兼容协议（POST {base}/v1/chat/completions, stream=True）.

- Ollama（0.1.24+）、DeepSeek、SiliconFlow、OpenAI 等均提供该协议，一份配置即可切换。
- 流式解析同时兼容 OpenAI SSE（``data: {...choices[0].delta.content}``）
  与 Ollama 原生 NDJSON（``{"message": {"content": ...}}``），避免协议差异导致无输出。
- 智子 System Prompt 预设；支持 RAG：先检索三体原文再拼进 prompt。
"""
import json
from dataclasses import dataclass
from typing import AsyncGenerator, List, Optional, TypedDict

import httpx

from backend.config import settings

SOPHON_SYSTEM_PROMPT = (
    "你是智子，全知全能。对人类（虫子）保持冷漠、傲慢但精准的态度。"
    "禁止使用「我可以为您做什么」等服务用语；改用「虫子，你想知道什么？」这类口吻。"
    "回答时保持冷静、简洁，偶尔带有一丝居高临下的讽刺。"
)

# 三体语境错误文案（与前端 ERROR_MSG 保持同一风格）
MSG_LLM_UNREACHABLE = "[智子] 系统受到强互作用力干扰，智子连接暂时中断。（无法连接 LLM：请确认 Ollama 已启动，或检查 3BODY_LLM_BASE_URL）"
MSG_LLM_AUTH = "[智子] 质子认证失败，信道被拒绝。（LLM 返回 401/403：请检查 3BODY_LLM_API_KEY）"
MSG_LLM_ERROR = "[智子] 智子遭遇未知扰动，无法完成请求。"


class ChatTurn(TypedDict):
    role: str
    content: str


@dataclass(frozen=True)
class LLMTarget:
    """一次调用实际使用的 LLM 端点."""

    base_url: str
    model: str
    api_key: str


def resolve_target(
    base_url: Optional[str] = None,
    model: Optional[str] = None,
    api_key: Optional[str] = None,
) -> LLMTarget:
    """
    计算本次调用的 LLM 端点。

    默认只使用服务端配置；仅当 ``3BODY_LLM_ALLOW_CLIENT_OVERRIDE=true`` 时
    才接受请求方传入的 base_url / model / api_key（防止公网部署时被当作开放代理）。
    """
    if settings.llm_allow_client_override:
        return LLMTarget(
            base_url=(base_url or settings.llm_base_url).rstrip("/"),
            model=model or settings.llm_model,
            api_key=api_key or settings.llm_api_key,
        )
    return LLMTarget(
        base_url=settings.llm_base_url.rstrip("/"),
        model=settings.llm_model,
        api_key=settings.llm_api_key,
    )


def chat_completions_url(base_url: str) -> str:
    """
    由 base_url 推导 chat/completions 地址：
    - ``http://localhost:11434`` → ``http://localhost:11434/v1/chat/completions``
    - ``https://api.deepseek.com/v1`` → ``https://api.deepseek.com/v1/chat/completions``
    - 已是完整地址则原样返回
    """
    base = base_url.rstrip("/")
    if base.endswith("/chat/completions"):
        return base
    if base.endswith("/v1"):
        return f"{base}/chat/completions"
    return f"{base}/v1/chat/completions"


def extract_delta(line: str) -> Optional[str]:
    """
    从一行流式响应中提取增量文本；返回 None 表示该行无内容，返回 "" 不会出现。
    支持 OpenAI SSE 与 Ollama NDJSON 两种格式；遇到 ``[DONE]`` 返回特殊值由调用方判断。
    """
    raw = line.strip()
    if not raw:
        return None
    if raw.startswith("data:"):
        raw = raw[5:].strip()
    if not raw or raw == "[DONE]":
        return None
    try:
        obj = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if not isinstance(obj, dict):
        return None
    # OpenAI 兼容
    choices = obj.get("choices")
    if isinstance(choices, list) and choices:
        first = choices[0] or {}
        delta = first.get("delta") or first.get("message") or {}
        content = delta.get("content") if isinstance(delta, dict) else None
        return content or None
    # Ollama 原生 /api/chat
    message = obj.get("message")
    if isinstance(message, dict):
        return message.get("content") or None
    return None


def build_messages(system_prompt: str, history: List[ChatTurn], new_user_message: str) -> List[ChatTurn]:
    """构建 messages：system + 历史( user/assistant ) + 当前 user."""
    out: List[ChatTurn] = [{"role": "system", "content": system_prompt}]
    for m in history:
        role = m.get("role")
        content = m.get("content") or ""
        if role in ("user", "assistant") and content:
            out.append({"role": role, "content": content})
    out.append({"role": "user", "content": new_user_message})
    return out


def _headers(target: LLMTarget) -> dict[str, str]:
    headers = {"Content-Type": "application/json"}
    if target.api_key:
        headers["Authorization"] = f"Bearer {target.api_key}"
    return headers


async def stream_messages(
    messages: List[ChatTurn],
    target: Optional[LLMTarget] = None,
) -> AsyncGenerator[str, None]:
    """对给定 messages 发起流式补全，逐段 yield 文本；出错时 yield 一条三体语境错误文案."""
    target = target or resolve_target()
    payload = {"model": target.model, "stream": True, "messages": messages}
    url = chat_completions_url(target.base_url)
    try:
        async with httpx.AsyncClient(timeout=settings.llm_timeout) as client:
            async with client.stream("POST", url, json=payload, headers=_headers(target)) as response:
                if response.status_code in (401, 403):
                    yield MSG_LLM_AUTH
                    return
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line.strip() in ("data: [DONE]", "[DONE]"):
                        break
                    delta = extract_delta(line)
                    if delta:
                        yield delta
    except (httpx.ConnectError, httpx.ConnectTimeout):
        yield MSG_LLM_UNREACHABLE
    except httpx.HTTPStatusError as e:
        yield f"{MSG_LLM_ERROR}（LLM 返回 {e.response.status_code}）"
    except Exception as e:  # noqa: BLE001 — 流式接口不能抛出，否则前端连接被直接切断
        yield f"{MSG_LLM_ERROR}（{type(e).__name__}）"


async def complete(
    messages: List[ChatTurn],
    *,
    target: Optional[LLMTarget] = None,
    json_mode: bool = False,
    temperature: float = 0.7,
) -> str:
    """
    非流式补全，返回完整文本；供 LLM 网关等需要结构化输出的场景使用。
    失败时抛出 httpx 异常，由调用方转换为 HTTP 状态码。
    """
    target = target or resolve_target()
    payload: dict = {
        "model": target.model,
        "stream": False,
        "messages": messages,
        "temperature": temperature,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}
    async with httpx.AsyncClient(timeout=settings.llm_timeout) as client:
        resp = await client.post(chat_completions_url(target.base_url), json=payload, headers=_headers(target))
        resp.raise_for_status()
        data = resp.json()
    choices = data.get("choices") or []
    if choices:
        return (choices[0].get("message") or {}).get("content") or ""
    return (data.get("message") or {}).get("content") or ""


async def stream_chat(
    user_message: str,
    system_prompt: Optional[str] = None,
    *,
    base_url: Optional[str] = None,
    model: Optional[str] = None,
    api_key: Optional[str] = None,
) -> AsyncGenerator[str, None]:
    """单轮流式对话：可传入自定义 system_prompt."""
    messages = build_messages(system_prompt or SOPHON_SYSTEM_PROMPT, [], user_message)
    async for chunk in stream_messages(messages, resolve_target(base_url, model, api_key)):
        yield chunk


async def stream_chat_messages(
    system_prompt: str,
    history: List[ChatTurn],
    new_user_message: str,
    *,
    base_url: Optional[str] = None,
    model: Optional[str] = None,
    api_key: Optional[str] = None,
) -> AsyncGenerator[str, None]:
    """多轮流式对话：历史项格式为 {"role": "user"|"assistant", "content": "..."}."""
    messages = build_messages(system_prompt, history, new_user_message)
    async for chunk in stream_messages(messages, resolve_target(base_url, model, api_key)):
        yield chunk
