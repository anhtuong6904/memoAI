"""
services/ollama.py — Ollama API wrapper

Fix #2: extract_from_image dùng 1 LLM call duy nhất.
        llava được prompt để trả về JSON trực tiếp, bỏ bước qwen3:8b thứ 2.
"""

import base64
import logging
import threading
import requests
import json
import re
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

import os as _os
OLLAMA_URL  = _os.getenv("OLLAMA_URL", "http://localhost:11434/api/generate")
_OLLAMA_BASE = OLLAMA_URL.rsplit("/api/", 1)[0]  # e.g. http://localhost:11434

_WEEKDAY_VI    = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"]
_WEEKDAY_SHORT = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]


def _now_context() -> str:
    now     = datetime.now()
    wd      = _WEEKDAY_VI[now.weekday()]
    monday  = now - timedelta(days=now.weekday())
    next_monday = monday + timedelta(weeks=1)
    lines = [
        f"Hom nay    : {now.strftime('%Y-%m-%d')} ({wd}, {now.strftime('%H:%M')})",
        f"Tuan nay   : {monday.strftime('%Y-%m-%d')} (T2) → {(monday+timedelta(days=6)).strftime('%Y-%m-%d')} (CN)",
        f"Tuan sau   : {next_monday.strftime('%Y-%m-%d')} (T2) → {(next_monday+timedelta(days=6)).strftime('%Y-%m-%d')} (CN)",
    ]
    thu_lines = []
    for i, name in enumerate(_WEEKDAY_SHORT):
        d = next_monday + timedelta(days=i)
        thu_lines.append(f"  {name} tuan sau = {d.strftime('%Y-%m-%d')}")
    return "\n".join(lines) + "\n" + "\n".join(thu_lines)


TEXT_MODEL   = "qwen3:8b"
VISION_MODEL = "qwen2.5vl:latest"

TEXT_TIMEOUT    = 300
VISION_TIMEOUT  = 300
VISION_MAX_SIDE = 768   # resize ảnh trước khi gửi vision model → giảm 4-10x thời gian

# Tắt vision model sau lần fail đầu tiên trong session (tránh gọi lặp khi model không khả dụng)
_vision_model_ok = True


def _probe_vision_model():
    """Kiểm tra qwen2.5vl có trong ollama khi khởi động. Chạy nền."""
    global _vision_model_ok
    try:
        r = requests.get(f"{_OLLAMA_BASE}/api/tags", timeout=10)
        if r.status_code == 200:
            names = [m["name"] for m in r.json().get("models", [])]
            prefix = VISION_MODEL.split(":")[0]
            if not any(m == VISION_MODEL or m.startswith(prefix + ":") for m in names):
                _vision_model_ok = False
                logger.info("[vision] %s not found in ollama → disabled", VISION_MODEL)
            else:
                logger.info("[vision] %s available", VISION_MODEL)
    except Exception as e:
        logger.debug("[vision] startup probe failed (ollama may not be running yet): %s", e)


threading.Thread(target=_probe_vision_model, daemon=True).start()

# ── EasyOCR lazy loader ────────────────────────────────────────────────────────

_ocr_reader      = None
_ocr_reader_lock = threading.Lock()


def _get_ocr_reader():
    """Lazy-load EasyOCR reader (tải model ~100 MB lần đầu)."""
    global _ocr_reader
    if _ocr_reader is None:
        with _ocr_reader_lock:
            if _ocr_reader is None:
                try:
                    # python-bidi 0.4.2 không expose get_display ở top-level;
                    # EasyOCR import sai → patch trước khi import easyocr
                    import bidi
                    if not hasattr(bidi, "get_display"):
                        from bidi.algorithm import get_display as _gd
                        bidi.get_display = _gd
                    import easyocr
                    _ocr_reader = easyocr.Reader(
                        ["vi", "en"],
                        gpu=_has_gpu(),
                        verbose=False,
                    )
                    logger.info("[OCR] EasyOCR reader loaded (vi+en)")
                except Exception as e:
                    logger.warning("[OCR] EasyOCR unavailable: %s", e)
                    _ocr_reader = False
    return _ocr_reader if _ocr_reader else None


