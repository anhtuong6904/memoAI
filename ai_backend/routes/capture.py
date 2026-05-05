# routes/capture.py

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional
from datetime import datetime
import base64
import json

from database import get_connection
from services.ollama import extract_from_text, extract_from_image

router = APIRouter()


# ── Helper: Lưu hoặc UPDATE note + extracted_info vào DB ─────────────────────

def save_or_update_db(
    content:   str,
    note_type: str,
    extracted: dict,
    note_id:   Optional[int] = None,   # <-- nếu có → UPDATE
    file_path: Optional[str] = None,
    location:  Optional[str] = None,
) -> dict:
    conn = get_connection()
    now  = datetime.now().isoformat()
    tags_json   = json.dumps(extracted.get("tags", []), ensure_ascii=False)
    action_items = json.dumps(extracted.get("action_items", []), ensure_ascii=False)

    if note_id:
        # ── UPDATE mode ───────────────────────────────────────────────────────
        existing = conn.execute("SELECT id FROM notes WHERE id = ?", [note_id]).fetchone()
        if not existing:
            conn.close()
            raise HTTPException(status_code=404, detail=f"Note {note_id} không tồn tại")

        conn.execute(
            """UPDATE notes SET
               title=?, content=?, summary=?, type=?, file_path=?,
               tags=?, location=?, ai_processed=1, updated_at=?
               WHERE id=?""",
            [
                extracted.get("title"),
                content,
                extracted.get("summary"),
                note_type,
                file_path,
                tags_json,
                location,
                now,
                note_id,
            ]
        )
        conn.commit()

        # Xóa extracted_info cũ rồi insert lại (đơn giản hơn partial update)
        conn.execute("DELETE FROM extracted_info WHERE note_id = ?", [note_id])
        conn.commit()

    else:
        # ── INSERT mode ───────────────────────────────────────────────────────
        cursor = conn.execute(
            """INSERT INTO notes
               (title, content, summary, type, file_path, tags, location,
                ai_processed, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)""",
            [
                extracted.get("title"),
                content,
                extracted.get("summary"),
                note_type,
                file_path,
                tags_json,
                location,
                now, now,
            ]
        )
        conn.commit()
        note_id = cursor.lastrowid

    # ── extracted_info (dùng chung cho cả INSERT và UPDATE) ───────────────────
    conn.execute(
        """INSERT INTO extracted_info
           (note_id, person_name, phone, email, organization,
            place_name, address, event_title, event_time, deadline,
            category, action_items, reminder_needed, raw_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        [
            note_id,
            extracted.get("person_name"),
            extracted.get("phone"),
            extracted.get("email"),
            extracted.get("organization"),
            extracted.get("place_name"),
            extracted.get("address"),
            extracted.get("event_title"),
            extracted.get("event_time"),
            extracted.get("deadline"),
            extracted.get("category", "note"),
            action_items,
            1 if extracted.get("reminder_needed") else 0,
            json.dumps(extracted, ensure_ascii=False),
            now,
        ]
    )
    conn.commit()

    # ── Reminder (xóa cũ nếu update, tạo mới nếu cần) ────────────────────────
    conn.execute("DELETE FROM reminders WHERE note_id = ?", [note_id])
    conn.commit()
    if extracted.get("reminder_needed") and extracted.get("event_time"):
        reminder_title = (
            extracted.get("event_title")
            or extracted.get("title")
            or "Nhắc nhở từ MemoAI"
        )
        conn.execute(
            """INSERT INTO reminders (note_id, title, remind_at, created_at)
               VALUES (?, ?, ?, ?)""",
            [note_id, reminder_title, extracted["event_time"], now]
        )
        conn.commit()

    # ── Tags (xóa note_tags cũ, insert lại) ──────────────────────────────────
    conn.execute("DELETE FROM note_tags WHERE note_id = ?", [note_id])
    conn.commit()
    for tag_name in extracted.get("tags", []):
        tag_name = tag_name.strip().lower()
        if not tag_name:
            continue
        conn.execute(
            "INSERT OR IGNORE INTO tags (name, created_at) VALUES (?, ?)",
            [tag_name, now]
        )
        conn.commit()
        tag = conn.execute("SELECT id FROM tags WHERE name = ?", [tag_name]).fetchone()
        if tag:
            conn.execute(
                "INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)",
                [note_id, tag["id"]]
            )
            conn.commit()

    note = conn.execute("SELECT * FROM notes WHERE id = ?", [note_id]).fetchone()
    conn.close()
    return dict(note)


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/text")
async def capture_text(
    text:     str           = Form(...),
    note_id:  Optional[int] = Form(None),   
    location: Optional[str] = Form(None),
):
    try:
        extracted = extract_from_text(text)
        note      = save_or_update_db(
            content=text,
            note_type="text",
            extracted=extracted,
            note_id=note_id,
            location=location,
        )
        return {"success": True, "data": note, "extracted": extracted}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/image")
async def capture_image(
    file:     UploadFile    = File(...),
    note_id:  Optional[int] = Form(None),   # <-- thêm
    location: Optional[str] = Form(None),
):
    try:
        image_bytes = await file.read()
        image_b64   = base64.b64encode(image_bytes).decode("utf-8")

        import os
        uploads_dir = "uploads"
        os.makedirs(uploads_dir, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename  = f"{timestamp}_{file.filename}"
        file_path = f"{uploads_dir}/{filename}"
        with open(file_path, "wb") as f:
            f.write(image_bytes)

        extracted = extract_from_image(image_b64)
        content   = extracted.get("extracted_text") or extracted.get("summary") or ""

        note = save_or_update_db(
            content=content,
            note_type="image",
            extracted=extracted,
            note_id=note_id,
            file_path=file_path,
            location=location,
        )
        return {"success": True, "data": note, "extracted": extracted}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/voice")
async def capture_voice(
    file:     UploadFile    = File(...),
    note_id:  Optional[int] = Form(None),   # <-- thêm
    location: Optional[str] = Form(None),
):
    try:
        from services.whisper import transcribe_audio

        audio_bytes = await file.read()
        transcript  = transcribe_audio(audio_bytes, file.filename)

        if not transcript.strip():
            raise HTTPException(status_code=400, detail="Không nhận diện được giọng nói")

        extracted = extract_from_text(transcript)
        note      = save_or_update_db(
            content=transcript,
            note_type="voice",
            extracted=extracted,
            note_id=note_id,
            location=location,
        )
        return {
            "success":    True,
            "data":       note,
            "transcript": transcript,
            "extracted":  extracted,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))