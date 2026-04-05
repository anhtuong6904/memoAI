const express = require('express');
const router = express.Router();
const db = require('./db/database');
const upload = require('../middleware/upload');
const { pragma } = require('../db/database');

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
        .all('%${q}%', '%${q}%');// '%' wild card de tim keyword q ben trong summary hay content
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
        const now = new Date().toISOstring();
        //.run() = thuc thi INSERT/UPDATE/DELETE
        //tra ve {lastInsertRowId, changes}
        const result = db
        .prepare('INSERT INTO notes (content, type, tags, created_at VALUES (?, ?, [], ?)')
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

//post api/notes/file
//upload file de tao ghi chu tu file co cac dinh dang am thanh, anh, clip,....
//dung multer middleware de xu ly file upload
router.post('/file', upload.single('image'), (req, res) => {
    try{
        if(!req.file){
            return 
        }
    }
    catch(err){

    }
})


module.exports = router;