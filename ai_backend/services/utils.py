import socket, os
from datetime import datetime
from pathlib import Path

def get_server_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]; s.close(); return ip
    except Exception:
        return "localhost"

def get_server_url() -> str:
    env = os.environ.get("SERVER_URL", "").rstrip("/")
    if env:
        return env
    return f"http://{get_server_ip()}:8000"

def get_file_url(file_path):
    if not file_path: return None
    return f"{get_server_url()}/{file_path.replace(chr(92),'/')}"

def _sanitize_filename(name: str) -> str:
    """Strip null bytes, control characters, and path separators from filename."""
    # Remove null bytes and ASCII control chars
    name = "".join(c for c in name if c >= " " and c != "\x7f")
    # Use only the basename to prevent path traversal
    name = Path(name).name
    # Replace remaining dangerous characters
    for ch in r'<>:"/\|?*':
        name = name.replace(ch, "_")
    return name or "file"


def save_upload(data: bytes, subfolder: str, original_filename: str) -> str:
    folder = os.path.join("uploads", subfolder)
    os.makedirs(folder, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe = f"{ts}_{_sanitize_filename(original_filename)}"
    path = os.path.join(folder, safe).replace("\\", "/")
    with open(path, "wb") as f: f.write(data)
    return path