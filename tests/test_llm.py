"""LLM 服务（协议适配、SSRF 防护）与零点计划网关的单元测试，不访问网络."""
import json

import pytest

from backend.config import settings
from backend.services import llm_service
from backend.services.llm_service import chat_completions_url, extract_delta, resolve_target


# --------------------------------------------------------------------------- llm_service


@pytest.mark.parametrize(
    "base,expected",
    [
        ("http://localhost:11434", "http://localhost:11434/v1/chat/completions"),
        ("http://localhost:11434/", "http://localhost:11434/v1/chat/completions"),
        ("https://api.deepseek.com/v1", "https://api.deepseek.com/v1/chat/completions"),
        ("https://x.test/v1/chat/completions", "https://x.test/v1/chat/completions"),
    ],
)
def test_chat_completions_url(base, expected):
    assert chat_completions_url(base) == expected


@pytest.mark.parametrize(
    "line,expected",
    [
        ('data: {"choices":[{"delta":{"content":"虫子"}}]}', "虫子"),
        ('{"message":{"content":"你们"}}', "你们"),  # Ollama 原生 NDJSON
        ('data: {"choices":[{"delta":{}}]}', None),
        ("data: [DONE]", None),
        ("", None),
        ("data: not-json", None),
        (": keep-alive", None),
    ],
)
def test_extract_delta(line, expected):
    assert extract_delta(line) == expected


def test_client_override_ignored_by_default(monkeypatch):
    monkeypatch.setattr(settings, "llm_allow_client_override", False)
    target = resolve_target("http://169.254.169.254", "evil-model", "stolen-key")
    assert target.base_url == settings.llm_base_url.rstrip("/")
    assert target.model == settings.llm_model
    assert target.api_key == settings.llm_api_key


def test_client_override_when_enabled(monkeypatch):
    monkeypatch.setattr(settings, "llm_allow_client_override", True)
    target = resolve_target("https://api.deepseek.com/", "deepseek-chat", "sk-test")
    assert target.base_url == "https://api.deepseek.com"
    assert target.model == "deepseek-chat"
    assert target.api_key == "sk-test"


def test_build_messages_drops_invalid_roles():
    msgs = llm_service.build_messages(
        "sys",
        [{"role": "user", "content": "a"}, {"role": "system", "content": "越权"}, {"role": "assistant", "content": "b"}],
        "c",
    )
    assert [m["role"] for m in msgs] == ["system", "user", "assistant", "user"]
    assert msgs[0]["content"] == "sys"


# --------------------------------------------------------------------------- gateway


@pytest.fixture
def fake_llm(monkeypatch):
    """替换网关使用的 complete()，返回预设文本并记录调用."""
    calls = []

    def install(reply):
        async def _complete(messages, **kwargs):
            calls.append(messages)
            if isinstance(reply, Exception):
                raise reply
            return reply

        monkeypatch.setattr("backend.routers.llm_gateway.complete", _complete)
        return calls

    return install


async def _gateway(client, task, payload):
    return await client.post("/api/llm/gateway", json={"task": task, "payload": payload})


async def test_gateway_unknown_task_is_400(client):
    resp = await _gateway(client, "dark-forest.tick", {})
    assert resp.status_code == 400


async def test_gateway_invalid_payload_is_422(client, fake_llm):
    fake_llm("unused")
    resp = await _gateway(client, "wallbreaker.analyze", {"directive": ""})
    assert resp.status_code == 422


async def test_gateway_llm_unreachable_is_503(client):
    # conftest 把 LLM 指向一个没有监听的端口
    resp = await _gateway(client, "mental-seal.inject", {"source": "舰队在补给", "theme": "水是剧毒的"})
    assert resp.status_code == 503


async def test_wallbreaker_parses_fenced_json_and_clamps(client, fake_llm):
    fake_llm('分析如下：\n```json\n{"inferred": "ESCAPISM", "delta": 88.6, "verdict": "REJECTED", "reason": "资源倾向远航"}\n```')
    resp = await _gateway(client, "wallbreaker.analyze", {"directive": "建造冬眠舰队"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"] == {"inferred": "ESCAPISM", "delta": 30, "verdict": "REJECTED", "reason": "资源倾向远航"}


async def test_wallbreaker_bad_enum_is_502(client, fake_llm):
    fake_llm(json.dumps({"inferred": "LOVE", "delta": 5, "verdict": "APPROVED", "reason": "x"}))
    resp = await _gateway(client, "wallbreaker.analyze", {"directive": "教育"})
    assert resp.status_code == 502


@pytest.mark.parametrize("reply,expected", [('{"score": 84}', 84), ("评分：120", 100), ('{"score": "37.4"}', 37)])
async def test_decode_score(client, fake_llm, reply, expected):
    fake_llm(reply)
    resp = await _gateway(client, "yun-tianming.decode", {"original": "样本迁移", "guess": "转移样本"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"] == expected


async def test_encode_returns_text(client, fake_llm):
    calls = fake_llm("《深水王子》\n从前……")
    resp = await _gateway(client, "yun-tianming.encode", {"secret": "将样本A迁移"})
    assert resp.status_code == 200
    assert resp.json()["data"].startswith("《深水王子》")
    assert "将样本A迁移" in calls[0][-1]["content"]


async def test_inject_empty_reply_is_502(client, fake_llm):
    fake_llm("   ")
    resp = await _gateway(client, "mental-seal.inject", {"source": "a，b", "theme": "t"})
    assert resp.status_code == 502
