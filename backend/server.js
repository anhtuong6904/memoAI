const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { error } = require('console');
require('dotenv').config();

const app = express();
//doc port tu .env neu khong co thi dung port 3001
const PORT = process.env.PORT ;

//cho phep goi API tu IP khac
app.use(cors());// Cho phép mọi IP khi dev

//parse json body 
app.use(express.json());

//parse form data dang text
app.use(express.urlencoded({extended: true}));

//tao them thu muc uploads
//tranh loi khi multer co ghi file cho thu muc khong ton tai
//can dung cho dich vu luu tru anh cloudinary local thi khong can
if(!fs.existsSync('uploads')){
  fs.mkdirSync('uploads', {recursive: true});
}

//serve file tinh trong thu muc upload 
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

//setup routes
app.get('/api/health', (req,res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    message: 'memoAI server dang chay'
  })
})

app.use('/api/notes', require('./routes/notes'));
app.use('/api/reminders', require('./routes/reminders'));

//xu li route khong ton tai 
app.use((req, res) => {
  res.status(404).json({error: `Route ${req.method} ${req.url} khong ton tai`});
})

//xu ly loi toan cuc 
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  res.status(500).json({error: err.message || 'loi server'});
})

//khoi dong server 
app.listen(PORT, () => {
  console.log(`🚀 SERVER: http://localhost:${PORT}`);
  console.log(`📱 API: http://192.168.1.11:${PORT}/api`);
  console.log(`❤️ HEALTH: http://192.168.1.11:${PORT}/api/health`);
});