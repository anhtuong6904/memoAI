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
    return f"http://{get_server_ip()}:8000"

def get_file_url(file_path):
    if not file_path: return None
    return f"{get_server_url()}/{file_path.replace(chr(92),'/')}"

def save_upload(data: bytes, subfolder: str, original_filename: str) -> str:
    folder = os.path.join("uploads", subfolder)
    os.makedirs(folder, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe = f"{ts}_{Path(original_filename).name}"
    path = os.path.join(folder, safe).replace("\\", "/")
    with open(path, "wb") as f: f.write(data)
    return path