// backend/db/database.js

const Database = require('better-sqlite3');
const path     = require('path');

const db = new Database(path.join(__dirname, 'memoai.db'));

// Bật WAL mode — tăng hiệu năng đọc/ghi đồng thời
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON'); // Bật foreign key constraint

db.exec(`

  -- ══════════════════════════════════════════════════════
  -- NOTES — bảng chính lưu tất cả ghi chú
  -- ══════════════════════════════════════════════════════
  CREATE TABLE IF NOT EXISTS notes (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Nội dung
    title         TEXT,                        -- Tiêu đề (có thể null với voice/image)
    content       TEXT    NOT NULL DEFAULT '', -- Nội dung chính (markdown)
    summary       TEXT,                        -- AI tóm tắt (null cho đến khi AI xử lý)

    -- Loại ghi chú
    -- 'text' | 'image' | 'voice' | 'video'
    type          TEXT    NOT NULL DEFAULT 'text',

    -- File đính kèm (URL Cloudinary hoặc local path)
    file_path     TEXT,

    -- Tags lưu JSON string — vd: '["Công việc","Quan trọng"]'
    -- Dùng cho quick filter, không cần query phức tạp
    tags          TEXT    NOT NULL DEFAULT '[]',

    -- Nguồn gốc (nếu capture từ web/app khác)
    source_url    TEXT,

    -- Vị trí (JSON: {"lat": 10.7, "lng": 106.6, "address": "..."})
    -- Tự động lấy khi chụp ảnh ngoài trời
    location      TEXT,

    -- Trạng thái
    is_pinned     INTEGER NOT NULL DEFAULT 0, -- 1 = ghim lên đầu
    is_archived   INTEGER NOT NULL DEFAULT 0, -- 1 = lưu trữ, ẩn khỏi danh sách chính
    ai_processed  INTEGER NOT NULL DEFAULT 0, -- 1 = AI đã xử lý xong (tóm tắt, tags...)

    -- Thời gian
    created_at    TEXT    NOT NULL,
    updated_at    TEXT    NOT NULL            -- Cập nhật mỗi khi sửa note
  );

  -- ══════════════════════════════════════════════════════
  -- TAGS — bảng tag riêng để quản lý tag tập trung
  -- Dùng song song với cột tags JSON trong notes
  -- tags JSON → filter nhanh
  -- bảng tags → quản lý, đếm, màu sắc
  -- ══════════════════════════════════════════════════════
  CREATE TABLE IF NOT EXISTS tags (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL UNIQUE,        -- Tên tag, duy nhất
    color      TEXT    NOT NULL DEFAULT '#6C63FF', -- Màu hiển thị
    created_at TEXT    NOT NULL
  );

  -- ══════════════════════════════════════════════════════
  -- NOTE_TAGS — bảng trung gian notes ↔ tags (many-to-many)
  -- 1 note có nhiều tag, 1 tag gắn với nhiều note
  -- ══════════════════════════════════════════════════════
  CREATE TABLE IF NOT EXISTS note_tags (
    note_id    INTEGER NOT NULL,
    tag_id     INTEGER NOT NULL,
    PRIMARY KEY (note_id, tag_id),
    FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id)  REFERENCES tags(id)  ON DELETE CASCADE
  );

  -- ══════════════════════════════════════════════════════
  -- REMINDERS — nhắc nhở gắn với note
  -- ══════════════════════════════════════════════════════
  CREATE TABLE IF NOT EXISTS reminders (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    note_id     INTEGER,                       -- Có thể null (reminder độc lập)
    title       TEXT    NOT NULL,
    remind_at   TEXT    NOT NULL,              -- ISO string

    -- Lặp lại: null | 'daily' | 'weekly' | 'monthly'
    repeat_type TEXT,

    is_done     INTEGER NOT NULL DEFAULT 0,   -- 0 = chưa, 1 = xong
    created_at  TEXT    NOT NULL,
    FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
    -- ON DELETE CASCADE: xóa note → tự xóa reminder liên quan
  );

  -- ══════════════════════════════════════════════════════
  -- INDEX — tăng tốc truy vấn thường dùng
  -- ══════════════════════════════════════════════════════

  -- Tìm kiếm theo nội dung (LIKE query)
  CREATE INDEX IF NOT EXISTS idx_notes_content
    ON notes(content);

  -- Lọc theo type (text/image/voice/video)
  CREATE INDEX IF NOT EXISTS idx_notes_type
    ON notes(type);

  -- Lọc note chưa archive, sắp xếp mới nhất
  CREATE INDEX IF NOT EXISTS idx_notes_archived_created
    ON notes(is_archived, created_at DESC);

  -- Lọc note được ghim
  CREATE INDEX IF NOT EXISTS idx_notes_pinned
    ON notes(is_pinned);

  -- Tìm reminder theo thời gian
  CREATE INDEX IF NOT EXISTS idx_reminders_remind_at
    ON reminders(remind_at, is_done);
`);

module.exports = db;