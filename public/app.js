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

function checkAuth() {
    const token = localStorage.getItem('token');
    const authLinks = document.getElementById('auth-links'); // Контейнер для Вход/Регистрация
    const privateLinks = document.getElementById('private-links'); // Контейнер для Профиль/Выход

    if (token) {
        if (authLinks) authLinks.classList.add('hidden');
        if (privateLinks) privateLinks.classList.remove('hidden');
    } else {
        if (authLinks) authLinks.classList.remove('hidden');
        if (privateLinks) privateLinks.classList.add('hidden');
    }
}

// Роуты
router
    .on('/', renderHome)
    .on('/login', renderLogin)
    .on('/register', renderRegister)
    .on('/profile', renderProfile)
    .on('/reset-password', renderResetPassword)
    .on('/about', renderAbout)
    .on('/techniques', renderTechniques)
    .on('/pools', renderPools)
    .on('/admin', renderAdmin);

async function renderPools() {
    const contentEl = document.getElementById('content');
    contentEl.innerHTML = '<p>Загрузка...</p>';
    
    const data = await fetchPageContent('pools'); // Берем заголовок с сервера
    
    contentEl.innerHTML = `
        <h2>${data.title}</h2>
        <p>${data.description}</p>
        <input type="text" id="pool-search-main" placeholder="Поиск по названию или городу..." class="search-input">
        <div id="pools-list-main" class="pools-grid"></div>
    `;
    
    const searchInput = document.getElementById('pool-search-main');
    const listContainer = document.getElementById('pools-list-main');
    const updateList = (search = '') => {
        const url = search ? `/api/pools?search=${encodeURIComponent(search)}` : '/api/pools';
        fetch(url)
            .then(res => res.json())
            .then(pools => {
                listContainer.innerHTML = pools.map(pool => `
                    <div class="pool-item">
                        <strong>${pool.name}</strong> <span>(${pool.city})</span>
                        <div class="price">${pool.price} BYN</div>
                    </div>
                `).join('');
            });
    };
    searchInput.addEventListener('input', (e) => updateList(e.target.value));
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
        <div style="margin-top: 10px;">
            <a href="#/reset-password" style="font-size: 0.8em; color: #666;">Забыли пароль?</a>
        </div>
        <p id="error-login" class="error-msg"></p>
    `;

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const errorEl = document.getElementById('error-login');
        
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(Object.fromEntries(formData))
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Ошибка входа');
            
            localStorage.setItem('token', data.token);
            checkAuth();
            window.location.hash = '/profile';
        } catch (err) {
            errorEl.textContent = err.message;
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
            <input type="password" name="password" placeholder="Пароль" required>
            <hr>
            <p><small>Секретный вопрос для восстановления доступа:</small></p>
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
        const formData = new FormData(e.target);
        const errorEl = document.getElementById('error-register');

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(Object.fromEntries(formData))
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Ошибка регистрации');
            alert('Регистрация успешна!');
            window.location.hash = '/login';
        } catch (err) {
            errorEl.textContent = err.message;
        }
    });
}

// Сброс пароля (Требование препода)
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
function renderProfile() {
    const token = localStorage.getItem('token');

    if (!token) {
        window.location.hash = '#/login';
        return; 
    }

    document.getElementById('content').innerHTML = '<h2>Загрузка...</h2>';

    fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${token}` } })
    .then(res => {
        if (!res.ok) throw new Error('Не авторизован');
        return res.json();
    })
    .then(user => {
        document.getElementById('content').innerHTML = `
            <h2>Личный кабинет</h2>
            <p>Email: ${user.email}</p>
            <p>Имя: ${user.name}</p>
            <hr>
            <h3>Каталог бассейнов</h3>
            <input type="text" id="pool-search" placeholder="Поиск по названию или городу..." 
                   style="width: 100%; padding: 10px; margin-bottom: 15px; border-radius: 4px; border: 1px solid #ccc;">
            <div id="pools-list"></div>
        `;
        
        const searchInput = document.getElementById('pool-search');
        searchInput.addEventListener('input', (e) => loadPools(e.target.value));
        
        loadPools();
    })
    .catch(err => {
        localStorage.removeItem('token');
        checkAuth();
        router.resolve('login');
    });
}

async function renderAdmin() {
    document.getElementById('content').innerHTML = `<h2>Админ-панель</h2><p>Доступ ограничен.</p>`;
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

