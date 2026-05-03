import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from database import init_db
from routes.notes     import router as notes_router
from routes.capture   import router as capture_router
from routes.reminders import router as reminders_router
from routes.ai        import router as ai_router

# ── Tạo thư mục uploads khi khởi động ────────────────────────────────────────
os.makedirs("uploads/images", exist_ok=True)
os.makedirs("uploads/audio",  exist_ok=True)

# ── Khởi tạo app ─────────────────────────────────────────────────────────────
app = FastAPI(
    title="MemoAI Backend",
    description="AI-powered note taking backend",
    version="1.0.0",
)

# ── CORS — cho phép Expo app gọi API ─────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Serve static files (ảnh + audio) ─────────────────────────────────────────
# Expo app dùng URL: http://<IP>:8000/uploads/images/file.jpg
#                    http://<IP>:8000/uploads/audio/file.m4a
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# ── Đăng ký routes ───────────────────────────────────────────────────────────
app.include_router(notes_router,     prefix="/notes",     tags=["Notes"])
app.include_router(capture_router,   prefix="/capture",   tags=["Capture"])
app.include_router(reminders_router, prefix="/reminders", tags=["Reminders"])
app.include_router(ai_router,        prefix="",           tags=["AI"])

# ── Khởi tạo DB khi server start ─────────────────────────────────────────────
@app.on_event("startup")
def startup():
    init_db()
    from services.utils import get_server_url
    print(f"🚀 MemoAI backend started")
    print(f"📱 Expo app dùng URL: {get_server_url()}")
    print(f"📖 API Docs: {get_server_url()}/docs")

@app.get("/")
def root():
    from services.utils import get_server_url
    return {
        "status":  "MemoAI backend running",
        "version": "1.0.0",
        "url":     get_server_url(),
    }