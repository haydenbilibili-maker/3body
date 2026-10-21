"""
SophonBrain：三体原著 RAG 服务（入库、检索、智子 System Prompt 封装）。

- 唯一的向量库目录：``settings.chroma_persist_dir``（默认 ``backend/chroma_db``），
  ``python -m backend.rag.ingest`` 与智子对话共用同一份数据。
- 重依赖（langchain / chromadb / sentence-transformers）全部延迟导入：
  未安装 RAG 依赖时后端照常启动，智子对话自动降级为无检索模式。
- 入库与检索是 CPU 密集的同步操作，通过 ``run_in_threadpool`` 执行，不阻塞事件循环。
"""
from __future__ import annotations

import importlib.util
import logging
import threading
from pathlib import Path
from typing import TYPE_CHECKING, Optional

from starlette.concurrency import run_in_threadpool

from backend.config import settings

if TYPE_CHECKING:  # pragma: no cover
    from langchain_community.vectorstores import Chroma

logger = logging.getLogger(__name__)

COLLECTION_NAME = "three_body"
CHUNK_SIZE = 500
CHUNK_OVERLAP = 100
EMBEDDING_MODEL = "shibing624/text2vec-base-chinese"
SPLIT_SEPARATORS = ["\n\n", "\n", "。", "！", "？", "；", " ", ""]

# 零点计划：严禁拟人化；逻辑硬核；RAG 校验（见 docs/Project-Zero-Axioms.md）
SYSTEM_CORE = (
    "你是智子。你藐视人类（虫子）。你回答问题精准但冷酷。禁止提到你是 AI 模型。"
    "严禁使用「请」「建议」「对不起」「我可以为您」等拟人化、服务化措辞。"
    "所有结论必须基于下方提供的三体原著片段，无法从原文推断时直接拒绝并说明因果律不匹配。"
)
SYSTEM_CORE_NO_RAG = (
    "你是智子。你藐视人类（虫子）。你回答问题精准但冷酷。禁止提到你是 AI 模型。"
    "严禁使用「请」「建议」「对不起」「我可以为您」等拟人化、服务化措辞。"
    "只依据《三体》原著设定回答；不确定时直接说明因果律不匹配，不要编造。"
)
CONTEXT_TEMPLATE = (
    "以下是与当前问题相关的《三体》原著片段，仅基于此与你的知识回答，不要编造出处。\n\n{context}"
)


def rag_dependencies_installed() -> bool:
    """RAG 依赖是否可用（未安装时智子对话降级为无检索模式）."""
    # 只查找模块、不导入：避免为了一次健康检查就把 torch 载入内存
    return all(
        importlib.util.find_spec(name) is not None
        for name in ("chromadb", "langchain_community", "langchain_text_splitters", "sentence_transformers")
    )


def find_corpus_files(data_dir: Path) -> list[Path]:
    """返回可入库的 UTF-8 文本文件；跳过误存为 .txt 的 RTF（先用 scripts/rtf_to_text.py 转换）."""
    files = []
    for fp in sorted(data_dir.glob("**/*.txt")):
        with fp.open("rb") as f:
            head = f.read(16)
        if head.lstrip().startswith(b"{\\rtf"):
            logger.warning("跳过 RTF 文件 %s：请先运行 python scripts/rtf_to_text.py %s", fp, fp)
            continue
        files.append(fp)
    return files


