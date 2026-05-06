const router = {
    routes: {},
    
    on: function(path, handler) {
        this.routes[path] = handler;
        return this;
    },
    
    resolve: function() {
        const hash = window.location.hash || '#/';
        const path = hash.replace('#', '');
        const handler = this.routes[path] || (this.routes[path] === undefined ? render404 : this.routes['/']);
        if (handler) handler();
    }
};

const validationRules = {
    minPasswordLength: 6,
    emailPattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
};

// Функция для отображения ошибок 
function showValidationError(elementId, message) {
    const errorEl = document.getElementById(elementId);
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.style.color = 'red';
    }
}

window.addEventListener('hashchange', () => router.resolve());

document.addEventListener('click', function(e) {
    if (e.target.tagName === 'A') {
        const href = e.target.getAttribute('href');
        if (href && href.startsWith('#')) {
            checkAuth(); 
        }
    }
});

window.addEventListener('load', () => {
    checkAuth();
    router.resolve();
});

async function checkAuth() {
    const token = localStorage.getItem('token');
    const authLinks = document.getElementById('auth-links'); 
    const privateLinks = document.getElementById('private-links');
    const adminLink = document.getElementById('admin-link');
    const userDisplay = document.getElementById('user-status-display'); // Твоя новая фишка в HTML

    if (token) {
        try {
            const res = await fetch('/api/auth/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!res.ok) throw new Error('Сессия истекла');
            const user = await res.json();

            // 1. Твоя важная проверка админки (ОСТАВЛЯЕМ)
            if (adminLink) {
                adminLink.style.display = user.role === 'admin' ? 'inline-block' : 'none';
            }

            // 2. ФИШКА: Индикатор "На дорожке"
            if (userDisplay) {
                userDisplay.innerHTML = `
                    <span class="status-dot online"></span>
                    <span class="user-name">${user.name}</span>
                `;
            }

            if (authLinks) authLinks.classList.add('hidden');
            if (privateLinks) privateLinks.classList.remove('hidden');

        } catch (err) {
            localStorage.removeItem('token');
            location.reload(); 
        }
    } else {
        // Если гость — гасим индикатор
        if (userDisplay) {
            userDisplay.innerHTML = `<span class="status-dot offline"></span> <small>Вне системы</small>`;
        }
        if (authLinks) authLinks.classList.remove('hidden');
        if (privateLinks) privateLinks.classList.add('hidden');
    }
}

// Что-то очень важное, не трогать!
// Это перенаправляет на страницу логина если токен отсутствует
function withAuth(handler) {
    return () => {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.hash = '#/login';
        } else {
            handler();
        }
    };
}

// Роуты
router
    .on('/', renderHome)
    .on('/about', renderAbout)
    .on('/techniques', renderTechniques)
    .on('/pools', renderPools)
    .on('/login', renderLogin)
    .on('/register', renderRegister)
    .on('/reset-password', renderResetPassword)

    .on('/pools/:id', withAuth(renderPoolDetail)) 
    .on('/profile', withAuth(renderProfile))      
    .on('/admin', withAuth(renderAdmin));

