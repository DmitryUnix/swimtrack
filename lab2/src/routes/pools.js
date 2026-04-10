const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken } = require('../middleware/middleware'); 

//список всех бассейнов
router.get('/', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT id, name, city, address, price, amenities, rating FROM pools ORDER BY id DESC'
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Ошибка получения списка бассейнов:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

//детали одного бассейна
router.get('/:id', async (req, res) => {
    try {
        const poolId = req.params.id;
        const result = await db.query(
            'SELECT id, name, city, address, price, amenities, rating FROM pools WHERE id = $1',
            [poolId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Бассейн не найден' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Ошибка получения деталей бассейна:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

router.post('/', authenticateToken, async (req, res) => {
    try {
        const { name, city, address, price, amenities, rating } = req.body;

        //проверка обязательных полей
        if (!name || !city || !price) {
            return res.status(400).json({ 
                error: 'Недостаточно данных: name, city, price обязательны' 
            });
        }

        const result = await db.query(
            'INSERT INTO pools (name, city, address, price, amenities, rating) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, city',
            [name, city, address || '', price, amenities || '', rating || 0]
        );

        res.status(201).json({
            message: 'Бассейн успешно добавлен',
            pool: result.rows[0]
        });

    } catch (error) {
        console.error('Ошибка добавления бассейна:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

module.exports = router;