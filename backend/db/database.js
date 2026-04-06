
const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname,'memoai.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS notes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    content     TEXT NOT NULL,
    summary     TEXT,
    type        TEXT    DEFAULT 'text',  -- 'text' | 'image' | 'voice' | 'video'
    file_path   TEXT,
    tags        TEXT DEFAULT '[]',
    created_at  TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS reminders (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    note_id     INTEGER,
    title       TEXT NOT NULL,
    remind_at   TEXT NOT NULL,
    is_done     INTEGER DEFAULT 0,
    created_at  TEXT NOT NULL,
    FOREIGN KEY (note_id) REFERENCES notes(id)
  );
`);

module.exports = db;