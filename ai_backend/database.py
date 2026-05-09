import sqlite3
from pathlib import Path

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
    conn.executescript('''
    CREATE TABLE IF NOT EXISTS notes (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        title         TEXT,
        content       TEXT    NOT NULL DEFAULT \'\',
        content_json  TEXT,
        summary       TEXT,
        type          TEXT    NOT NULL DEFAULT \'text\',
        file_path     TEXT,
        file_url      TEXT,
        tags          TEXT    NOT NULL DEFAULT \'[]\',
        source_url    TEXT,
        location      TEXT,
        is_pinned     INTEGER NOT NULL DEFAULT 0,
        is_archived   INTEGER NOT NULL DEFAULT 0,
        ai_processed  INTEGER NOT NULL DEFAULT 0,
        created_at    TEXT NOT NULL DEFAULT (datetime(\'now\',\'localtime\')),
        updated_at    TEXT NOT NULL DEFAULT (datetime(\'now\',\'localtime\'))
    );
    CREATE TABLE IF NOT EXISTS extracted_info (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        note_id         INTEGER NOT NULL UNIQUE,
        person_name     TEXT, phone TEXT, email TEXT, organization TEXT,
        place_name      TEXT, address TEXT, location_lat REAL, location_lng REAL,
        event_title     TEXT, event_time TEXT, deadline TEXT,
        category        TEXT NOT NULL DEFAULT \'note\',
        action_items    TEXT NOT NULL DEFAULT \'[]\',
        reminder_needed INTEGER NOT NULL DEFAULT 0,
        raw_json        TEXT,
        created_at      TEXT NOT NULL DEFAULT (datetime(\'now\',\'localtime\')),
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
        created_at  TEXT NOT NULL DEFAULT (datetime(\'now\',\'localtime\')),
        FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS tags (
        id   INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        color TEXT NOT NULL DEFAULT \'#6C63FF\',
        created_at TEXT NOT NULL DEFAULT (datetime(\'now\',\'localtime\'))
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
        file_name  TEXT NOT NULL,
        file_path  TEXT NOT NULL,
        file_url   TEXT NOT NULL,
        mime_type  TEXT,
        file_group TEXT NOT NULL DEFAULT \'document\',
        file_size  INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime(\'now\',\'localtime\')),
        FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_notes_active     ON notes(is_archived,is_pinned,created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_notes_type       ON notes(type,is_archived);
    CREATE INDEX IF NOT EXISTS idx_notes_ai         ON notes(ai_processed);
    CREATE INDEX IF NOT EXISTS idx_note_tags_note   ON note_tags(note_id);
    CREATE INDEX IF NOT EXISTS idx_reminders_time   ON reminders(remind_at,is_done);
    CREATE INDEX IF NOT EXISTS idx_extracted_note   ON extracted_info(note_id);
    CREATE INDEX IF NOT EXISTS idx_extracted_cat    ON extracted_info(category);
    CREATE INDEX IF NOT EXISTS idx_attachments_note ON note_attachments(note_id);
    ''')
    conn.commit()
    # Safe migrations
    for tbl, col, sql in [
        ("notes","content_json","ALTER TABLE notes ADD COLUMN content_json TEXT"),
        ("notes","file_url",    "ALTER TABLE notes ADD COLUMN file_url TEXT"),
        ("notes","source_url",  "ALTER TABLE notes ADD COLUMN source_url TEXT"),
    ]:
        cols = [r[1] for r in conn.execute(f"PRAGMA table_info({tbl})").fetchall()]
        if col not in cols:
            conn.execute(sql); conn.commit()
            print(f"  migration: added {tbl}.{col}")
    att_cols = [r[1] for r in conn.execute("PRAGMA table_info(note_attachments)").fetchall()]
    if att_cols and "file_group" not in att_cols:
        conn.execute("ALTER TABLE note_attachments ADD COLUMN file_group TEXT NOT NULL DEFAULT \'document\'")
        conn.commit()
    conn.close()
    print(f"DB ready: {DB_PATH}")

if __name__ == "__main__":
    init_db()