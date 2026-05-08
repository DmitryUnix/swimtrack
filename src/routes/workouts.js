const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken } = require('../middleware/middleware');

// Получить все тренировки ТЕКУЩЕГО пользователя
router.get('/', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM workouts WHERE user_id = $1 ORDER BY id DESC', 
            [req.user.id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Ошибка загрузки данных' });
    }
});

// Сохранить новую тренировку
router.post('/', authenticateToken, async (req, res) => {
    const { style, dist, date, time } = req.body;
    try {
        await db.query(
            'INSERT INTO workouts (user_id, style, distance, workout_date, workout_time) VALUES ($1, $2, $3, $4, $5)',
            [req.user.id, style, dist, date, time]
        );
        res.status(201).json({ message: 'Запись сохранена в базу' });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сохранения' });
    }
});

module.exports = router;