async function renderPools() {
    const contentEl = document.getElementById('content');
    contentEl.innerHTML = '<p>Загрузка...</p>';
    
    // Получаем заголовок и описание с сервера (контент не зашит!)
    const data = await fetchPageContent('pools'); 
    
    contentEl.innerHTML = `
        <h2>${data.title}</h2>
        <p>${data.description}</p>
        
        <div class="search-container" style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-bottom: 20px;">
            <div class="search-box" style="flex: 1; min-width: 200px;">
                <span class="search-icon">🔍</span>
                <input type="text" id="pool-search-main" placeholder="Название..." class="search-input">
            </div>
            
            <select id="city-filter" class="search-input" style="width: 130px; cursor: pointer;">
                <option value="">Все города</option>
                <option value="Минск">Минск</option>
                <option value="Брест">Брест</option>
            </select>

            <select id="price-filter" class="search-input" style="width: 140px; cursor: pointer;">
                <option value="">Любая цена</option>
                <option value="0-10">До 10 BYN</option>
                <option value="10-20">10 - 20 BYN</option>
            </select>
        </div>
        
        <div id="pools-list-main" class="pools-grid"></div>
    `;
    
    const searchInput = document.getElementById('pool-search-main');
    const cityFilter = document.getElementById('city-filter');
    const priceFilter = document.getElementById('price-filter');
    const listContainer = document.getElementById('pools-list-main');

    // Обновленная функция обновления с учетом всех фильтров
    const updateList = async () => {
        const token = localStorage.getItem('token');
        const search = searchInput.value;
        const city = cityFilter.value;
        const price = priceFilter.value;

        // Собираем URL с параметрами
        let url = `/api/pools?search=${encodeURIComponent(search)}`;
        if (city) url += `&city=${encodeURIComponent(city)}`;
        if (price) url += `&priceRange=${encodeURIComponent(price)}`;
        
        try {
            const resPools = await fetch(url);
            const pools = await resPools.json();

            let favoriteIds = [];
            if (token) {
                const resFavs = await fetch('/api/favorites/ids', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (resFavs.ok) favoriteIds = await resFavs.json();
            }

            if (pools.length === 0) {
                listContainer.innerHTML = '<p>Ничего не найдено по вашим параметрам.</p>';
                return;
            }

            listContainer.innerHTML = pools.map(pool => {
                const isFav = favoriteIds.includes(pool.id);
                return `
                    <div class="pool-item">
                        <div class="pool-info" style="text-align: left;">
                            <strong>${pool.name}</strong> <span style="color: #666;">(${pool.city})</span>
                            <div class="price">${pool.price} BYN</div>
                        </div>
                        ${token ? `
                            <button class="fav-btn ${isFav ? 'active' : ''}" onclick="toggleFavorite(${pool.id}, this)">
                                ${isFav ? '★' : '☆'}
                            </button>
                        ` : ''}
                    </div>
                `;
            }).join('');
        } catch (err) {
            listContainer.innerHTML = '<p class="error-msg">Ошибка связи с сервером</p>';
        }
    };

    // Слушатели на все элементы управления
    searchInput.addEventListener('input', updateList);
    cityFilter.addEventListener('change', updateList);
    priceFilter.addEventListener('change', updateList);

    updateList(); 
}

    // Рендер главной
async function renderHome() {
    const contentEl = document.getElementById('content');
    contentEl.innerHTML = '<p>Загрузка...</p>';
    
    const data = await fetchPageContent('home');
    contentEl.innerHTML = `

            <h2>${data.title}</h2>
            <p>${data.description}</p>

    `;
}

async function renderAbout() {
    const contentEl = document.getElementById('content');
    contentEl.innerHTML = '<p>Загрузка...</p>';
    
    const data = await fetchPageContent('about');
    contentEl.innerHTML = `
       
            <h2>${data.title}</h2>
            <p>${data.description}</p>
       
    `;
}

async function renderTechniques() {
    const contentEl = document.getElementById('content');
    contentEl.innerHTML = '<h2>Загрузка техник...</h2>';
    try {
        const res = await fetch('/api/techniques');
        const data = await res.json();
        contentEl.innerHTML = `
            <h2>Библиотека техник</h2>
            <div class="grid">
                ${data.map(t => `<div class="card"><h3>${t.name}</h3><p>${t.description}</p></div>`).join('')}
            </div>`;
    } catch (err) {
        contentEl.innerHTML = '<h2>Библиотека техник</h2><p>Данные пока не добавлены на сервер.</p>';
    }
}

// Рендер входа
function renderLogin() {
    document.getElementById('content').innerHTML = `
        <h2>Вход</h2>
        <form id="login-form">
            <input type="email" name="email" placeholder="Email" required>
            <input type="password" name="password" placeholder="Пароль" required>
            <button type="submit">Войти</button>
        </form>
        <div style="margin-top: 15px;">
            <a href="#/reset-password" style="font-size: 0.8em; color: #666;">Забыли пароль? Восстановить</a>
        </div>
        <p id="error-login" class="error-msg"></p>
    `;

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = Object.fromEntries(new FormData(e.target));
        const errorEl = document.getElementById('error-login');
        errorEl.textContent = ''; 

        if (!validationRules.emailPattern.test(formData.email)) {
            return showValidationError('error-login', 'Введите корректный email');
        }

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Ошибка входа');
            
            localStorage.setItem('token', data.token);
            checkAuth();
            window.location.hash = '/profile';
        } catch (err) {
            showValidationError('error-login', err.message);
        }
    });
}

