import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from database import init_db
from routes.notes       import router as notes_router
from routes.attachments import router as attachments_router
from routes.analyze     import router as analyze_router
from routes.reminders   import router as reminders_router
from routes.ai          import router as ai_router

app = FastAPI(
    title="MemoAI Backend",
    version="2.0.0",
    redirect_slashes=False,   # KHONG redirect /notes -> /notes/
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


@app.on_event("startup")
def startup():
    for d in ["uploads/image", "uploads/audio", "uploads/video", "uploads/document"]:
        os.makedirs(d, exist_ok=True)
    init_db()
    from services.utils import get_server_url
    print(f"MemoAI v2 -> {get_server_url()}/docs")
    print(f"redirect_slashes = False (POST /notes phai 200, KHONG 307)")


@app.get("/")
def root():
    from services.utils import get_server_url
    return {"status": "running", "version": "2.0.0", "url": get_server_url()}