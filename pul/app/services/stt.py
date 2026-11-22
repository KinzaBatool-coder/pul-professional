"""Speech-to-text using faster-whisper."""
import threading

from faster_whisper import WhisperModel

from app.config import settings

_model: WhisperModel | None = None
_lock = threading.Lock()


def load_model() -> WhisperModel:
    global _model
    with _lock:
        if _model is None:
            _model = WhisperModel(settings.whisper_model,
                                  device=settings.whisper_device,
                                  compute_type=settings.whisper_compute)
    return _model


def transcribe(path: str, language: str) -> str:
    segments, _ = load_model().transcribe(
        path, language=language, beam_size=5, vad_filter=True,
        condition_on_previous_text=False)
    return " ".join(s.text.strip() for s in segments).strip()
