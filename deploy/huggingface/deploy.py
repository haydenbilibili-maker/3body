#!/usr/bin/env python3
"""把 3body 后端打包并发布到 Hugging Face Space（Docker SDK）。

用法（凭据通过环境变量传入，避免出现在命令行历史里）：
    export HF_TOKEN=hf_xxx
    export THREEBODY_LLM_BASE_URL=https://api.deepseek.com
    export THREEBODY_LLM_MODEL=deepseek-chat
    export THREEBODY_LLM_API_KEY=sk-xxx
    python deploy/huggingface/deploy.py

可选：
    --space-name 3body-api      Space 名称（默认 3body-api）
    --cors "url1,url2"          允许的前端来源
    --skip-secrets              不改动 Space secrets（仅更新代码）
    --no-wait                   上传后立即返回，不等待构建
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
BUNDLE_DIR = Path("/tmp/3body-space")

DEFAULT_CORS = "https://3body-5px.pages.dev,https://haydenbilibili-maker.github.io"
IGNORE_DIRS = {"__pycache__", ".git", ".pytest_cache", "node_modules", "chroma_db", "db"}
IGNORE_SUFFIXES = {".pyc", ".pyo", ".DS_Store"}


def build_bundle() -> Path:
    """把 Space 需要的文件复制到临时目录（backend + scripts + data + 入口文件）。"""
    if BUNDLE_DIR.exists():
        shutil.rmtree(BUNDLE_DIR)
    BUNDLE_DIR.mkdir(parents=True)

    for name in ("backend", "scripts", "data"):
        src = REPO_ROOT / name
        if not src.exists():
            sys.exit(f"缺少目录: {src}")
        shutil.copytree(
            src,
            BUNDLE_DIR / name,
            ignore=shutil.ignore_patterns(*IGNORE_DIRS, *IGNORE_SUFFIXES),
        )

    shutil.copy2(REPO_ROOT / "deploy/backend/Dockerfile", BUNDLE_DIR / "Dockerfile")
    shutil.copy2(REPO_ROOT / "deploy/huggingface/README.md", BUNDLE_DIR / "README.md")

    total = sum(p.stat().st_size for p in BUNDLE_DIR.rglob("*") if p.is_file())
    print(f"✅ 打包完成: {BUNDLE_DIR} ({total / 1024 / 1024:.1f} MB)")
    return BUNDLE_DIR


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--space-name", default="3body-api")
    parser.add_argument("--cors", default=DEFAULT_CORS)
    parser.add_argument("--skip-secrets", action="store_true")
    parser.add_argument("--no-wait", action="store_true")
    args = parser.parse_args()

    token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGINGFACEHUB_API_TOKEN")
    if not token:
        cached = Path.home() / ".cache/huggingface/token"
        if cached.exists():
            token = cached.read_text().strip()
    if not token:
        sys.exit("缺少 HF_TOKEN（或在终端执行 `hf auth login` 后再运行）")

    llm_base = os.environ.get("THREEBODY_LLM_BASE_URL", "")
    llm_model = os.environ.get("THREEBODY_LLM_MODEL", "")
    llm_key = os.environ.get("THREEBODY_LLM_API_KEY", "")

    from huggingface_hub import HfApi

    api = HfApi(token=token)
    user = api.whoami()["name"]
    repo_id = f"{user}/{args.space_name}"
    url = f"https://{user}-{args.space_name}.hf.space"

    print(f"👤 账号: {user}")
    print(f"🚀 目标 Space: {repo_id}")

    bundle = build_bundle()

    api.create_repo(
        repo_id=repo_id,
        repo_type="space",
        space_sdk="docker",
        private=False,
        exist_ok=True,
    )
    print("📦 上传文件 ...")
    api.upload_folder(
        folder_path=str(bundle),
        repo_id=repo_id,
        repo_type="space",
        commit_message="deploy: 3body FastAPI backend",
    )
    print("✅ 代码已推送")

    if not args.skip_secrets:
        secrets = {}
        if llm_base:
            secrets["THREEBODY_LLM_BASE_URL"] = llm_base
        if llm_model:
            secrets["THREEBODY_LLM_MODEL"] = llm_model
        if llm_key:
            secrets["THREEBODY_LLM_API_KEY"] = llm_key
        secrets["THREEBODY_CORS_ORIGINS"] = args.cors
        for key, value in secrets.items():
            api.add_space_secret(repo_id=repo_id, key=key, value=value)
            print(f"🔐 已写入 secret: {key}")
        api.add_space_variable(repo_id=repo_id, key="THREEBODY_LLM_TIMEOUT", value="60")
        print("🔐 已写入 variable: THREEBODY_LLM_TIMEOUT=60")

    print(f"🌐 Space 地址: https://huggingface.co/spaces/{repo_id}")
    print(f"🔗 API 地址:   {url}")

    if args.no_wait:
        return

    print("⏳ 等待 Space 构建（首次约 2-5 分钟）...")
    stage = None
    deadline = time.time() + 900
    while time.time() < deadline:
        info = api.space_info(repo_id)
        runtime = getattr(info, "runtime", None)
        current = getattr(runtime, "stage", None) if runtime else None
        if current != stage:
            stage = current
            print(f"   stage: {stage}")
        if stage == "RUNNING":
            break
        if stage in ("BUILD_ERROR", "CONFIG_ERROR", "RUNTIME_ERROR", "DELETING"):
            sys.exit(f"❌ 构建/运行失败: {stage}（查看 https://huggingface.co/spaces/{repo_id}/logs）")
        time.sleep(10)
    else:
        sys.exit("⌛ 超时：Space 仍未 RUNNING")

    print("🔍 健康检查 ...")
    for _ in range(30):
        try:
            with urllib.request.urlopen(f"{url}/health", timeout=15) as resp:
                payload = json.loads(resp.read().decode())
            print("✅ /health:", json.dumps(payload, ensure_ascii=False)[:400])
            return
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            time.sleep(5)
            last = exc
    sys.exit(f"❌ 健康检查失败: {last}")


if __name__ == "__main__":
    main()
