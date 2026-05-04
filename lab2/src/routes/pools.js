const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken } = require('../middleware/middleware'); 

// Получение всех бассейнов с поиском
router.get('/', async (req, res) => {
    try {
        const searchTerm = req.query.search;
        let queryText = 'SELECT id, name, city, price FROM pools';
        let params = [];

        if (searchTerm) {
            // PostgreSQL требует $1, $2 вместо ?
            // ILIKE сделает поиск регистронезависимым (удобно для "Минск" и "минск")
            queryText += ' WHERE name ILIKE $1 OR city ILIKE $2';
            params = [`%${searchTerm}%`, `%${searchTerm}%`];
        }
        
        queryText += ' ORDER BY id DESC';
        
        const result = await db.query(queryText, params);
        // В pg результат всегда лежит в result.rows
        res.json(result.rows);
    } catch (error) {
        console.error('Ошибка поиска:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Добавление бассейна
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { name, city, price } = req.body;
        if (!name || !city || !price) {
            return res.status(400).json({ error: 'Заполните обязательные поля: name, city, price' });
        }

        // В PostgreSQL используем $1, $2, $3 и возвращаем ID через RETURNING
        const result = await db.query(
            'INSERT INTO pools (name, city, price) VALUES ($1, $2, $3) RETURNING id',
            [name, city, price]
        );

        res.status(201).json({
            message: 'Бассейн добавлен',
            id: result.rows[0].id // Берем id из первой строки результата
        });
    } catch (error) {
        console.error('Ошибка добавления:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

module.exports = router;