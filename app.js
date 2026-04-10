const router = {
    routes: {},
    
    on: function(path, handler) {
        this.routes[path] = handler;
        return this;
    },
    
    resolve: function(hash) {
        if (!hash) return; // Защита от undefined
        const path = hash.replace('#', '');
        if (this.routes[path]) {
            this.routes[path]();
        } else if (this.routes['']) {
            this.routes['']();
        }
    }
};

document.addEventListener('click', function(e) {
    // Если клик был по ссылке <a>
    if (e.target.tagName === 'A') {
        e.preventDefault(); // Останавливаем стандартное поведение (перезагрузку)
        
        // Получаем href ссылки (например, "#/login")
        const href = e.target.getAttribute('href');
        
        // Извлекаем путь без решетки (например, "login")
        const path = href.replace('#', '');
        
        // Переходим по этому пути
        router.resolve(path);
    }
});

//проверка авторизации при загрузке
window.addEventListener('load', () => {
    checkAuth();
    const currentHash = window.location.hash || '';
    router.resolve(currentHash.slice(1));
});

function checkAuth() {
    const token = localStorage.getItem('token');
    const profileLink = document.getElementById('profile-link');
    const logoutBtn = document.getElementById('logout-btn');

    if (token) {
        profileLink.classList.remove('hidden');
        logoutBtn.classList.remove('hidden');
    } else {
        profileLink.classList.add('hidden');
        logoutBtn.classList.add('hidden');
    }
}

//роуты
router
    .on('/', renderHome)
    .on('/login', renderLogin)
    .on('/register', renderRegister)
    .on('/profile', renderProfile)
    .resolve();

//рендер главной
function renderHome() {
    document.getElementById('content').innerHTML = `
        <h2>Добро пожаловать в SwimTrack!</h2>
        <p>Выберите действие из меню.</p>
    `;
}

//рендер входа
function renderLogin() {
    document.getElementById('content').innerHTML = `
        <h2>Вход</h2>
        <form id="login-form">
            <input type="email" name="email" placeholder="Email" required>
            <input type="password" name="password" placeholder="Пароль" required>
            <button type="submit">Войти</button>
        </form>
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
            router.resolve('profile'); // ЗАМЕНИЛИ navigate на resolve
        } catch (err) {
            errorEl.textContent = err.message;
        }
    });
}

//рендер регистрации
function renderRegister() {
    document.getElementById('content').innerHTML = `
        <h2>Регистрация</h2>
        <form id="register-form">
            <input type="text" name="name" placeholder="Имя" required>
            <input type="email" name="email" placeholder="Email" required>
            <input type="password" name="password" placeholder="Пароль" required>
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

            alert('Регистрация успешна! Теперь войдите.');
            router.resolve('login'); // ЗАМЕНИЛИ navigate на resolve
        } catch (err) {
            errorEl.textContent = err.message;
        }
    });
}

//рендер профиля
function renderProfile() {
    const token = localStorage.getItem('token');
    
    if (!token) {
        router.resolve('login'); 
        return;
    }

    document.getElementById('content').innerHTML = '<h2>Загрузка профиля...</h2>';

    fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => {
        if (!res.ok) throw new Error('Не авторизован');
        return res.json();
    })
    .then(user => {
        document.getElementById('content').innerHTML = `
            <h2>Личный кабинет</h2>
            <div id="user-info">
                <p><strong>Email:</strong> ${user.email}</p>
                <p><strong>Имя:</strong> ${user.name}</p>
            </div>
            <h3>Мои бассейны:</h3>
            <div id="pools-list"></div>
        `;
        loadPools();
    })
    .catch(err => {
        document.getElementById('content').innerHTML = `<p class="error-msg">Ошибка: ${err.message}</p>`;
        localStorage.removeItem('token');
        checkAuth();
    });
}

//загрузка списка бассейнов
function loadPools() {
    fetch('/api/pools')
        .then(res => res.json())
        .then(pools => {
            const listEl = document.getElementById('pools-list');
            if (pools.length === 0) {
                listEl.innerHTML = '<p>Нет бассейнов</p>';
                return;
            }
            let html = '<ul>';
            pools.forEach(pool => {
                html += `
                    <li>
                        <span>${pool.name} (${pool.city})</span>
                        <span>${pool.price} руб.</span>
                    </li>
                `;
            });
            html += '</ul>';
            listEl.innerHTML = html;
        })
        .catch(err => {
            document.getElementById('pools-list').innerHTML = `<p class="error-msg">Ошибка загрузки: ${err.message}</p>`;
        });
}

//выход
window.logout = function() {
    localStorage.removeItem('token');
    checkAuth();
    router.resolve('');
};