import os
import tempfile
from pathlib import Path


def transcribe_audio(audio_bytes: bytes, filename: str = "audio.m4a") -> str:
    """
    Chuyển audio bytes thành text tiếng Việt.
    
    Args:
        audio_bytes: raw bytes của file audio
        filename:    tên file gốc (để biết extension)
    
    Returns:
        Transcript text tiếng Việt
    """
    from faster_whisper import WhisperModel

    # Load model — chỉ load 1 lần nhờ module-level caching
    model = _get_whisper_model()

    # Lưu audio ra file tạm để Whisper đọc
    suffix = Path(filename).suffix or ".m4a"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        segments, info = model.transcribe(
            tmp_path,
            language="vi",          # Tiếng Việt
            beam_size=5,            # Accuracy vs speed tradeoff
            vad_filter=True,        # Lọc khoảng lặng — tăng accuracy
        )
        transcript = " ".join([s.text.strip() for s in segments])
        return transcript.strip()

    finally:
        os.unlink(tmp_path)  # Xóa file tạm


# ── Model caching — chỉ load 1 lần ──────────────────────────────────────────
_whisper_model = None

def _get_whisper_model():
    """
    Lazy load Whisper model.
    Lần đầu gọi: load model (~vài giây).
    Các lần sau: trả về model đã load.
    """
    global _whisper_model
    if _whisper_model is None:
        try:
            # Thử dùng GPU trước
            from faster_whisper import WhisperModel
            _whisper_model = WhisperModel(
                "large-v3",         # Model lớn nhất, accurate nhất
                device="cuda",      # RTX 4060 của bạn
                compute_type="float16",  # Tối ưu cho GPU
            )
            print("✅ Whisper loaded on GPU (CUDA)")
        except Exception as e:
            # Fallback sang CPU nếu GPU lỗi
            from faster_whisper import WhisperModel
            _whisper_model = WhisperModel(
                "medium",           # Model nhỏ hơn cho CPU
                device="cpu",
                compute_type="int8",
            )
            print(f"⚠️  Whisper loaded on CPU (GPU error: {e})")

    return _whisper_model