// lab2/src/middleware/middleware.js
const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
    // Получаем заголовок Authorization (формат: "Bearer <токен>")
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Токен не передан' });
    }

    const secret = process.env.JWT_SECRET;

    jwt.verify(token, secret, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Невалидный токен' });
        }
        // Если всё ок, добавляем данные пользователя в запрос
        req.user = user; 
        next(); // Передаем управление дальше
    });
};

module.exports = { authenticateToken };