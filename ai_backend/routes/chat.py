"""
routes/chat.py — Global Chat endpoints
POST /chat                  → gửi câu hỏi, nhận trả lời AI (lưu vào DB)
GET  /chat/history          → lấy lịch sử chat
DELETE /chat/history        → xóa toàn bộ lịch sử
"""

import asyncio

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from database import get_connection

router = APIRouter()


class ChatRequest(BaseModel):
    question: str


@router.post("")
async def chat(req: ChatRequest):
    question = req.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="question không được để trống")

    # Lấy lịch sử gần nhất để truyền vào LLM (tối đa 10 turn = 20 messages)
    conn = get_connection()
    try:
        history_rows = conn.execute(
            "SELECT role, content FROM chat_messages ORDER BY created_at DESC LIMIT 20"
        ).fetchall()
    finally:
        conn.close()

    # Đảo ngược để chronological order, loại message cuối (chưa có answer)
    history = [{"role": r["role"], "content": r["content"]} for r in reversed(history_rows)]

    try:
        from services.rag import rag_chat
        loop = asyncio.get_running_loop()
        answer = await loop.run_in_executor(None, rag_chat, question, history)
        # Chỉ lưu vào DB khi LLM thành công — tránh persist error message vào history
        conn = get_connection()
        try:
            conn.execute(
                "INSERT INTO chat_messages (role, content) VALUES (?, ?)",
                ["user", question],
            )
            conn.execute(
                "INSERT INTO chat_messages (role, content) VALUES (?, ?)",
                ["assistant", answer],
            )
            conn.commit()
        finally:
            conn.close()
    except Exception as e:
        answer = f"Lỗi xử lý: {str(e)}"

    return {"success": True, "answer": answer, "question": question}


@router.get("/history")
def get_chat_history(limit: int = Query(default=50, le=200)):
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT id, role, content, created_at FROM chat_messages "
            "ORDER BY created_at ASC LIMIT ?",
            [limit],
        ).fetchall()
    finally:
        conn.close()
    return {"success": True, "data": [dict(r) for r in rows], "count": len(rows)}


@router.delete("/history")
def clear_chat_history():
    conn = get_connection()
    try:
        conn.execute("DELETE FROM chat_messages")
        conn.commit()
    finally:
        conn.close()
    return {"success": True, "message": "Lịch sử chat đã được xóa"}
