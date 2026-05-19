import concurrent.futures
import logging
import os
import tempfile
import threading
from pathlib import Path

logger = logging.getLogger(__name__)

_TRANSCRIBE_TIMEOUT = 120  # giây — trả về chuỗi rỗng nếu model treo quá lâu


def transcribe_audio(audio_bytes: bytes, filename: str = "audio.m4a") -> str:
    """Chuyển audio bytes thành text tiếng Việt. Timeout sau 120 giây."""
    model = _get_whisper_model()

    suffix = Path(filename).suffix or ".m4a"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(_do_transcribe, model, tmp_path)
            try:
                return future.result(timeout=_TRANSCRIBE_TIMEOUT)
            except concurrent.futures.TimeoutError:
                logger.warning("Whisper transcription timed out after %ds", _TRANSCRIBE_TIMEOUT)
                return ""
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def _do_transcribe(model, tmp_path: str) -> str:
    segments, _ = model.transcribe(
        tmp_path,
        language="vi",
        beam_size=5,
        vad_filter=True,
    )
    return " ".join(s.text.strip() for s in segments).strip()


# ── Model caching — thread-safe lazy load ─────────────────────────────────────
_whisper_model      = None
_whisper_model_lock = threading.Lock()


def _get_whisper_model():
    """Lazy load Whisper model. Thread-safe — chỉ load 1 lần dù nhiều request đến đồng thời."""
    global _whisper_model
    if _whisper_model is None:
        with _whisper_model_lock:
            if _whisper_model is None:   # double-checked locking
                try:
                    from faster_whisper import WhisperModel
                    _whisper_model = WhisperModel(
                        "large-v3",
                        device="cuda",
                        compute_type="float16",
                    )
                    logger.info("Whisper loaded on GPU (CUDA)")
                except Exception as e:
                    from faster_whisper import WhisperModel
                    _whisper_model = WhisperModel(
                        "medium",
                        device="cpu",
                        compute_type="int8",
                    )
                    logger.warning("Whisper loaded on CPU (GPU error: %s)", e)
    return _whisper_model