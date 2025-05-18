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

// Путь к SVG-картинке для персонажа
const playerImgSrc = "ARCIUM_Primary-Icon_light.svg";
const playerImg = new Image();
playerImg.src = playerImgSrc;

// Класс для игрока
class Player {
    constructor() {
        this.width = 50;
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
        this.isCurrent = false; // Добавляем флаг текущей платформы
    }

    draw() {
        if (this.isCurrent) {
            // Подсветка текущей платформы
            ctx.fillStyle = '#ff6b6b';
            ctx.fillRect(this.x - 2, this.y - cameraY - 2, this.width + 4, this.height + 4);
        }
        ctx.fillStyle = '#6b3fd9';
        ctx.fillRect(this.x, this.y - cameraY, this.width, this.height);
    }
}

// Создаем игрока
const player = new Player();

// Массив платформ
let platforms = [];

// Создаем начальные платформы
function createInitialPlatforms() {
    platforms = [];
    // Добавляем начальную платформу
    platforms.push(new Platform(canvas.width / 2 - 50, canvas.height - 100));
    
    // Добавляем больше случайных платформ
    for (let i = 0; i < 10; i++) { // Увеличиваем количество начальных платформ
        const x = Math.random() * (canvas.width - 100);
        const y = canvas.height - 200 - i * 80; // Уменьшаем расстояние между платформами
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
                score += 10;
                scoreElement.textContent = score;
                player.lastPlatformY = platform.y;
            }
        }
    });
}

// Обработка клавиш
document.addEventListener('keydown', (event) => {
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
    if (event.code === 'KeyA' || event.code === 'KeyD') {
        player.stop();
    }
});

// Обработка кликов по кнопкам
leaderboardBtn.addEventListener('click', () => {
    leaderboard.classList.remove('hidden');
    updateLeaderboard();
});

closeLeaderboard.addEventListener('click', () => {
    leaderboard.classList.add('hidden');
});

// Обновление таблицы лидеров
function updateLeaderboard() {
    const scores = JSON.parse(localStorage.getItem('scores') || '[]');
    scores.sort((a, b) => b - a);
    
    leaderboardList.innerHTML = scores
        .slice(0, 10)
        .map((score, index) => `<div>${index + 1}. ${score} очков</div>`)
        .join('');
}

// Сохранение счета
function saveScore() {
    const scores = JSON.parse(localStorage.getItem('scores') || '[]');
    scores.push(score);
    localStorage.setItem('scores', JSON.stringify(scores));
}

// Игровой цикл
function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Обновляем позицию камеры
    if (player.y < cameraY + canvas.height * 0.7) {
        cameraY = player.y - canvas.height * 0.7;
    }
    
    player.update();
    player.draw();
    
    // Удаляем платформы, которые находятся слишком низко (за пределами экрана снизу)
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