def _has_gpu() -> bool:
    try:
        import torch
        return torch.cuda.is_available()
    except Exception:
        return False


def _resize_image_b64(image_b64: str, max_side: int = VISION_MAX_SIDE) -> str:
    """Resize ảnh về max_side px (cạnh dài nhất) trước khi gửi LLM.
    Giảm đáng kể thời gian inference mà không mất text quan trọng.
    """
    try:
        from PIL import Image
        import io
        img = Image.open(io.BytesIO(base64.b64decode(image_b64))).convert("RGB")
        w, h = img.size
        if max(w, h) <= max_side:
            return image_b64
        scale = max_side / max(w, h)
        new_w, new_h = int(w * scale), int(h * scale)
        img = img.resize((new_w, new_h), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=90)
        resized = base64.b64encode(buf.getvalue()).decode()
        logger.info("[vision] resized %dx%d → %dx%d (%.1f%%)",
                    w, h, new_w, new_h, 100 * len(resized) / len(image_b64))
        return resized
    except Exception as e:
        logger.warning("[vision] resize failed, using original: %s", e)
        return image_b64


def _ocr_image_b64(image_b64: str) -> str:
    """Đọc text từ ảnh base64 bằng EasyOCR."""
    from PIL import Image
    import io
    img_bytes = base64.b64decode(image_b64)
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")

    reader = _get_ocr_reader()
    if reader is not None:
        try:
            import numpy as np
            results = reader.readtext(np.array(img), detail=0, paragraph=True)
            text = "\n".join(r.strip() for r in results if r.strip())
            if text:
                logger.info("[OCR] easyocr: %d chars", len(text))
                return text
        except Exception as e:
            logger.warning("[OCR] easyocr readtext error: %s", e)

    return ""


# ── Prompts ────────────────────────────────────────────────────────────────────

TEXT_EXTRACT_PROMPT = """Ban la trinh trich xuat thong tin tu ghi chu cua nguoi Viet.
Doc text dau vao va tra ve DUY NHAT mot JSON object hop le.
KHONG kem giai thich, KHONG markdown, KHONG text thua, chi JSON.

=== THOI GIAN THAM CHIEU ===
{now_ctx}
============================

Quy tac tinh thoi gian tuong doi (QUAN TRONG):
- "hom nay"           → ngay hom nay o tren
- "ngay mai"          → ngay hom nay + 1
- "ngay kia"          → ngay hom nay + 2
- "tuan sau/toi"      → dung bang "Tuan sau" o tren
- "thu X tuan sau"    → dung dong "TX tuan sau = YYYY-MM-DD" o tren
- "cuoi tuan nay"     → chu nhat cua tuan hien tai
- "dau tuan sau"      → thu 2 tuan sau
- "thang sau/toi"     → thang hien tai + 1, giu nguyen ngay
- "sang/chieu/toi"    → sang=08:00, chieu=14:00, toi=19:00
- Neu chi co ngay, khong co gio → event_time dung 09:00:00, deadline dung 23:59:00
- Neu moi quan he thoi gian khong ro → null

Cau truc JSON (dung null neu khong tim thay):
{{
  "title":           "tieu de ngan gon (tieng Viet)",
  "summary":         "tom tat 1-2 cau (tieng Viet)",
  "person_name":     null,
  "phone":           null,
  "email":           null,
  "organization":    null,
  "place_name":      null,
  "address":         null,
  "event_title":     null,
  "event_time":      null,
  "deadline":        null,
  "category":        "contact | meeting | shopping | location | reminder | note",
  "action_items":    [],
  "reminder_needed": false,
  "tags":            []
}}

Quy tac:
- Khong suy doan thong tin khong co trong text
- Tieng Viet dung dau day du
- event_time va deadline phai la ISO 8601: YYYY-MM-DDTHH:MM:SS
- reminder_needed = true khi co thoi gian cu the hoac han chot

Dau vao:
{text}"""


