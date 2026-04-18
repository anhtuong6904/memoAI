const express = require('express');
const router  = express.Router();
const db      = require('../db/database');


const { uploadAudio, uploadVideo, uploadImage } = require('../middleware/upload');

// GET /api/notes — thêm filter is_archived
router.get('/', (req, res) => {
  try {
    const { archived = '0', pinned } = req.query;

    let query = 'SELECT * FROM notes WHERE is_archived = ?';
    const params = [archived === '1' ? 1 : 0];

    if (pinned === '1') {
      query += ' AND is_pinned = 1';
    }

    query += ' ORDER BY is_pinned DESC, updated_at DESC';

    const notes = db.prepare(query).all(...params);
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
    const { content, title = '', type = 'text' } = req.body;

    if (!content || content.trim() === '') {
      return res.status(400).json({ error: 'Nội dung không được để trống' });
    }

    const now = new Date().toISOString();

    const result = db.prepare(`
      INSERT INTO notes (title, content, type, tags, created_at, updated_at)
      VALUES (?, ?, ?, '[]', ?, ?)
    `).run(title.trim(), content.trim(), type, now, now);

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

// PUT /api/notes/:id — cập nhật updated_at khi sửa
router.put('/:id', (req, res) => {
  try {
    const { content, title, summary, tags } = req.body;
    const { id } = req.params;

    const existing = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Không tìm thấy ghi chú' });
    }

    const now = new Date().toISOString();

    db.prepare(`
      UPDATE notes
      SET title = ?, content = ?, summary = ?, tags = ?, updated_at = ?
      WHERE id = ?
    `).run(
      title   ?? existing.title,
      content ?? existing.content,
      summary ?? existing.summary,
      tags    ?? existing.tags,
      now,     // ← luôn cập nhật updated_at
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

// PATCH /api/notes/:id/pin — toggle ghim
router.patch('/:id/pin', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Không tìm thấy' });

    const newVal = existing.is_pinned === 1 ? 0 : 1;
    db.prepare('UPDATE notes SET is_pinned = ?, updated_at = ? WHERE id = ?')
      .run(newVal, new Date().toISOString(), id);

    res.json({ id: Number(id), is_pinned: newVal });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/notes/:id/archive — toggle lưu trữ
router.patch('/:id/archive', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Không tìm thấy' });

    const newVal = existing.is_archived === 1 ? 0 : 1;
    db.prepare('UPDATE notes SET is_archived = ?, updated_at = ? WHERE id = ?')
      .run(newVal, new Date().toISOString(), id);

    res.json({ id: Number(id), is_archived: newVal });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;