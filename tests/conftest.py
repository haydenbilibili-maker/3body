"""
测试夹具：隔离的临时 SQLite、不可达的 LLM 地址、无 RAG 依赖。

环境变量必须在导入 backend 之前设置（settings 在导入时读取）。
"""
import os
import shutil
import sys
import tempfile

import pytest
from httpx import ASGITransport, AsyncClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

_TMP = tempfile.mkdtemp(prefix="3body-test-")
os.environ["3BODY_DATABASE_URL"] = f"sqlite+aiosqlite:///{_TMP}/test.db"
os.environ["3BODY_CHROMA_PERSIST_DIR"] = os.path.join(_TMP, "chroma")
# 端口 9 (discard) 在 CI 上没有监听：连接会立即被拒绝，用于验证「LLM 不可达」分支
os.environ["3BODY_LLM_BASE_URL"] = "http://127.0.0.1:9"
os.environ["3BODY_LLM_TIMEOUT"] = "3"
os.environ["3BODY_LLM_ALLOW_CLIENT_OVERRIDE"] = "false"
os.environ["3BODY_SILICONFLOW_API_KEY"] = ""


def pytest_sessionfinish(session, exitstatus):
    shutil.rmtree(_TMP, ignore_errors=True)


@pytest.fixture
def app():
    from backend.main import app as _app

    return _app


@pytest.fixture
async def client(app):
    """
    ASGITransport 不会触发 lifespan，这里手动建表；
    每个测试结束后释放连接池，避免 aiosqlite 连接跨事件循环复用。
    """
    from backend.cache import _CACHE
    from backend.database import engine, init_db

    _CACHE.clear()
    await init_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", timeout=30) as ac:
        yield ac
    await engine.dispose()
