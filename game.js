const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('scoreValue');
const leaderboardBtn = document.getElementById('leaderboardBtn');
const leaderboard = document.getElementById('leaderboard');
const closeLeaderboard = document.getElementById('closeLeaderboard');
const leaderboardList = document.getElementById('leaderboardList');

// Устанавливаем размеры canvas
canvas.width = 800;
canvas.height = 600;

// Игровые переменные
let score = 0;
let gameOver = false;
let cameraY = 0; // Добавляем переменную для камеры
let playerName = localStorage.getItem('playerName') || '';
let gameStarted = false;
let paused = false;

// Загружаем изображение для персонажа
const playerImg = new Image();
playerImg.src = 'ARCIUM_Primary-Icon_light.svg'; // SVG-картинка персонажа

// Класс для игрока
class Player {
    constructor() {
        this.width = 50; // Размер под SVG
        this.height = 50;
        this.x = canvas.width / 2 - this.width / 2;
        this.y = canvas.height - this.height;
        this.velocityY = 0;
        this.velocityX = 0;
        this.jumping = false;
        this.gravity = 0.1; // Уменьшаем гравитацию для более медленного движения вверх-вниз
        this.speed = 4;
        this.lastPlatformY = canvas.height - this.height;
        this.jumpForce = -10; // Возвращаем прежнюю высоту прыжка
        this.currentPlatform = null;
    }

    draw() {
        if (playerImg.complete && playerImg.naturalWidth > 0) {
            ctx.drawImage(playerImg, this.x, this.y - cameraY, this.width, this.height);
        } else {
            ctx.fillStyle = '#8a4fff';
            ctx.fillRect(this.x, this.y - cameraY, this.width, this.height);
        }
    }

    update() {
        this.velocityY += this.gravity;
        this.y += this.velocityY;
        this.x += this.velocityX;

        // Ограничение движения по горизонтали
        if (this.x < 0) {
            this.x = 0;
        }
        if (this.x + this.width > canvas.width) {
            this.x = canvas.width - this.width;
        }

        // Проверка столкновения с землей
        if (this.y + this.height > canvas.height) {
            this.y = canvas.height - this.height;
            this.velocityY = this.jumpForce; // Автоматический прыжок при приземлении
            this.jumping = false;
        }
    }

    moveLeft() {
        this.velocityX = -this.speed;
    }

    moveRight() {
        this.velocityX = this.speed;
    }

    stop() {
        this.velocityX = 0;
    }
}

// Класс для платформ
class Platform {
    constructor(x, y) {
        this.width = 100;
        this.height = 20;
        this.x = x;
        this.y = y;
        this.isCurrent = false;
    }

    draw() {
        if (this.isCurrent) {
            // Подсветка текущей платформы
            ctx.fillStyle = '#ff6b6b';
            ctx.fillRect(this.x - 2, this.y - cameraY - 2, this.width + 4, this.height + 4);
        }
        ctx.fillStyle = '#6b3fd9';
        ctx.fillRect(this.x, this.y - cameraY, this.width, this.height);

        // Текст на платформе по категориям
        let text = getCategory(score);
        if (text) {
            ctx.fillStyle = '#fff';
            ctx.font = (text.length > 15 ? 'bold 10px Arial' : 'bold 16px Arial');
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, this.x + this.width / 2, this.y - cameraY + this.height / 2);
        }
    }
}

// Создаем игрока
const player = new Player();

// Массив платформ
let platforms = [];

// Создаем начальные платформы
function createInitialPlatforms() {
    platforms = [];
    // Стартовая платформа
    platforms.push(new Platform(canvas.width / 2 - 50, canvas.height - 100));
    // Остальные платформы выше, с шагом 80px
    for (let i = 0; i < 14; i++) {
        const x = Math.random() * (canvas.width - 100);
        const y = canvas.height - 200 - i * 80;
        platforms.push(new Platform(x, y));
    }
}

// Функция для создания новой платформы
function createNewPlatform() {
    // Находим самую верхнюю платформу
    const highestPlatformY = Math.min(...platforms.map(p => p.y));
    // Новая платформа появляется выше самой верхней на фиксированное расстояние (например, 80)
    const y = highestPlatformY - 80;
    const x = Math.random() * (canvas.width - 100);
    platforms.push(new Platform(x, y));
}

// Проверка столкновений
function checkCollisions() {
    // Сбрасываем флаг текущей платформы для всех платформ
    platforms.forEach(platform => platform.isCurrent = false);
    
    platforms.forEach(platform => {
        if (player.velocityY > 0 && // Падаем вниз
            player.x + player.width > platform.x &&
            player.x < platform.x + platform.width &&
            player.y + player.height > platform.y &&
            player.y + player.height < platform.y + platform.height + 10) {
            
            player.y = platform.y - player.height;
            player.velocityY = player.jumpForce;
            player.jumping = false;
            platform.isCurrent = true; // Устанавливаем флаг текущей платформы
            player.currentPlatform = platform;

            // Увеличиваем счет только если поднялись на платформу выше
            if (platform.y < player.lastPlatformY) {
                score += 100;
                scoreElement.textContent = score;
                player.lastPlatformY = platform.y;
            }
        }
    });
}

// Обработка клавиш
document.addEventListener('keydown', (event) => {
    if (!isGameActive()) return;
    switch(event.code) {
        case 'KeyA':
            player.moveLeft();
            break;
        case 'KeyD':
            player.moveRight();
            break;
    }
});

