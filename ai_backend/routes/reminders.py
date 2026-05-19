from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator

from database import get_connection

router = APIRouter()


class ReminderCreate(BaseModel):
    note_id:     Optional[int] = None
    title:       str
    body:        Optional[str] = None
    remind_at:   str
    repeat_type: Optional[str] = None

    @field_validator("remind_at")
    @classmethod
    def remind_at_must_be_iso8601(cls, v: str) -> str:
        try:
            datetime.fromisoformat(v)
            return v
        except ValueError:
            raise ValueError("remind_at phải là ISO 8601 (vd: 2026-05-15T09:00:00)")


@router.get("")
def get_reminders(include_done: bool = False):
    conn  = get_connection()
    query = (
        "SELECT r.*, n.title as note_title FROM reminders r "
        "LEFT JOIN notes n ON r.note_id = n.id"
    )
    if not include_done:
        query += " WHERE r.is_done = 0"
    query += " ORDER BY r.remind_at ASC"
    try:
        reminders = conn.execute(query).fetchall()
    finally:
        conn.close()
    return {
        "success": True,
        "data":    [dict(r) for r in reminders],
        "count":   len(reminders),
    }


@router.put("/{reminder_id}/done")
def mark_done(reminder_id: int):
    conn = get_connection()
    try:
        existing = conn.execute(
            "SELECT id FROM reminders WHERE id=?", [reminder_id]
        ).fetchone()
        if not existing:
            raise HTTPException(404, f"Reminder {reminder_id} not found")
        conn.execute("UPDATE reminders SET is_done=1 WHERE id=?", [reminder_id])
        conn.commit()
    finally:
        conn.close()
    return {"success": True, "message": f"Reminder {reminder_id} done"}


@router.post("")
def create_reminder(body: ReminderCreate):
    conn = get_connection()
    now  = datetime.now().isoformat()
    try:
        cur = conn.execute(
            "INSERT INTO reminders (note_id, title, body, remind_at, repeat_type, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            [body.note_id, body.title, body.body, body.remind_at, body.repeat_type, now],
        )
        conn.commit()
        reminder = conn.execute("SELECT * FROM reminders WHERE id=?", [cur.lastrowid]).fetchone()
    finally:
        conn.close()
    return {"success": True, "data": dict(reminder)}


@router.delete("/{reminder_id}")
def delete_reminder(reminder_id: int):
    conn = get_connection()
    try:
        existing = conn.execute(
            "SELECT id FROM reminders WHERE id=?", [reminder_id]
        ).fetchone()
        if not existing:
            raise HTTPException(404, f"Reminder {reminder_id} not found")
        conn.execute("DELETE FROM reminders WHERE id=?", [reminder_id])
        conn.commit()
    finally:
        conn.close()
    return {"success": True, "message": f"Reminder {reminder_id} deleted"}