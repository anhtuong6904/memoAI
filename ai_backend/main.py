import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI

os.chdir(Path(__file__).parent)

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env")
except ImportError:
    pass
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

logger = logging.getLogger(__name__)

from database import init_db
from routes.notes       import router as notes_router
from routes.attachments import router as attachments_router
from routes.analyze     import router as analyze_router
from routes.reminders   import router as reminders_router
from routes.ai          import router as ai_router
from routes.chat        import router as chat_router
from routes.note_chat   import router as note_chat_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    for d in ["uploads/image", "uploads/audio", "uploads/video", "uploads/document"]:
        os.makedirs(d, exist_ok=True)
    init_db()
    from services.utils import get_server_url
    from services.rag import rebuild_index_from_db
    rebuild_index_from_db()
    logger.info("MemoAI v2 -> %s/docs", get_server_url())
    yield


app = FastAPI(
    title="MemoAI Backend",
    version="1.0.0",
    redirect_slashes=False,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(notes_router,       prefix="/notes",     tags=["Notes"])
app.include_router(attachments_router, prefix="",           tags=["Attachments"])
app.include_router(analyze_router,     prefix="",           tags=["Analyze"])
app.include_router(reminders_router,   prefix="/reminders", tags=["Reminders"])
app.include_router(ai_router,          prefix="",           tags=["AI"])
app.include_router(chat_router,        prefix="/chat",      tags=["Chat"])
app.include_router(note_chat_router,   prefix="",           tags=["NoteChat"])



@app.get("/")
def root():
    from services.utils import get_server_url
    return {"status": "running", "version": "2.0.0", "url": get_server_url()}