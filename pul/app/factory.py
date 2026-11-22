"""Application factory."""
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.api.routes import router
from app.config import settings
from app.services import stt

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.preload_models:
        logging.info("Loading Whisper model '%s' ...", settings.whisper_model)
        await asyncio.to_thread(stt.load_model)
    logging.info("Ready -> http://%s:%s", settings.host, settings.port)
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="Pul", version="2.0.0", lifespan=lifespan)
    app.include_router(router)
    app.mount("/audio", StaticFiles(directory=settings.audio_dir), name="audio")
    app.mount("/", StaticFiles(directory=settings.static_dir, html=True), name="ui")
    return app
