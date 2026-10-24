"""
RAG 知识注入：扫描 data/ 目录下的 UTF-8 .txt，切片后写入 ChromaDB。

    python -m backend.rag.ingest            # 未入库时入库
    python -m backend.rag.ingest --force    # 删除旧向量库并重建

与智子对话共用同一套切片参数和向量库目录（3BODY_CHROMA_PERSIST_DIR，默认 backend/chroma_db）。
首次运行会下载中文 embedding 模型（shibing624/text2vec-base-chinese），需要 RAG 依赖：
    pip install -r backend/requirements-rag.txt
"""
import argparse
import logging
import sys

from backend.services.rag_service import find_corpus_files, get_sophon_brain, rag_dependencies_installed


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="三体原著入库 ChromaDB")
    parser.add_argument("--force", action="store_true", help="删除已有向量库并重新入库")
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(message)s")

    if not rag_dependencies_installed():
        print("RAG 依赖未安装：pip install -r backend/requirements-rag.txt")
        return 1

    brain = get_sophon_brain()
    files = find_corpus_files(brain.data_dir)
    print(f"数据目录: {brain.data_dir}（{len(files)} 个文本文件）")
    print(f"向量库目录: {brain.chroma_dir}")
    if brain.is_ingested() and not args.force:
        print("已入库，跳过。如需重建请加 --force")
        return 0
    count = brain.ingest(force=args.force)
    print(f"完成，共写入 {count} 个向量切片。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
