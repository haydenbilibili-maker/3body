"""RAG 降级逻辑、语料文件检查与 RTF 转换脚本的测试（不需要 RAG 依赖）."""
import importlib.util
from pathlib import Path

import pytest

from backend.services import rag_service
from backend.services.rag_service import SYSTEM_CORE_NO_RAG, SophonBrain, find_corpus_files

ROOT = Path(__file__).resolve().parent.parent


def _load_rtf_module():
    spec = importlib.util.spec_from_file_location("rtf_to_text", ROOT / "scripts" / "rtf_to_text.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _u(*codes: int) -> str:
    """生成 RTF 的 Unicode 转义序列（拼接写法：源码里不出现字面的反斜杠加 u 加数字）."""
    return "".join("\\" + "u" + str(c) + " " for c in codes)


def test_rtf_to_text_decodes_cocoa_rtf():
    bs = "\\"
    rtf = (
        bs + "rtf1" + bs + "ansi" + bs + "ansicpg936" + bs + "cocoartf2868\n"
        "{" + bs + "fonttbl" + bs + "f0" + bs + "fmodern Courier;}\n"
        "{" + bs + "colortbl;" + bs + "red255" + bs + "green255;}\n"
        + bs + "pard" + bs + "pardeftab720\n"
        + bs + "uc0" + _u(19977, 20307) + bs + "'85" + bs + "\n"
        + bs + "uc0" + _u(12288) + bs + "'93" + _u(24819, 35937) + bs + "'94" + bs + "par\n"
    )
    text = _load_rtf_module().rtf_to_text("{" + rtf + "}")
    assert text == "三体…\n\u3000“想象”\n"


def test_rtf_to_text_passthrough_for_plain_text():
    assert _load_rtf_module().rtf_to_text("已经是纯文本") == "已经是纯文本"


def test_repository_corpus_is_plain_utf8():
    """data/ 下的原著必须是 UTF-8 纯文本，RTF 会让向量库里存满转义码."""
    files = find_corpus_files(ROOT / "data")
    assert files, "data/ 下没有可入库的 .txt"
    for fp in files:
        head = fp.read_text(encoding="utf-8")[:2000]
        assert "\\u" not in head and not head.lstrip().startswith("{\\rtf"), fp


def test_find_corpus_files_skips_rtf(tmp_path):
    (tmp_path / "good.txt").write_text("三体", encoding="utf-8")
    (tmp_path / "bad.txt").write_text(r"{\rtf1\ansi x}", encoding="utf-8")
    assert [p.name for p in find_corpus_files(tmp_path)] == ["good.txt"]


def test_system_prompt_with_and_without_context():
    assert SophonBrain.get_system_prompt([]) == SYSTEM_CORE_NO_RAG
    prompt = SophonBrain.get_system_prompt(["片段一", "片段二"])
    assert "片段一" in prompt and "片段二" in prompt


def test_half_written_index_is_not_ingested(tmp_path):
    """只有 HNSW 段文件、没有 chroma.sqlite3 的目录（旧仓库里提交的那种）不算已入库."""
    (tmp_path / "segment").mkdir()
    (tmp_path / "segment" / "data_level0.bin").write_bytes(b"\0")
    assert not SophonBrain(chroma_dir=tmp_path).is_ingested()


async def test_retrieve_context_degrades_without_dependencies(monkeypatch):
    monkeypatch.setattr(rag_service, "_rag_disabled_reason", None)
    monkeypatch.setattr(rag_service, "rag_dependencies_installed", lambda: False)
    assert await rag_service.retrieve_context("水滴是什么") == []
    assert "依赖未安装" in rag_service._rag_disabled_reason
    prompt = await rag_service.build_sophon_system_prompt("水滴是什么")
    assert prompt == SYSTEM_CORE_NO_RAG


async def test_retrieve_context_disables_after_failure(monkeypatch):
    calls = []

    class Boom(SophonBrain):
        def search(self, query, k=3):
            calls.append(query)
            raise FileNotFoundError("no data")

    monkeypatch.setattr(rag_service, "_rag_disabled_reason", None)
    monkeypatch.setattr(rag_service, "rag_dependencies_installed", lambda: True)
    monkeypatch.setattr(rag_service, "_brain", Boom())
    assert await rag_service.retrieve_context("q1") == []
    assert await rag_service.retrieve_context("q2") == []
    assert calls == ["q1"], "失败一次后不应再反复尝试入库"


@pytest.mark.skipif(
    importlib.util.find_spec("chromadb") is None or importlib.util.find_spec("sentence_transformers") is None,
    reason="未安装 RAG 依赖",
)
def test_rag_dependencies_detected():
    assert rag_service.rag_dependencies_installed()
