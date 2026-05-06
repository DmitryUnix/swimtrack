const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken } = require('../middleware/middleware');

// Получить ID всех избранных бассейнов текущего пользователя
router.get('/ids', authenticateToken, async (req, res) => {
    try {
        const result = await db.query('SELECT pool_id FROM favorites WHERE user_id = $1', [req.user.id]);
        res.json(result.rows.map(row => row.pool_id));
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Добавить/Удалить из избранного
router.post('/toggle', authenticateToken, async (req, res) => {
    const { poolId } = req.body;
    const userId = req.user.id;

    try {
        const check = await db.query('SELECT id FROM favorites WHERE user_id = $1 AND pool_id = $2', [userId, poolId]);
        
        if (check.rows.length > 0) {
            await db.query('DELETE FROM favorites WHERE user_id = $1 AND pool_id = $2', [userId, poolId]);
            return res.json({ status: 'removed' });
        } else {
            await db.query('INSERT INTO favorites (user_id, pool_id) VALUES ($1, $2)', [userId, poolId]);
            return res.json({ status: 'added' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

module.exports = router;