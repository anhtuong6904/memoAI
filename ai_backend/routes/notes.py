from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import os
from database import get_connection
from services.tiptap import extract_plain_text

router = APIRouter()


class NoteCreate(BaseModel):
    title:        Optional[str] = None
    content:      str           = ""
    content_json: Optional[str] = None
    tags:         str           = "[]"


class NoteUpdate(BaseModel):
    title:        Optional[str] = None
    content:      Optional[str] = None
    content_json: Optional[str] = None
    tags:         Optional[str] = None
    is_pinned:    Optional[int] = None
    is_archived:  Optional[int] = None


def _404(note_id: int):
    raise HTTPException(status_code=404, detail=f"Note {note_id} not found")


@router.get("")
def get_notes(
    tag:    Optional[str] = Query(None),
    type:   Optional[str] = Query(None),
    limit:  int           = Query(50),
    offset: int           = Query(0),
):
    conn   = get_connection()
    q      = "SELECT * FROM notes WHERE is_archived=0"
    params = []
    if type:
        q += " AND type=?"
        params.append(type)
    if tag:
        q += " AND tags LIKE ?"
        params.append(f"%{tag}%")
    q += " ORDER BY is_pinned DESC, created_at DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])
    notes = conn.execute(q, params).fetchall()
    conn.close()
    return {"success": True, "data": [dict(n) for n in notes], "count": len(notes)}


@router.post("")
def create_note(body: NoteCreate):
    conn    = get_connection()
    now     = datetime.now().isoformat()
    content = body.content
    if body.content_json:
        try:
            content = extract_plain_text(body.content_json)
        except Exception as e:
            print(f"  [create_note] tiptap parse error: {e}")
            content = body.content
    cur = conn.execute(
        "INSERT INTO notes (title, content, content_json, tags, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        [body.title, content, body.content_json, body.tags, now, now],
    )
    conn.commit()
    note = conn.execute("SELECT * FROM notes WHERE id=?", [cur.lastrowid]).fetchone()
    conn.close()
    print(f"  [create_note] id={cur.lastrowid} title={body.title!r}")
    return {"success": True, "data": dict(note)}


@router.get("/{note_id}")
def get_note(note_id: int):
    conn = get_connection()
    note = conn.execute("SELECT * FROM notes WHERE id=?", [note_id]).fetchone()
    if not note:
        conn.close()
        _404(note_id)
    extracted = conn.execute(
        "SELECT * FROM extracted_info WHERE note_id=?", [note_id]
    ).fetchone()
    attachments = conn.execute(
        "SELECT * FROM note_attachments WHERE note_id=? ORDER BY created_at",
        [note_id],
    ).fetchall()
    conn.close()
    return {
        "success":     True,
        "data":        dict(note),
        "extracted":   dict(extracted) if extracted else None,
        "attachments": [dict(a) for a in attachments],
    }


@router.put("/{note_id}")
def update_note(note_id: int, body: NoteUpdate):
    conn = get_connection()
    if not conn.execute("SELECT id FROM notes WHERE id=?", [note_id]).fetchone():
        conn.close()
        _404(note_id)
    fields, params = [], []
    if body.title is not None:
        fields.append("title=?"); params.append(body.title)
    if body.content_json is not None:
        fields.append("content_json=?"); params.append(body.content_json)
        try:
            plain = extract_plain_text(body.content_json)
        except Exception:
            plain = body.content_json
        fields.append("content=?"); params.append(plain)
    elif body.content is not None:
        fields.append("content=?"); params.append(body.content)
    if body.tags is not None:
        fields.append("tags=?"); params.append(body.tags)
    if body.is_pinned is not None:
        fields.append("is_pinned=?"); params.append(body.is_pinned)
    if body.is_archived is not None:
        fields.append("is_archived=?"); params.append(body.is_archived)
    if not fields:
        conn.close()
        raise HTTPException(400, "No fields to update")
    fields.append("updated_at=?"); params.append(datetime.now().isoformat())
    params.append(note_id)
    conn.execute(f"UPDATE notes SET {', '.join(fields)} WHERE id=?", params)
    conn.commit()
    note = conn.execute("SELECT * FROM notes WHERE id=?", [note_id]).fetchone()
    conn.close()
    print(f"  [update_note] id={note_id} fields={[f.split('=')[0] for f in fields]}")
    return {"success": True, "data": dict(note)}


@router.delete("/{note_id}")
def delete_note(note_id: int):
    """
    Manual cascade delete — KHONG dua vao ON DELETE CASCADE.
    Ly do: SQLite cu co the co bang cu (block, ai_extractions...) co FK hong
    khien CASCADE bi loi 'foreign key mismatch'.
    """
    conn = get_connection()
    if not conn.execute("SELECT id FROM notes WHERE id=?", [note_id]).fetchone():
        conn.close()
        _404(note_id)

    # 1. Xoa file dinh kem khoi disk truoc
    attachments = conn.execute(
        "SELECT file_path FROM note_attachments WHERE note_id=?", [note_id]
    ).fetchall()
    for att in attachments:
        try:
            if att["file_path"] and os.path.exists(att["file_path"]):
                os.remove(att["file_path"])
        except OSError as e:
            print(f"  [delete_note] cant remove file {att['file_path']}: {e}")

    # 2. Manual delete tat ca rows lien quan, KHONG FK
    conn.execute("PRAGMA foreign_keys = OFF")
    try:
        conn.execute("DELETE FROM note_attachments WHERE note_id=?", [note_id])
        conn.execute("DELETE FROM extracted_info WHERE note_id=?", [note_id])
        conn.execute("DELETE FROM reminders WHERE note_id=?", [note_id])
        conn.execute("DELETE FROM note_tags WHERE note_id=?", [note_id])
        conn.execute("DELETE FROM notes WHERE id=?", [note_id])
        conn.commit()
        print(f"  [delete_note] id={note_id} ok")
    except Exception as e:
        conn.rollback()
        conn.close()
        print(f"  [delete_note] ERROR: {e}")
        raise HTTPException(500, f"Delete failed: {e}")
    finally:
        conn.execute("PRAGMA foreign_keys = ON")
        conn.close()

    return {"success": True, "message": f"Deleted note {note_id}"}


@router.put("/{note_id}/pin")
def toggle_pin(note_id: int):
    conn = get_connection()
    note = conn.execute("SELECT * FROM notes WHERE id=?", [note_id]).fetchone()
    if not note:
        conn.close()
        _404(note_id)
    new_val = 0 if note["is_pinned"] else 1
    conn.execute(
        "UPDATE notes SET is_pinned=?, updated_at=? WHERE id=?",
        [new_val, datetime.now().isoformat(), note_id],
    )
    conn.commit()
    note = conn.execute("SELECT * FROM notes WHERE id=?", [note_id]).fetchone()
    conn.close()
    return {"success": True, "data": dict(note)}


@router.put("/{note_id}/archive")
def toggle_archive(note_id: int):
    conn = get_connection()
    note = conn.execute("SELECT * FROM notes WHERE id=?", [note_id]).fetchone()
    if not note:
        conn.close()
        _404(note_id)
    new_val = 0 if note["is_archived"] else 1
    conn.execute(
        "UPDATE notes SET is_archived=?, updated_at=? WHERE id=?",
        [new_val, datetime.now().isoformat(), note_id],
    )
    conn.commit()
    note = conn.execute("SELECT * FROM notes WHERE id=?", [note_id]).fetchone()
    conn.close()
    return {"success": True, "data": dict(note)}