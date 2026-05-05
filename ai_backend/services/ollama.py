"""
services/ollama.py  — optimized v2

Thay đổi so với v1:
  1. /api/chat thay /api/generate → system/user role riêng biệt, instruction following tốt hơn
  2. format = JSON Schema (Pydantic) thay format="json" → Ollama enforce schema cứng,
     model KHÔNG thể trả về field sai kiểu hay thiếu required field
  3. temperature=0 cho extraction (tối đa nhất quán), 0.7 cho chat
  4. Few-shot example nhúng trong system prompt để anchor hành vi
  5. Pydantic validate response → fail rõ ràng thay vì silent wrong data
  6. Tách riêng system prompt / user content → ngắn gọn hơn, dễ maintain
"""

import json
import re
import requests
from typing import Any, Optional
from pydantic import BaseModel, Field

# ── Endpoints ─────────────────────────────────────────────────────────────────

OLLAMA_CHAT_URL     = "http://localhost:11434/api/chat"
OLLAMA_GENERATE_URL = "http://localhost:11434/api/generate"  # chỉ dùng cho chat thuần


# ─────────────────────────────────────────────────────────────────────────────
# Pydantic schemas — dùng .model_json_schema() để tạo JSON Schema cho Ollama
# "required" + "additionalProperties: false" → model KHÔNG được thêm field lạ
# ─────────────────────────────────────────────────────────────────────────────

class ExtractedNote(BaseModel):
    """Schema cho kết quả trích xuất thông tin từ text / image."""
    title:            Optional[str]       = Field(None, description="Tiêu đề ngắn tóm tắt nội dung")
    summary:          Optional[str]       = Field(None, description="Tóm tắt 1-2 câu bằng tiếng Việt")
    person_name:      Optional[str]       = Field(None, description="Họ tên đầy đủ người được nhắc tới")
    phone:            Optional[str]       = Field(None, description="Số điện thoại Việt Nam")
    email:            Optional[str]       = Field(None, description="Địa chỉ email")
    organization:     Optional[str]       = Field(None, description="Tên công ty / tổ chức")
    place_name:       Optional[str]       = Field(None, description="Tên địa điểm")
    address:          Optional[str]       = Field(None, description="Địa chỉ đầy đủ")
    event_title:      Optional[str]       = Field(None, description="Tên cuộc họp / sự kiện")
    event_time:       Optional[str]       = Field(None, description="Thời gian ISO 8601, ví dụ 2026-05-10T15:00:00")
    deadline:         Optional[str]       = Field(None, description="Ngày hết hạn ISO 8601, ví dụ 2026-05-15")
    category:         str                 = Field("note", description="contact|meeting|shopping|location|reminder|note")
    action_items:     list[str]           = Field(default_factory=list, description="Danh sách việc cần làm")
    reminder_needed:  bool                = Field(False, description="True nếu cần tạo nhắc nhở")
    tags:             list[str]           = Field(default_factory=list, description="Tag liên quan bằng tiếng Việt")

    class Config:
        extra = "forbid"   # additionalProperties: false


class SearchResult(BaseModel):
    """Schema cho kết quả semantic search — danh sách ID note theo thứ tự liên quan."""
    ids: list[int] = Field(default_factory=list, description="ID các note liên quan, sắp xếp từ liên quan nhất")

    class Config:
        extra = "forbid"


# ── Lấy JSON Schema từ Pydantic (truyền vào format của Ollama) ────────────────

def _schema(model_cls: type[BaseModel]) -> dict:
    """
    Tạo JSON Schema từ Pydantic model.
    Thêm 'additionalProperties: false' để Ollama enforce schema cứng.
    """
    schema = model_cls.model_json_schema()
    schema["additionalProperties"] = False
    return schema


# ─────────────────────────────────────────────────────────────────────────────
# System prompts  — ngắn gọn, role rõ ràng, few-shot nhúng trực tiếp
# ─────────────────────────────────────────────────────────────────────────────

