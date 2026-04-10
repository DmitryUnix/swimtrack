const express = require('express');
const router = express.Router();
const db = require('../database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticateToken } = require('../middleware/middleware'); 
//регистрация нового пользователя
router.post('/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;

        //проверка всех обязательных полей
        if (!email || !password || !name) {
            return res.status(400).json({ 
                error: 'Все поля обязательны: email, password, name' 
            });
        }

        //хеширование пароля
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        //вставка в базу данных
        const result = await db.query(
            'INSERT INTO users (email, passwordhash, name) VALUES ($1, $2, $3) RETURNING id, email, name, createdAt',
            [email, hashedPassword, name]
        );

        //успешная регистрация
        res.status(201).json({
            message: 'Пользователь успешно зарегистрирован',
            userId: result.rows[0].id,
            email: result.rows[0].email,
            name: result.rows[0].name,
            createdAt: result.rows[0].createdAt
        });

    } catch (error) {
        console.error('Ошибка регистрации:', error);

        //обработка ошибок
        if (error.code === '23505') {
            //ограничение email
            return res.status(409).json({ 
                error: 'Email уже зарегистрирован' 
            });
        }

        //общие ошибки сервера
        res.status(500).json({ 
            error: 'Ошибка на сервере при регистрации' 
        });
    }
});

//аутаризация (вход в систему)
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        //проверка обязательных полей
        if (!email || !password) {
            return res.status(400).json({ 
                error: 'Необходимы email и password' 
            });
        }

        //поиск пользователя в базе
        const result = await db.query(
            'SELECT id, email, passwordhash FROM users WHERE email = $1',
            [email]
        );

        //если пользователь не найден
        if (result.rows.length === 0) {
            return res.status(404).json({ 
                error: 'Пользователь не найден' 
            });
        }

        const user = result.rows[0];

        //сравнение пароля
        const isValidPassword = await bcrypt.compare(password, user.passwordhash);

        if (!isValidPassword) {
            return res.status(401).json({ 
                error: 'Неверный пароль' 
            });
        }

        //успешный вход то генерируем токен
        const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.json({
            message: 'Успешный вход',
            userId: user.id,
            email: user.email,
            token: token
        });

    } catch (error) {
        console.error('Ошибка входа:', error);
        res.status(500).json({ 
            error: 'Ошибка на сервере при входе' 
        });
    }
});

router.get('/me', authenticateToken, async (req, res) => {
    try {
        //берем id из токена который мы подписали при логине
        const userId = req.user.id;

        //запрашиваем данные пользователя из базы
        const result = await db.query(
            'SELECT id, email, name FROM users WHERE id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        res.json(result.rows[0]);

    } catch (error) {
        console.error('Ошибка получения профиля:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});
module.exports = router;