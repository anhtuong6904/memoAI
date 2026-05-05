import sqlite3
import os
from pathlib import Path

# ── Đường dẫn database ────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent
DB_PATH  = BASE_DIR / "memoai.db"


def get_connection() -> sqlite3.Connection:
    """
    Tạo kết nối SQLite.
    row_factory = Row → truy cập cột theo tên: row["title"] thay vì row[0]
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")   # Tăng hiệu năng đọc/ghi đồng thời
    conn.execute("PRAGMA foreign_keys = ON")    # Bật foreign key constraint
    return conn


def init_db() -> None:
    """
    Khởi tạo toàn bộ schema.
    Gọi 1 lần khi backend khởi động.
    IF NOT EXISTS → an toàn, không xóa data cũ nếu chạy lại.
    """
    conn = get_connection()
    cursor = conn.cursor()

    cursor.executescript("""

    -- ══════════════════════════════════════════════════════════════════
    -- 1. NOTES — bảng chính lưu tất cả ghi chú
    -- ══════════════════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS notes (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,

        -- Nội dung
        title         TEXT,                          -- Tiêu đề (AI tự tạo nếu null)
        content       TEXT    NOT NULL DEFAULT '',   -- Nội dung gốc (text / transcript)
        summary       TEXT,                          -- AI tóm tắt ngắn

        -- Loại input
        -- 'text' | 'image' | 'voice' | 'video'
        type          TEXT    NOT NULL DEFAULT 'text',

        -- File đính kèm (local path)
        file_path     TEXT,

        -- Tags lưu JSON string — dùng để filter nhanh trên UI
        -- vd: '["liên hệ", "công việc"]'
        -- (song song với bảng tags để quản lý tập trung)
        tags          TEXT    NOT NULL DEFAULT '[]',

        -- Vị trí GPS khi capture
        -- JSON: {"lat": 10.762, "lng": 106.660, "address": "Quận 1, TP.HCM"}
        location      TEXT,

        -- Trạng thái
        is_pinned     INTEGER NOT NULL DEFAULT 0,    -- 1 = ghim lên đầu
        is_archived   INTEGER NOT NULL DEFAULT 0,    -- 1 = ẩn khỏi danh sách chính
        ai_processed  INTEGER NOT NULL DEFAULT 0,    -- 1 = AI đã xử lý xong

        -- Thời gian
        created_at    TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
        updated_at    TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- ══════════════════════════════════════════════════════════════════
    -- 2. EXTRACTED_INFO — thông tin có cấu trúc do AI trích xuất
    --    Quan hệ: 1 note → 1 extracted_info (one-to-one)
    -- ══════════════════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS extracted_info (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        note_id         INTEGER NOT NULL UNIQUE,     -- UNIQUE → 1 note chỉ có 1 record

        -- ── Thông tin người / liên hệ ──────────────────────────────
        person_name     TEXT,   -- "Nguyễn Văn Minh"
        phone           TEXT,   -- "0901234567"
        email           TEXT,   -- "minh@gmail.com"
        organization    TEXT,   -- "Công ty ABC"

        -- ── Địa điểm ───────────────────────────────────────────────
        place_name      TEXT,   -- "Quán cà phê Highlands"
        address         TEXT,   -- "123 Nguyễn Huệ, Quận 1"
        location_lat    REAL,   -- 10.762622
        location_lng    REAL,   -- 106.660172
        location_name   TEXT,   -- "Quận 1, TP.HCM" (reverse geocoding)

        -- ── Thời gian / Sự kiện ────────────────────────────────────
        event_title     TEXT,   -- "Họp nhóm dự án X"
        event_time      TEXT,   -- "2026-05-02T15:00:00" (ISO format)
        deadline        TEXT,   -- "2026-05-05" (ngày hết hạn)

        -- ── Phân loại ──────────────────────────────────────────────
        -- 'contact' | 'meeting' | 'shopping' | 'location' | 'reminder' | 'note' | 'other'
        category        TEXT    NOT NULL DEFAULT 'note',

        -- ── Việc cần làm ───────────────────────────────────────────
        -- JSON array: ["Gọi lại anh Minh", "Gửi báo giá trước thứ 6"]
        action_items    TEXT    NOT NULL DEFAULT '[]',

        -- ── AI có nên tạo reminder không ───────────────────────────
        reminder_needed INTEGER NOT NULL DEFAULT 0,  -- 1 = cần, 0 = không

        -- ── Raw output của AI (backup toàn bộ JSON) ─────────────────
        -- Lưu để sau này parse lại mà không cần gọi AI lần 2
        raw_json        TEXT,

        created_at      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),

        FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
        -- ON DELETE CASCADE: xóa note → tự xóa extracted_info liên quan
    );

    -- ══════════════════════════════════════════════════════════════════
    -- 3. REMINDERS — nhắc nhở gắn với note
    --    Tự động tạo khi extracted_info.reminder_needed = 1
    -- ══════════════════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS reminders (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        note_id     INTEGER,                -- Có thể null (reminder độc lập)

        title       TEXT    NOT NULL,       -- "Gọi lại anh Minh"
        body        TEXT,                   -- Nội dung chi tiết (optional)

        remind_at   TEXT    NOT NULL,       -- "2026-05-02T15:00:00" (ISO)

        -- Lặp lại: NULL | 'daily' | 'weekly' | 'monthly'
        repeat_type TEXT,

        is_done     INTEGER NOT NULL DEFAULT 0,  -- 0 = chưa, 1 = đã xong

        created_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),

        FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
    );

    -- ══════════════════════════════════════════════════════════════════
    -- 4. TAGS — danh sách tag tập trung
    --    Tự động tạo từ category của extracted_info
    -- ══════════════════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS tags (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT    NOT NULL UNIQUE,             -- Tên tag, duy nhất
        color      TEXT    NOT NULL DEFAULT '#7C3AED',  -- Màu hiển thị (accent mặc định)
        created_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- ══════════════════════════════════════════════════════════════════
    -- 5. NOTE_TAGS — bảng trung gian notes ↔ tags (many-to-many)
    --    1 note có nhiều tag, 1 tag gắn với nhiều note
    -- ══════════════════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS note_tags (
        note_id    INTEGER NOT NULL,
        tag_id     INTEGER NOT NULL,
        PRIMARY KEY (note_id, tag_id),                  -- Composite key, không trùng lặp
        FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id)  REFERENCES tags(id)  ON DELETE CASCADE
    );
    -- ══════════════════════════════════════════════════════════════════
    -- note-attachment — bảng trung gian dùng để lưu các file attachment
    -- một note có nhiều attachment
    -- ══════════════════════════════════════════════════════════════════ 

    CREATE TABLE IF NOT EXISTS note_attachments (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        note_id       INTEGER NOT NULL,
 
        -- Loại: 'image' | 'audio' | 'video' | 'file'
        type          TEXT    NOT NULL DEFAULT 'file',
 
        -- Đường dẫn tương đối trên server, vd: "uploads/images/xxx.jpg"
        file_path     TEXT    NOT NULL,
 
        -- Metadata
        file_name     TEXT,                  -- tên file gốc từ client
        mime_type     TEXT,                  -- "image/jpeg", "audio/x-m4a"...
        file_size     INTEGER,               -- bytes
        duration      INTEGER,               -- ms — chỉ dùng cho audio/video
        width         INTEGER,               -- px — chỉ dùng cho image/video
        height        INTEGER,               -- px — chỉ dùng cho image/video
 
        -- Caption / ghi chú kèm attachment (vd: chú thích ảnh)
        caption       TEXT    DEFAULT '',
 
        -- Thứ tự hiển thị trong note (để giữ đúng vị trí block)
        display_order INTEGER NOT NULL DEFAULT 0,
 
        created_at    TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
 
        FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
    );

    -- ══════════════════════════════════════════════════════════════════
    -- INDEX — tăng tốc các truy vấn thường dùng
    -- ══════════════════════════════════════════════════════════════════

    -- Tìm kiếm full-text theo content và summary
    CREATE INDEX IF NOT EXISTS idx_notes_content
        ON notes(content);

    -- Lọc theo loại input (text/image/voice/video)
    CREATE INDEX IF NOT EXISTS idx_notes_type
        ON notes(type);

    -- Lọc note active (chưa archive), sắp xếp mới nhất
    CREATE INDEX IF NOT EXISTS idx_notes_active
        ON notes(is_archived, created_at DESC);

    -- Lọc note được ghim
    CREATE INDEX IF NOT EXISTS idx_notes_pinned
        ON notes(is_pinned, created_at DESC);

    -- Lọc note chưa được AI xử lý (dùng cho background job)
    CREATE INDEX IF NOT EXISTS idx_notes_ai_processed
        ON notes(ai_processed);

    -- Tìm reminder theo thời gian (cho notification scheduler)
    CREATE INDEX IF NOT EXISTS idx_reminders_time
        ON reminders(remind_at, is_done);

    -- Tìm extracted_info theo category
    CREATE INDEX IF NOT EXISTS idx_extracted_category
        ON extracted_info(category);

    -- Tìm theo note_id trong note_tags
    CREATE INDEX IF NOT EXISTS idx_note_tags_note
        ON note_tags(note_id);

    """)

    conn.commit()
    conn.close()
    print("✅ Database initialized:", DB_PATH)


# ── Chạy trực tiếp để test ───────────────────────────────────────────────────
if __name__ == "__main__":
    init_db()

    # Verify — in ra danh sách bảng đã tạo
    conn = get_connection()
    tables = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).fetchall()
    print("\n📋 Tables created:")
    for t in tables:
        print(f"   • {t['name']}")

    indexes = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='index' ORDER BY name"
    ).fetchall()
    print("\n⚡ Indexes created:")
    for i in indexes:
        print(f"   • {i['name']}")

    conn.close()