IMAGE_DESCRIBE_PROMPT = """Read this image carefully. Your job is to extract ALL information visible.

1. Transcribe EVERY piece of text you can see, exactly as written:
   - Names, emails, phone numbers
   - Dates, deadlines, times (preserve exact format)
   - URLs and links
   - All sentences and paragraphs

2. Briefly describe what the image shows (UI screenshot, photo, document, etc.)

Format:
TEXT:
[all visible text here, line by line]

DESCRIPTION:
[one paragraph about the image content]"""


CHAT_PROMPT = """Ban la tro ly AI cua app ghi chu MemoAI. Tra loi nguoi dung dua tren ghi chu cua ho.
Luon tra loi bang tieng Viet, ngan gon, ro rang. Neu khong tim thay thong tin trong ghi chu,
hay noi ro la khong tim thay.

Ghi chu cua nguoi dung:
{notes}

Lich su tro chuyen:
{history}

Cau hoi: {question}

Tra loi:"""

NOTE_RAG_PROMPT = """Bạn là trợ lý AI của ứng dụng MemoAI, giúp người dùng làm việc với ghi chú của họ.

=== GHI CHÚ ĐANG XEM ===
Tiêu đề: {title}
Nội dung:
{content}
========================
{related}
Bạn có thể thực hiện bất kỳ tác vụ nào trên nội dung ghi chú:
- Tóm tắt, phân tích, giải thích, dịch, cải thiện văn bản
- Trả lời câu hỏi dựa trên thông tin trong ghi chú
- Trích xuất thông tin cụ thể (ngày, tên, địa điểm, v.v.)
- So sánh với ghi chú liên quan nếu có

Quy tắc:
- Trả lời bằng tiếng Việt, ngắn gọn, rõ ràng
- Chỉ dùng thông tin từ ghi chú, không bịa đặt thêm
- Khi được yêu cầu tóm tắt/phân tích/giải thích → thực hiện ngay, không từ chối
- Chỉ trả lời "Ghi chú không có thông tin này." khi hỏi một dữ liệu cụ thể thực sự không xuất hiện trong ghi chú (vd: hỏi số điện thoại nhưng ghi chú không có)
{history}
Yêu cầu: {question}

Trả lời:"""

SEARCH_PROMPT = """Ban la trinh tim kiem semantic. Cho mot tu khoa va danh sach ghi chu,
tim cac ghi chu lien quan nhat va sap xep theo do lien quan giam dan.
Tra ve DUY NHAT mot JSON array chua note IDs. Khong giai thich.
Vi du output: [3, 1, 5]

Tu khoa: {keyword}

Ghi chu:
{notes}"""


# ── Safe prompt builder ────────────────────────────────────────────────────────

def _fmt(template: str, **kwargs) -> str:
    """Replace {key} placeholders without invoking str.format() on user content.

    str.format() parses its receiver for field names — if user content ends up
    in the template string (or if a value contains unbalanced braces) it raises
    ValueError.  Using explicit str.replace() means user values are always
    treated as opaque strings, never as format directives.

    Handles {{ / }} escape sequences the same way str.format() does:
      {{ → {   }} → }   (processed AFTER placeholder substitution)
    """
    result = template
    for key, value in kwargs.items():
        result = result.replace("{" + key + "}", str(value))
    # Unescape literal-brace sequences used in prompt templates (e.g. JSON examples)
    return result.replace("{{", "{").replace("}}", "}")


# ── Core API call ──────────────────────────────────────────────────────────────