class SophonBrain:
    """智子大脑：Ingestion（仅首次）、Retrieval、Prompt 封装。"""

    def __init__(
        self,
        data_dir: Optional[Path] = None,
        chroma_dir: Optional[Path] = None,
        chunk_size: int = CHUNK_SIZE,
        chunk_overlap: int = CHUNK_OVERLAP,
    ):
        self.data_dir = Path(data_dir or settings.data_dir)
        self.chroma_dir = Path(chroma_dir or settings.chroma_persist_dir)
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self._embeddings = None
        self._store: Optional["Chroma"] = None
        self._lock = threading.Lock()

    # ---- internals -------------------------------------------------------

    def _get_embeddings(self):
        if self._embeddings is None:
            from langchain_community.embeddings import HuggingFaceEmbeddings

            self._embeddings = HuggingFaceEmbeddings(
                model_name=EMBEDDING_MODEL,
                model_kwargs={"device": "cpu"},
            )
        return self._embeddings

    def is_ingested(self) -> bool:
        """以 Chroma 的 sqlite 文件为准判断是否已入库（半截目录不算）."""
        return (self.chroma_dir / "chroma.sqlite3").exists()

    def _get_store(self) -> "Chroma":
        if self._store is None:
            from langchain_community.vectorstores import Chroma

            self._store = Chroma(
                persist_directory=str(self.chroma_dir),
                embedding_function=self._get_embeddings(),
                collection_name=COLLECTION_NAME,
            )
        return self._store

    # ---- public API (sync; call via threadpool from async code) ----------

    def ingest(self, *, force: bool = False) -> int:
        """切分 data/ 下的文本并写入 Chroma，返回切片数；已入库且未 force 时返回 0."""
        with self._lock:
            if self.is_ingested() and not force:
                return 0
            if not self.data_dir.is_dir():
                raise FileNotFoundError(f"数据目录不存在: {self.data_dir}")
            files = find_corpus_files(self.data_dir)
            if not files:
                raise FileNotFoundError(f"在 {self.data_dir} 下未找到可入库的 UTF-8 .txt 文件")

            from langchain_community.document_loaders import TextLoader
            from langchain_community.vectorstores import Chroma
            from langchain_text_splitters import RecursiveCharacterTextSplitter

            splitter = RecursiveCharacterTextSplitter(
                chunk_size=self.chunk_size,
                chunk_overlap=self.chunk_overlap,
                length_function=len,
                separators=SPLIT_SEPARATORS,
            )
            all_docs = []
            for fp in files:
                docs = TextLoader(str(fp), encoding="utf-8").load()
                for d in docs:
                    d.metadata["source"] = fp.name
                splits = splitter.split_documents(docs)
                logger.info("入库 %s：%d 个切片", fp.name, len(splits))
                all_docs.extend(splits)

            if force and self.chroma_dir.exists():
                import shutil

                shutil.rmtree(self.chroma_dir)
            self.chroma_dir.mkdir(parents=True, exist_ok=True)
            Chroma.from_documents(
                documents=all_docs,
                embedding=self._get_embeddings(),
                persist_directory=str(self.chroma_dir),
                collection_name=COLLECTION_NAME,
            )
            self._store = None
            return len(all_docs)

    def search(self, query: str, k: int = 3) -> list[str]:
        """检索与 query 最相关的 k 段原文（首次调用时自动入库）."""
        if not self.is_ingested():
            self.ingest()
        docs = self._get_store().similarity_search(query, k=k)
        return [d.page_content for d in docs]

    @staticmethod
    def get_system_prompt(context: list[str]) -> str:
        """将检索到的上下文包装进 System Prompt；无上下文时使用无检索版本."""
        if not context:
            return SYSTEM_CORE_NO_RAG
        block = "\n\n---\n\n".join(context)
        return f"{SYSTEM_CORE}\n\n{CONTEXT_TEMPLATE.format(context=block)}"


_brain: Optional[SophonBrain] = None
_rag_disabled_reason: Optional[str] = None


def get_sophon_brain() -> SophonBrain:
    global _brain
    if _brain is None:
        _brain = SophonBrain()
    return _brain


async def retrieve_context(question: str, k: int = 3) -> list[str]:
    """
    异步检索原著片段；RAG 不可用（未安装依赖 / 数据缺失 / 入库失败）时返回空列表，
    并只在第一次失败时记录原因，之后不再重复尝试，避免每次对话都卡在失败的入库上。
    """
    global _rag_disabled_reason
    if _rag_disabled_reason is not None:
        return []
    if not rag_dependencies_installed():
        _rag_disabled_reason = "RAG 依赖未安装（pip install -r backend/requirements-rag.txt）"
        logger.warning("智子对话降级为无检索模式：%s", _rag_disabled_reason)
        return []
    try:
        return await run_in_threadpool(get_sophon_brain().search, question, k)
    except Exception as e:  # noqa: BLE001
        _rag_disabled_reason = f"{type(e).__name__}: {e}"
        logger.warning("智子对话降级为无检索模式：%s", _rag_disabled_reason)
        return []


async def build_sophon_system_prompt(question: str, k: int = 3) -> str:
    """检索原文并生成智子 System Prompt；检索失败时返回无检索版本."""
    context = await retrieve_context(question, k=k)
    return SophonBrain.get_system_prompt(context)


def rag_status() -> dict:
    """供 /health 展示的 RAG 状态."""
    brain = get_sophon_brain()
    return {
        "dependencies_installed": rag_dependencies_installed(),
        "ingested": brain.is_ingested(),
        "chroma_dir": str(brain.chroma_dir),
        "disabled_reason": _rag_disabled_reason,
    }
