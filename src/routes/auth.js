const express = require('express');
const router = express.Router();
const db = require('../database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticateToken } = require('../middleware/middleware'); 

// 1. РЕГИСТРАЦИЯ
router.post('/register', async (req, res) => {
    try {
        const { email, password, name, secret_question, secret_answer } = req.body;

        if (!email || !password || !name || !secret_question || !secret_answer) {
            return res.status(400).json({ 
                error: 'Все поля обязательны, включая секретный вопрос и ответ' 
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // В PostgreSQL используем $1, $2... и возвращаем ID через RETURNING id
        const result = await db.query(
            'INSERT INTO users (email, passwordhash, name, secret_question, secret_answer) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [email, hashedPassword, name, secret_question, secret_answer]
        );

        res.status(201).json({
            message: 'Пользователь успешно зарегистрирован',
            userId: result.rows[0].id // В PG данные лежат в rows
        });

    } catch (error) {
        console.error('Ошибка регистрации:', error);
        // Код 23505 в PostgreSQL означает нарушение уникальности (email уже есть)
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Email уже зарегистрирован' });
        }
        res.status(500).json({ error: 'Ошибка на сервере при регистрации' });
    }
});

// 2. ВХОД В СИСТЕМУ
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Необходимы email и password' });
        }

        // Поиск пользователя (используем $1)
        const result = await db.query(
            'SELECT id, email, passwordhash FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        const user = result.rows[0];
        const isValidPassword = await bcrypt.compare(password, user.passwordhash);

        if (!isValidPassword) {
            return res.status(401).json({ error: 'Неверный пароль' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email }, 
            process.env.JWT_SECRET || 'supersecret', 
            { expiresIn: '1h' }
        );

        res.json({
            message: 'Успешный вход',
            userId: user.id,
            token: token
        });

    } catch (error) {
        console.error('Ошибка входа:', error);
        res.status(500).json({ error: 'Ошибка на сервере при входе' });
    }
});

// 3. ВОССТАНОВЛЕНИЕ ПАРОЛЯ
router.post('/reset-password', async (req, res) => {
    const { email, secret_answer, newPassword } = req.body;
    try {
        const result = await db.query(
            'SELECT secret_answer FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Пользователь не найден' });

        if (result.rows[0].secret_answer.toLowerCase() !== secret_answer.toLowerCase()) {
            return res.status(403).json({ error: 'Неверный ответ на секретный вопрос' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        // Используем $1 и $2
        await db.query('UPDATE users SET passwordhash = $1 WHERE email = $2', [hashedPassword, email]);
        
        res.json({ message: 'Пароль успешно изменен' });
    } catch (err) {
        console.error('Ошибка сброса пароля:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// 4. ПОЛУЧЕНИЕ ДАННЫХ ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT id, email, name, role FROM users WHERE id = $1', // Добавили role сюда
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        res.json(result.rows[0]); 
    } catch (error) {
        console.error('Ошибка получения /me:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

router.get('/all', authenticateToken, async (req, res) => {
    try {
        const userRes = await db.query('SELECT role FROM users WHERE id = $1', [req.user.id]);
        if (userRes.rows[0].role !== 'admin') return res.status(403).json({ error: 'Нет доступа' });

        const result = await db.query('SELECT id, name, email, role FROM users ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

router.delete('/users/:id', authenticateToken, async (req, res) => {
    try {
        const userRes = await db.query('SELECT role FROM users WHERE id = $1', [req.user.id]);
        if (userRes.rows[0].role !== 'admin') return res.status(403).json({ error: 'Нет доступа' });
        if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: 'Себя удалять нельзя' });

        await db.query('DELETE FROM users WHERE id = $1', [req.params.id]);
        res.json({ message: 'Пользователь удален' });
    } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// Смена роли пользователя (админ правит юзера)
router.put('/users/:id/role', authenticateToken, async (req, res) => {
    try {
        const adminCheck = await db.query('SELECT role FROM users WHERE id = $1', [req.user.id]);
        if (adminCheck.rows[0].role !== 'admin') return res.status(403).json({ error: 'Нет доступа' });
        
        const { role } = req.body; // 'admin' или 'user'
        await db.query('UPDATE users SET role = $1 WHERE id = $2', [role, req.params.id]);
        res.json({ message: 'Роль обновлена' });
    } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

module.exports = router;