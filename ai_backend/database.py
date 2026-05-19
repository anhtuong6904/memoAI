import logging
import sqlite3
from pathlib import Path

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).parent
DB_PATH  = BASE_DIR / "memoai.db"


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    conn = get_connection()

    # Migration: drop bảng cũ từ schema BlockEditor
    # Dùng whitelist cứng — không nhận input từ bên ngoài nên an toàn
    _DROP_WHITELIST = frozenset(["block", "blocks", "captures", "ai_extractions"])
    conn.execute("PRAGMA foreign_keys = OFF")
    for old_table in _DROP_WHITELIST:
        try:
            existing = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
                [old_table],
            ).fetchone()
            if existing:
                # Table name validated against whitelist — safe to interpolate
                conn.execute(f"DROP TABLE IF EXISTS {old_table}")  # noqa: S608
                conn.commit()
                logger.info("migration: dropped old table %r", old_table)
        except Exception as e:
            logger.warning("migration: drop %r error: %s", old_table, e)
    conn.execute("PRAGMA foreign_keys = ON")

    conn.executescript("""
    CREATE TABLE IF NOT EXISTS notes (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        title         TEXT,
        content       TEXT    NOT NULL DEFAULT '',
        content_json  TEXT,
        summary       TEXT,
        type          TEXT    NOT NULL DEFAULT 'text',
        file_path     TEXT,
        file_url      TEXT,
        tags          TEXT    NOT NULL DEFAULT '[]',
        source_url    TEXT,
        location      TEXT,
        is_pinned     INTEGER NOT NULL DEFAULT 0,
        is_archived   INTEGER NOT NULL DEFAULT 0,
        ai_processed  INTEGER NOT NULL DEFAULT 0,
        embedded_at   TEXT,
        created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        updated_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS extracted_info (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        note_id         INTEGER NOT NULL UNIQUE,
        person_name     TEXT, phone TEXT, email TEXT, organization TEXT,
        place_name      TEXT, address TEXT, location_lat REAL, location_lng REAL,
        event_title     TEXT, event_time TEXT, deadline TEXT,
        category        TEXT NOT NULL DEFAULT 'note',
        action_items    TEXT NOT NULL DEFAULT '[]',
        reminder_needed INTEGER NOT NULL DEFAULT 0,
        raw_json        TEXT,
        created_at      TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS reminders (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        note_id     INTEGER,
        title       TEXT NOT NULL,
        body        TEXT,
        remind_at   TEXT NOT NULL,
        repeat_type TEXT,
        is_done     INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS tags (
        id   INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        color TEXT NOT NULL DEFAULT '#6C63FF',
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS note_tags (
        note_id INTEGER NOT NULL, tag_id INTEGER NOT NULL,
        PRIMARY KEY (note_id, tag_id),
        FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id)  REFERENCES tags(id)  ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS note_attachments (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        note_id    INTEGER NOT NULL,
        position   INTEGER NOT NULL DEFAULT 0,
        file_name  TEXT NOT NULL,
        file_path  TEXT NOT NULL,
        file_url   TEXT NOT NULL,
        mime_type  TEXT,
        file_group TEXT NOT NULL DEFAULT 'document',
        file_size  INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_notes_active     ON notes(is_archived,is_pinned,created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_notes_type       ON notes(type,is_archived);
    CREATE INDEX IF NOT EXISTS idx_notes_ai         ON notes(ai_processed);
    CREATE INDEX IF NOT EXISTS idx_note_tags_note   ON note_tags(note_id);
    CREATE INDEX IF NOT EXISTS idx_note_tags_tag    ON note_tags(tag_id);
    CREATE INDEX IF NOT EXISTS idx_reminders_time   ON reminders(remind_at,is_done);
    CREATE INDEX IF NOT EXISTS idx_extracted_note   ON extracted_info(note_id);
    CREATE INDEX IF NOT EXISTS idx_extracted_cat    ON extracted_info(category);
    CREATE INDEX IF NOT EXISTS idx_attachments_note ON note_attachments(note_id);
    CREATE TABLE IF NOT EXISTS chat_messages (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        role       TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
        content    TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_chat_messages_time ON chat_messages(created_at);
    """)
    conn.commit()

    # Migrations cho DB cũ (thêm cột nếu chưa có)
    _add_col_if_missing(conn, "notes", "content_json", "ALTER TABLE notes ADD COLUMN content_json TEXT")
    _add_col_if_missing(conn, "notes", "file_url",     "ALTER TABLE notes ADD COLUMN file_url TEXT")
    _add_col_if_missing(conn, "notes", "source_url",   "ALTER TABLE notes ADD COLUMN source_url TEXT")
    # Fix #5: cột embedded_at cho incremental indexing
    _add_col_if_missing(conn, "notes", "embedded_at",  "ALTER TABLE notes ADD COLUMN embedded_at TEXT")
    # Index cho embedded_at — tạo SAU khi đảm bảo cột đã tồn tại
    conn.execute("CREATE INDEX IF NOT EXISTS idx_notes_embedded ON notes(embedded_at, updated_at)")
    conn.commit()

    att_cols = [r[1] for r in conn.execute("PRAGMA table_info(note_attachments)").fetchall()]
    if att_cols and "file_group" not in att_cols:
        conn.execute("ALTER TABLE note_attachments ADD COLUMN file_group TEXT NOT NULL DEFAULT 'document'")
        conn.commit()
    if att_cols and "extracted_text" not in att_cols:
        conn.execute("ALTER TABLE note_attachments ADD COLUMN extracted_text TEXT")
        conn.commit()

    conn.close()
    logger.info("DB ready: %s", DB_PATH)


_TABLE_WHITELIST = frozenset(["notes", "note_attachments", "extracted_info", "reminders",
                              "tags", "note_tags", "chat_messages"])


def _add_col_if_missing(conn, table: str, col: str, sql: str) -> None:
    if table not in _TABLE_WHITELIST:
        logger.error("_add_col_if_missing: unknown table %r — skipping", table)
        return
    cols = [r[1] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()]  # noqa: S608
    if col not in cols:
        conn.execute(sql)
        conn.commit()
        logger.info("migration: added column %s.%s", table, col)


if __name__ == "__main__":
    init_db()