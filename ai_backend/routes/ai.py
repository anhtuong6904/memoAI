"""
routes/ai.py — AI Routes
POST /search → tìm kiếm semantic theo keyword
POST /chat   → hỏi AI về toàn bộ notes
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from database import get_connection
from services.ollama import chat_with_notes, search_notes_by_keyword

router = APIRouter()


# ── Request Models ────────────────────────────────────────────────────────────

class SearchRequest(BaseModel):
    keyword: str


class ChatRequest(BaseModel):
    question: str
    history:  list[dict] = []  # [{"role": "user"|"assistant", "content": "..."}]


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/search")
def search_notes(body: SearchRequest):
    """
    Tìm kiếm semantic — LLM hiểu ngữ nghĩa thay vì LIKE keyword.
    
    Ví dụ:
    - "số điện thoại" → tìm notes có phone number
    - "cuộc họp tuần tới" → tìm meeting notes
    - "địa chỉ quán ăn" → tìm location notes
    """
    if not body.keyword.strip():
        raise HTTPException(status_code=400, detail="Keyword không được để trống")

    conn  = get_connection()
    notes = conn.execute(
        "SELECT id, title, content, summary, type, tags FROM notes WHERE is_archived = 0"
    ).fetchall()
    conn.close()

    if not notes:
        return {"success": True, "data": [], "count": 0}

    notes_list = [dict(n) for n in notes]

    # LLM tìm notes liên quan
    relevant_ids = search_notes_by_keyword(body.keyword, notes_list)

    # Lấy full data của các notes liên quan theo thứ tự
    conn  = get_connection()
    result = []
    for note_id in relevant_ids:
        note = conn.execute("SELECT * FROM notes WHERE id = ?", [note_id]).fetchone()
        if note:
            result.append(dict(note))
    conn.close()

    return {
        "success": True,
        "data":    result,
        "count":   len(result),
        "keyword": body.keyword,
    }


@router.post("/chat")
def chat(body: ChatRequest):
    """
    Second Brain — user hỏi, AI trả lời dựa trên toàn bộ notes.
    
    Ví dụ câu hỏi:
    - "Số điện thoại của anh Minh là gì?"
    - "Tôi có cuộc họp nào sắp tới không?"
    - "Tóm tắt những gì tôi đã ghi chú tuần này"
    """
    if not body.question.strip():
        raise HTTPException(status_code=400, detail="Câu hỏi không được để trống")

    # Lấy tất cả notes (không archive)
    conn  = get_connection()
    notes = conn.execute(
        """SELECT n.*, e.person_name, e.phone, e.email,
                  e.event_title, e.event_time, e.category
           FROM notes n
           LEFT JOIN extracted_info e ON n.id = e.note_id
           WHERE n.is_archived = 0
           ORDER BY n.created_at DESC
           LIMIT 50"""   # Giới hạn 50 notes để tránh overflow context window
    ).fetchall()
    conn.close()

    notes_list = [dict(n) for n in notes]

    # Gọi LLM để trả lời
    answer = chat_with_notes(
        question=body.question,
        notes=notes_list,
        history=body.history,
    )

    return {
        "success":  True,
        "answer":   answer,
        "question": body.question,
    }