def _call(model, prompt, images=None, format_json=True, temperature=0.1,
          timeout=120, num_ctx=8192, think=None):
    payload = {
        "model":   model,
        "prompt":  prompt,
        "stream":  False,
        "options": {
            "temperature": temperature,
            "num_predict": 4096,
            "num_ctx":     num_ctx,
        },
    }
    # Tắt thinking mode cho qwen3 khi không cần (extraction, search)
    # think=False → nhanh hơn 3-10x; think=True → chất lượng cao hơn (chat)
    if think is not None:
        payload["think"] = think
    if format_json:
        payload["format"] = "json"
    if images:
        payload["images"] = images
    try:
        r = requests.post(OLLAMA_URL, json=payload, timeout=timeout)
        r.raise_for_status()
        return r.json()["response"]
    except requests.exceptions.ConnectionError:
        raise Exception("Khong ket noi duoc Ollama. Chay: ollama serve")
    except requests.exceptions.Timeout:
        raise Exception(f"Ollama timeout sau {timeout}s. Model dang load hoac qua tai.")
    except requests.exceptions.HTTPError as e:
        if e.response is not None:
            if e.response.status_code == 404:
                raise Exception(f"Model {model} chua co. Chay: ollama pull {model}")
            if e.response.status_code == 500:
                raise Exception(
                    f"Model {model} loi noi bo (500). "
                    "Co the chua pull hoac het VRAM. "
                    "Kiem tra: ollama ps && ollama pull " + model
                )
        raise Exception(f"Ollama error: {e}")
    except Exception as e:
        raise Exception(f"Ollama error: {e}")


def _safe_parse_json(raw: str) -> dict:
    """Parse JSON từ LLM output. Luôn trả về dict, raise nếu không thể."""
    raw = raw.strip()
    candidates = [raw]

    m = re.search(r"\{.*\}", raw, re.DOTALL)
    if m and m.group() != raw:
        candidates.append(m.group())

    if raw.startswith("{") and not raw.rstrip().endswith("}"):
        candidates.append(raw.rstrip().rstrip(",") + "}")

    if not raw.startswith("{"):
        candidates.append("{" + raw.rstrip(",") + "}")

    for c in candidates:
        try:
            result = json.loads(c)
            if isinstance(result, dict):
                return result
        except (json.JSONDecodeError, ValueError):
            pass
    raise Exception(f"JSON parse failed: {raw[:120]}")


# ── Public API ─────────────────────────────────────────────────────────────────

def extract_from_text(text: str) -> dict:
    """qwen3:8b trích xuất thông tin từ text tiếng Việt. think=False → nhanh."""
    prompt = _fmt(TEXT_EXTRACT_PROMPT, now_ctx=_now_context(), text=text)
    raw    = _call(TEXT_MODEL, prompt, timeout=TEXT_TIMEOUT, think=False)
    return _safe_parse_json(raw)


