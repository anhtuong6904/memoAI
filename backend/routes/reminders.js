// backend/routes/reminders.js

const express = require('express');
const router  = express.Router();
const db      = require('../db/database');

// GET /api/reminders
router.get('/', (req, res) => {
  try {
    const reminders = db.prepare(`
      SELECT
        r.*,
        n.content AS note_content,
        n.summary AS note_summary,
        n.type    AS note_type
      FROM reminders r
      LEFT JOIN notes n ON r.note_id = n.id
      ORDER BY r.remind_at ASC
    `).all();

    res.json(reminders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reminders/upcoming
// ✅ FIX 1: >= thay vì < để lấy nhắc nhở CHƯA TỚI
router.get('/upcoming', (req, res) => {
  try {
    const now = new Date().toISOString();

    const reminders = db.prepare(`
      SELECT
        r.*,
        n.content AS note_content
      FROM reminders r
      LEFT JOIN notes n ON r.note_id = n.id
      WHERE r.is_done   = 0
        AND r.remind_at >= ?
      ORDER BY r.remind_at ASC
    `).all(now);

    res.json(reminders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reminders/overdue — nhắc nhở quá hạn
router.get('/overdue', (req, res) => {
  try {
    const now = new Date().toISOString();

    const reminders = db.prepare(`
      SELECT
        r.*,
        n.content AS note_content
      FROM reminders r
      LEFT JOIN notes n ON r.note_id = n.id
      WHERE r.is_done  = 0
        AND r.remind_at < ?
      ORDER BY r.remind_at DESC
    `).all(now);

    res.json(reminders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reminders/:id
// ✅ FIX 2: 'reminder r' → 'reminders r'
router.get('/:id', (req, res) => {
  try {
    const reminder = db.prepare(`
      SELECT
        r.*,
        n.content AS note_content,
        n.summary AS note_summary
      FROM reminders r
      LEFT JOIN notes n ON r.note_id = n.id
      WHERE r.id = ?
    `).get(req.params.id);

    if (!reminder) {
      return res.status(404).json({ error: 'Không tìm thấy nhắc nhở' });
    }

    res.json(reminder);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reminders
router.post('/', (req, res) => {
  try {
    const { title, remindAt, noteId } = req.body;

    if (!title || title.trim() === '') {
      return res.status(400).json({ error: 'Tiêu đề không được để trống' });
    }
    if (!remindAt) {
      return res.status(400).json({ error: 'Thời gian không được để trống' });
    }

    const date = new Date(remindAt);
    if (isNaN(date.getTime())) {
      return res.status(400).json({ error: 'Định dạng thời gian không hợp lệ' });
    }

    if (noteId !== undefined && noteId !== null) {
      const note = db.prepare('SELECT id FROM notes WHERE id = ?').get(noteId);
      if (!note) {
        return res.status(404).json({ error: 'Ghi chú không tồn tại' });
      }
    }

    const now    = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO reminders (note_id, title, remind_at, is_done, created_at)
      VALUES (?, ?, ?, 0, ?)
    `).run(noteId ?? null, title.trim(), remindAt, now);

    const newReminder = db.prepare(`
      SELECT r.*, n.content AS note_content
      FROM reminders r
      LEFT JOIN notes n ON r.note_id = n.id
      WHERE r.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(newReminder);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/reminders/:id/done — đặt TRƯỚC PUT /:id
router.put('/:id/done', (req, res) => {
  try {
    const { id } = req.params;

    const existing = db.prepare('SELECT * FROM reminders WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Không tìm thấy nhắc nhở' });
    }

    const newStatus = existing.is_done === 1 ? 0 : 1;
    db.prepare('UPDATE reminders SET is_done = ? WHERE id = ?').run(newStatus, id);

    const updated = db.prepare(`
      SELECT r.*, n.content AS note_content
      FROM reminders r
      LEFT JOIN notes n ON r.note_id = n.id
      WHERE r.id = ?
    `).get(id);

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/reminders/:id
router.put('/:id', (req, res) => {
  try {
    const { id }              = req.params;
    const { title, remindAt } = req.body;

    // ✅ FIX 3a: Kiểm tra existing trước khi dùng
    const existing = db.prepare('SELECT * FROM reminders WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Không tìm thấy nhắc nhở' });
    }

    if (remindAt) {
      const date = new Date(remindAt);
      if (isNaN(date.getTime())) {
        return res.status(400).json({ error: 'Định dạng thời gian không hợp lệ' });
      }
    }

    db.prepare(`
      UPDATE reminders SET title = ?, remind_at = ? WHERE id = ?
    `).run(
      title    ?? existing.title,
      remindAt ?? existing.remind_at, // ✅ FIX 3b: remind_at thay vì remindAt
      id
    );

    // ✅ FIX 3c: Thêm .get(id) để lấy data thật
    const updated = db.prepare(`
      SELECT r.*, n.content AS note_content
      FROM reminders r
      LEFT JOIN notes n ON r.note_id = n.id
      WHERE r.id = ?
    `).get(id);

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/reminders/:id
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;

    const existing = db.prepare('SELECT * FROM reminders WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Không tìm thấy nhắc nhở' });
    }

    db.prepare('DELETE FROM reminders WHERE id = ?').run(id);
    res.json({ message: 'Đã xóa nhắc nhở', id: Number(id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;