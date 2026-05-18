require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const authRoutes = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');
const messageRoutes = require('./src/routes/messageRoutes');
const groupRoutes = require('./src/routes/groupRoutes');
const { initSocket } = require('./src/socket/socketHandler');

const app = express();
const httpServer = http.createServer(app);

// Cấu hình Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: [
      'https://hieukhong27.github.io',
      'http://localhost:5500',
      'http://127.0.0.1:5500'
    ],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: [
    'https://hieukhong27.github.io',
    'http://localhost:5500',
    'http://127.0.0.1:5500'
  ],
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/groups', groupRoutes);

// Kiểm tra server hoạt động
app.get('/health', (req, res) => res.json({ status: 'OK' }));

// Khởi động Socket.IO
initSocket(io);

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
});