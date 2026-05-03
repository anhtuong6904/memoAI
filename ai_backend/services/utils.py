"""
services/utils.py — Helper utilities
- Lấy IP máy tính trong LAN
- Tạo URL cho ảnh và audio
"""

import socket
import os
from datetime import datetime


def get_server_ip() -> str:
    """Lấy IP máy tính trong mạng LAN tự động."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "localhost"


def get_server_url() -> str:
    return f"http://{get_server_ip()}:8000"


def get_file_url(file_path: str | None) -> str | None:
    """Chuyển relative path thành full URL có thể dùng trong Expo."""
    if not file_path:
        return None
    # Chuẩn hóa dấu \ thành / (Windows path)
    file_path = file_path.replace("\\", "/")
    return f"{get_server_url()}/{file_path}"


def save_upload(data: bytes, subfolder: str, original_filename: str) -> str:
    """
    Lưu file upload vào uploads/<subfolder>/<timestamp>_<filename>.
    Trả về relative path để lưu vào DB.

    Args:
        data:              raw bytes của file
        subfolder:         'images' | 'audio'
        original_filename: tên file gốc từ client

    Returns:
        relative path — vd: "uploads/images/20260428_153000_photo.jpg"
    """
    folder = os.path.join("uploads", subfolder)
    os.makedirs(folder, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename  = f"{timestamp}_{original_filename}"
    file_path = os.path.join(folder, filename).replace("\\", "/")

    with open(file_path, "wb") as f:
        f.write(data)

    return file_path