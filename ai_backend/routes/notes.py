"""
routes/notes.py — CRUD Notes
GET    /notes        → danh sách notes
GET    /notes/:id    → 1 note
POST   /notes        → tạo note mới
PUT    /notes/:id    → cập nhật note
DELETE /notes/:id    → xóa note
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from database import get_connection

router = APIRouter()


# ── Pydantic Models — định nghĩa shape của request body ──────────────────────

class NoteCreate(BaseModel):
    title:   Optional[str] = None
    content: str           = ""
    type:    str           = "text"
    tags:    str           = "[]"   # JSON string


class NoteUpdate(BaseModel):
    title:      Optional[str] = None
    content:    Optional[str] = None
    tags:       Optional[str] = None
    is_pinned:  Optional[int] = None
    is_archived: Optional[int] = None


# ── Helper ────────────────────────────────────────────────────────────────────

def note_not_found(note_id: int):
    raise HTTPException(status_code=404, detail=f"Note {note_id} không tồn tại")


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/")
def get_notes(
    tag:    Optional[str] = Query(None, description="Lọc theo tag"),
    type:   Optional[str] = Query(None, description="Lọc theo type: text|image|voice|video"),
    limit:  int           = Query(10,   description="Số note tối đa trả về"),
    offset: int           = Query(0,    description="Bỏ qua bao nhiêu note (phân trang)"),
):
    """
    Lấy danh sách notes, mới nhất lên đầu.
    Hỗ trợ filter theo tag và type.
    """
    conn = get_connection()

    query  = "SELECT * FROM notes WHERE is_archived = 0"
    params = []

    # Filter theo type nếu có
    if type:
        query += " AND type = ?"
        params.append(type)

    # Filter theo tag — tìm trong JSON string
    # vd: tags = '["liên hệ", "công việc"]'
    if tag:
        query += " AND tags LIKE ?"
        params.append(f'%{tag}%')

    query += " ORDER BY is_pinned DESC, created_at DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    notes = conn.execute(query, params).fetchall()
    conn.close()

    return {
        "success": True,
        "data": [dict(n) for n in notes],
        "count": len(notes),
    }


@router.get("/{note_id}")
def get_note(note_id: int):
    """Lấy 1 note theo ID, kèm extracted_info nếu có."""
    conn = get_connection()

    note = conn.execute(
        "SELECT * FROM notes WHERE id = ?", [note_id]
    ).fetchone()

    if not note:
        conn.close()
        note_not_found(note_id)

    # Lấy kèm extracted_info
    extracted = conn.execute(
        "SELECT * FROM extracted_info WHERE note_id = ?", [note_id]
    ).fetchone()

    conn.close()

    return {
        "success":   True,
        "data":      dict(note),
        "extracted": dict(extracted) if extracted else None,
    }


@router.post("/")
def create_note(body: NoteCreate):
    """Tạo note mới (text thuần, không qua AI pipeline)."""
    conn = get_connection()
    now  = datetime.now().isoformat()

    cursor = conn.execute(
        """INSERT INTO notes (title, content, type, tags, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        [body.title, body.content, body.type, body.tags, now, now]
    )
    conn.commit()
    note_id = cursor.lastrowid

    note = conn.execute("SELECT * FROM notes WHERE id = ?", [note_id]).fetchone()
    conn.close()

    return {"success": True, "data": dict(note)}


@router.put("/{note_id}")
def update_note(note_id: int, body: NoteUpdate):
    """Cập nhật note — chỉ update các field được gửi lên."""
    conn = get_connection()

    # Kiểm tra note tồn tại
    existing = conn.execute("SELECT id FROM notes WHERE id = ?", [note_id]).fetchone()
    if not existing:
        conn.close()
        note_not_found(note_id)

    # Build dynamic UPDATE — chỉ update field có giá trị
    fields = []
    params = []

    if body.title      is not None: fields.append("title = ?");       params.append(body.title)
    if body.content    is not None: fields.append("content = ?");     params.append(body.content)
    if body.tags       is not None: fields.append("tags = ?");        params.append(body.tags)
    if body.is_pinned  is not None: fields.append("is_pinned = ?");   params.append(body.is_pinned)
    if body.is_archived is not None: fields.append("is_archived = ?"); params.append(body.is_archived)

    if not fields:
        conn.close()
        raise HTTPException(status_code=400, detail="Không có field nào để update")

    # Luôn update updated_at
    fields.append("updated_at = ?")
    params.append(datetime.now().isoformat())
    params.append(note_id)

    conn.execute(f"UPDATE notes SET {', '.join(fields)} WHERE id = ?", params)
    conn.commit()

    note = conn.execute("SELECT * FROM notes WHERE id = ?", [note_id]).fetchone()
    conn.close()

    return {"success": True, "data": dict(note)}


@router.delete("/{note_id}")
def delete_note(note_id: int):
    """
    Xóa note.
    ON DELETE CASCADE trong DB tự xóa extracted_info, reminders, note_tags liên quan.
    """
    conn = get_connection()

    existing = conn.execute("SELECT id FROM notes WHERE id = ?", [note_id]).fetchone()
    if not existing:
        conn.close()
        note_not_found(note_id)

    conn.execute("DELETE FROM notes WHERE id = ?", [note_id])
    conn.commit()
    conn.close()

    return {"success": True, "message": f"Đã xóa note {note_id}"}