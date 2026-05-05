# routes/capture.py

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional
from datetime import datetime
import base64
import json
import os

from database import get_connection
from services.ollama import extract_from_text, extract_from_image

router = APIRouter()

def _build_context(note_type: str, file_path: Optional[str], location: Optional[str], extra: dict | None = None) -> dict:
    return {
        "note_type": note_type,
        "file_path": file_path,
        "location": location,
        **(extra or {}),
    }

def _load_existing_note_text(note_id: Optional[int]) -> str:
    if not note_id:
        return ""
    conn = get_connection()
    note = conn.execute("SELECT content FROM notes WHERE id = ?", [note_id]).fetchone()
    conn.close()
    if not note:
        return ""
    return (note["content"] or "").strip()


def _merge_note_content(existing_text: str, new_text: str, source_label: str) -> str:
    new_text = (new_text or "").strip()
    if not existing_text:
        return new_text
    if not new_text:
        return existing_text
    return f"{existing_text}\n\n[{source_label}]\n{new_text}"


def _extract_text_from_file_bytes(file_bytes: bytes, filename: str | None) -> str:
    name = filename or "attachment"
    lower = name.lower()
    if lower.endswith((".txt", ".md", ".csv", ".json", ".log", ".xml", ".yaml", ".yml")):
        try:
            return file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            return file_bytes.decode("latin-1", errors="ignore")
    if lower.endswith(".pdf"):
        try:
            from pypdf import PdfReader
            import io
            reader = PdfReader(io.BytesIO(file_bytes))
            pages = [p.extract_text() or "" for p in reader.pages]
            return "\n".join(pages).strip()
        except Exception:
            return ""
    return ""




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
        existing_text = _load_existing_note_text(note_id)
        combined_content = _merge_note_content(existing_text, text, "Manual text")
        extracted = extract_from_text(
            combined_content,
            context=_build_context("text", None, location),
        )
        note      = save_or_update_db(
            content=combined_content,
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

        uploads_dir = "uploads"
        os.makedirs(uploads_dir, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename  = f"{timestamp}_{file.filename}"
        file_path = f"{uploads_dir}/{filename}"
        with open(file_path, "wb") as f:
            f.write(image_bytes)

        extracted = extract_from_image(image_b64)
        image_text = extracted.get("extracted_text") or extracted.get("summary") or ""
        existing_text = _load_existing_note_text(note_id)
        combined_content = _merge_note_content(existing_text, image_text, f"Image filename: {file.filename}")
        combined_input = f"{combined_content}\n\n[Image filename: {file.filename}]"
        final_extracted = extract_from_text(
            combined_input,
            context=_build_context(
                "image",
                file_path,
                location,
                extra={"image_extracted": extracted}
            ),
        )
        note = save_or_update_db(
            content=combined_content,
            note_type="image",
            extracted=final_extracted,
            note_id=note_id,
            file_path=file_path,
            location=location,
        )
        return {"success": True, "data": note, "extracted": final_extracted}
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

        # Bước 1: Lưu file audio + Whisper STT
        audio_bytes = await file.read()
        
        import os
        os.makedirs("uploads/audio", exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_name = file.filename or "voice.m4a"
        audio_path = f"uploads/audio/{timestamp}_{safe_name}"
        with open(audio_path, "wb") as f:
            f.write(audio_bytes)
            
        transcript  = transcribe_audio(audio_bytes, file.filename)
        if not transcript.strip():
            raise HTTPException(status_code=400, detail="Không nhận diện được giọng nói")

        existing_text = _load_existing_note_text(note_id)
        combined_content = _merge_note_content(existing_text, transcript, f"Voice transcript: {file.filename}")
        extracted = extract_from_text(
            combined_content,
            context=_build_context("voice", None, location),
        )
        note      = save_or_update_db(
            content=combined_content,
            note_type="voice",
            extracted=extracted,
            file_path=audio_path,
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
    
@router.post("/file")
async def capture_file(
    file: UploadFile = File(...),
    note_id: Optional[int] = Form(None),
    location: Optional[str] = Form(None),
):
    try:
        file_bytes = await file.read()
        os.makedirs("uploads/files", exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_name = file.filename or "attachment.bin"
        file_path = f"uploads/files/{timestamp}_{safe_name}"
        with open(file_path, "wb") as f:
            f.write(file_bytes)

        extracted_text = _extract_text_from_file_bytes(file_bytes, safe_name)
        if not extracted_text.strip():
            extracted_text = f"File đính kèm: {safe_name}"

        existing_text = _load_existing_note_text(note_id)
        combined_content = _merge_note_content(existing_text, extracted_text, f"Attachment: {safe_name}")

        extracted = extract_from_text(
            combined_content,
            context=_build_context("file", file_path, location, extra={"filename": safe_name}),
        )

        note = save_or_update_db(
            content=combined_content,
            note_type="file",
            extracted=extracted,
            file_path=file_path,
            note_id=note_id,
            location=location,
        )
        return {"success": True, "data": note, "extracted": extracted}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reanalyze/{note_id}")
def reanalyze_note(note_id: int):
    """Re-run AI extraction using BOTH note content and attachment-derived text."""
    conn = get_connection()
    note = conn.execute("SELECT * FROM notes WHERE id = ?", [note_id]).fetchone()
    if not note:
        conn.close()
        raise HTTPException(status_code=404, detail="Note không tồn tại")

    note = dict(note)
    attachment_text = ""

    try:
        if note.get("type") == "image" and note.get("file_path"):
            with open(note["file_path"], "rb") as f:
                image_b64 = base64.b64encode(f.read()).decode("utf-8")
            image_extracted = extract_from_image(image_b64)
            attachment_text = image_extracted.get("extracted_text") or image_extracted.get("summary") or ""

        elif note.get("type") == "voice" and note.get("file_path"):
            from services.whisper import transcribe_audio
            with open(note["file_path"], "rb") as f:
                audio_bytes = f.read()
            attachment_text = transcribe_audio(audio_bytes, note["file_path"])

        combined_text = (note.get("content") or "").strip()
        if attachment_text.strip():
            combined_text += f"\n\n[Attachment extracted]\n{attachment_text.strip()}"

        extracted = extract_from_text(
            combined_text or " ",
            context=_build_context(
                note.get("type") or "text",
                note.get("file_path"),
                note.get("location"),
                extra={"note_id": note_id},
            ),
        )

        now = datetime.now().isoformat()
        action_items = json.dumps(extracted.get("action_items", []), ensure_ascii=False)
        conn.execute(
            """UPDATE notes SET title=?, summary=?, tags=?, ai_processed=1, updated_at=? WHERE id=?""",
            [
                extracted.get("title") or note.get("title"),
                extracted.get("summary"),
                json.dumps(extracted.get("tags", []), ensure_ascii=False),
                now,
                note_id,
            ],
        )
        conn.execute("DELETE FROM extracted_info WHERE note_id = ?", [note_id])
        conn.execute(
            """INSERT INTO extracted_info
               (note_id, person_name, phone, email, organization,
                place_name, address, event_title, event_time, deadline,
                category, action_items, reminder_needed, raw_json, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            [
                note_id,
                extracted.get("person_name"), extracted.get("phone"), extracted.get("email"), extracted.get("organization"),
                extracted.get("place_name"), extracted.get("address"), extracted.get("event_title"), extracted.get("event_time"),
                extracted.get("deadline"), extracted.get("category", "note"), action_items,
                1 if extracted.get("reminder_needed") else 0, json.dumps(extracted, ensure_ascii=False), now,
            ],
        )
        conn.commit()
        updated = conn.execute("SELECT * FROM notes WHERE id = ?", [note_id]).fetchone()
        conn.close()
        return {"success": True, "data": dict(updated), "extracted": extracted, "combined_text": combined_text}
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))