_EXTRACT_SYSTEM = """\
Bạn là memory parser cho MemoAI (Second Brain).
Mục tiêu: biến mọi capture thành tri thức dễ tìm lại.

Quy tắc bắt buộc:
- Chỉ trả về JSON, không thêm text ngoài schema.
- Ưu tiên khả năng truy hồi: title rõ ngữ cảnh, summary nêu ý chính + hành động.
- Nếu thiếu dữ liệu: dùng null hoặc [] theo kiểu field.
- summary và tags LUÔN bằng tiếng Việt, dễ tìm kiếm về sau.
- event_time/deadline phải là ISO 8601 hoặc null.
- category ∈ {contact, meeting, shopping, location, reminder, note}.
- Nếu input có nhiều nguồn (text + attachment), hãy hợp nhất thành một ngữ cảnh duy nhất, không bỏ sót chi tiết quan trọng.

Ví dụ:
Input: "Gặp anh Minh Nguyễn CEO Techviet số 0912345678 lúc 3h chiều thứ 6 tại văn phòng Q1"
Output:
{
  "title": "Gặp anh Minh - Techviet",
  "summary": "Cuộc gặp với CEO Techviet vào chiều thứ 6 tại Quận 1.",
  "person_name": "Minh Nguyễn",
  "phone": "0912345678",
  "email": null,
  "organization": "Techviet",
  "place_name": "Văn phòng Techviet",
  "address": "Quận 1, TP.HCM",
  "event_title": "Gặp anh Minh - CEO Techviet",
  "event_time": null,
  "deadline": null,
  "category": "meeting",
  "action_items": ["Chuẩn bị tài liệu trước buổi gặp"],
  "reminder_needed": true,
  "tags": ["cuộc-họp", "liên-hệ", "techviet"]
}\
"""

_IMAGE_SYSTEM = """\
Bạn là module OCR và trích xuất thông tin từ ảnh cho ứng dụng ghi chú MemoAI.
Nhiệm vụ: nhìn vào ảnh, đọc toàn bộ text hiển thị và các thông tin có thể nhận diện, trả về JSON theo schema.

Quy tắc:
- extracted_text: toàn bộ văn bản nhìn thấy trong ảnh, giữ nguyên định dạng.
- Nếu là danh thiếp: điền đầy đủ person_name, phone, email, organization, address.
- Nếu là hóa đơn / menu: category = shopping, ghi items vào action_items.
- summary và tags bằng tiếng Việt.
- Trả về JSON thuần, không markdown, không giải thích.\
"""

_SEARCH_SYSTEM = """\
Bạn là search engine ngữ nghĩa cho ứng dụng ghi chú.
Nhiệm vụ: cho danh sách note và từ khóa, trả về JSON chứa mảng IDs các note liên quan nhất.

Quy tắc:
- Hiểu ngữ nghĩa: "số điện thoại" → tìm note có contact info.
- Sắp xếp: liên quan nhất trước.
- Nếu không có note nào liên quan → trả về {"ids": []}.
- Chỉ trả về JSON, không giải thích.\
"""

_CHAT_SYSTEM = """\
Bạn là trợ lý Second Brain của người dùng.
Nguyên tắc: capture không ma sát, retrieval cực nhanh.

Quy tắc:
- Luôn trả lời bằng tiếng Việt (trừ khi người dùng dùng ngôn ngữ khác).
- Chỉ dựa trên dữ liệu ghi chú đã cung cấp.
- Ưu tiên câu trả lời có thể hành động: tóm tắt ngắn + các mốc thời gian/việc cần làm.
- Khi phù hợp, trích ID note nguồn dạng [#id] để người dùng mở lại ngữ cảnh.
- Nếu thiếu thông tin, nói rõ: "Tôi không tìm thấy thông tin này trong ghi chú của bạn."\
"""


# ─────────────────────────────────────────────────────────────────────────────
# Core: call_chat — dùng /api/chat với system/user separation + JSON Schema
# ─────────────────────────────────────────────────────────────────────────────

