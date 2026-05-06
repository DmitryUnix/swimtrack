require('dotenv').config();
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

//подключение к базе данных
require('./database'); 

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


const pageContent = {
    'home': {
        title: 'Добро пожаловать в SwimTrack!',
        description: 'Ваш персональный трекер для мониторинга спортивных достижений в плавании.'
    },
    'about': {
        title: 'О проекте SwimTrack',
        description: 'Система позволяет анализировать техники и находить актуальные цены на бассейны.'
    },
    'pools': {
        title: 'Каталог бассейнов',
        description: 'Найдите подходящее место для тренировки в Бресте или Минске.'
    }
};

app.get('/api/content/:page', (req, res) => {
    const content = pageContent[req.params.page];
    if (content) res.json(content);
    else res.status(404).json({ error: 'Контент не найден' });
});

// Техники тоже выносим в API (уже было у тебя, оставляем здесь)
app.get('/api/techniques', (req, res) => {
    const techniques = [
        { id: 1, name: 'Кроль на груди', description: 'Самый быстрый стиль. КМС рекомендует: держите голову ниже.' },
        { id: 2, name: 'Баттерфляй', description: 'Стиль дельфина. Требует мощного удара ногами.' },
        { id: 3, name: 'Брасс', description: 'Технически сложный стиль. Важна фаза скольжения.' }
    ];
    res.json(techniques);
});

//запуск сервера
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});