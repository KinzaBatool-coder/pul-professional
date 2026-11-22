"""Central configuration. Values come from environment variables or a .env file."""
import os
import tempfile
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def _flag(name: str, default: bool) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    host: str = os.getenv("HOST", "127.0.0.1")
    port: int = int(os.getenv("PORT", "8000"))
    preload_models: bool = _flag("PRELOAD_MODELS", True)

    whisper_model: str = os.getenv("WHISPER_MODEL", "small")
    whisper_device: str = os.getenv("WHISPER_DEVICE", "auto")
    whisper_compute: str = os.getenv("WHISPER_COMPUTE", "auto")

    translator: str = os.getenv("TRANSLATOR", "auto").lower()   # auto | llm | nllb
    anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "")
    anthropic_model: str = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-5-5")
    nllb_model: str = os.getenv("NLLB_MODEL", "facebook/nllb-200-distilled-600M")

    audio_dir: Path = Path(tempfile.gettempdir()) / "pul_audio"
    audio_ttl_seconds: int = 3600
    max_text_chars: int = 3000
    max_audio_mb: int = 15
    static_dir: Path = BASE_DIR / "static"


settings = Settings()
settings.audio_dir.mkdir(parents=True, exist_ok=True)