document.addEventListener('keyup', (event) => {
    if (!isGameActive()) return;
    if (event.code === 'KeyA' || event.code === 'KeyD') {
        player.stop();
    }
});

// Обработка кликов по кнопкам
leaderboardBtn.addEventListener('click', () => {
    leaderboard.classList.remove('hidden');
    updateLeaderboard();
    paused = true;
    showPauseOverlay();
});

closeLeaderboard.addEventListener('click', () => {
    leaderboard.classList.add('hidden');
    paused = false;
    hidePauseOverlay();
});

// Обновление таблицы лидеров
function updateLeaderboard() {
    let records = JSON.parse(localStorage.getItem('records') || '[]');
    // Сортируем по убыванию очков
    records.sort((a, b) => b.score - a.score);
    // Формируем строки таблицы
    leaderboardList.innerHTML = records.map((rec, i) =>
        `<tr><td>${i + 1}</td><td>${rec.name}</td><td>${rec.score}</td><td>${getCategory(rec.score)}</td></tr>`
    ).join('');
}

// Сохранение счета
function saveScore() {
    let records = JSON.parse(localStorage.getItem('records') || '[]');
    // Проверяем, есть ли уже запись для этого ника
    const idx = records.findIndex(r => r.name === playerName);
    if (idx === -1) {
        // Нет записи — добавляем
        records.push({ name: playerName, score });
    } else if (score > records[idx].score) {
        // Есть запись, но побит рекорд — обновляем
        records[idx].score = score;
    } // иначе не обновляем
    localStorage.setItem('records', JSON.stringify(records));
}

function showNameMenu() {
    document.getElementById('nameMenu').style.display = 'flex';
    document.getElementById('startOverlay').style.display = 'none';
    document.querySelector('.game-container').style.filter = 'blur(2px)';
    document.getElementById('playerNameInput').value = playerName;
    document.getElementById('playerNameInput').focus();
}
function hideNameMenu() {
    document.getElementById('nameMenu').style.display = 'none';
}
function showStartBtn() {
    document.getElementById('startBtn').style.display = 'inline-block';
}
function hideStartBtn() {
    document.getElementById('startBtn').style.display = 'none';
    document.querySelector('.game-container').style.filter = '';
}
function saveName() {
    console.log('saveName вызвана');
    const input = document.getElementById('playerNameInput').value.trim();
    if (!input) return;
    playerName = input;
    localStorage.setItem('playerName', playerName);
    document.getElementById('nameMenu').style.display = 'none';
    document.querySelector('.game-container').style.filter = '';
    document.getElementById('startBtn').style.display = 'inline-block';
}
function startGame() {
    hideStartBtn();
    document.querySelector('.game-container').style.filter = '';
    gameStarted = true;
}
function isGameActive() { return gameStarted && !paused; }

function showPauseOverlay() {
    document.getElementById('pauseOverlay').style.display = 'flex';
}
function hidePauseOverlay() {
    document.getElementById('pauseOverlay').style.display = 'none';
}
function togglePause() {
    if (!gameStarted) return;
    paused = !paused;
    if (paused) {
        showPauseOverlay();
    } else {
        hidePauseOverlay();
    }
}

window.addEventListener('DOMContentLoaded', () => {
    if (!playerName) {
        showNameMenu();
    } else {
        showStartBtn();
    }
    document.getElementById('saveNameBtn').onclick = saveName;
    document.getElementById('playerNameInput').onkeydown = e => {
        if (e.key === 'Enter') saveName();
    };
    document.getElementById('startBtn').onclick = startGame;
    document.getElementById('resumeBtn').onclick = () => { paused = false; hidePauseOverlay(); };
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Escape') {
            paused = !paused;
            if (paused) {
                showPauseOverlay();
            } else {
                hidePauseOverlay();
            }
        }
    });
});

// Игровой цикл
function gameLoop() {
    if (!isGameActive()) {
        requestAnimationFrame(gameLoop);
        return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Обновляем позицию камеры
    if (player.y < cameraY + canvas.height * 0.7) {
        cameraY = player.y - canvas.height * 0.7;
    }
    
    player.update();
    player.draw();
    
    // Удаляем платформы, которые ушли за низ экрана
    platforms = platforms.filter(platform => platform.y < cameraY + canvas.height);

    // Генерируем новые платформы, если их меньше 15
    while (platforms.length < 15) {
        createNewPlatform();
    }
    
    // Сортируем платформы по высоте для правильного отображения
    platforms.sort((a, b) => a.y - b.y);
    platforms.forEach(platform => platform.draw());
    
    checkCollisions();
    
    // Если игрок упал вниз
    if (player.y > cameraY + canvas.height) {
        gameOver = true;
        saveScore();
        alert(`Игра окончена! Ваш счет: ${score}`);
        score = 0;
        scoreElement.textContent = score;
        player.y = canvas.height - player.height;
        player.velocityY = player.jumpForce;
        cameraY = 0;
        player.lastPlatformY = canvas.height - player.height;
        player.currentPlatform = null;
        createInitialPlatforms();
        gameOver = false;
    }
    
    requestAnimationFrame(gameLoop);
}

// Запуск игры
createInitialPlatforms();
gameLoop();

function getCategory(score) {
    if (score < 500) return 'Aprove?';
    if (score < 1000) return 'Gmpc';
    if (score < 1500) return 'Arcian';
    if (score < 2000) return 'PARASOL ☂️';
    if (score < 2500) return 'Loosty GM';
    if (score < 3000) return 'Well you a monster';
    if (score < 3500) return 'A BOT?';
    return 'LEGEND';
} 