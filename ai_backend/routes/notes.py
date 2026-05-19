"""
routes/notes.py

Fixes applied:
  #4   Debounced rebuild — gọi schedule_rebuild thay vì rebuild_index_from_db
  #7   Delete note → xóa vectors khỏi Chroma ngay lập tức
  #9   SQLite try/finally nhất quán — không leak connection
  #10  Related notes dùng note_tags index thay vì LIKE trên JSON
"""

import json
import logging
import os
import re as _re
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, field_validator

from database import get_connection
from services.tiptap import extract_plain_text
from services.rag import schedule_rebuild, delete_note_from_index

logger = logging.getLogger(__name__)

router = APIRouter()


def _html_to_plain(html: str) -> str:
    """Strip HTML tags and decode common entities to get plain text."""
    text = _re.sub(r'<[^>]+>', ' ', html)
    text = (text.replace('&amp;', '&').replace('&lt;', '<')
                .replace('&gt;', '>').replace('&nbsp;', ' ').replace('&quot;', '"'))
    return _re.sub(r'\s+', ' ', text).strip()


def _extract_urls_from_html(html: str) -> set:
    """Trích xuất tất cả giá trị src/href từ HTML."""
    urls = set()
    for m in _re.finditer(r'(?:src|href)=["\']([^"\']+)["\']', html):
        urls.add(m.group(1))
    return urls


def _cleanup_orphaned_attachments(conn, note_id: int, content_html: str) -> None:
    """Xóa attachment không còn được tham chiếu trong content_html (cả DB lẫn file trên disk)."""
    urls_in_content = _extract_urls_from_html(content_html)
    attachments = conn.execute(
        "SELECT id, file_path, file_url, file_name FROM note_attachments WHERE note_id=?",
        [note_id],
    ).fetchall()
    for att in attachments:
        if att["file_url"] not in urls_in_content:
            try:
                if att["file_path"] and os.path.exists(att["file_path"]):
                    os.remove(att["file_path"])
            except OSError as e:
                logger.warning("[cleanup] cant remove file %s: %s", att["file_path"], e)
            conn.execute("DELETE FROM note_attachments WHERE id=?", [att["id"]])
            logger.info("[cleanup] deleted orphaned attachment id=%d name=%s", att["id"], att["file_name"])


def _extract_plain(content_json: str, fallback: str = "") -> str:
    """Extract plain text from content_json (HTML string or TipTap JSON)."""
    if not content_json or not content_json.strip():
        return fallback
    if content_json.lstrip().startswith("<"):
        return _html_to_plain(content_json)
    try:
        return extract_plain_text(content_json)
    except Exception:
        return _html_to_plain(content_json)


def _validate_tags(v: Optional[str]) -> Optional[str]:
    if v is None:
        return v
    try:
        parsed = json.loads(v)
    except json.JSONDecodeError:
        raise ValueError("tags phải là JSON array hợp lệ (vd: [\"tag1\",\"tag2\"])")
    if not isinstance(parsed, list):
        raise ValueError("tags phải là JSON array, không phải object")
    return v


class NoteCreate(BaseModel):
    title:        Optional[str] = None
    content:      str           = ""
    content_json: Optional[str] = None
    tags:         str           = "[]"

    @field_validator("tags")
    @classmethod
    def tags_must_be_array(cls, v: str) -> str:
        _validate_tags(v)
        return v


class NoteUpdate(BaseModel):
    title:        Optional[str] = None
    content:      Optional[str] = None
    content_json: Optional[str] = None
    tags:         Optional[str] = None
    @field_validator("tags")
    @classmethod
    def tags_must_be_array(cls, v: Optional[str]) -> Optional[str]:
        _validate_tags(v)
        return v


def _404(note_id: int):
    raise HTTPException(status_code=404, detail=f"Note {note_id} not found")


@router.get("")
def get_notes(
    tag:    Optional[str] = Query(None),
    type:   Optional[str] = Query(None),
    limit:  int           = Query(50),
    offset: int           = Query(0),
):
    conn = get_connection()
    try:
        # Bỏ content_json khỏi list để giảm payload (chỉ cần khi mở từng note)
        q = (
            "SELECT id,title,content,summary,type,tags,"
            "ai_processed,created_at,updated_at FROM notes WHERE 1=1"
        )
        params = []
        if type:
            q += " AND type=?"
            params.append(type)
        if tag:
            # JSON array membership check — tránh false positive của LIKE
            q += " AND EXISTS (SELECT 1 FROM json_each(tags) WHERE json_each.value = ?)"
            params.append(tag)
        q += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        notes = conn.execute(q, params).fetchall()
    finally:
        conn.close()
    return {"success": True, "data": [dict(n) for n in notes], "count": len(notes)}