// Рендер регистрации
function renderRegister() {
    document.getElementById('content').innerHTML = `
        <h2>Регистрация</h2>
        <form id="register-form">
            <input type="text" name="name" placeholder="Имя" required>
            <input type="email" name="email" placeholder="Email" required>
            <input type="password" name="password" id="reg-pass" placeholder="Пароль (мин. 6 симв.)" required>
            <input type="password" name="confirm_password" placeholder="Повторите пароль" required>
            <hr>
            <p><small>Секретный вопрос для восстановления:</small></p>
            <select name="secret_question" required>
                <option value="Девичья фамилия матери">Девичья фамилия матери</option>
                <option value="Кличка первого питомца">Кличка первого питомца</option>
                <option value="Ваш родной город">Ваш родной город</option>
            </select>
            <input type="text" name="secret_answer" placeholder="Ответ" required>
            <button type="submit">Зарегистрироваться</button>
        </form>
        <p id="error-register" class="error-msg"></p>
    `;

    document.getElementById('register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = Object.fromEntries(new FormData(e.target));
        const errorEl = document.getElementById('error-register');
        errorEl.textContent = '';

        // --- КЛИЕНТСКАЯ ВАЛИДАЦИЯ ---
        if (formData.name.trim().length < 2) {
            return showValidationError('error-register', 'Имя слишком короткое');
        }
        if (!validationRules.emailPattern.test(formData.email)) {
            return showValidationError('error-register', 'Некорректный формат email');
        }
        if (formData.password.length < validationRules.minPasswordLength) {
            return showValidationError('error-register', `Пароль должен быть не менее ${validationRules.minPasswordLength} символов`);
        }
        if (formData.password !== formData.confirm_password) {
            return showValidationError('error-register', 'Пароли не совпадают');
        }

        try {
            // Удаляем confirm_password перед отправкой на бэкенд, он там не нужен
            delete formData.confirm_password;

            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Ошибка регистрации');
            alert('Регистрация успешна! Теперь войдите.');
            window.location.hash = '/login';
        } catch (err) {
            showValidationError('error-register', err.message);
        }
    });
}

// Сброс пароля 
function renderResetPassword() {
    document.getElementById('content').innerHTML = `
        <h2>Сброс пароля</h2>
        <form id="reset-form">
            <input type="email" name="email" placeholder="Ваш Email" required>
            <input type="text" name="secret_answer" placeholder="Ответ на секретный вопрос" required>
            <input type="password" name="newPassword" placeholder="Новый пароль" required>
            <button type="submit">Сменить пароль</button>
        </form>
        <p id="reset-msg" class="error-msg"></p>
    `;

    document.getElementById('reset-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = Object.fromEntries(new FormData(e.target));
        const msgEl = document.getElementById('reset-msg');

        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            msgEl.style.color = 'green';
            msgEl.textContent = 'Пароль успешно изменен!';
            setTimeout(() => window.location.hash = '/login', 2000);
        } catch (err) {
            msgEl.style.color = 'red';
            msgEl.textContent = err.message;
        }
    });
}

