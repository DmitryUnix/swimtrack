const { Pool } = require('pg');
require('dotenv').config();

// Подключаемся через строку из .env
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Обязательно для Supabase/Render
    }
});

pool.on('connect', () => {
    console.log('Подключено к облачной базе PostgreSQL (Supabase)');
});

pool.on('error', (err) => {
    console.error('Ошибка пула PostgreSQL:', err);
});

module.exports = {
    // Сохраняем тот же интерфейс, чтобы не менять auth.js и pools.js
    query: (text, params) => pool.query(text, params)
};