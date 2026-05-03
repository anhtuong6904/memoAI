"""
routes/capture.py — AI Pipeline (Core của đề thầy)
POST /capture/image → ảnh → llava → note mới
POST /capture/voice → audio → Whisper → mistral → note mới
POST /capture/text  → text → mistral → note mới
"""

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional
from datetime import datetime
import base64
import json

from database import get_connection
from services.ollama import extract_from_text, extract_from_image

router = APIRouter()


# ── Helper: Lưu note + extracted_info vào DB ─────────────────────────────────

def save_to_db(
    content:   str,
    note_type: str,
    extracted: dict,
    file_path: Optional[str] = None,
    location:  Optional[str] = None,
) -> dict:
    """
    Lưu note gốc và thông tin AI trích xuất vào DB.
    Tự động tạo reminder nếu extracted['reminder_needed'] = True.
    
    Returns: dict của note vừa tạo
    """
    conn = get_connection()
    now  = datetime.now().isoformat()

    # ── 1. Tạo note trong bảng notes ─────────────────────────────────────────
    tags_json = json.dumps(extracted.get("tags", []), ensure_ascii=False)

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

    # ── 2. Lưu extracted_info ─────────────────────────────────────────────────
    action_items = json.dumps(extracted.get("action_items", []), ensure_ascii=False)

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
            json.dumps(extracted, ensure_ascii=False),  # raw backup
            now,
        ]
    )
    conn.commit()

    # ── 3. Tự động tạo reminder nếu cần ──────────────────────────────────────
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

    # ── 4. Tự động tạo tags trong bảng tags + note_tags ──────────────────────
    for tag_name in extracted.get("tags", []):
        tag_name = tag_name.strip().lower()
        if not tag_name:
            continue

        # Tạo tag nếu chưa có (INSERT OR IGNORE)
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

    # ── 5. Trả về note vừa tạo ───────────────────────────────────────────────
    note = conn.execute("SELECT * FROM notes WHERE id = ?", [note_id]).fetchone()
    conn.close()
    return dict(note)


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/text")
async def capture_text(
    text:     str           = Form(...),
    location: Optional[str] = Form(None),  # JSON: {"lat":..., "lng":..., "address":...}
):
    """
    Nhận text → mistral:7b trích xuất → lưu DB → trả về note.
    Đây là pipeline đơn giản nhất.
    """
    try:
        extracted = extract_from_text(text)
        note      = save_to_db(
            content=text,
            note_type="text",
            extracted=extracted,
            location=location,
        )
        return {
            "success":   True,
            "data":      note,
            "extracted": extracted,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/image")
async def capture_image(
    file:     UploadFile    = File(...),
    location: Optional[str] = Form(None),
):
    """
    Nhận ảnh → encode base64 → llava:7b đọc → trích xuất → lưu DB.
    """
    try:
        # Đọc ảnh và encode base64
        image_bytes = await file.read()
        image_b64   = base64.b64encode(image_bytes).decode("utf-8")

        # Lưu file ảnh local
        import os
        uploads_dir = "uploads"
        os.makedirs(uploads_dir, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename  = f"{timestamp}_{file.filename}"
        file_path = f"{uploads_dir}/{filename}"

        with open(file_path, "wb") as f:
            f.write(image_bytes)

        # Gọi llava để đọc ảnh
        extracted = extract_from_image(image_b64)

        # Content = text trích xuất từ ảnh
        content = extracted.get("extracted_text") or extracted.get("summary") or ""

        note = save_to_db(
            content=content,
            note_type="image",
            extracted=extracted,
            file_path=file_path,
            location=location,
        )
        return {
            "success":   True,
            "data":      note,
            "extracted": extracted,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/voice")
async def capture_voice(
    file:     UploadFile    = File(...),
    location: Optional[str] = Form(None),
):
    """
    Nhận audio → Whisper STT → text → mistral trích xuất → lưu DB.
    Pipeline: audio file → transcript → extracted info → note
    """
    try:
        from services.whisper import transcribe_audio

        # Bước 1: Whisper STT
        audio_bytes = await file.read()
        transcript  = transcribe_audio(audio_bytes, file.filename)

        if not transcript.strip():
            raise HTTPException(status_code=400, detail="Không nhận diện được giọng nói")

        # Bước 2: mistral trích xuất thông tin từ transcript
        extracted = extract_from_text(transcript)

        # Bước 3: Lưu vào DB
        note = save_to_db(
            content=transcript,     # Lưu transcript gốc làm content
            note_type="voice",
            extracted=extracted,
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