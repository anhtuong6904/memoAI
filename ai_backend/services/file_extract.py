"""
services/file_extract.py — Trích xuất text từ các loại file đính kèm

Hỗ trợ:
  .pdf          → pypdf (text layer), nếu không có text layer → trả về ""
  .docx         → python-docx
  .xlsx / .xls  → openpyxl (đọc các cell có giá trị)
  .txt .md .csv .json .xml .html .py .js .ts → đọc trực tiếp UTF-8
  Khác          → trả về "" (image/audio xử lý riêng ở analyze)

Giới hạn: tối đa 8000 ký tự per file (tránh overflow context FAISS chunk)
"""

import logging
from pathlib import Path

logger = logging.getLogger(__name__)

MAX_CHARS = 8000  # ký tự tối đa lưu vào DB


def extract_text(file_path: str, mime_type: str = "") -> str:
    """
    Trích xuất text từ file. Trả về chuỗi rỗng nếu không hỗ trợ hoặc lỗi.
    """
    path = Path(file_path)
    ext  = path.suffix.lower()

    try:
        if ext == ".pdf":
            return _extract_pdf(path)
        if ext == ".docx":
            return _extract_docx(path)
        if ext in (".xlsx", ".xls"):
            return _extract_excel(path)
        if ext in (".txt", ".md", ".csv", ".json", ".xml",
                   ".html", ".htm", ".py", ".js", ".ts",
                   ".java", ".c", ".cpp", ".cs", ".yaml", ".yml"):
            return _extract_text_file(path)
    except Exception as e:
        logger.warning("[file_extract] %s: %s", file_path, e)

    return ""


# ── Implementations ───────────────────────────────────────────────────────────

def _extract_pdf(path: Path) -> str:
    from pypdf import PdfReader
    reader = PdfReader(str(path))
    pages  = []
    for page in reader.pages:
        t = page.extract_text() or ""
        if t.strip():
            pages.append(t.strip())
    text = "\n\n".join(pages)
    logger.debug("[file_extract] PDF %s: %d chars", path.name, len(text))
    return text[:MAX_CHARS]


def _extract_docx(path: Path) -> str:
    from docx import Document
    doc   = Document(str(path))
    lines = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
    text  = "\n".join(lines)
    logger.debug("[file_extract] DOCX %s: %d chars", path.name, len(text))
    return text[:MAX_CHARS]


def _extract_excel(path: Path) -> str:
    import openpyxl
    wb    = openpyxl.load_workbook(str(path), read_only=True, data_only=True)
    lines = []
    for sheet in wb.worksheets:
        lines.append(f"[Sheet: {sheet.title}]")
        for row in sheet.iter_rows(values_only=True):
            cells = [str(c) for c in row if c is not None and str(c).strip()]
            if cells:
                lines.append("\t".join(cells))
    text = "\n".join(lines)
    logger.debug("[file_extract] XLSX %s: %d chars", path.name, len(text))
    return text[:MAX_CHARS]


def _extract_text_file(path: Path) -> str:
    text = path.read_text(encoding="utf-8", errors="ignore")
    logger.debug("[file_extract] TXT %s: %d chars", path.name, len(text))
    return text[:MAX_CHARS]
