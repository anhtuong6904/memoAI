"""
routes/analyze.py

Fixes applied:
  #1  Async Phase 1 — image/audio/document extraction chạy song song
  #2  extract_from_image dùng 1 LLM call (llava ra JSON trực tiếp)
  #3  Validate event_time / deadline trước khi insert DB
"""

import asyncio
import base64
import json
import logging
import os
import re as _re
from datetime import datetime
from fastapi import APIRouter, HTTPException
from database import get_connection
from services.ollama import extract_from_text, extract_from_image
from services.tiptap import extract_plain_text
from services.rag import schedule_rebuild

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Fix #3: Validate datetime strings từ LLM ──────────────────────────────────

def _parse_datetime(val) -> str | None:
    """Validate ISO 8601. Trả về val nếu hợp lệ, None nếu sai format."""
    if not val:
        return None
    try:
        datetime.fromisoformat(str(val))
        return str(val)
    except (ValueError, TypeError):
        logger.warning("[analyze] invalid datetime discarded: %r", val)
        return None


_UPLOADS_ROOT = os.path.realpath(os.path.join(os.path.dirname(__file__), "..", "uploads"))


def _resolve_path(stored: str) -> str | None:
    """Resolve stored path → absolute path.
    Rejects paths that escape the uploads/ directory (path traversal guard)."""
    candidates = [
        stored,
        stored.replace("/", os.sep),
        stored.replace("\\", "/"),
    ]
    for p in candidates:
        try:
            real = os.path.realpath(p)
        except Exception:
            continue
        # Block paths that escape uploads/ root
        if not real.startswith(_UPLOADS_ROOT):
            logger.warning("[analyze] path traversal blocked: %r → %r", stored, real)
            continue
        if os.path.exists(real):
            return real
    return None


def _upsert(conn, note_id, data, now) -> dict | None:
    """Lưu extracted_info, cập nhật note. Trả về reminder dict nếu được tạo/cập nhật."""
    data["event_time"] = _parse_datetime(data.get("event_time"))
    data["deadline"]   = _parse_datetime(data.get("deadline"))

    action_items = json.dumps(data.get("action_items", []), ensure_ascii=False)
    tags_json    = json.dumps(data.get("tags", []),         ensure_ascii=False)

    conn.execute(
        "INSERT OR REPLACE INTO extracted_info "
        "(note_id,person_name,phone,email,organization,place_name,address,"
        "event_title,event_time,deadline,category,action_items,"
        "reminder_needed,raw_json,created_at) "
        "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [note_id,
         data.get("person_name"), data.get("phone"),
         data.get("email"),       data.get("organization"),
         data.get("place_name"),  data.get("address"),
         data.get("event_title"), data.get("event_time"),
         data.get("deadline"),    data.get("category", "note"),
         action_items, 1 if data.get("reminder_needed") else 0,
         json.dumps(data, ensure_ascii=False), now],
    )
    conn.execute(
        "UPDATE notes SET tags=?, summary=?, ai_processed=1, updated_at=? WHERE id=?",
        [tags_json, data.get("summary"), now, note_id],
    )

    reminder: dict | None = None
    if data.get("reminder_needed") and data.get("event_time"):
        title = data.get("event_title") or data.get("title") or "MemoAI reminder"
        ex = conn.execute(
            "SELECT id FROM reminders WHERE note_id=?", [note_id]
        ).fetchone()
        if ex:
            # Cập nhật reminder hiện có (re-analyze → event_time mới)
            conn.execute(
                "UPDATE reminders SET title=?, remind_at=?, is_done=0 WHERE id=?",
                [title, data["event_time"], ex["id"]],
            )
        else:
            conn.execute(
                "INSERT INTO reminders (note_id,title,remind_at,created_at) "
                "VALUES (?,?,?,?)",
                [note_id, title, data["event_time"], now],
            )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM reminders WHERE note_id=? ORDER BY id DESC LIMIT 1", [note_id]
        ).fetchone()
        if row:
            reminder = dict(row)
    conn.commit()
    return reminder


# ── Fix #1: Async attachment processors ───────────────────────────────────────

async def _process_image(att: dict) -> tuple[str, str | None]:
    """Trả về (att_id, extracted_text | None)."""
    fpath = _resolve_path(att["file_path"])
    if not fpath:
        logger.warning("[analyze] image not found: %s", att["file_path"])
        return att["id"], None
    try:
        loop = asyncio.get_running_loop()
        # Fix #2: extract_from_image giờ gọi 1 LLM (xem ollama.py)
        def _read_and_extract():
            with open(fpath, "rb") as f:
                b64 = base64.b64encode(f.read()).decode()
            return extract_from_image(b64)

        res = await loop.run_in_executor(None, _read_and_extract)
        text = res.get("extracted_text", "")
        return att["id"], text or None
    except Exception as e:
        logger.warning("[analyze] image err %s: %s", att["file_name"], e)
        return att["id"], None


async def _process_audio(att: dict) -> tuple[str, str | None]:
    fpath = _resolve_path(att["file_path"])
    if not fpath:
        return att["id"], None
    try:
        loop = asyncio.get_running_loop()

        def _transcribe():
            from services.whisper import transcribe_audio
            with open(fpath, "rb") as f:
                audio = f.read()
            return transcribe_audio(audio, att["file_name"])

        tx = await loop.run_in_executor(None, _transcribe)
        return att["id"], tx.strip() or None
    except Exception as e:
        logger.warning("[analyze] audio err %s: %s", att["file_name"], e)
        return att["id"], None