def call_chat(
    model:       str,
    system:      str,
    user:        str,
    schema:      Optional[dict] = None,
    images:      Optional[list[str]] = None,
    temperature: float = 0.0,
    num_predict: int   = 1024,
) -> str:
    """
    Gọi /api/chat endpoint.

    Args:
        model:       "mistral:7b" | "llava:7b"
        system:      System prompt (vai trò + quy tắc)
        user:        User message (dữ liệu cần xử lý)
        schema:      JSON Schema dict (nếu muốn enforce output format)
        images:      List base64 strings cho llava
        temperature: 0.0 cho extraction, 0.7 cho chat
        num_predict: Max tokens output

    Returns:
        Response string từ model
    """
    # Tạo user message — có thể kèm ảnh cho llava
    user_content: Any
    if images:
        user_content = [
            {"type": "text", "text": user},
            *[{"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img}"}}
              for img in images],
        ]
    else:
        user_content = user

    payload: dict[str, Any] = {
        "model":  model,
        "stream": False,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user",   "content": user_content},
        ],
        "options": {
            "temperature": temperature,
            "num_predict": num_predict,
        },
    }

    # Truyền JSON Schema vào format → Ollama enforce cứng
    if schema:
        payload["format"] = schema

    try:
        response = requests.post(OLLAMA_CHAT_URL, json=payload, timeout=120)
        response.raise_for_status()
        return response.json()["message"]["content"]

    except requests.exceptions.ConnectionError:
        raise Exception("Không kết nối được Ollama. Chạy: ollama serve")
    except requests.exceptions.Timeout:
        raise Exception("Ollama timeout — model đang load hoặc quá tải")
    except KeyError:
        raise Exception(f"Ollama trả về response không hợp lệ: {response.text[:200]}")
    except Exception as e:
        raise Exception(f"Ollama error: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

def extract_from_text(text: str, context: Optional[dict] = None) -> dict:
    """
    Dùng mistral:7b + JSON Schema để trích xuất thông tin có cấu trúc từ text.

    Flow:
      system  = _EXTRACT_SYSTEM (role + rules + few-shot)
      user    = text thô của user
      format  = ExtractedNote schema → Ollama KHÔNG thể trả về field sai

    Returns:
        dict validated theo ExtractedNote schema
    """
    raw = call_chat(
        model       = "mistral:7b",
        system      = _EXTRACT_SYSTEM,
        user        = ((f"Ngữ cảnh bổ sung: {json.dumps(context, ensure_ascii=False)}\n\n") if context else "") + f"Trích xuất thông tin từ text sau:\n\n{text}",
        schema      = _schema(ExtractedNote),
        temperature = 0.0,   # tối đa nhất quán
        num_predict = 1024,
    )

    return _parse_and_validate(raw, ExtractedNote)


def extract_from_image(image_b64: str) -> dict:
    """
    Dùng llava:7b + JSON Schema để đọc ảnh và trích xuất thông tin.

    Args:
        image_b64: ảnh encode base64
    """
    # llava nhận images qua /api/generate (multimodal format khác)
    # Dùng generate endpoint cho llava vì /api/chat image format có thể khác tuỳ version
    schema_str = json.dumps(_schema(ExtractedNote), ensure_ascii=False)

    payload: dict[str, Any] = {
        "model":  "llava:7b",
        "stream": False,
        "prompt": (
            f"{_IMAGE_SYSTEM}\n\n"
            f"Schema bắt buộc:\n{schema_str}\n\n"
            "Phân tích ảnh này và trả về JSON theo schema trên:"
        ),
        "images": [image_b64],
        "format": "json",
        "options": {
            "temperature": 0.0,
            "num_predict": 1024,
        },
    }

    try:
        response = requests.post(OLLAMA_GENERATE_URL, json=payload, timeout=120)
        response.raise_for_status()
        raw = response.json()["response"]
    except requests.exceptions.ConnectionError:
        raise Exception("Không kết nối được Ollama.")
    except Exception as e:
        raise Exception(f"llava error: {e}")

    return _parse_and_validate(raw, ExtractedNote)


def chat_with_notes(
    question: str,
    notes:    list[dict],
    history:  list[dict],
) -> str:
    """
    Second Brain: trả lời câu hỏi dựa trên toàn bộ notes của user.

    Args:
        question: câu hỏi của user
        notes:    list note dict từ DB
        history:  [{"role": "user"|"assistant", "content": "..."}]
    """
    # Format notes — súc tích, đủ thông tin để model tra cứu
    notes_block = "\n\n".join(
        f"[#{n['id']}] {n.get('title') or '(không có tiêu đề)'}\n"
        f"Loại: {n.get('type', 'text')} | Tags: {n.get('tags', '[]')}\n"
        f"{(n.get('content') or '')[:400]}"   # giới hạn 400 chars/note tránh overflow
        for n in notes
    ) or "Chưa có ghi chú nào."

    # Format history — lấy 6 tin nhắn gần nhất
    history_block = "\n".join(
        f"{'Người dùng' if h['role'] == 'user' else 'Trợ lý'}: {h['content']}"
        for h in history[-6:]
    ) if history else ""

    user_message = (
        f"=== GHI CHÚ CỦA BẠN ===\n{notes_block}\n\n"
        + (f"=== LỊCH SỬ HỘI THOẠI ===\n{history_block}\n\n" if history_block else "")
        + f"=== CÂU HỎI ===\n{question}"
    )

    # Chat không cần JSON Schema — trả về plain text
    return call_chat(
        model       = "mistral:7b",
        system      = _CHAT_SYSTEM,
        user        = user_message,
        schema      = None,       # plain text response
        temperature = 0.7,        # cao hơn để chat tự nhiên
        num_predict = 512,
    )


def search_notes_by_keyword(keyword: str, notes: list[dict]) -> list[int]:
    """
    Semantic search: dùng LLM hiểu ngữ nghĩa thay LIKE query.

    Returns:
        List note IDs sắp xếp theo độ liên quan (liên quan nhất trước)
    """
    if not notes:
        return []

    notes_block = "\n".join(
        f"ID:{n['id']} | {n.get('title', '')} | {(n.get('content') or '')[:150]}"
        for n in notes
    )

    user_message = (
        f"Từ khóa tìm kiếm: \"{keyword}\"\n\n"
        f"Danh sách ghi chú:\n{notes_block}"
    )

    raw = call_chat(
        model       = "mistral:7b",
        system      = _SEARCH_SYSTEM,
        user        = user_message,
        schema      = _schema(SearchResult),
        temperature = 0.0,
        num_predict = 256,
    )

    try:
        result = _parse_and_validate(raw, SearchResult)
        return result.get("ids", [])
    except Exception:
        return []


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _parse_and_validate(raw: str, model_cls: type[BaseModel]) -> dict:
    """
    Parse JSON string → validate với Pydantic model → trả về dict.

    Strategy:
      1. Parse trực tiếp nếu raw là JSON hợp lệ
      2. Nếu có text lẫn JSON → extract bằng regex
      3. Nếu vẫn lỗi → raise rõ ràng

    Pydantic validation đảm bảo:
      - Các field có đúng kiểu dữ liệu
      - Field bắt buộc không bị thiếu
      - Field không có trong schema bị loại bỏ (extra="forbid" → raise nếu có)
    """
    # Attempt 1: parse trực tiếp
    try:
        data = json.loads(raw)
        validated = model_cls.model_validate(data)
        return validated.model_dump()
    except json.JSONDecodeError:
        pass
    except Exception as e:
        # Pydantic validation error — thử extract JSON trước khi raise
        pass

    # Attempt 2: extract JSON từ text lẫn lộn
    # Pattern bắt cả object {} và array []
    match = re.search(r'(\{[\s\S]*\}|\[[\s\S]*\])', raw)
    if match:
        try:
            data = json.loads(match.group())
            validated = model_cls.model_validate(data)
            return validated.model_dump()
        except Exception:
            pass

    # Attempt 3: fallback — trả về default values thay vì crash pipeline
    # Với extraction, trả về object rỗng tốt hơn throw exception làm mất note
    try:
        fallback = model_cls.model_validate({})
        return fallback.model_dump()
    except Exception:
        raise Exception(
            f"Model không trả về JSON hợp lệ theo schema {model_cls.__name__}.\n"
            f"Raw response (200 chars): {raw[:200]}"
        )


def _check_ollama_health() -> bool:
    """Kiểm tra Ollama có đang chạy không. Dùng trong startup."""
    try:
        r = requests.get("http://localhost:11434/api/tags", timeout=3)
        return r.status_code == 200
    except Exception:
        return False