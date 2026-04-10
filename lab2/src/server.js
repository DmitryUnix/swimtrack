require('dotenv').config();
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

//подключение к базе данных
require('./database'); 

// Middleware
app.use(express.json()); //понимает JSON от клиента
app.use(express.static('public')); //открывает файлы из папки public

//подключаем маршруты авторизации
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

const poolsRoutes = require('./routes/pools');
app.use('/api/pools', poolsRoutes);

//тестовый маршрут
app.get('/', (req, res) => {
    res.send('<h1>SwimTrack Lab 2 запущен</h1>');
});

//запуск сервера
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});