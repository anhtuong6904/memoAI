const Database = require('better-sqlite3');
const db = new Database('memoai.db');

// prepared statements
const insertNote = db.prepare(`
  INSERT INTO notes (content, summary, type, file_path, tags, created_at)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const insertReminder = db.prepare(`
  INSERT INTO reminders (note_id, title, remind_at, created_at)
  VALUES (?, ?, ?, ?)
`);

const seed = db.transaction(() => {
  const now = new Date().toISOString();

  // 📝 TEXT NOTE
  const note1 = insertNote.run(
    "Learn Node.js, Express and SQLite",
    "Study backend development basics",
    "text",
    null,
    JSON.stringify(["coding", "backend", "nodejs"]),
    now
  );

  // 🖼️ IMAGE NOTE
  const note2 = insertNote.run(
    "Screenshot UI design",
    "Collect UI inspiration",
    "image",
    "https://res.cloudinary.com/demo/image/upload/sample.jpg",
    JSON.stringify(["design", "ui", "inspiration"]),
    now
  );

  // 🎧 AUDIO NOTE
  const note3 = insertNote.run(
    "Meeting recording",
    "Discuss project deadline",
    "voice",
    "https://res.cloudinary.com/demo/video/upload/sample.mp3",
    JSON.stringify(["meeting", "work"]),
    now
  );

  // 🎥 VIDEO NOTE
  const note4 = insertNote.run(
    "Demo app recording",
    "Record demo for presentation",
    "video",
    "https://res.cloudinary.com/demo/video/upload/sample.mp4",
    JSON.stringify(["demo", "presentation"]),
    now
  );

  // ⏰ REMINDERS
  insertReminder.run(note1.lastInsertRowid, "Study at 8PM", "2026-04-07 20:00:00", now);
  insertReminder.run(note2.lastInsertRowid, "Review design", "2026-04-08 09:00:00", now);
  insertReminder.run(note3.lastInsertRowid, "Send meeting notes", "2026-04-08 15:00:00", now);
  insertReminder.run(note4.lastInsertRowid, "Prepare demo", "2026-04-09 10:00:00", now);
});

// chỉ seed khi chưa có data
const count = db.prepare("SELECT COUNT(*) as total FROM notes").get();

if (count.total === 0) {
  seed();
  console.log("✅ Seed data inserted!");
} else {
  console.log("⚠️ Database already has data, skip seeding.");
  
}
const notes = db.prepare("SELECT * FROM notes").all();
console.log(notes);