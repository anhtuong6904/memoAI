"""
services/ollama.py — Ollama API wrapper

Toi uu cho cau hinh: RTX 4060 Laptop 8GB VRAM + 24GB RAM + i7-13650HX
============================================================
PULL MODELS TRUOC KHI CHAY:

  ollama pull qwen3:8b         # 4.7GB disk, 7.2GB VRAM, ~40 tok/s
  ollama pull gemma3:12b       # 7.8GB disk, ~7.8GB VRAM voi QAT

Tai sao 2 model nay:
  - Qwen 3 8B: tot nhat trong tam 7-8B cho tieng Viet (119 ngon ngu),
    full GPU offload tren 4060 8GB, ~40 tok/s.
  - Gemma 3 12B: vision + 140 ngon ngu, OCR rat tot (DocVQA 85.6),
    QAT giup fit 8GB VRAM o chat luong gan FP16.

Neu muon don gian (1 model thoi):
  TEXT_MODEL = VISION_MODEL = "gemma3:12b"
  Tranh swap model, dung 1 lan luc nao cung san sang.

Neu may yeu hon (4-6GB VRAM):
  TEXT_MODEL   = "qwen3:4b"
  VISION_MODEL = "gemma3:4b"
"""

import requests
import json
import re

OLLAMA_URL = "http://localhost:11434/api/generate"

# ── Cau hinh model — doi 2 dong nay neu can ─────────────────────────────
TEXT_MODEL   = "qwen3:8b"
VISION_MODEL = "gemma3:12b"

# Timeout doi voi tung loai request (giay)
TEXT_TIMEOUT   = 120
VISION_TIMEOUT = 180  # vision lau hon vi phai encode/decode anh


# ── Prompts ────────────────────────────────────────────────────────────

TEXT_EXTRACT_PROMPT = """Ban la trinh trich xuat thong tin tu ghi chu cua nguoi Viet.
Doc text dau vao va tra ve DUY NHAT mot JSON object hop le.
KHONG kem giai thich, KHONG markdown, KHONG text thua, chi JSON.

Cau truc JSON bat buoc (dung null neu khong tim thay):
{{
  "title":           "tieu de ngan gon mo ta noi dung (tieng Viet)",
  "summary":         "tom tat 1-2 cau bang tieng Viet",
  "person_name":     "ho ten day du",
  "phone":           "so dien thoai",
  "email":           "dia chi email",
  "organization":    "ten cong ty / to chuc",
  "place_name":      "ten dia diem",
  "address":         "dia chi day du",
  "event_title":     "ten su kien / cuoc hop",
  "event_time":      "ISO 8601 datetime neu co thoi gian, nguoc lai null",
  "deadline":        "ISO 8601 date neu co han chot, nguoc lai null",
  "category":        "mot trong: contact | meeting | shopping | location | reminder | note",
  "action_items":    ["danh", "sach", "viec", "can", "lam"],
  "reminder_needed": true hoac false,
  "tags":            ["the", "tag", "lien", "quan", "bang", "tieng", "Viet"]
}}

Quy tac quan trong:
- Khong tu suy doan thong tin khong co trong text
- Tieng Viet dung dau du, khong viet tat
- Date/time format ISO 8601: YYYY-MM-DDTHH:MM:SS

Dau vao:
{text}"""

IMAGE_EXTRACT_PROMPT = """Look at this image carefully. Extract ALL visible text and information.
Return ONLY a valid JSON object — no markdown, no explanation, JSON only.

Required fields (use null if not visible in the image):
{
  "title":           "short Vietnamese title describing the image",
  "summary":         "1-2 sentence Vietnamese summary",
  "extracted_text":  "ALL text visible in the image, preserving original language and layout",
  "person_name":     "full name if visible",
  "phone":           "phone number if visible",
  "email":           "email if visible",
  "organization":    "company/organization name if visible",
  "place_name":      "place name if visible",
  "address":         "full address if visible",
  "event_title":     "event title if visible",
  "event_time":      "ISO 8601 datetime if visible, else null",
  "deadline":        "ISO 8601 date if visible, else null",
  "category":        "one of: contact | meeting | shopping | location | reminder | note",
  "action_items":    [],
  "reminder_needed": false,
  "tags":            ["relevant", "Vietnamese", "tags"]
}

Critical: read text in the image character-by-character to avoid OCR errors."""

