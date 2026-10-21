"""
全部 API 的冒烟测试：空库 + 无 LLM + 无 RAG 依赖下，每个接口都不应 500。

目的不是校验业务细节，而是保证「克隆下来、装完核心依赖就能跑」——
任何接口在这种最小环境里崩溃都会在 CI 中暴露。
"""
import json

import pytest

GET_ENDPOINTS = [
    "/",
    "/health",
    "/api/chronicle/documents",
    "/api/chronicle/wiki",
    "/api/chronicle/events",
    "/api/chronicle/eras",
    "/api/chronicle/archives",
    "/api/chronicle/encyclopedia",
    "/api/chronicle/apocrypha",
    "/api/figures/list",
    "/api/gallery/items",
    "/api/universe/metrics",
    "/api/sector-u/",
    "/api/sector-f/seal",
    "/api/sector-r/signals",
    "/api/sector-e/stars",
    "/api/llm/tasks",
]


@pytest.mark.parametrize("path", GET_ENDPOINTS)
async def test_get_endpoints_do_not_crash(client, path):
    resp = await client.get(path)
    assert resp.status_code < 500, f"{path} → {resp.status_code}: {resp.text[:300]}"


async def test_health_reports_llm_and_rag(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "healthy"
    assert body["llm"]["client_override_allowed"] is False
    assert "ingested" in body["rag"]


async def test_mental_seal_session_flow_without_llm(client):
    """面壁会话：LLM 不可达时破壁人使用兜底台词，接口不崩溃."""
    assert (await client.get("/api/sector-f/session")).status_code == 404

    resp = await client.post("/api/sector-f/start", json={"plan_title": "计划A", "plan_content": "把舰队藏进柯伊伯带"})
    assert resp.status_code == 200, resp.text
    session = resp.json()
    history = json.loads(session["history"])
    assert history and history[-1]["role"] == "breaker"
    assert "连接中断" in history[-1]["content"]

    # 再开一局：旧会话被放弃，查询当前会话仍只返回一条
    resp = await client.post("/api/sector-f/start", json={"plan_title": "计划B", "plan_content": "沉默"})
    assert resp.status_code == 200
    current = await client.get("/api/sector-f/session")
    assert current.status_code == 200
    assert current.json()["plan_title"] == "计划B"

    reply = await client.post("/api/sector-f/reply", json={"session_id": current.json()["id"], "content": "这是面壁计划的一部分"})
    assert reply.status_code == 200
    assert reply.json()["round_count"] == 1


async def test_mental_seal_imprint(client):
    assert (await client.post("/api/sector-f/imprint", json={"seal_type": "NOPE"})).status_code == 400
    resp = await client.post("/api/sector-f/imprint", json={"seal_type": "TRIUMPH"})
    assert resp.status_code == 200
    assert (await client.get("/api/sector-f/seal")).json()["seal_type"] == "TRIUMPH"
    assert (await client.delete("/api/sector-f/seal")).status_code < 500


async def test_dark_forest_star_lifecycle(client):
    resp = await client.post("/api/sector-e/ignite", json={"content": "我在这里", "x": 1.0, "y": 2.0})
    assert resp.status_code == 200, resp.text
    star_id = resp.json()["id"]
    assert (await client.post(f"/api/sector-e/nurture/{star_id}")).status_code < 500
    assert (await client.post(f"/api/sector-e/strike/{star_id}")).status_code < 500
    assert (await client.post("/api/sector-e/strike/999999")).status_code == 404


async def test_red_coast_broadcast(client):
    resp = await client.post(
        "/api/sector-r/broadcast",
        json={"source_type": "user", "frequency": 1420.0, "content_decrypted": "不要回答"},
    )
    assert resp.status_code == 200, resp.text
    signals = (await client.get("/api/sector-r/signals")).json()
    assert any(s["content_decrypted"] == "不要回答" for s in signals)


async def test_mini_universe_note_and_return(client):
    assert (await client.get("/api/sector-u/")).status_code == 200
    assert (await client.post("/api/sector-u/note", json={"note_add": "给大宇宙的一封信"})).status_code == 200
    assert (await client.post("/api/sector-u/note", json={})).status_code == 400
    assert (await client.post("/api/sector-u/return")).status_code < 500


async def test_universe_resonance(client):
    assert (await client.post("/api/universe/resonance", json={"state": "2d"})).status_code == 200
    assert (await client.post("/api/universe/resonance", json={"state": "4d"})).status_code == 400


async def test_chronicle_create_without_audit_engine(client):
    """未配置智子审计（无 SiliconFlow Key）时，编年史录入应放行而不是 500."""
    resp = await client.post(
        "/api/chronicle/events",
        json={"era": "危机纪元", "year": 3, "title": "测试事件", "content": "面壁计划启动", "event_type": "ugc"},
    )
    assert resp.status_code == 200, resp.text
    event_id = resp.json()["id"]
    assert (await client.post(f"/api/chronicle/events/{event_id}/interact")).status_code < 500
    events = (await client.get("/api/chronicle/events", params={"era": "危机纪元"})).json()
    assert any(e["id"] == event_id for e in events)
    assert "危机纪元" in (await client.get("/api/chronicle/eras")).json()


async def test_sophon_audit_unconfigured_is_503(client):
    resp = await client.post("/api/sophon/audit", json={"fragment": "人类在危机纪元发明了曲率驱动"})
    assert resp.status_code == 503


async def _read_sse(resp) -> tuple[list[str], bool]:
    chunks, done = [], False
    for event in resp.text.split("\n\n"):
        if not event.startswith("data: "):
            continue
        data = event[len("data: "):]
        if data == "[DONE]":
            done = True
            continue
        chunks.append(json.loads(data))
    return chunks, done


@pytest.mark.parametrize("path", ["/api/chat", "/api/chat/stream"])
async def test_sophon_chat_streams_error_when_llm_unreachable(client, path):
    resp = await client.post(path, json={"message": "你是谁"})
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/event-stream")
    chunks, done = await _read_sse(resp)
    assert done
    assert any("智子" in c for c in chunks)


async def test_figure_chat_streams(client):
    resp = await client.post(
        "/api/chat/figure",
        json={
            "figure_name": "罗辑",
            "message": "你为什么选择面壁？",
            "history": [{"role": "user", "content": "你好"}, {"role": "assistant", "content": "……"}],
            # 未开启 ALLOW_CLIENT_OVERRIDE：这个地址必须被忽略，不会被请求
            "base_url": "http://169.254.169.254",
        },
    )
    assert resp.status_code == 200
    chunks, done = await _read_sse(resp)
    assert done and chunks


async def test_chat_rejects_empty_message(client):
    assert (await client.post("/api/chat", json={"message": ""})).status_code == 422
