"""应用配置 - 可从环境变量覆盖.

环境变量前缀为 ``3BODY_``（可写入 backend/.env 或项目根 .env）。
由于以数字开头的变量名无法在 bash 中 ``export``，同时兼容 ``THREEBODY_`` 前缀：
``THREEBODY_LLM_MODEL=xxx`` 等价于 ``3BODY_LLM_MODEL=xxx``。
"""
import os
from pathlib import Path

from pydantic_settings import BaseSettings

BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent

_ALT_PREFIX = "THREEBODY_"
_PREFIX = "3BODY_"

# 将 THREEBODY_* 映射为 3BODY_*（不覆盖已显式设置的 3BODY_* 值）
for _key, _val in list(os.environ.items()):
    if _key.upper().startswith(_ALT_PREFIX):
        os.environ.setdefault(_PREFIX + _key[len(_ALT_PREFIX):], _val)


class Settings(BaseSettings):
    """3body 后端配置."""

    # 应用
    app_name: str = "3body"
    debug: bool = False
    # 允许跨域的前端来源，逗号分隔；默认 "*"（本地开发）
    cors_origins: str = "*"

    # 数据库 (SQLite for dev)
    database_url: str = "sqlite+aiosqlite:///3body.db"

    # LLM：统一使用 OpenAI 兼容协议（/v1/chat/completions）。
    # Ollama 本地默认 http://localhost:11434（自带 /v1 兼容端点）；
    # DeepSeek / SiliconFlow / OpenAI 等云端服务填写其 base_url 与 api_key 即可。
    llm_base_url: str = "http://localhost:11434"
    llm_model: str = "qwen2.5:7b"
    llm_timeout: float = 60.0
    llm_api_key: str = ""
    # 是否允许前端在请求中覆盖 base_url / api_key / model。
    # 仅建议本地开发开启：开启后服务器会按请求方给出的地址发起请求（SSRF 风险）。
    llm_allow_client_override: bool = False

    # ChromaDB for RAG (三体原著)：智子对话与 ingest 脚本共用同一目录
    chroma_persist_dir: str = str(BACKEND_DIR / "chroma_db")
    data_dir: str = str(PROJECT_ROOT / "data")

    # Project Zero — 智子审计引擎 (SiliconFlow)：嵌入与对话共用一个端点，须与 Key 所属平台一致
    siliconflow_api_key: str = ""
    siliconflow_base_url: str = "https://api.siliconflow.cn/v1"  # 国际站：https://api.siliconflow.com/v1
    sophon_engine_chroma_dir: str = "./chroma_project_zero"  # 相对启动目录，保持与既有部署一致
    sophon_engine_data_dir: str = ""  # 空则用项目根目录下的 data/

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()] or ["*"]

    class Config:
        # 项目根与 backend/ 下的 .env 都会读取（后者优先），与启动目录无关
        env_file = (str(PROJECT_ROOT / ".env"), str(BACKEND_DIR / ".env"))
        env_file_encoding = "utf-8"
        env_prefix = _PREFIX
        extra = "ignore"


settings = Settings()
