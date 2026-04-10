const { Pool } = require('pg');
require('dotenv').config();

//настройки подключения к Supabase
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false }
});

//проверка подключения при старте
pool.connect((err, client, release) => {
  if (err) {
    console.error('Ошибка подключения к БД:', err.message);
    process.exit(1);
  } else {
    console.log('Подключение к PostgreSQL (Supabase) успешно');
    release();
  }
});

module.exports = pool;