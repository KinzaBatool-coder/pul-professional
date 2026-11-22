"""HTTP API."""
import asyncio
import time
import uuid

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.config import settings
from app.languages import LANGUAGES
from app.services import stt, translator, tts

router = APIRouter(prefix="/api")


@router.get("/health")
def health():
    return {"status": "ok", "translator": translator.engine_name(),
            "whisper": settings.whisper_model}


@router.get("/languages")
def languages():
    return [{"code": l.code, "name": l.name, "native": l.native, "rtl": l.rtl, "note": l.note}
            for l in LANGUAGES.values()]


@router.post("/translate")
async def translate(src: str = Form(...), dst: str = Form(...), text: str = Form(""),
                    audio: UploadFile | None = File(None), speak: bool = Form(True),
                    gender: str = Form("f"), rate: int = Form(0)):
    if src not in LANGUAGES or dst not in LANGUAGES:
        raise HTTPException(400, "Unsupported language.")
    if src == dst:
        raise HTTPException(400, "Choose two different languages.")

    warnings: list[str] = []
    timings: dict[str, int] = {}
    transcript = text.strip()

    if not transcript:                                          # voice input
        if audio is None:
            raise HTTPException(400, "Send text or audio.")
        data = await audio.read()
        if len(data) > settings.max_audio_mb * 1024 * 1024:
            raise HTTPException(413, "Recording is too large.")
        tmp = settings.audio_dir / f"in_{uuid.uuid4().hex}.webm"
        tmp.write_bytes(data)
        t0 = time.perf_counter()
        try:
            transcript = await asyncio.to_thread(stt.transcribe, str(tmp), LANGUAGES[src].whisper)
        except Exception as e:
            raise HTTPException(500, f"Speech recognition failed: {e}")
        finally:
            tmp.unlink(missing_ok=True)
        timings["stt"] = round((time.perf_counter() - t0) * 1000)
        if not transcript:
            raise HTTPException(422, "No speech detected. Please try again.")
        if LANGUAGES[src].note:
            warnings.append(LANGUAGES[src].note)

    if len(transcript) > settings.max_text_chars:
        raise HTTPException(413, f"Text is too long (max {settings.max_text_chars} characters).")

    t0 = time.perf_counter()
    try:
        translation, engine = await asyncio.to_thread(translator.translate, transcript, src, dst)
    except translator.TranslationError as e:
        raise HTTPException(502, str(e))
    timings["translate"] = round((time.perf_counter() - t0) * 1000)

    audio_url = None
    if speak:
        t0 = time.perf_counter()
        try:
            name, provider = await tts.synthesize(translation, dst, gender, max(-50, min(50, rate)))
            audio_url = f"/audio/{name}"
            if LANGUAGES[dst].note:
                warnings.append(LANGUAGES[dst].note)
        except tts.TTSError as e:
            warnings.append(str(e))
        timings["tts"] = round((time.perf_counter() - t0) * 1000)

    return {"src": src, "dst": dst, "transcript": transcript, "translation": translation,
            "audio": audio_url, "engine": engine, "warnings": list(dict.fromkeys(warnings)),
            "ms": timings}


@router.post("/speak")
async def speak_only(text: str = Form(...), lang: str = Form(...),
                     gender: str = Form("f"), rate: int = Form(0)):
    """Generate voice for text that is already translated (used by the Replay button)."""
    if lang not in LANGUAGES:
        raise HTTPException(400, "Unsupported language.")
    try:
        name, _ = await tts.synthesize(text[:settings.max_text_chars], lang, gender,
                                       max(-50, min(50, rate)))
    except tts.TTSError as e:
        raise HTTPException(502, str(e))
    return {"audio": f"/audio/{name}"}
