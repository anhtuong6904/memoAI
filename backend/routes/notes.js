const express = require('express');
const router  = express.Router();
const db      = require('../db/database');

// ✅ Bỏ dòng import params không tồn tại
const { uploadAudio, uploadVideo, uploadImage } = require('../middleware/upload');

// GET /api/notes
router.get('/', (req, res) => {
  try {
    const notes = db
      .prepare('SELECT * FROM notes ORDER BY created_at DESC')
      .all();
    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/notes/search?q=keyword
router.get('/search', (req, res) => {
  try {
    const q = req.query.q || '';
    const notes = db
      .prepare(`
        SELECT * FROM notes
        WHERE content LIKE ? OR summary LIKE ?
        ORDER BY created_at DESC
      `)
      .all(`%${q}%`, `%${q}%`);
    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/notes/:id
router.get('/:id', (req, res) => {
  try {
    const note = db
      .prepare('SELECT * FROM notes WHERE id = ?')
      .get(req.params.id);

    if (!note) {
      return res.status(404).json({ error: 'Không tìm thấy ghi chú' });
    }
    res.json(note);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notes — tạo ghi chú text
router.post('/', (req, res) => {
  try {
    const { content, type = 'text' } = req.body;

    if (!content || content.trim() === '') {
      return res.status(400).json({ error: 'Nội dung không được để trống' });
    }

    const now = new Date().toISOString();

    // ✅ Fix: tags phải là string '[]' trong SQL
    const result = db
      .prepare(`
        INSERT INTO notes (content, type, tags, created_at)
        VALUES (?, ?, '[]', ?)
      `)
      .run(content.trim(), type, now);

    const newNote = db
      .prepare('SELECT * FROM notes WHERE id = ?')
      .get(result.lastInsertRowid);

    res.status(201).json(newNote);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notes/image
router.post('/image', (req, res) => {
  uploadImage(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Không có file ảnh' });

    const fileUrl = req.file.path;
    const now     = new Date().toISOString();

    // type = 'image' ✅ khớp schema
    const result = db
      .prepare(`
        INSERT INTO notes (content, type, file_path, tags, created_at)
        VALUES (?, 'image', ?, '[]', ?)
      `)
      .run('Đang xử lý ảnh...', fileUrl, now);

    const newNote = db
      .prepare('SELECT * FROM notes WHERE id = ?')
      .get(result.lastInsertRowid);

    res.status(201).json(newNote);
  });
});

// POST /api/notes/audio
router.post('/audio', (req, res) => {
  uploadAudio(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Không có file audio' });

    const fileUrl = req.file.path;
    const now     = new Date().toISOString();

    // ✅ Fix: 'audio' → 'voice' cho khớp schema
    const result = db
      .prepare(`
        INSERT INTO notes (content, type, file_path, tags, created_at)
        VALUES (?, 'voice', ?, '[]', ?)
      `)
      .run('Đang xử lý âm thanh...', fileUrl, now);

    const newNote = db
      .prepare('SELECT * FROM notes WHERE id = ?')
      .get(result.lastInsertRowid);

    res.status(201).json(newNote);
  });
});

// POST /api/notes/video
router.post('/video', (req, res) => {
  uploadVideo(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Không có file video' });

    const fileUrl = req.file.path;
    const now     = new Date().toISOString();

    // type = 'video' ✅ khớp schema
    const result = db
    
      .prepare(`
        INSERT INTO notes (content, type, file_path, tags, created_at)
        VALUES (?, 'video', ?, '[]', ?)
      `)
      .run('Đang xử lý video...', fileUrl, now);

    const newNote = db
      .prepare('SELECT * FROM notes WHERE id = ?')
      .get(result.lastInsertRowid);

    res.status(201).json(newNote);
  });
});

// PUT /api/notes/:id
router.put('/:id', (req, res) => {
  try {
    const { content, summary, tags } = req.body;
    const { id }                     = req.params;

    const existing = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Không tìm thấy ghi chú' });
    }

    db.prepare(`
      UPDATE notes SET content = ?, summary = ?, tags = ? WHERE id = ?
    `).run(
      content ?? existing.content,
      summary ?? existing.summary,
      tags    ?? existing.tags,
      id
    );

    const updated = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/notes/:id
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;

    const existing = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Không tìm thấy ghi chú' });
    }

    db.prepare('DELETE FROM notes WHERE id = ?').run(id);
    res.json({ message: 'Đã xóa ghi chú', id: Number(id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;