@router.post("")
def create_note(body: NoteCreate):
    conn = get_connection()
    try:
        now     = datetime.now().isoformat()
        content = _extract_plain(body.content_json, fallback=body.content) if body.content_json else body.content
        cur = conn.execute(
            "INSERT INTO notes (title, content, content_json, tags, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            [body.title, content, body.content_json, body.tags, now, now],
        )
        conn.commit()
        note = conn.execute("SELECT * FROM notes WHERE id=?", [cur.lastrowid]).fetchone()
    finally:
        conn.close()
    logger.info("[create_note] id=%d title=%r", cur.lastrowid, body.title)
    schedule_rebuild()  # Fix #4
    return {"success": True, "data": dict(note)}


@router.get("/{note_id}")
def get_note(note_id: int):
    conn = get_connection()
    try:
        note = conn.execute("SELECT * FROM notes WHERE id=?", [note_id]).fetchone()
        if not note:
            _404(note_id)
        extracted = conn.execute(
            "SELECT * FROM extracted_info WHERE note_id=?", [note_id]
        ).fetchone()
        attachments = conn.execute(
            "SELECT * FROM note_attachments WHERE note_id=? ORDER BY created_at",
            [note_id],
        ).fetchall()
    finally:
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
    try:
        if not conn.execute("SELECT id FROM notes WHERE id=?", [note_id]).fetchone():
            _404(note_id)
        fields, params = [], []
        if body.title is not None:
            fields.append("title=?"); params.append(body.title)
        if body.content_json is not None and body.content_json != "":
            fields.append("content_json=?"); params.append(body.content_json)
            fields.append("content=?"); params.append(_extract_plain(body.content_json))
        elif body.content is not None:
            fields.append("content=?"); params.append(body.content)
        if body.tags is not None:
            fields.append("tags=?"); params.append(body.tags)
        if not fields:
            raise HTTPException(400, "No fields to update")
        # body.content = "" (empty) không được tính là thay đổi nội dung cần re-embed
        content_changed = any([
            body.title is not None and body.title.strip() != "",
            body.content is not None and body.content.strip() != "",
            body.content_json is not None and body.content_json.strip() != "",
            body.tags is not None,
        ])
        if content_changed:
            fields.append("embedded_at=?"); params.append(None)
        fields.append("updated_at=?");  params.append(datetime.now().isoformat())
        params.append(note_id)
        conn.execute(f"UPDATE notes SET {', '.join(fields)} WHERE id=?", params)
        conn.commit()
        # Xóa attachments không còn tồn tại trong nội dung mới
        if body.content_json and body.content_json.strip():
            _cleanup_orphaned_attachments(conn, note_id, body.content_json)
            conn.commit()
        note = conn.execute("SELECT * FROM notes WHERE id=?", [note_id]).fetchone()
    finally:
        conn.close()
    logger.info("[update_note] id=%d fields=%s", note_id, [f.split("=")[0] for f in fields])
    schedule_rebuild()  # Fix #4
    return {"success": True, "data": dict(note)}


@router.delete("/{note_id}")
def delete_note(note_id: int):
    conn = get_connection()
    try:
        if not conn.execute("SELECT id FROM notes WHERE id=?", [note_id]).fetchone():
            _404(note_id)

        # 1. Xóa file trên disk
        attachments = conn.execute(
            "SELECT file_path FROM note_attachments WHERE note_id=?", [note_id]
        ).fetchall()
        for att in attachments:
            try:
                if att["file_path"] and os.path.exists(att["file_path"]):
                    os.remove(att["file_path"])
            except OSError as e:
                logger.warning("[delete_note] cant remove file %s: %s", att["file_path"], e)

        # 2. Manual cascade delete
        conn.execute("PRAGMA foreign_keys = OFF")
        try:
            conn.execute("DELETE FROM note_attachments WHERE note_id=?", [note_id])
            conn.execute("DELETE FROM extracted_info   WHERE note_id=?", [note_id])
            conn.execute("DELETE FROM reminders        WHERE note_id=?", [note_id])
            conn.execute("DELETE FROM note_tags        WHERE note_id=?", [note_id])
            conn.execute("DELETE FROM notes            WHERE id=?",      [note_id])
            conn.commit()
            logger.info("[delete_note] id=%d ok", note_id)
        except Exception as e:
            conn.rollback()
            logger.error("[delete_note] ERROR: %s", e)
            raise HTTPException(500, f"Delete failed: {e}")
        finally:
            conn.execute("PRAGMA foreign_keys = ON")
    finally:
        conn.close()

    # Fix #7: xóa vectors khỏi Chroma ngay lập tức (không cần rebuild)
    delete_note_from_index(note_id)

    return {"success": True, "message": f"Deleted note {note_id}"}