async def _process_document(att: dict) -> tuple[str, str | None]:
    fpath = _resolve_path(att["file_path"])
    if not fpath:
        return att["id"], None
    try:
        loop = asyncio.get_running_loop()

        def _extract():
            from services.file_extract import extract_text
            return extract_text(fpath, att["mime_type"] or "")

        txt = await loop.run_in_executor(None, _extract)
        return att["id"], txt.strip() or None
    except Exception as e:
        logger.warning("[analyze] document err %s: %s", att["file_name"], e)
        return att["id"], None


@router.post("/notes/{note_id}/analyze")
async def analyze_note(note_id: int):
    conn = get_connection()
    try:
        note = conn.execute("SELECT * FROM notes WHERE id=?", [note_id]).fetchone()
        if not note:
            raise HTTPException(404, f"Note {note_id} not found")
        attachments = conn.execute(
            "SELECT * FROM note_attachments WHERE note_id=? ORDER BY created_at",
            [note_id],
        ).fetchall()
    finally:
        conn.close()

    now   = datetime.now().isoformat()
    parts = []

    # 1. Title
    if note["title"] and note["title"].strip():
        parts.append(f"Tieu de: {note['title']}")

    # 2. Plain text — lọc bỏ placeholder ảnh/video/audio vì chúng được xử lý riêng
    plain = ""
    if note["content_json"]:
        raw = note["content_json"]
        if raw.lstrip().startswith("<"):
            # HTML content từ pell-rich-editor
            plain = _re.sub(r'<[^>]+>', ' ', raw)
            plain = _re.sub(r'\s+', ' ', plain).strip()
        else:
            try:
                plain = extract_plain_text(raw)
            except Exception as e:
                logger.warning("[analyze] tiptap parse err: %s", e)
    if not plain.strip() and note["content"]:
        plain = note["content"]
    # Xóa markers [Hình ảnh], [Video], [Âm thanh], [File đính kèm] khỏi plain text
    plain = _re.sub(r'\[(Hình ảnh|Video|Âm thanh|File đính kèm)[^\]]*\]\s*', '', plain).strip()
    if plain:
        parts.append(f"Noi dung: {plain}")

    # 3. Tags
    if note["tags"] and note["tags"] != "[]":
        try:
            tags = json.loads(note["tags"])
            if tags:
                parts.append(f"Tags: {', '.join(tags)}")
        except Exception:
            pass

    # ── Phase 1: xử lý attachments ───────────────────────────────────────────
    # Dùng cached extracted_text chỉ khi note đã được analyze thành công trước đó
    # (ai_processed=1). Nếu ai_processed=0 → re-process để overwrite data cũ sai.
    use_cache = note["ai_processed"] == 1
    att_extracts: dict[int, str] = {}
    needs_processing = []

    for a in attachments:
        cached = (a["extracted_text"] or "").strip()
        if use_cache and cached:
            att_extracts[a["id"]] = cached
            logger.info("[analyze] att %s: cache hit (%d chars)", a["file_name"], len(cached))
        else:
            needs_processing.append(dict(a))

    images    = [a for a in needs_processing if a["file_group"] == "image"]
    audios    = [a for a in needs_processing if a["file_group"] == "audio"]
    documents = [a for a in needs_processing if a["file_group"] == "document"]

    tasks = (
        [_process_image(a)    for a in images] +
        [_process_audio(a)    for a in audios] +
        [_process_document(a) for a in documents]
    )

    if tasks:
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for r in results:
            if isinstance(r, Exception):
                logger.warning("[analyze] task exception: %s", r)
                continue
            att_id, text = r
            if text:
                att_extracts[att_id] = text

    # Gán label và thêm vào parts
    att_map = {a["id"]: dict(a) for a in attachments}
    for att_id, text in att_extracts.items():
        att = att_map.get(att_id, {})
        grp  = att.get("file_group", "document")
        name = att.get("file_name", "")
        if grp == "image":
            parts.append(f"[Anh {name}]: {text}")
        elif grp == "audio":
            parts.append(f"[Ghi am]: {text}")
        else:
            parts.append(f"[{name}]: {text}")

    # ── Phase 2: 1 LLM call duy nhất ─────────────────────────────────────────
    combined_text = "\n\n".join(parts)
    logger.debug("[analyze] note %d input length: %d", note_id, len(combined_text))

    if len(combined_text.strip()) < 5:
        raise HTTPException(
            400,
            "Ghi chu qua ngan de phan tich. Hay them tieu de hoac noi dung."
        )

    try:
        result = extract_from_text(combined_text)
    except Exception as e:
        logger.error("[analyze] LLM err: %s", e)
        raise HTTPException(500, f"Loi AI: {e}")

    final = {k: v for k, v in result.items() if v}

    # ── Phase 3: Persist ──────────────────────────────────────────────────────
    conn = get_connection()
    try:
        reminder = _upsert(conn, note_id, final, now)
        for att_id, txt in att_extracts.items():
            conn.execute(
                "UPDATE note_attachments SET extracted_text=? WHERE id=?",
                [txt, att_id],
            )
        conn.commit()
    finally:
        conn.close()

    logger.info("[analyze] done. category=%s reminder=%s", final.get("category"), bool(reminder))

    schedule_rebuild(delay=3.0)

    return {"success": True, "note_id": note_id, "extracted": final, "reminder": reminder}