const AppState = {
    user: null,           // Храним данные юзера
    isAuthenticated: false, // Статус входа
    
    // Функция для обновления 
    setUser(userData) {
        this.user = userData;
        this.isAuthenticated = !!userData;
        console.log("AppState обновлен:", this.isAuthenticated ? "Авторизован" : "Гость");
    }
};

const router = {
    routes: {},
    
    on: function(path, handler) {
        this.routes[path] = handler;
        return this;
    },
    
    resolve: function() {
        const hash = window.location.hash || '#/';
        const path = hash.replace('#', '') || '/';
        
        // Пытаемся найти обработчик. Если его нет — вызываем render404
        const handler = this.routes[path];
        
        if (handler) {
            handler();
        } else {
            render404(); 
        }
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
    const userDisplay = document.getElementById('user-status-display');

    if (token) {
        try {
            const res = await fetch('/api/auth/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!res.ok) throw new Error('Сессия истекла');
            const user = await res.json();

           
            AppState.setUser(user);

            //чето важное
            if (adminLink) {
                adminLink.style.display = user.role === 'admin' ? 'inline-block' : 'none';
            }

           
            if (userDisplay) {
                userDisplay.innerHTML = `
                    <span class="status-dot online"></span>
                    <span class="user-name">${user.name}</span>
                `;
            }

            if (authLinks) authLinks.classList.add('hidden');
            if (privateLinks) privateLinks.classList.remove('hidden');

        // Внутри функции checkAuth замени блок catch на этот:
        } catch (err) {
            console.warn("Auth check failed:", err.message);
            localStorage.removeItem('token');
            AppState.setUser(null);
            
            // Вместо location.reload() просто обновляем интерфейс в состояние "Гость"
            if (authLinks) authLinks.classList.remove('hidden');
            if (privateLinks) privateLinks.classList.add('hidden');
            if (userDisplay) {
                userDisplay.innerHTML = `<span class="status-dot offline"></span> <small>Вне системы</small>`;
            }
        }
    } else {
        
        AppState.setUser(null);

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
    const token = localStorage.getItem('token'); // Проверяем токен сразу
    contentEl.innerHTML = '<div class="loader-wrapper"><span class="loader"></span></div>';
    
    await new Promise(resolve => setTimeout(resolve, 800));
    try {
        const [pageData, cities] = await Promise.all([
            fetchPageContent('pools'),
            fetch('/api/pools/cities/all').then(res => res.json())
        ]);

        contentEl.innerHTML = `
            <h2>${pageData.title}</h2>
            <p>${pageData.description}</p>
            
            <div class="search-container" style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-bottom: 20px;">
                <div class="search-box" style="flex: 1; min-width: 200px;">
                    <span class="search-icon">🔍</span>
                    <input type="text" id="pool-search-main" placeholder="Название..." class="search-input">
                </div>
                
                <select id="city-filter" class="search-input" style="width: 140px; cursor: pointer;">
                    <option value="">Все города</option>
                    ${cities.map(city => `<option value="${city}">${city}</option>`).join('')}
                </select>

                <select id="price-sort-filter" class="search-input" style="width: 160px; cursor: pointer;">
                    <option value="">Любая цена</option>
                    <option value="price_asc">По возрастанию</option>
                    <option value="price_desc">По убыванию</option>
                </select>

                ${token ? `
                    <button id="fav-toggle-filter" class="search-input" style="width: auto; padding: 0 12px; cursor: pointer; display: flex; align-items: center; gap: 8px;" title="Показать только избранное">
                        <span class="star-icon">☆</span>
                        <span style="font-size: 0.9em;">Избранное</span>
                    </button>
                ` : ''}
            </div>
            
            <div id="pools-list-main" class="pools-grid"></div>
        `;

        const searchInput = document.getElementById('pool-search-main');
        const cityFilter = document.getElementById('city-filter');
        const priceSort = document.getElementById('price-sort-filter');
        const favToggle = document.getElementById('fav-toggle-filter'); // Новая кнопка
        const listContainer = document.getElementById('pools-list-main');

        // Переменная для хранения состояния фильтра (вкл/выкл)
        let showOnlyFavs = false;

        const updateList = async () => {
            const search = searchInput.value;
            const city = cityFilter.value;
            const sortBy = priceSort.value;

            let url = `/api/pools?search=${encodeURIComponent(search)}`;
            if (city) url += `&city=${encodeURIComponent(city)}`;
            if (sortBy) url += `&sortBy=${encodeURIComponent(sortBy)}`;
            
            try {
                const resPools = await fetch(url);
                let pools = await resPools.json(); // Используем let, чтобы можно было отфильтровать

                let favoriteIds = [];
                if (token) {
                    const resFavs = await fetch('/api/favorites/ids', {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (resFavs.ok) favoriteIds = await resFavs.json();
                }

                // --- ЛОГИКА ИЗБРАННОГО ---
                if (showOnlyFavs) {
                    pools = pools.filter(p => favoriteIds.includes(p.id));
                }

                if (pools.length === 0) {
                    listContainer.innerHTML = showOnlyFavs 
                        ? '<p>В избранном пока пусто или нет совпадений.</p>' 
                        : '<p>Ничего не найдено.</p>';
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
                renderErrorMessage("Ошибка связи с сервером при поиске бассейнов.");
            }
        };

        // Обработчик для кнопки избранного
        if (favToggle) {
            favToggle.addEventListener('click', () => {
                showOnlyFavs = !showOnlyFavs;
                
                // Меняем и иконку, и фон, чтобы было видно — фильтр включен!
                const star = favToggle.querySelector('.star-icon');
                star.innerHTML = showOnlyFavs ? '★' : '☆';
                
                // Визуальная индикация активности фильтра
                favToggle.style.background = showOnlyFavs ? '#e3f2fd' : ''; // Легкая подсветка фона
                favToggle.style.borderColor = showOnlyFavs ? '#2196f3' : ''; 
                favToggle.style.color = showOnlyFavs ? '#2196f3' : 'inherit';

                updateList();
        });
        }

        searchInput.addEventListener('input', updateList);
        cityFilter.addEventListener('change', updateList);
        priceSort.addEventListener('change', updateList);

        updateList(); 

    } catch (err) {
        console.error("Ошибка в renderPools:", err);
        contentEl.innerHTML = '<p class="error-msg">Ошибка загрузки страницы.</p>';
    }
}

    // Рендер главной
async function renderHome() {
    const contentEl = document.getElementById('content');
    contentEl.innerHTML = '<div class="loader-wrapper"><span class="loader"></span></div>';
    
    const data = await fetchPageContent('home');
    contentEl.innerHTML = `

            <h2>${data.title}</h2>
            <p>${data.description}</p>

    `;
}

async function renderAbout() {
    const contentEl = document.getElementById('content');
    contentEl.innerHTML = '<div class="loader-wrapper"><span class="loader"></span></div>';
    
    const data = await fetchPageContent('about');
    contentEl.innerHTML = `
       
            <h2>${data.title}</h2>
            <p>${data.description}</p>
       
    `;
}

async function renderTechniques() {
    const contentEl = document.getElementById('content');
    contentEl.innerHTML = '<div class="loader-wrapper"><span class="loader"></span></div>';
    
    try {
        const res = await fetch('/api/techniques');
        const data = await res.json();
        
        if (!data || data.length === 0) {
            contentEl.innerHTML = '<h2>Библиотека техник</h2><p>В базе пока нет техник.</p>';
            return;
        }

        contentEl.innerHTML = `
            <h2>Библиотека техник</h2>
            <p style="color: #666; margin-bottom: 30px;">Изучите основные стили плавания и посмотрите видеоуроки</p>
            
            <div class="techniques-grid">
                ${data.map(t => `
                    <div class="card glass-card" style="padding: 25px; border-top: 4px solid var(--swim-blue); display: flex; flex-direction: column; justify-content: space-between; text-align: left;">
                        <div>
                            <h3 style="color: var(--dark-blue); margin-top: 0;">${t.name}</h3>
                            <p style="line-height: 1.6; color: #444; font-size: 0.95rem;">${t.description}</p>
                        </div>
                        
                        ${t.video_url ? `
                            <a href="${t.video_url}" target="_blank" class="video-link-btn">
                                <span>▶</span> Смотреть видеоурок
                            </a>
                        ` : ''}
                    </div>
                `).join('')}
            </div>`;
    } catch (err) {
        console.error(err);
        renderErrorMessage("Не удалось загрузить библиотеку техник. База данных временно недоступна.");
    }
}

// Рендер входа
function renderLogin() {

    // Если юзер уже авторизован, не показывать форму входа, а сразу редиректить в профиль
    if (localStorage.getItem('token')) {
            window.location.hash = '#/profile';
        return;
    }

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

    if (localStorage.getItem('token')) {
        window.location.hash = '#/profile';
        return;
    }

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
            
            <p><small style="color: #666;">Выберите секретный вопрос, который вы указывали при регистрации:</small></p>
            <select name="secret_question" required style="margin-bottom: 15px; width: 100%; padding: 10px; border-radius: 4px; border: 1px solid #ccc;">
                <option value="Девичья фамилия матери">Девичья фамилия матери</option>
                <option value="Кличка первого питомца">Кличка первого питомца</option>
                <option value="Ваш родной город">Ваш родной город</option>
            </select>
            
            <input type="text" name="secret_answer" placeholder="Ответ на секретный вопрос" required>
            <input type="password" name="newPassword" placeholder="Новый пароль" required>
            <button type="submit">Сменить пароль</button>
        </form>
        <p id="reset-msg" class="error-msg"></p>
    `;

    document.getElementById('reset-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        // FormData автоматически подхватит и secret_question, и secret_answer
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
//----
// Рендер профиля с поиском
// Инициализация данных из базы
let userWorkouts = [];

async function renderProfile() {
    const token = localStorage.getItem('token');
    const contentEl = document.getElementById('content');
    contentEl.innerHTML = '<div class="loader-wrapper"><span class="loader"></span></div>';

    try {
        // Получаем данные юзера и ЕГО тренировки параллельно
        const [userRes, workoutRes] = await Promise.all([
            fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch('/api/workouts', { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        if (!userRes.ok) throw new Error('Не авторизован');
        const user = await userRes.json();
        
        // Обновляем наш глобальный массив данными из базы
        userWorkouts = workoutRes.ok ? await workoutRes.json() : [];

        contentEl.innerHTML = `
            <h2>Личный кабинет пловца</h2>
            <div class="user-card" style="margin-bottom:20px; text-align:left;">
                <p><strong>Спортсмен:</strong> ${user.name} | <strong>Статус:</strong> ${user.role}</p>
            </div>

            <div id="workout-section">
                <h3 style="text-align:left;">Дневник тренировок</h3>
                
                <div class="workout-form-container" id="workout-form-box">
                    <input type="hidden" id="edit-id" value="-1"> <div class="workout-grid-inputs">
                        <div>
                            <label>Стиль</label>
                            <select id="w-style" onchange="updateDistances()">
                                <option value="Вольный стиль">Вольный стиль</option>
                                <option value="На спине">На спине</option>
                                <option value="Брасс">Брасс</option>
                                <option value="Баттерфляй">Баттерфляй</option>
                            </select>
                        </div>
                        <div>
                            <label>Дистанция</label>
                            <select id="w-dist"></select>
                        </div>
                        <div>
                            <label>Дата (ДД.ММ.ГГ)</label>
                            <input type="text" id="w-date" placeholder="07.05.26" maxlength="8">
                        </div>
                        <div>
                            <label>Время (ММ.СС.ММ)</label>
                            <input type="text" id="w-time" placeholder="01.25.45" maxlength="8">
                        </div>
                    </div>
                    <div style="display:flex; gap:10px;">
                        <button id="btn-add-main" onclick="addWorkout()" class="btn-save" style="flex:2">Добавить запись</button>
                        <button id="btn-cancel-edit" onclick="resetWorkoutForm()" class="btn-delete" style="flex:1; display:none;">Отмена</button>
                    </div>
                    <p id="workout-error" class="error-msg" style="display:none; font-size:0.8rem; text-align:center;"></p>
                </div>

                <div style="overflow-x:auto;">
                    <table class="workout-table">
                        <thead>
                            <tr>
                                <th>Дата</th>
                                <th>Стиль</th>
                                <th>Дист.</th>
                                <th>Время</th>
                                <th>Действия</th>
                            </tr>
                        </thead>
                        <tbody id="workout-tbody">${renderWorkoutRows()}</tbody>
                    </table>
                </div>
            </div>
        `;
        updateDistances();
    } catch (err) {
        window.location.hash = '#/login';
    }
}

// Обновление списка дистанций
window.updateDistances = function() {
    const style = document.getElementById('w-style').value;
    const distSelect = document.getElementById('w-dist');
    const distances = style === "Вольный стиль" ? [50, 100, 200, 400, 800, 1500] : [50, 100, 200];
    distSelect.innerHTML = distances.map(d => `<option value="${d}">${d}м</option>`).join('');
};

// Рендер строк с кнопками управления
function renderWorkoutRows() {
    if (userWorkouts.length === 0) return `<tr><td colspan="5" style="color:#999;">Записей нет</td></tr>`;
    // Используем .map((w) => ...) и передаем w.id в функции
    return userWorkouts.map((w) => `
        <tr>
            <td>${w.workout_date}</td> <td>${w.style}</td>
            <td>${w.distance}м</td> <td>${w.workout_time}</td> <td style="display:flex; gap:5px; justify-content:center;">
                <button onclick="editWorkout(${w.id})" style="background:none; border:none; cursor:pointer;">✏️</button>
                <button onclick="deleteWorkout(${w.id})" style="background:none; border:none; cursor:pointer;">🗑️</button>
            </td>
        </tr>
    `).join(''); // Убрали .reverse(), так как БД сама может сортировать (ORDER BY id DESC)
}

// Добавление или сохранение изменений
window.addWorkout = async function() {
    const date = document.getElementById('w-date').value;
    const style = document.getElementById('w-style').value;
    const dist = document.getElementById('w-dist').value;
    const time = document.getElementById('w-time').value;
    const errorEl = document.getElementById('workout-error');

    const regex = /^\d{2}\.\d{2}\.\d{2}$/;
    if (!regex.test(date) || !regex.test(time)) {
        errorEl.textContent = "Ошибка формата! Используйте точки (00.00.00)";
        errorEl.style.display = 'block';
        return;
    }

    const data = { date, style, dist, time };
    const token = localStorage.getItem('token');

    try {
        const response = await fetch('/api/workouts', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) throw new Error('Ошибка сохранения');
        
        resetWorkoutForm();
        renderProfile(); 
    } catch (err) {
        errorEl.textContent = "Не удалось сохранить тренировку в базу.";
        errorEl.style.display = 'block';
    }
};

// Удаление
window.deleteWorkout = async function(id) {
    if (confirm("Удалить запись о тренировке?")) {
        try {
            await fetch(`/api/workouts/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            renderProfile();
        } catch (err) {
            alert("Ошибка при удалении");
        }
    }
};

// Подготовка к редактированию
window.editWorkout = function(id) {
    const w = userWorkouts.find(item => item.id === id);
    if (!w) return;

    document.getElementById('w-date').value = w.workout_date;
    document.getElementById('w-style').value = w.style;
    updateDistances();
    document.getElementById('w-dist').value = w.distance;
    document.getElementById('w-time').value = w.workout_time;
    document.getElementById('edit-id').value = id;
    
    document.getElementById('btn-add-main').textContent = "Сохранить изменения (скоро)";
    document.getElementById('btn-cancel-edit').style.display = "block";
    document.getElementById('workout-form-box').style.border = "1px solid orange";
};

window.resetWorkoutForm = function() {
    document.getElementById('edit-index').value = "-1";
    document.getElementById('w-date').value = "";
    document.getElementById('w-time').value = "";
    document.getElementById('btn-add-main').textContent = "Добавить запись";
    document.getElementById('btn-cancel-edit').style.display = "none";
    document.getElementById('workout-form-box').style.border = "1px dashed var(--swim-blue)";
    document.getElementById('workout-error').style.display = 'none';
};
//-----
async function renderAdmin() {
    const token = localStorage.getItem('token');
    const contentEl = document.getElementById('content');
    if (!token) { window.location.hash = '#/login'; return; }

    contentEl.innerHTML = '<p>Проверка прав доступа...</p>';

    try {
        const res = await fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${token}` } });
        const user = await res.json();
        if (user.role !== 'admin') {
            contentEl.innerHTML = `<div style="text-align:center; color:red; padding:40px;"><h2>Доступ ограничен</h2><p>Дмитрий, нужны права админа.</p></div>`;
            return;
        }

        contentEl.innerHTML = `
            <h2>Панель управления SwimTrack</h2>
            <div class="admin-tabs" style="margin-bottom: 25px; display: flex; gap: 10px; justify-content: center;">
                <button onclick="switchAdminTab('pools')" class="btn-reg">Управление бассейнами</button>
                <button onclick="switchAdminTab('users')" class="btn-reg">Пользователи системы</button>
            </div>
            <div id="admin-tab-content" class="glass-card" style="padding: 20px;"></div>
        `;

        window.switchAdminTab = async (tab) => {
            const container = document.getElementById('admin-tab-content');
            
            // Обновляем визуальный вид кнопок вкладок
            document.querySelectorAll('.admin-tabs button').forEach(btn => btn.classList.remove('active'));
            if (tab === 'pools') event?.target?.classList.add('active'); // Простая подсветка

            if (tab === 'pools') {
                container.innerHTML = `
                    <div class="admin-tab-content-inner">
                        <h3 style="margin-bottom: 10px;">➕ Добавить новый бассейн</h3>
                        <form id="admin-add-pool-form" class="admin-grid-form">
                            <div>
                                <small>Название</small>
                                <input type="text" name="name" placeholder="Название" required class="admin-input">
                            </div>
                            <div>
                                <small>Город</small>
                                <input type="text" name="city" placeholder="Город" required class="admin-input">
                            </div>
                            <div>
                                <small>Цена</small>
                                <input type="number" name="price" placeholder="BYN" required class="admin-input">
                            </div>
                            <button type="submit" class="btn-reg">Создать</button>
                        </form>
                        <hr style="margin: 30px 0; border: 0; border-top: 1px solid #eee;">
                        <div id="admin-pools-list"></div>
                    </div>
                `;
                setupPoolForm();
                refreshAdminPools();
            } else {
                container.innerHTML = `<div class="admin-tab-content-inner"><h3>👥 Список пользователей</h3><div id="admin-users-list"></div></div>`;
                refreshAdminUsers();
            }
        };

        async function refreshAdminPools() {
            const listEl = document.getElementById('admin-pools-list');
            const pRes = await fetch('/api/pools');
            const pools = await pRes.json();
            
            listEl.innerHTML = pools.map(p => `
                <div class="admin-item" style="display:flex; gap:10px; align-items:center; flex-wrap: wrap;">
                    <input type="text" value="${p.name}" id="p-name-${p.id}" class="admin-input" style="flex:2; min-width: 150px;">
                    <input type="text" value="${p.city}" id="p-city-${p.id}" class="admin-input" style="flex:1; min-width: 100px;">
                    <input type="number" value="${p.price}" id="p-price-${p.id}" class="admin-input" style="width:70px">
                    
                    <button onclick="updatePool(${p.id})" class="btn-save">Сохранить</button>
                    <button onclick="deletePool(${p.id})" class="btn-delete">Удалить</button>
                </div>
            `).join('');
        }

        window.updatePool = async (id) => {
            const data = {
                name: document.getElementById(`p-name-${id}`).value,
                city: document.getElementById(`p-city-${id}`).value,
                price: document.getElementById(`p-price-${id}`).value
            };
            try {
                const response = await fetch(`/api/pools/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(data)
                });
                if (response.ok) {
                    alert('Данные бассейна обновлены!');
                    refreshAdminPools();
                }
            } catch (err) { alert('Ошибка обновления'); }
        };

        window.deletePool = async (id) => {
            if (confirm('Удалить этот бассейн навсегда?')) {
                await fetch(`/api/pools/${id}`, { 
                    method: 'DELETE', 
                    headers: { 'Authorization': `Bearer ${token}` } 
                });
                refreshAdminPools();
            }
        };

        function setupPoolForm() {
            document.getElementById('admin-add-pool-form').onsubmit = async (e) => {
                e.preventDefault();
                const formData = Object.fromEntries(new FormData(e.target));
                await fetch('/api/pools', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(formData)
                });
                e.target.reset();
                refreshAdminPools();
            };
        }

        // --- ЛОГИКА ПОЛЬЗОВАТЕЛЕЙ ---
        async function refreshAdminUsers() {
            const listEl = document.getElementById('admin-users-list');
            const uRes = await fetch('/api/auth/all', { headers: { 'Authorization': `Bearer ${token}` } });
            const users = await uRes.json();
            listEl.innerHTML = users.map(u => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:15px; border-bottom:1px solid #eee;">
                    <span><b>${u.name}</b> <small>(${u.email})</small> — <span class="price">${u.role}</span></span>
                    <button onclick="deleteUser(${u.id})" class="btn-delete" style="${u.id === user.id ? 'display:none' : ''}">Удалить юзера</button>
                </div>
            `).join('');
        }

        window.deleteUser = async (id) => {
            if (confirm('Удалить пользователя из системы?')) {
                const res = await fetch(`/api/auth/users/${id}`, { 
                    method: 'DELETE', 
                    headers: { 'Authorization': `Bearer ${token}` } 
                });
                if (res.ok) refreshAdminUsers();
                else alert('Ошибка при удалении');
            }
        };

        switchAdminTab('pools');

    } catch (err) { console.error(err); window.location.hash = '#/login'; }
}

// Загрузка бассейнов 
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

// Универсальная функция для получения контента страниц (home, about, techniques)
async function fetchPageContent(pageId) {
    const res = await fetch(`/api/content/${pageId}`);
    return await res.json();
}

// Функция выхода из системы
window.logout = function() {
    alert("Вы успешно вышли из аккаунта");
    // 1. Очищаем хранилище
    localStorage.removeItem('token');
    
    // 2. Обнуляем состояние приложения
    AppState.setUser(null);
    
    // 3. Обнуляем визуальный статус пользователя (имя и точку)
    const userDisplay = document.getElementById('user-status-display');
    if (userDisplay) {
        userDisplay.innerHTML = `<span class="status-dot offline"></span> <small>Вне системы</small>`;
    }

    // 4. Обновляем интерфейс (прячем Кабинет, показываем Вход)
    checkAuth();
    
    // 5. Редирект на главную и принудительный рендер через роутер
    window.location.hash = '#/';
    router.resolve();
    
    console.log("Logout successful: session cleared.");
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

// Функция для 404 (Not Found)
function render404() {
    const contentEl = document.getElementById('content');
    // Убираем класс glass-card и лишние стили рамок
    contentEl.innerHTML = `
        <div style="padding: 60px 20px; animation: fadeIn 0.5s ease-out;">
            <h1 style="font-size: 8rem; color: var(--swim-blue); margin: 0; line-height: 1;">404</h1>
            <h2 style="margin-top: 10px; font-size: 2rem;">Вы заплыли за буйки!</h2>
            <p style="color: #666; font-size: 1.1rem;">Такой дорожки в нашем приложении не существует.</p>
            <br>
            <a href="#/" class="btn-reg" style="text-decoration: none; display: inline-block;">Вернуться на главную</a>
        </div>
    `;
}

// Универсальная функция для вывода ошибок сервера/сети
function renderErrorMessage(message = "Произошла сетевая ошибка. Проверьте соединение.") {
    const contentEl = document.getElementById('content');
    contentEl.innerHTML = `
        <div class="glass-card" style="border-top: 6px solid var(--error-red); animation: fadeIn 0.4s ease-out;">
            <h3 style="color: var(--error-red); margin-top: 0;">🏊‍♂️ Проблема с погружением...</h3>
            <p style="color: #444;">${message}</p>
            <button onclick="location.reload()" class="btn-tab" style="margin-top: 15px; cursor: pointer;">Попробовать снова</button>
        </div>
    `;
}

// Обработка мобильного меню 
document.addEventListener('click', (e) => {
    const navMenu = document.getElementById('nav-menu');
    const burgerBtn = document.getElementById('burger-btn');

    // Если кликнули на бургер 
    if (e.target.closest('#burger-btn')) {
        navMenu.classList.toggle('active');
        burgerBtn.classList.toggle('open');
    } 
    // Если меню открыто и кликнули по ссылке или мимо меню
    else if (navMenu.classList.contains('active')) {
        if (e.target.closest('a') || e.target.closest('button') || !e.target.closest('.app-header')) {
            navMenu.classList.remove('active');
            burgerBtn.classList.remove('open');
        }
    }
});