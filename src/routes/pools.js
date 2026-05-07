const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken } = require('../middleware/middleware'); 

router.get('/cities/all', async (req, res) => {
    try {
        const result = await db.query('SELECT DISTINCT city FROM pools ORDER BY city ASC');
        res.json(result.rows.map(row => row.city));
    } catch (err) {
        console.error('Ошибка получения городов:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

router.get('/', async (req, res) => {
    try {
        const { search, city, priceRange } = req.query; // Достаем всё, что прислал фронт
        
        let queryText = 'SELECT id, name, city, price FROM pools';
        let params = [];
        let conditions = [];

        // 1. Условие поиска (как и было)
        if (search) {
            params.push(`%${search}%`);

            conditions.push(`(name ILIKE $${params.length} OR city ILIKE $${params.length})`);
        }


        if (city) {
            params.push(city);
            conditions.push(`city = $${params.length}`);
        }


        if (priceRange) {
            if (priceRange === '0-10') {
                conditions.push(`price <= 10`);
            } else if (priceRange === '10-20') {
                conditions.push(`price > 10 AND price <= 20`);
            }
        }

        
        if (conditions.length > 0) {
            queryText += ' WHERE ' + conditions.join(' AND ');
        }
        
        const { sortBy } = req.query; 

        if (sortBy === 'price_asc') {
            queryText += ' ORDER BY price ASC';
        } else if (sortBy === 'price_desc') {
            queryText += ' ORDER BY price DESC';
        } else {
            queryText += ' ORDER BY id DESC'; // По умолчанию
        }
        
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

router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        // Проверка роли ищем юзера и смотрим, админ ли он
        const userRes = await db.query('SELECT role FROM users WHERE id = $1', [req.user.id]);
        
        if (!userRes.rows[0] || userRes.rows[0].role !== 'admin') {
            return res.status(403).json({ error: 'Доступ запрещен: требуются права администратора' });
        }

        await db.query('DELETE FROM pools WHERE id = $1', [req.params.id]);
        res.json({ message: 'Бассейн успешно удален из базы' });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера при удалении' });
    }
});

// Редактирование бассейна
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const userRes = await db.query('SELECT role FROM users WHERE id = $1', [req.user.id]);
        if (userRes.rows[0].role !== 'admin') return res.status(403).json({ error: 'Доступ запрещен' });

        const { name, city, price } = req.body;
        await db.query(
            'UPDATE pools SET name = $1, city = $2, price = $3 WHERE id = $4',
            [name, city, price, req.params.id]
        );
        res.json({ message: 'Данные бассейна обновлены' });
    } catch (error) { res.status(500).json({ error: 'Ошибка сервера' }); }
});


module.exports = router;