CHAT_PROMPT = """Ban la tro ly AI cua app ghi chu MemoAI. Tra loi nguoi dung dua tren ghi chu cua ho.
Luon tra loi bang tieng Viet, ngan gon, ro rang. Neu khong tim thay thong tin trong ghi chu,
hay noi ro la khong tim thay.

Ghi chu cua nguoi dung:
{notes}

Lich su tro chuyen:
{history}

Cau hoi: {question}

Tra loi:"""

SEARCH_PROMPT = """Ban la trinh tim kiem semantic. Cho mot tu khoa va danh sach ghi chu,
tim cac ghi chu lien quan nhat va sap xep theo do lien quan giam dan.
Tra ve DUY NHAT mot JSON array chua note IDs. Khong giai thich.
Vi du output: [3, 1, 5]

Tu khoa: {keyword}

Ghi chu:
{notes}"""


# ── Core API call ──────────────────────────────────────────────────────

def _call(model, prompt, images=None, format_json=True, temperature=0.1, timeout=120):
    payload = {
        "model":   model,
        "prompt":  prompt,
        "stream":  False,
        "options": {
            "temperature": temperature,
            "num_predict": 2048,
            "num_ctx":     8192,   # context window 8K — du cho note dai
        },
    }
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
        # 404 = model chua duoc pull
        if e.response is not None and e.response.status_code == 404:
            raise Exception(f"Model {model} chua co. Chay: ollama pull {model}")
        raise Exception(f"Ollama error: {e}")
    except Exception as e:
        raise Exception(f"Ollama error: {e}")


def _safe_parse_json(raw):
    """Parse JSON, fallback regex extract neu model tra co text thua."""
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        if m:
            try:
                return json.loads(m.group())
            except json.JSONDecodeError:
                pass
        raise Exception(f"Model tra ve JSON khong hop le: {raw[:200]}")


# ── Public API ─────────────────────────────────────────────────────────

def extract_from_text(text):
    """qwen3:8b trich xuat thong tin tu text tieng Viet."""
    prompt = TEXT_EXTRACT_PROMPT.format(text=text)
    raw    = _call(TEXT_MODEL, prompt, timeout=TEXT_TIMEOUT)
    return _safe_parse_json(raw)


def extract_from_image(image_b64):
    """gemma3:12b doc anh va trich xuat thong tin (multimodal)."""
    raw = _call(VISION_MODEL, IMAGE_EXTRACT_PROMPT,
                images=[image_b64], format_json=False, timeout=VISION_TIMEOUT)
    return _safe_parse_json(raw)


def chat_with_notes(question, notes, history):
    """Tra loi cau hoi cua user dua tren toan bo notes."""
    notes_text = "\n\n".join([
        f"[Note {n['id']}] {n.get('title') or 'Khong co tieu de'}\n{n.get('content','')}"
        for n in notes
    ]) or "Chua co ghi chu nao"

    history_text = "\n".join([
        f"{h['role'].upper()}: {h['content']}"
        for h in history[-6:]
    ]) or "Day la tin nhan dau tien"

    prompt = CHAT_PROMPT.format(
        notes=notes_text, history=history_text, question=question,
    )
    return _call(TEXT_MODEL, prompt, format_json=False, temperature=0.7, timeout=TEXT_TIMEOUT)


def search_notes_by_keyword(keyword, notes):
    """Tim kiem semantic — LLM hieu y nghia, khong chi LIKE."""
    notes_text = "\n".join([
        f"ID:{n['id']} | {n.get('title','')} | {n.get('content','')[:200]}"
        for n in notes
    ])
    prompt = SEARCH_PROMPT.format(keyword=keyword, notes=notes_text)
    raw    = _call(TEXT_MODEL, prompt, timeout=TEXT_TIMEOUT)
    try:
        result = json.loads(raw)
        if isinstance(result, list):
            return result
        if isinstance(result, dict):
            return result.get("ids", [])
        return []
    except Exception:
        return []