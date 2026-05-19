"""
routes/attachments.py

Fixes applied:
  #4  Debounced rebuild thay vì rebuild ngay lập tức
  #9  try/finally nhất quán cho SQLite connections
"""

import asyncio
import logging
import os
import mimetypes
from datetime import datetime
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import Optional
from database import get_connection
from services.utils import get_server_url, save_upload
from services.file_extract import extract_text
from services.rag import schedule_rebuild  # Fix #4

logger = logging.getLogger(__name__)

router = APIRouter()
MAX_MB = 50
GROUPS = {
    "image":    ("image/",),
    "audio":    ("audio/",),
    "video":    ("video/",),
    "document": ("application/pdf", "application/msword",
                 "application/vnd.openxmlformats", "application/vnd.ms-",
                 "text/", "application/json", "application/zip",
                 "application/xml", "application/octet-stream"),
}


def _group(mime: str) -> str:
    for g, prefixes in GROUPS.items():
        if any(mime.startswith(p) for p in prefixes):
            return g
    return "document"


def _chk(note_id: int):
    conn = get_connection()
    try:
        row = conn.execute("SELECT id FROM notes WHERE id=?", [note_id]).fetchone()
    finally:
        conn.close()
    if not row:
        raise HTTPException(404, f"Note {note_id} not found")


@router.get("/notes/{note_id}/attachments")
def list_attachments(note_id: int):
    _chk(note_id)
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT * FROM note_attachments WHERE note_id=? ORDER BY created_at DESC",
            [note_id],
        ).fetchall()
    finally:
        conn.close()
    return {"success": True, "data": [dict(r) for r in rows]}


@router.post("/notes/{note_id}/attachments")
async def upload_attachment(
    note_id:   int,
    file:      UploadFile    = File(...),
    file_name: Optional[str] = Form(None),
):
    _chk(note_id)
    content = await file.read()
    if len(content) / (1024 * 1024) > MAX_MB:
        raise HTTPException(413, f"File too large. Max {MAX_MB}MB.")

    original = file_name or file.filename or "file"
    mime     = file.content_type or ""
    if not mime or mime == "application/octet-stream":
        guessed, _ = mimetypes.guess_type(original)
        mime = guessed or "application/octet-stream"

    grp   = _group(mime)
    fpath = save_upload(content, grp, original)
    furl  = f"{get_server_url()}/{fpath.replace(os.sep, '/')}"
    now   = datetime.now().isoformat()

    # Extract text ngay lúc upload (PDF, DOCX, XLSX, text files)
    # Chạy trong executor để không block event loop với file lớn
    extracted = ""
    if grp == "document":
        loop = asyncio.get_running_loop()
        extracted = await loop.run_in_executor(None, extract_text, fpath, mime)

    conn = get_connection()
    try:
        cur = conn.execute(
            "INSERT INTO note_attachments "
            "(note_id,file_name,file_path,file_url,mime_type,file_group,file_size,extracted_text,created_at) "
            "VALUES (?,?,?,?,?,?,?,?,?)",
            [note_id, original, fpath, furl, mime, grp, len(content), extracted or None, now],
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM note_attachments WHERE id=?", [cur.lastrowid]
        ).fetchone()
    finally:
        conn.close()

    if extracted:
        schedule_rebuild()  # Fix #4: debounced

    return {"success": True, "data": dict(row)}


@router.delete("/notes/{note_id}/attachments/{att_id}")
def delete_attachment(note_id: int, att_id: int):
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT * FROM note_attachments WHERE id=? AND note_id=?",
            [att_id, note_id],
        ).fetchone()
        if not row:
            raise HTTPException(404, "Attachment not found")
        try:
            if os.path.exists(row["file_path"]):
                os.remove(row["file_path"])
        except OSError as e:
            logger.warning("[delete_attachment] cant remove file %s: %s", row["file_path"], e)
        conn.execute("DELETE FROM note_attachments WHERE id=?", [att_id])
        conn.commit()
    finally:
        conn.close()
    return {"success": True, "message": f"Deleted attachment {att_id}"}