// Рендер профиля с поиском
async function renderProfile() {
    const token = localStorage.getItem('token');
    const contentEl = document.getElementById('content');

    contentEl.innerHTML = '<h2>Загрузка...</h2>';

    try {
        const res = await fetch('/api/auth/me', { 
            headers: { 'Authorization': `Bearer ${token}` } 
        });
        
        if (!res.ok) throw new Error('Не авторизован');
        const user = await res.json();

        contentEl.innerHTML = `
            <h2>Личный кабинет пловца</h2>
            <div class="user-card">
                <p><strong>Спортсмен:</strong> ${user.name}</p>
                <p><strong>Роль в системе:</strong> ${user.role}</p>
            </div>
            <hr>
            <h3>Дневник тренировок</h3>
            <div class="workout-placeholder">
                <p>Здесь будут отображаться ваши заплывы и статистика прогресса.</p>
                <table class="workout-table" style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                    <thead>
                        <tr style="border-bottom: 2px solid #ddd; text-align: left;">
                            <th>Дата</th>
                            <th>Дистанция</th>
                            <th>Стиль</th>
                            <th>Время</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td colspan="4" style="padding: 10px; color: #666;">Записей пока нет</td></tr>
                    </tbody>
                </table>
                <button style="margin-top: 15px;" onclick="alert('Добавление будет реализовано в Лабе №4')">+ Добавить тренировку</button>
            </div>
        `;
    } catch (err) {
        localStorage.removeItem('token');
        checkAuth();
        window.location.hash = '#/login';
    }
}

async function renderAdmin() {
    const token = localStorage.getItem('token');
    const contentEl = document.getElementById('content');


    if (!token) {
        window.location.hash = '#/login';
        return;
    }

    contentEl.innerHTML = '<p>Проверка прав доступа...</p>';

    try {
        const res = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const user = await res.json();

        if (user.role !== 'admin') {
            contentEl.innerHTML = `
                <div style="text-align: center; color: red; margin-top: 50px;">
                    <h2>Доступ запрещен</h2>
                    <p>Дмитрий, эта страница только для администраторов. Ваша роль: ${user.role}</p>
                    <a href="#/">Вернуться на главную</a>
                </div>
            `;
            return;
        }

        // Если админ  показываем интерфейс
        contentEl.innerHTML = `
            <h2>Панель управления SwimTrack</h2>
            <div class="admin-dashboard">
                <div class="card">Управление пользователями</div>
                <div class="card">Редактирование бассейнов</div>
            </div>
        `;
    } catch (err) {
        console.error(err);
        window.location.hash = '#/login';
    }
}

// Загрузка бассейнов (встроенный поиск)
function loadPools(search = '') {
    const url = search ? `/api/pools?search=${encodeURIComponent(search)}` : '/api/pools';
    
    fetch(url)
        .then(res => res.json())
        .then(pools => {
            const listEl = document.getElementById('pools-list');
            if (pools.length === 0) {
                listEl.innerHTML = '<p>Ничего не найдено</p>';
                return;
            }
            listEl.innerHTML = '<ul>' + pools.map(pool => `
                <li style="margin-bottom: 10px; padding: 10px; border-bottom: 1px solid #eee;">
                    <strong>${pool.name}</strong> (${pool.city})<br>
                    <span style="color: #2c3e50;">Цена: ${pool.price} BYN</span>
                </li>
            `).join('') + '</ul>';
        })
        .catch(err => {
            document.getElementById('pools-list').innerHTML = `<p class="error-msg">Ошибка загрузки</p>`;
        });
}

async function fetchPageContent(pageId) {
    const res = await fetch(`/api/content/${pageId}`);
    return await res.json();
}

window.logout = function() {
    localStorage.removeItem('token');
    checkAuth();
    window.location.hash = '#/';
};

function renderPoolDetail() {
    document.getElementById('content').innerHTML = `
        <div class="container">
            <h2>Детальная информация о бассейне</h2>
            <p>Здесь будут фото, расписание и отзывы для зарегистрированных пловцов.</p>
            <a href="#/pools">← Назад к списку</a>
        </div>
    `;
}

window.toggleFavorite = async function(poolId, btn) {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/favorites/toggle', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ poolId })
    });
    const data = await res.json();
    if (data.status === 'added') {
        btn.innerHTML = '★';
        btn.classList.add('active');
    } else {
        btn.innerHTML = '☆';
        btn.classList.remove('active');
    }
};