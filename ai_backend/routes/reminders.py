"""
routes/reminders.py — Reminder Routes
GET /reminders       → danh sách reminders
PUT /reminders/:id/done → đánh dấu hoàn thành
"""

from fastapi import APIRouter, HTTPException
from database import get_connection
from datetime import datetime

router = APIRouter()


@router.get("/")
def get_reminders(include_done: bool = False):
    """
    Lấy danh sách reminders, sắp xếp theo thời gian gần nhất.
    include_done=False → chỉ lấy chưa xong (mặc định)
    include_done=True  → lấy tất cả
    """
    conn  = get_connection()
    query = "SELECT r.*, n.title as note_title FROM reminders r LEFT JOIN notes n ON r.note_id = n.id"

    if not include_done:
        query += " WHERE r.is_done = 0"

    query += " ORDER BY r.remind_at ASC"

    reminders = conn.execute(query).fetchall()
    conn.close()

    return {
        "success": True,
        "data":    [dict(r) for r in reminders],
        "count":   len(reminders),
    }


@router.put("/{reminder_id}/done")
def mark_done(reminder_id: int):
    """Đánh dấu reminder là đã hoàn thành."""
    conn = get_connection()

    existing = conn.execute(
        "SELECT id FROM reminders WHERE id = ?", [reminder_id]
    ).fetchone()

    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail=f"Reminder {reminder_id} không tồn tại")

    conn.execute(
        "UPDATE reminders SET is_done = 1 WHERE id = ?", [reminder_id]
    )
    conn.commit()
    conn.close()

    return {"success": True, "message": f"Reminder {reminder_id} đã hoàn thành"}