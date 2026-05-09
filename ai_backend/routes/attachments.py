import os, mimetypes
from datetime import datetime
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import Optional
from database import get_connection
from services.utils import get_server_url, save_upload

router = APIRouter()
MAX_MB  = 50
GROUPS  = {
    "image":    ("image/",),
    "audio":    ("audio/",),
    "video":    ("video/",),
    "document": ("application/pdf","application/msword",
                 "application/vnd.openxmlformats","application/vnd.ms-",
                 "text/","application/json","application/zip",
                 "application/xml","application/octet-stream"),
}

def _group(mime: str) -> str:
    for g, prefixes in GROUPS.items():
        if any(mime.startswith(p) for p in prefixes): return g
    return "document"

def _chk(note_id: int):
    conn = get_connection()
    row  = conn.execute("SELECT id FROM notes WHERE id=?", [note_id]).fetchone()
    conn.close()
    if not row: raise HTTPException(404, f"Note {note_id} not found")


@router.get("/notes/{note_id}/attachments")
def list_attachments(note_id: int):
    _chk(note_id)
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM note_attachments WHERE note_id=? ORDER BY created_at DESC",
        [note_id]).fetchall()
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
    if len(content) / (1024*1024) > MAX_MB:
        raise HTTPException(413, f"File too large. Max {MAX_MB}MB.")
    original = file_name or file.filename or "file"
    mime     = file.content_type or ""
    if not mime or mime == "application/octet-stream":
        guessed, _ = mimetypes.guess_type(original)
        mime = guessed or "application/octet-stream"
    grp      = _group(mime)
    fpath    = save_upload(content, grp, original)
    furl     = f"{get_server_url()}/{fpath.replace(os.sep,'/')}"
    now      = datetime.now().isoformat()
    conn     = get_connection()
    cur      = conn.execute(
        "INSERT INTO note_attachments (note_id,file_name,file_path,file_url,mime_type,file_group,file_size,created_at) VALUES (?,?,?,?,?,?,?,?)",
        [note_id, original, fpath, furl, mime, grp, len(content), now])
    conn.commit()
    row = conn.execute("SELECT * FROM note_attachments WHERE id=?", [cur.lastrowid]).fetchone()
    conn.close()
    return {"success": True, "data": dict(row)}


@router.delete("/notes/{note_id}/attachments/{att_id}")
def delete_attachment(note_id: int, att_id: int):
    conn = get_connection()
    row  = conn.execute(
        "SELECT * FROM note_attachments WHERE id=? AND note_id=?",
        [att_id, note_id]).fetchone()
    if not row: conn.close(); raise HTTPException(404, "Attachment not found")
    try:
        if os.path.exists(row["file_path"]): os.remove(row["file_path"])
    except OSError: pass
    conn.execute("DELETE FROM note_attachments WHERE id=?", [att_id])
    conn.commit(); conn.close()
    return {"success": True, "message": f"Deleted attachment {att_id}"}