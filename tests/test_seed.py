"""scripts/seed_db.py：默认只填充空表，重复运行不重复导入、不覆盖用户数据."""
import importlib.util
from pathlib import Path

from sqlalchemy import func, select

ROOT = Path(__file__).resolve().parent.parent


def _load_seed_module():
    spec = importlib.util.spec_from_file_location("seed_db", ROOT / "scripts" / "seed_db.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


async def _count(model) -> int:
    from backend.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        return (await db.execute(select(func.count()).select_from(model))).scalar_one()


async def test_seed_is_idempotent_and_keeps_user_data(client):
    from backend.models.chronicle import ChronicleEventORM
    from backend.models.figures import FigureORM

    seed_db = _load_seed_module()
    await seed_db.seed()
    events, figures = await _count(ChronicleEventORM), await _count(FigureORM)
    assert events > 0 and figures > 50

    # 用户录入一条事件后再次运行：不重复导入，也不清空用户数据
    resp = await client.post(
        "/api/chronicle/events",
        json={"era": "危机纪元", "year": 7, "title": "用户事件", "content": "测试", "event_type": "ugc"},
    )
    assert resp.status_code == 200
    await seed_db.seed()
    assert await _count(ChronicleEventORM) == events + 1
    assert await _count(FigureORM) == figures
