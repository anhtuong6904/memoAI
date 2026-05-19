"""
routes/note_chat.py — Per-note RAG Chat

POST /notes/{note_id}/chat
  - Chỉ đọc nội dung note đó: title, content (TipTap JSON), extracted attachments
  - Không đọc các note khác
"""

import asyncio
import re as _re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from database import get_connection
from services.tiptap import extract_plain_text
from services.ollama import rag_chat_with_note

router = APIRouter()


class NoteChatRequest(BaseModel):
    message: str
    history: list[dict] = []


@router.post("/notes/{note_id}/chat")
async def note_chat(note_id: int, body: NoteChatRequest):
    if not body.message.strip():
        raise HTTPException(400, "Câu hỏi không được để trống")

    conn = get_connection()
    try:
        note = conn.execute("SELECT * FROM notes WHERE id=?", [note_id]).fetchone()
        if not note:
            raise HTTPException(404, f"Note {note_id} not found")

        att_rows = conn.execute(
            """SELECT file_name, file_group, extracted_text
               FROM note_attachments
               WHERE note_id = ? AND extracted_text IS NOT NULL AND extracted_text != ''
               ORDER BY created_at""",
            [note_id],
        ).fetchall()
        attachments = [dict(r) for r in att_rows]
    finally:
        conn.close()

    # Plain text từ content_json (HTML hoặc TipTap JSON) hoặc plain content
    note_text = ""
    if note["content_json"]:
        raw = note["content_json"]
        if raw.lstrip().startswith("<"):
            note_text = _re.sub(r'<[^>]+>', ' ', raw)
            note_text = _re.sub(r'\s+', ' ', note_text).strip()
        else:
            try:
                note_text = extract_plain_text(raw)
            except Exception:
                note_text = note["content"] or ""
    else:
        note_text = note["content"] or ""

    # Nối extracted_text của attachments (ảnh/audio/document) vào context
    if attachments:
        label_map = {"image": "Ảnh", "audio": "Ghi âm", "video": "Video", "document": "Tài liệu"}
        att_parts = [
            f"[{label_map.get(a['file_group'], 'File')}: {a['file_name']}]\n{a['extracted_text']}"
            for a in attachments
        ]
        sep = "\n\n"
        note_text = (note_text + sep + sep.join(att_parts)) if note_text else sep.join(att_parts)

    try:
        loop = asyncio.get_running_loop()
        answer = await loop.run_in_executor(
            None,
            lambda: rag_chat_with_note(
                message=body.message,
                title=note["title"],
                content=note_text,
                related_notes=None,
                history=body.history,
            ),
        )
        return {"success": True, "answer": answer, "note_id": note_id}
    except Exception as e:
        raise HTTPException(500, f"AI error: {e}")
