"""
services/ollama.py — Giao tiếp với Ollama API
Tất cả logic gọi LLM tập trung ở đây
"""

import requests
import json
from typing import Any

OLLAMA_URL = "http://localhost:11434/api/generate"

# ── System prompts ────────────────────────────────────────────────────────────

TEXT_EXTRACT_PROMPT = """You are an information extractor for a smart note app.
Extract information from the input text and return ONLY a valid JSON object.
No explanation, no markdown, no extra text — JSON only.

Required fields (use null if not found):
{{
  "title": "short title summarizing the content",
  "summary": "1-2 sentence summary in Vietnamese",
  "person_name": "full name of person mentioned",
  "phone": "phone number",
  "email": "email address",
  "organization": "company or organization name",
  "place_name": "name of place",
  "address": "full address",
  "event_title": "title of meeting or event",
  "event_time": "ISO datetime string if time mentioned, else null",
  "deadline": "ISO date string if deadline mentioned, else null",
  "category": "one of: contact | meeting | shopping | location | reminder | note",
  "action_items": ["list", "of", "tasks"],
  "reminder_needed": true or false,
  "tags": ["relevant", "tags", "in", "vietnamese"]
}}

Input: {text}"""

IMAGE_EXTRACT_PROMPT = """You are an information extractor for a smart note app.
Look at this image carefully and extract ALL visible text and information.
Return ONLY a valid JSON object. No explanation, no markdown — JSON only.

Required fields (use null if not found):
{
  "title": "short title describing the image content",
  "summary": "1-2 sentence summary in Vietnamese of what's in the image",
  "extracted_text": "all text visible in the image",
  "person_name": "full name if visible",
  "phone": "phone number if visible",
  "email": "email if visible",
  "organization": "company name if visible",
  "place_name": "place name if visible",
  "address": "address if visible",
  "event_title": "event or meeting title if visible",
  "event_time": "ISO datetime if time/date visible, else null",
  "deadline": "ISO date if deadline visible, else null",
  "category": "one of: contact | meeting | shopping | location | reminder | note",
  "action_items": [],
  "reminder_needed": false,
  "tags": ["relevant", "tags", "in", "vietnamese"]
}"""

CHAT_PROMPT = """You are a helpful AI assistant for a smart note-taking app called MemoAI.
You help users find information from their notes and answer questions.
Always respond in Vietnamese unless the user writes in another language.
Be concise and helpful.

User's notes:
{notes}

Conversation history:
{history}

User's question: {question}

Answer based on the notes above. If the information is not in the notes, say so clearly."""

SEARCH_PROMPT = """You are a search assistant for a note-taking app.
Given a list of notes and a search keyword, find the most relevant notes.
Return ONLY a valid JSON array of note IDs sorted by relevance (most relevant first).
No explanation — JSON array only. Example: [3, 1, 5]

Keyword: {keyword}

Notes:
{notes}"""


def call_ollama(model: str, prompt: str, images: list[str] = None) -> str:
    """
    Gọi Ollama API và trả về response text.
    
    Args:
        model:  "mistral:7b" hoặc "llava:7b"
        prompt: nội dung prompt
        images: list base64 strings (chỉ dùng với llava)
    
    Returns:
        Response text từ model
    
    Raises:
        Exception nếu Ollama không chạy hoặc lỗi model
    """
    payload: dict[str, Any] = {
        "model":  model,
        "prompt": prompt,
        "stream": False,        # Đợi response đầy đủ, không stream
        "format": "json",       # Yêu cầu Ollama trả JSON thuần
        "options": {
            "temperature": 0.1, # Thấp → output nhất quán, ít "sáng tạo"
            "num_predict": 1024, # Giới hạn token output
        }
    }

    if images:
        payload["images"] = images  # Base64 strings cho llava

    try:
        response = requests.post(
            OLLAMA_URL,
            json=payload,
            timeout=60,  # 60s timeout — llava đọc ảnh cần thời gian
        )
        response.raise_for_status()
        return response.json()["response"]

    except requests.exceptions.ConnectionError:
        raise Exception("Không kết nối được Ollama. Hãy chạy: ollama serve")
    except requests.exceptions.Timeout:
        raise Exception("Ollama timeout. Model đang load hoặc quá tải")
    except Exception as e:
        raise Exception(f"Ollama error: {str(e)}")


def extract_from_text(text: str) -> dict:
    """
    Dùng mistral:7b để trích xuất thông tin từ text.
    Trả về dict với các field đã định nghĩa trong prompt.
    """
    prompt   = TEXT_EXTRACT_PROMPT.format(text=text)
    raw      = call_ollama("mistral:7b", prompt)

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Nếu model trả về text lẫn JSON, thử extract JSON
        import re
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        if match:
            return json.loads(match.group())
        raise Exception(f"Model không trả về JSON hợp lệ: {raw[:200]}")


def extract_from_image(image_b64: str) -> dict:
    """
    Dùng llava:7b để đọc ảnh và trích xuất thông tin.
    image_b64: ảnh đã encode base64
    """
    raw = call_ollama("llava:7b", IMAGE_EXTRACT_PROMPT, images=[image_b64])

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        import re
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        if match:
            return json.loads(match.group())
        raise Exception(f"llava không trả về JSON hợp lệ: {raw[:200]}")


def chat_with_notes(question: str, notes: list[dict], history: list[dict]) -> str:
    """
    Trả lời câu hỏi của user dựa trên toàn bộ notes.
    
    Args:
        question: câu hỏi của user
        notes:    list note dicts từ DB
        history:  list {"role": "user"|"assistant", "content": "..."}
    """
    # Format notes thành text cho prompt
    notes_text = "\n\n".join([
        f"[Note {n['id']}] {n.get('title', 'Không có tiêu đề')}\n{n.get('content', '')}"
        for n in notes
    ])

    # Format history
    history_text = "\n".join([
        f"{h['role'].upper()}: {h['content']}"
        for h in history[-6:]  # Chỉ lấy 6 tin nhắn gần nhất để tránh overflow
    ])

    prompt = CHAT_PROMPT.format(
        notes=notes_text or "Chưa có ghi chú nào",
        history=history_text or "Đây là tin nhắn đầu tiên",
        question=question,
    )

    # Chat dùng text model, không cần format JSON
    payload = {
        "model":  "mistral:7b",
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": 0.7},  # Cao hơn để chat tự nhiên hơn
    }

    response = requests.post(OLLAMA_URL, json=payload, timeout=60)
    return response.json()["response"]


def search_notes_by_keyword(keyword: str, notes: list[dict]) -> list[int]:
    """
    Tìm kiếm semantic — dùng LLM để hiểu ngữ nghĩa thay vì LIKE query.
    Trả về list note IDs sắp xếp theo độ liên quan.
    """
    notes_text = "\n".join([
        f"ID:{n['id']} | {n.get('title','')} | {n.get('content','')[:200]}"
        for n in notes
    ])

    prompt = SEARCH_PROMPT.format(keyword=keyword, notes=notes_text)
    raw    = call_ollama("mistral:7b", prompt)

    try:
        # Model trả về JSON array: [3, 1, 5]
        result = json.loads(raw)
        if isinstance(result, list):
            return result
        # Đôi khi model trả {"ids": [3,1,5]}
        if isinstance(result, dict):
            return result.get("ids", [])
        return []
    except:
        return []