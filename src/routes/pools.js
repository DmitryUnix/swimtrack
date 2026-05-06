const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken } = require('../middleware/middleware'); 

// Получение всех бассейнов с поиском
// Получение всех бассейнов с поиском и фильтрацией (Пункт 4)
router.get('/', async (req, res) => {
    try {
        const { search, city, priceRange } = req.query; // Достаем всё, что прислал фронт
        
        let queryText = 'SELECT id, name, city, price FROM pools';
        let params = [];
        let conditions = [];

        // 1. Условие поиска (как и было)
        if (search) {
            params.push(`%${search}%`);
            // Используем индекс параметра ($1, $2...) динамически
            conditions.push(`(name ILIKE $${params.length} OR city ILIKE $${params.length})`);
        }

        // 2. Условие города (Пункт 4.1)
        if (city) {
            params.push(city);
            conditions.push(`city = $${params.length}`);
        }

        // 3. Условие цены (Пункт 4.2)
        if (priceRange) {
            if (priceRange === '0-10') {
                conditions.push(`price <= 10`);
            } else if (priceRange === '10-20') {
                conditions.push(`price > 10 AND price <= 20`);
            }
        }

        // Собираем условия в кучу через AND
        if (conditions.length > 0) {
            queryText += ' WHERE ' + conditions.join(' AND ');
        }
        
        queryText += ' ORDER BY id DESC';
        
        const result = await db.query(queryText, params);
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