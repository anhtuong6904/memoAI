const express = require('express');
const router = express.Router();
const db = require('../db/database');
const {uploadAudio, uploadVideo, uploadImage} = require('../middleware/upload');
const { params } = require('../db/database');

//get api/notes 
//lay tat ca cac note trong data
router.get('/', (req, res) => {
    try{
        // truy van cac ghi chu sap xep theo thu tu mo nhat len truoc
        const notes = db
        .prepare('SELECT * FROM notes ORDER BY created_at DESC')
        .all(); 
        res.json(notes);
    }
    catch (err){
        res.status(500).json({error: err.message});
    }
});

//get api/notes/search?p=keyword 
//lay note co theo keyword co trong content hay summary
//"search" la id va chay nham router ben duoi 
router.get('/search', (req,res) => {
    try{
        const q = req.query.q || '';
        const notes = db
        .prepare('SELECT * FROM notes WHERE content LIKE ? OR summary LIKE ? ORDER BY created_at DESC')
        .all(`%${q}%`, `%${q}%`);// '%' wild card de tim keyword q ben trong summary hay content
        res.json(notes);
    }
    catch(err){
        res.status(500).json({error: err.message});
    }
});

//get api/notes/:id 
//lay 1 note = id
router.get('/:id', (req, res) =>{
    try{
        const note = db
        .prepare('SELECT * FROM notes WHERE ID = ?')
        .get(req.params.id);// .get() = tra ve 1 note hoac undefined

        if(!note){
            return res.status(404).json({error: 'Không thể tìm thấy note'});
        }

        res.json(note);
    }
    catch(err){
        res.status(500).json({error: err.message});
    }   
});

//post api/notes
//tao ghi chu moi tu text;
//body: {context: string, type?: string}
router.post('/', (req,res) => {
    try{
        const {content, type = 'text'} = req.body;

        if(!content || content.trim() === ''){
            return res.status(400).json({error: 'Nội dung không được để trống'});
        }
        //lay tao thoi diem tao note
        const now = new Date().toISOString();
        //.run() = thuc thi INSERT/UPDATE/DELETE
        //tra ve {lastInsertRowId, changes}
        const result = db
        .prepare('INSERT INTO notes (content, type, tags, created_at) VALUES (?, ?, [], ?)')
        .run(content.trim(), type, now);
        //lay lai note moi vua tao de tra ve cho client
        const newNote = db
        .prepare('SELECT * FROM notes WHERE id = ?')
        .get(result.lastInsertRowid);
        
        res.status(201).json(newNote);
    }
    catch(err){
        res.status(500).json({error: err.message});
    }
})

//post api/notes/images
//upload file de tao ghi chu tu file co cac dinh dang am thanh, anh, clip,....
//dung multer middleware de xu ly file upload
router.post('/image', (req, res) => {
    uploadImage(req, res, (err) => {
        //xu li loi
        if(err) return res.status(400).json({error : err.message});
        if(!req.file) return  res.status(400).json({error: 'Khong co file'});
        
        // req.file.path = URL Cloudinary
        const fileUrl = req.file.path;
        const now = new Date().toISOString();

        const result = db
        .prepare("INSERT INTO notes (content, type, file_path, tags, created_at) VALUES (?, 'image', ?, '[]', ?)")
        .run('Đang xử lý ảnh...', fileUrl, now);
        
        const newNote = db
        .prepare('SELECT * FROM notes WHERE id = ? ')
        .get(result.lastInsertRowid);

        res.status(201).json(newNote);
    })
})

//upload file audio
router.post('/audio', (req, res) => {
    uploadAudio(req, res, (err) => {
        //xu li loi
        if(err) return res.status(400).json({error : err.message});
        if(!req.file) return  res.status(400).json({error: 'Khong co file'});
        
        // req.file.path = URL Cloudinary
        const fileUrl = req.file.path;
        const now = new Date().toISOString();

        const result = db
        .prepare(`
        INSERT INTO notes (content, type, file_path, tags, created_at)
        VALUES (?, 'audio', ?, '[]', ?)
        `).run('Đang xử lý âm thanh...', fileUrl, now);
        
        const newNote = db
        .prepare('SELECT * FROM notes WHERE id = ? ')
        .get(result.lastInsertRowid);

        res.status(201).json(newNote);
    })
})

//upload video 
router.post('/video', (req, res) => {
    uploadVideo(req, res, (err) => {
        //xu li loi
        if(err) return res.status(400).json({error : err.message});
        if(!req.file) return  res.status(400).json({error: 'Khong co file'});
        
        // req.file.path = URL Cloudinary
        const fileUrl = req.file.path;
        const now = new Date().toISOString();

        const result = db
        .prepare(`
        INSERT INTO notes (content, type, file_path, tags, created_at)
        VALUES (?, 'video', ?, '[]', ?)
        `).run('Đang xử lý video...', fileUrl, now);
        
        const newNote = db
        .prepare('SELECT * FROM notes WHERE id = ? ')
        .get(result.lastInsertRowid);

        res.status(201).json(newNote);
    })
})

//put /api/notes/:id
//cap nhat note (content, summary, tag);
//body:{content?, summary?, tags?}
router.put('/:id', (req, res)=>{
    try{
        const {content, summary, tags} = req.body;
        const {id} = req.params;

        //kiem tra note da ton tai chua;
        const existing = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
        if(!existing){
            return res.status(404).json({error : 'khong tim thay note'});
        }
        //chi cap nhat field nao dang gui len 
        // ?? = nullish coalescing: dung existing neu khong co gia tri moi 
        db.prepare('UPDATE notes SET content = ? , summary = ? , tags = ? WHERE id = ?')
        .run(content ?? existing.content,
            summary ?? existing.summary,
            tags ?? existing.tags,
            id
        )
        const updated = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
        res.json(updated);
    }
    catch(err){
        res.status(500).json({ error: err.message });
    }
})

//delete /api/notes/:id
//xoa ghi chu
router.delete('/:id', (req,res)=>{
    try{
        const {id} = req.params;

        const existing = db
        .prepare('SELECT * FROM notes WHERE id = ?')
        .get(id);

        if(!existing){
            return res.status(404).json({error: 'khong tim thay note'});
        }
        db.prepare('DELETE FROM notes WHERE id = ?').run(id);
        res.json({message: 'da xoa ghi chu', id: Number(id)});
    }
    catch(err){
        res.status(500).json({error: err.message});
    }
})


module.exports = router;