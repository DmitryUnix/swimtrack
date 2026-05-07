require('dotenv').config();
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

//подключение к базе данных
const db = require('./database');

// Middleware
app.use(express.json()); //понимает JSON от клиента
app.use(express.static('public')); //открывает файлы из папки public

//подключаем маршруты авторизации
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

const poolsRoutes = require('./routes/pools');
app.use('/api/pools', poolsRoutes);

const favoriteRoutes = require('./routes/favorites');
app.use('/api/favorites', favoriteRoutes);

app.get('/api/content/:page', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT title, description FROM site_content WHERE key = $1', 
            [req.params.page]
        );
        if (result.rows.length > 0) res.json(result.rows[0]);
        else res.status(404).json({ error: 'Контент не найден' });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка базы данных' });
    }
});

app.get('/api/techniques', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM techniques ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Ошибка базы данных' });
    }
});

//запуск сервера
// Запуск сервера с поддержкой внешних подключений (0.0.0.0)
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});