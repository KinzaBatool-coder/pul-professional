"""Text-to-speech: Edge neural voices first, gTTS as a backup."""
import asyncio
import logging
import time
import uuid

import edge_tts

from app.config import settings
from app.languages import LANGUAGES

log = logging.getLogger("pul.tts")


class TTSError(Exception):
    pass


def _cleanup() -> None:
    now = time.time()
    for f in settings.audio_dir.glob("*.mp3"):
        if now - f.stat().st_mtime > settings.audio_ttl_seconds:
            f.unlink(missing_ok=True)


def _gtts(text: str, lang: str, path: str) -> None:
    from gtts import gTTS
    gTTS(text=text, lang=LANGUAGES[lang].gtts).save(path)


async def synthesize(text: str, lang: str, gender: str = "f", rate: int = 0) -> tuple[str, str]:
    """Create an mp3 and return (filename, provider)."""
    await asyncio.to_thread(_cleanup)
    name = f"{uuid.uuid4().hex}.mp3"
    path = str(settings.audio_dir / name)
    voice = LANGUAGES[lang].voices[gender if gender in ("f", "m") else "f"]
    try:
        await asyncio.wait_for(
            edge_tts.Communicate(text, voice, rate=f"{rate:+d}%").save(path), timeout=30)
        return name, "edge"
    except Exception as e:
        log.warning("Edge TTS failed (%s); trying gTTS", e)
    try:
        await asyncio.to_thread(_gtts, text, lang, path)
        return name, "gtts"
    except Exception as e:
        log.error("gTTS failed: %s", e)
        raise TTSError("Voice could not be generated. Check your internet connection.") from e