def extract_from_image(image_b64: str) -> dict:
    """Pipeline trích xuất ảnh:
      Step 1a: EasyOCR (nhanh, chính xác cho ảnh nhiều text)
      Step 1b: qwen2.5vl (fallback cho ảnh phức tạp / ít text, bỏ qua nếu model đã fail)
      Step 2 : qwen3:8b extract cấu trúc từ text đã đọc được
    """
    global _vision_model_ok

    # Step 1a: EasyOCR — nhanh, không tốn GPU LLM
    ocr_text = _ocr_image_b64(image_b64)
    if ocr_text and len(ocr_text.strip()) >= 5:
        logger.info("[extract_from_image] EasyOCR ok (%d chars) → qwen3 extract", len(ocr_text))
        try:
            result = extract_from_text(ocr_text)
            result["extracted_text"] = ocr_text
            return result
        except Exception as e:
            logger.warning("[extract_from_image] qwen3 after EasyOCR failed: %s", e)
            return {"extracted_text": ocr_text}

    # Step 1b: qwen2.5vl — skip nếu đã biết model không khả dụng trong session này
    if not _vision_model_ok:
        logger.info("[extract_from_image] qwen2.5vl skipped (unavailable this session)")
        return {"extracted_text": ocr_text} if ocr_text else {}

    logger.info("[extract_from_image] OCR short/empty → qwen2.5vl describe")
    vision_b64 = _resize_image_b64(image_b64)
    try:
        raw_desc = _call(
            VISION_MODEL,
            IMAGE_DESCRIBE_PROMPT,
            images=[vision_b64],
            format_json=False,
            timeout=VISION_TIMEOUT,
            num_ctx=16384,
        )
        description = raw_desc.strip()
        logger.info("[extract_from_image] qwen2.5vl described %d chars", len(description))
    except Exception as e:
        logger.warning("[extract_from_image] qwen2.5vl failed: %s", e)
        # Đánh dấu không dùng lại trong session này nếu lỗi 500 (model crash/VRAM)
        if "500" in str(e) or "loi noi bo" in str(e):
            _vision_model_ok = False
            logger.warning("[extract_from_image] qwen2.5vl disabled for this session")
        return {}

    if not description or len(description) < 10:
        return {}

    # Step 2: qwen3:8b trích xuất cấu trúc từ description của qwen2.5vl
    try:
        result = extract_from_text(description)
        result["extracted_text"] = description
        return result
    except Exception as e:
        logger.warning("[extract_from_image] qwen3 after qwen2.5vl failed: %s", e)
        return {"extracted_text": description}


def chat_with_notes(question: str, notes: list, history: list) -> str:
    notes_text = "\n\n".join([
        f"[Note {n['id']}] {n.get('title') or 'Khong co tieu de'}\n{n.get('content','')}"
        for n in notes
    ]) or "Chua co ghi chu nao"

    history_text = "\n".join([
        f"{h['role'].upper()}: {h['content']}"
        for h in history[-6:]
    ]) or "Day la tin nhan dau tien"

    prompt = _fmt(CHAT_PROMPT, notes=notes_text, history=history_text, question=question)
    return _call(TEXT_MODEL, prompt, format_json=False, temperature=0.7, timeout=TEXT_TIMEOUT)


def rag_chat_with_note(message: str, title: str, content: str,
                       related_notes=None, history=None) -> str:
    related_section = ""
    if related_notes:
        lines = ["\n=== GHI CHÚ LIÊN QUAN ==="]
        for n in related_notes[:3]:
            lines.append(f"• {n.get('title') or 'Không tiêu đề'}: {(n.get('content') or '')[:300]}")
        lines.append("=========================")
        related_section = "\n".join(lines) + "\n"

    history_section = ""
    if history:
        turns = history[-6:] if len(history) > 6 else history
        lines = ["\nLịch sử hội thoại:"]
        for h in turns:
            role = "Người dùng" if h.get("role") == "user" else "AI"
            lines.append(f"{role}: {h.get('content', '')}")
        history_section = "\n".join(lines) + "\n"

    prompt = _fmt(
        NOTE_RAG_PROMPT,
        title=title or "Không có tiêu đề",
        content=(content or "Ghi chú chưa có nội dung")[:3000],
        related=related_section,
        history=history_section,
        question=message,
    )
    return _call(TEXT_MODEL, prompt, format_json=False, temperature=0.7, timeout=TEXT_TIMEOUT)


def search_notes_by_keyword(keyword: str, notes: list) -> list:
    """Semantic search — dùng làm fallback khi chưa có vector index."""
    notes_text = "\n".join([
        f"ID:{n['id']} | {n.get('title','')} | {n.get('content','')[:200]}"
        for n in notes
    ])
    prompt = _fmt(SEARCH_PROMPT, keyword=keyword, notes=notes_text)
    raw    = _call(TEXT_MODEL, prompt, timeout=TEXT_TIMEOUT, think=False)
    try:
        result = json.loads(raw)
        if isinstance(result, list):
            return result
        if isinstance(result, dict):
            return result.get("ids", [])
        return []
    except Exception:
        return []