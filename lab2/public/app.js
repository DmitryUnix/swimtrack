const router = {
    routes: {},
    
    on: function(path, handler) {
        this.routes[path] = handler;
        return this;
    },
    
    resolve: function(hash) {
        if (!hash) return;
        const path = hash.replace('#', '');
        if (this.routes[path]) {
            this.routes[path]();
        } else if (this.routes['']) {
            this.routes['']();
        }
    }
};

document.addEventListener('click', function(e) {
    if (e.target.tagName === 'A') {
        const href = e.target.getAttribute('href');
        if (href && href.startsWith('#')) {
            e.preventDefault();
            const path = href.replace('#', '');
            router.resolve(path);
        }
    }
});

window.addEventListener('load', () => {
    checkAuth();
    const currentHash = window.location.hash || '#/';
    router.resolve(currentHash.slice(1));
});

function checkAuth() {
    const token = localStorage.getItem('token');
    const profileLink = document.getElementById('profile-link');
    const logoutBtn = document.getElementById('logout-btn');

    if (token) {
        if (profileLink) profileLink.classList.remove('hidden');
        if (logoutBtn) logoutBtn.classList.remove('hidden');
    } else {
        if (profileLink) profileLink.classList.add('hidden');
        if (logoutBtn) logoutBtn.classList.add('hidden');
    }
}

// Роуты
router
    .on('/', renderHome)
    .on('/login', renderLogin)
    .on('/register', renderRegister)
    .on('/profile', renderProfile)
    .on('/reset-password', renderResetPassword);

// Рендер главной
function renderHome() {
    document.getElementById('content').innerHTML = `
        <h2>Добро пожаловать в SwimTrack!</h2>
        <p>Ваш персональный трекер бассейнов.</p>
    `;
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
            router.resolve('profile');
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
            router.resolve('login');
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
            setTimeout(() => router.resolve('login'), 2000);
        } catch (err) {
            msgEl.style.color = 'red';
            msgEl.textContent = err.message;
        }
    });
}

// Рендер профиля с поиском
function renderProfile() {
    const token = localStorage.getItem('token');
    if (!token) { router.resolve('login'); return; }

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

window.logout = function() {
    localStorage.removeItem('token');
    checkAuth();
    router.resolve('');
};