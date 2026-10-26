"""人物志对话室：场景人设提示词."""
from backend.routers.chat import FigureScene, figure_system_prompt


def _scene(**kw):
    base = dict(
        title="杨冬墓前",
        era="公元末",
        setting="黄昏，墓园里只有风声。",
        knows="三体危机刚刚公开。",
        mood="漫不经心",
        secret="他隐约看见了黑暗森林。",
    )
    base.update(kw)
    return FigureScene(**base)


def test_prompt_places_figure_in_the_moment():
    p = figure_system_prompt("罗辑", "面壁者", None, _scene())
    assert "杨冬墓前" in p and "公元末" in p
    assert "绝不剧透未来" in p


def test_secret_is_withheld_until_guard_opens():
    closed = figure_system_prompt("罗辑", None, None, _scene())
    opened = figure_system_prompt("罗辑", None, None, _scene(reveal=True))
    assert "不要直接说出它" in closed
    assert "赢得了你的信任" in opened and "不要直接说出它" not in opened


def test_visitor_and_passages_are_optional():
    p = figure_system_prompt("罗辑", None, None, _scene(visitor="在执剑人大厅守住了威慑"), ["罗辑走进墓园。"])
    assert "守住了威慑" in p and "罗辑走进墓园" in p
    assert "此刻的场景" not in figure_system_prompt("罗辑", None, None)


def test_free_conversation_looks_back_on_a_whole_life():
    p = figure_system_prompt("罗辑", "面壁者", None)
    assert "自由对话" in p
    assert "此刻的场景" not in p
