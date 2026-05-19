"""
Test script: so sánh 4 pipeline trích xuất ảnh.
Usage: python test_image_extract.py <đường_dẫn_ảnh>

Models đang có: llava:7b, qwen2.5vl:latest, qwen3:8b
"""
import sys, base64, json, os, time, io

OLLAMA_URL = "http://localhost:11434/api/generate"
CHAT_MODEL  = "qwen3:8b"
VISION_OLD  = "llava:7b"
VISION_NEW  = "qwen2.5vl:latest"


def _b64(path: str) -> str:
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode()


def _ollama(model: str, prompt: str, b64: str = None, fmt_json: bool = False) -> str:
    import urllib.request
    payload = {"model": model, "prompt": prompt, "stream": False}
    if b64:
        payload["images"] = [b64]
    if fmt_json:
        payload["format"] = "json"
    data = json.dumps(payload).encode()
    req  = urllib.request.Request(OLLAMA_URL, data=data,
                                   headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.loads(r.read())["response"]


def separator(title: str):
    print("\n" + "═" * 64)
    print(f"  {title}")
    print("═" * 64)


# ─────────────────────────────────────────────────────────────────────────────
# Test 1: llava:7b + format=json  (cách CŨ — gây hallucination)
# ─────────────────────────────────────────────────────────────────────────────
def test1_llava_json(b64: str):
    schema = {
        "person_name": None, "phone": None, "email": None,
        "organization": None, "event_title": None, "event_time": None,
        "deadline": None, "summary": None, "category": "note",
        "action_items": [], "tags": [], "reminder_needed": False,
        "extracted_text": "",
    }
    prompt = (
        f"Extract information from this image. "
        f"Return ONLY valid JSON matching this schema: {json.dumps(schema)}"
    )
    raw = _ollama(VISION_OLD, prompt, b64, fmt_json=True)
    try:
        return json.loads(raw)
    except Exception:
        return {"raw": raw}


# ─────────────────────────────────────────────────────────────────────────────
# Test 2: llava:7b mô tả tự do (không force JSON)
# ─────────────────────────────────────────────────────────────────────────────
def test2_llava_free(b64: str):
    prompt = (
        "Mô tả tất cả văn bản, tên, ngày tháng, email, số điện thoại, "
        "và thông tin có cấu trúc trong ảnh này bằng tiếng Việt."
    )
    return _ollama(VISION_OLD, prompt, b64)


# ─────────────────────────────────────────────────────────────────────────────
# Test 3: qwen2.5vl:latest (vision model mới — tốt hơn nhiều)
# ─────────────────────────────────────────────────────────────────────────────
def test3_qwen_vl_free(b64: str):
    prompt = (
        "Read all text visible in this image. "
        "List every piece of information: names, emails, dates, deadlines, "
        "phone numbers, links, and any structured content. "
        "Respond in the same language as the text in the image."
    )
    return _ollama(VISION_NEW, prompt, b64)


def test3b_qwen_vl_extract(b64: str):
    """qwen2.5vl + yêu cầu trả JSON trực tiếp."""
    schema = {
        "person_name": None, "phone": None, "email": None,
        "organization": None, "event_title": None, "event_time": None,
        "deadline": None, "summary": None, "category": "note",
        "action_items": [], "tags": [], "reminder_needed": False,
        "extracted_text": "",
    }
    prompt = (
        "Extract all structured information from this image. "
        f"Return ONLY valid JSON matching this schema (no extra text): {json.dumps(schema, ensure_ascii=False)}"
    )
    raw = _ollama(VISION_NEW, prompt, b64, fmt_json=True)
    try:
        return json.loads(raw)
    except Exception:
        return {"raw": raw}


# ─────────────────────────────────────────────────────────────────────────────
# Test 4: EasyOCR (không LLM)
# ─────────────────────────────────────────────────────────────────────────────
def test4_easyocr(b64: str):
    try:
        import easyocr, numpy as np
        from PIL import Image
        reader = easyocr.Reader(["vi", "en"], gpu=False)
        img = Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB")
        results = reader.readtext(np.array(img), detail=0, paragraph=True)
        return "\n".join(results)
    except ImportError as e:
        return f"EasyOCR chưa cài: {e}\n→ pip install easyocr"
    except Exception as e:
        return f"EasyOCR lỗi: {e}"


# ─────────────────────────────────────────────────────────────────────────────
# Test 5: Pipeline hiện tại (EasyOCR → qwen3:8b extract)
# ─────────────────────────────────────────────────────────────────────────────
def test5_current_pipeline(b64: str):
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from services.ollama import extract_from_image
    return extract_from_image(b64)


# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_image_extract.py <image_path>")
        sys.exit(1)

    path = sys.argv[1]
    if not os.path.exists(path):
        print(f"File không tồn tại: {path}")
        sys.exit(1)

    b64 = _b64(path)
    print(f"Ảnh: {path}  ({len(b64):,} bytes base64)")

    results = {}

    separator("TEST 1 — llava:7b + format=json [CÁCH CŨ, gây hallucination]")
    t = time.time()
    try:
        results["llava_json"] = test1_llava_json(b64)
        print(json.dumps(results["llava_json"], ensure_ascii=False, indent=2))
    except Exception as e:
        print(f"LỖI: {e}")
    print(f"⏱  {time.time()-t:.1f}s")

    separator("TEST 2 — llava:7b mô tả tự do")
    t = time.time()
    try:
        results["llava_free"] = test2_llava_free(b64)
        print(results["llava_free"])
    except Exception as e:
        print(f"LỖI: {e}")
    print(f"⏱  {time.time()-t:.1f}s")

    separator("TEST 3 — qwen2.5vl:latest mô tả tự do [MODEL MỚI]")
    t = time.time()
    try:
        results["qwen_vl_free"] = test3_qwen_vl_free(b64)
        print(results["qwen_vl_free"])
    except Exception as e:
        print(f"LỖI: {e}")
    print(f"⏱  {time.time()-t:.1f}s")

    separator("TEST 3b — qwen2.5vl:latest + format=json [MODEL MỚI]")
    t = time.time()
    try:
        results["qwen_vl_json"] = test3b_qwen_vl_extract(b64)
        print(json.dumps(results["qwen_vl_json"], ensure_ascii=False, indent=2))
    except Exception as e:
        print(f"LỖI: {e}")
    print(f"⏱  {time.time()-t:.1f}s")

    separator("TEST 4 — EasyOCR thuần (không LLM)")
    t = time.time()
    try:
        results["easyocr"] = test4_easyocr(b64)
        print(results["easyocr"])
    except Exception as e:
        print(f"LỖI: {e}")
    print(f"⏱  {time.time()-t:.1f}s")

    separator("TEST 5 — Pipeline hiện tại (EasyOCR → qwen3:8b)")
    t = time.time()
    try:
        results["pipeline"] = test5_current_pipeline(b64)
        print(json.dumps(results["pipeline"], ensure_ascii=False, indent=2))
    except Exception as e:
        print(f"LỖI: {e}")
    print(f"⏱  {time.time()-t:.1f}s")

    separator("KẾT QUẢ NHANH")
    expected = {
        "email":        "anh@ut.edu.vn",
        "event_title":  "Thực hiện đề tài",
        "deadline":     "2026-05-30",
        "person_name":  "Lê Văn Quốc Anh",
        "organization": "UTH",
    }
    print("Thông tin cần trích xuất đúng từ ảnh:")
    for k, v in expected.items():
        print(f"  {k}: {v}")
