const express = require('express');
const cors = require('cors');
const app = express();



app.use(cors());                              // Cho phép mọi IP khi dev
app.use(express.json());
app.get('/', (req, res) => {
  res.send('hello world')
})

// app.use('/uploads', express.static('uploads'));

app.use('/api/notes',     require('./routes/notes'));
// app.use('/api/reminders', require('./routes/reminders'));

app.listen(3000, () => console.log('Server: http://localhost:3000'));


