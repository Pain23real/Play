const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('scoreValue');
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
let gameStartTime = 0; // Время начала игры
let safeStartPeriod = 3000; // Безопасный период в начале игры (3 секунды)
let baseSpeed = 4; // Базовая скорость игрока
let speedIncrement = 0.25; // Увеличение скорости при каждом прыжке - увеличено с 0.15

// Переменные для системы delta time
let lastFrameTime = 0; // Время последнего кадра
let deltaTime = 0; // Разница во времени между кадрами в секундах
const targetFPS = 60; // Целевой FPS для нормализации
const timeStep = 1000 / targetFPS; // Идеальный временной шаг (в мс)
const baseMoveSpeed = 240; // Базовая скорость движения в пикселях в секунду
const canvasRefWidth = 800; // Эталонная ширина канваса для нормализации скорости

// Загружаем изображение для персонажа
const playerImg = new Image();
playerImg.src = 'ARCIUM_Primary-Icon_light.svg'; // SVG-картинка персонажа

// Загружаем изображение зонтика
const umbrellaImg = new Image();
umbrellaImg.src = 'umbrella.svg'; // SVG-картинка зонтика с прозрачным фоном

// Создаем аудиоконтекст для звуковых эффектов
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

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
        this.speed = baseSpeed; // Используем глобальную базовую скорость
        this.lastPlatformY = canvas.height - this.height;
        this.jumpForce = -9.5; // Настраиваем базовую высоту прыжка
        this.currentPlatform = null;
        this.movementMultiplier = 1.2; // Уменьшенный множитель для более плавного движения
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
        // Применяем физику с учетом delta time
        this.velocityY += this.gravity * deltaTime * targetFPS;
        this.y += this.velocityY * deltaTime * targetFPS;
        this.x += this.velocityX;

        // Добавляем эффект экранной петли: когда игрок выходит за правый край, он появляется слева и наоборот
        if (this.x + this.width < 0) {
            // Если вышли за левый край - перемещаемся к правому
            this.x = canvas.width - this.width;
        } else if (this.x > canvas.width) {
            // Если вышли за правый край - перемещаемся к левому
            this.x = 0;
        }

        // Проверка столкновения с землей
        if (this.y + this.height > canvas.height) {
            this.y = canvas.height - this.height;
            this.velocityY = this.jumpForce; // Автоматический прыжок при приземлении
            this.jumping = false;
        }
    }

    moveLeft() {
        // Нормализуем скорость с учетом delta time и размера канваса
        const speedFactor = (canvas.width / canvasRefWidth) * deltaTime;
        this.velocityX = -baseMoveSpeed * speedFactor;
    }

    moveRight() {
        // Нормализуем скорость с учетом delta time и размера канваса
        const speedFactor = (canvas.width / canvasRefWidth) * deltaTime;
        this.velocityX = baseMoveSpeed * speedFactor;
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
        // Добавляем признак "сломанного" зонтика
        this.isBroken = score >= 500 && Math.random() < 0.3; // 30% вероятность быть сломанным
        // Случайный цвет для зонтика, для сломанных всегда фиолетовый
        this.color = this.isBroken ? '#8a4fff' : this.getRandomColor();
        // Добавляем смещение зонтика для более реалистичных коллизий
        this.umbrellaTopOffset = this.height * 1.5; // Увеличено для лучшей коллизии с верхом зонтика
        // Добавляем движение некоторым платформам
        this.isMoving = score >= 1500 && Math.random() < 0.3; // 30% движущиеся платформы после 1500 очков
        this.moveSpeed = (Math.random() * 2 + 1) * (Math.random() < 0.5 ? 1 : -1); // Скорость 1-3, случайное направление
        this.moveDistance = Math.random() * 150 + 50; // Дистанция 50-200px
        this.initialX = x; // Сохраняем начальную позицию для движения
        // Добавляем временное исчезновение для некоторых платформ
        this.isTemporary = score >= 2000 && Math.random() < 0.2; // 20% временных платформ после 2000 очков
        this.startTime = Date.now();
        this.lifeTime = Math.random() * 5000 + 5000; // 5-10 секунд жизни для временных платформ
    }

    getRandomColor() {
        const colors = ['#ff6b6b', '#6b3fd9', '#4ecdc4', '#ffbe0b', '#fb5607', '#8338ec'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    draw() {
        if (this.isCurrent) {
            // Подсветка текущей платформы
            ctx.save();
            ctx.shadowColor = '#fff';
            ctx.shadowBlur = 15;
        }
        
        // Сохраняем текущий контекст
        ctx.save();
        
        // Рисуем зонтик с помощью Canvas API
        var centerX = this.x + this.width / 2;
        var centerY = this.y - cameraY;
        var radius = this.width / 2;
        var handleHeight = this.height * 1.2;
        
        // Рисуем купол зонтика (полукруг)
        ctx.beginPath();
        ctx.fillStyle = this.color;
        ctx.arc(centerX, centerY - this.umbrellaTopOffset, radius, Math.PI, 0, false);
        ctx.fill();
        
        // Добавляем окантовку купола
        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#333';
        ctx.arc(centerX, centerY - this.umbrellaTopOffset, radius, Math.PI, 0, false);
        ctx.stroke();
        
        // Если зонтик сломан, рисуем "трещины" в виде зигзагов
        if (this.isBroken) {
            ctx.beginPath();
            ctx.lineWidth = 2.5;
            ctx.strokeStyle = '#ffffff';
            
            // Рисуем зигзаги вместо трещин
            const zigzagCount = 5;
            const zigzagWidth = radius * 1.6 / zigzagCount;
            
            for (let i = 0; i < zigzagCount; i++) {
                const startX = centerX - radius + i * zigzagWidth;
                const endX = startX + zigzagWidth;
                const midY = centerY - this.umbrellaTopOffset - radius * 0.2;
                const baseY = centerY - this.umbrellaTopOffset;
                
                ctx.moveTo(startX, baseY);
                ctx.lineTo((startX + endX) / 2, midY);
                ctx.lineTo(endX, baseY);
            }
            ctx.stroke();
        }
        
        // Рисуем ручку зонтика
        ctx.beginPath();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#333';
        ctx.moveTo(centerX, centerY - this.umbrellaTopOffset);
        ctx.lineTo(centerX, centerY + handleHeight - this.umbrellaTopOffset);
        ctx.stroke();
        
        // Рисуем изгиб на конце ручки
        ctx.beginPath();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#333';
        ctx.arc(centerX - 5, centerY + handleHeight - this.umbrellaTopOffset, 5, 0, Math.PI, false);
        ctx.stroke();
        
        // Добавляем "спицы" зонтика
        ctx.beginPath();
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#333';
        for (var i = 1; i <= 6; i++) {
            var angle = Math.PI + (i * Math.PI / 7);
            ctx.moveTo(centerX, centerY - this.umbrellaTopOffset);
            var endX = centerX + radius * Math.cos(angle);
            var endY = centerY - this.umbrellaTopOffset + radius * Math.sin(angle);
            ctx.lineTo(endX, endY);
        }
        ctx.stroke();
        
        // Если платформа временная, добавляем пунктирную окантовку
        if (this.isTemporary) {
            const timePassed = Date.now() - this.startTime;
            const lifePercentage = timePassed / this.lifeTime;
            
            if (lifePercentage > 0.7) {
                ctx.beginPath();
                ctx.setLineDash([5, 3]); // Пунктирная линия
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#fff';
                ctx.arc(centerX, centerY - this.umbrellaTopOffset, radius + 3, Math.PI, 0, false);
                ctx.stroke();
                ctx.setLineDash([]); // Возвращаем обычную линию
            }
        }
        
        // Восстанавливаем контекст
        ctx.restore();

        // Текст на платформе по категориям
        let text = getCategory(score);
        if (text) {
            ctx.fillStyle = '#fff';
            ctx.font = (text.length > 15 ? 'bold 10px Arial' : 'bold 16px Arial');
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, this.x + this.width / 2, this.y - cameraY - this.umbrellaTopOffset - 20);
        }
        
        if (this.isCurrent) {
            ctx.restore(); // Восстанавливаем контекст после подсветки
        }
    }
    
    update() {
        // Обновление для движущихся платформ
        if (this.isMoving) {
            // Двигаем платформу горизонтально
            this.x += this.moveSpeed;
            
            // Проверяем, не вышла ли платформа за пределы заданного диапазона движения
            if (Math.abs(this.x - this.initialX) > this.moveDistance) {
                this.moveSpeed = -this.moveSpeed; // Меняем направление
            }
            
            // Проверяем, не вышла ли платформа за пределы экрана
            if (this.x < 0) {
                this.x = 0;
                this.moveSpeed = Math.abs(this.moveSpeed); // Меняем направление
            } else if (this.x + this.width > canvas.width) {
                this.x = canvas.width - this.width;
                this.moveSpeed = -Math.abs(this.moveSpeed); // Меняем направление
            }
        }
        
        // Проверка времени жизни для временных платформ
        if (this.isTemporary) {
            const timePassed = Date.now() - this.startTime;
            
            // Если время вышло, начинаем исчезновение
            if (timePassed > this.lifeTime && !this.fading) {
                this.fading = true;
                this.opacity = 1;
            }
            
            // Если платформа исчезает, уменьшаем прозрачность
            if (this.fading) {
                this.opacity -= 0.05;
                if (this.opacity < 0) this.opacity = 0;
            }
        }
        
        // Возвращаем true если платформа всё еще активна, false если её нужно удалить
        if (this.fading && this.opacity <= 0) return false;
        return true;
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
    
    // Определяем уровень сложности
    const difficultyLevel = getDifficultyLevel(score);
    
    // Расстояние между платформами увеличивается с уровнем сложности (усилено)
    const verticalGap = 80 + (difficultyLevel * 8); // Увеличиваем с 5 до 8
    
    // Ширина платформ уменьшается с уровнем сложности (усилено)
    const platformWidth = Math.max(40, 100 - (difficultyLevel * 8)); // Минимум 40, увеличиваем с 5 до 8
    
    // Новая платформа появляется выше самой верхней
    const y = highestPlatformY - verticalGap;
    
    // Горизонтальная позиция становится более случайной с ростом сложности
    const horizontalVariance = difficultyLevel * 0.15; // Увеличено с 0.1 до 0.15
    const x = Math.random() * (canvas.width - platformWidth);
    
    const platform = new Platform(x, y);
    platform.width = platformWidth; // Устанавливаем новую ширину
    
    // Чем выше уровень сложности, тем больше вероятность сломанных платформ
    if (score >= 500) {
        platform.isBroken = Math.random() < (0.3 + difficultyLevel * 0.07); // Увеличено с 0.05 до 0.07
    }
    
    platforms.push(platform);
}

// Функция для воспроизведения звука при смене категории
function playLevelUpSound() {
    // Создаем осцилляторы для более интересного звука
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    // Настраиваем первый осциллятор (более высокая частота)
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(440, audioCtx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.2);
    
    // Настраиваем второй осциллятор (более низкая частота)
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(220, audioCtx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.3);
    
    // Настраиваем громкость звука
    gainNode.gain.setValueAtTime(0.4, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
    
    // Подключаем узлы
    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    // Запускаем осцилляторы
    osc1.start();
    osc2.start();
    
    // Останавливаем их через полсекунды
    osc1.stop(audioCtx.currentTime + 0.5);
    osc2.stop(audioCtx.currentTime + 0.5);
}

// Функция для показа уведомления при изменении категории
function showCategoryChangeNotification(category) {
    const notification = document.createElement('div');
    notification.className = 'category-notification';
    notification.textContent = category; // Show only the category name
    notification.style.position = 'absolute';
    notification.style.left = '50%';
    notification.style.top = '30%';
    notification.style.transform = 'translate(-50%, -50%)';
    notification.style.padding = '10px 20px';
    notification.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    notification.style.color = '#fff';
    notification.style.borderRadius = '5px';
    notification.style.fontSize = '24px';
    notification.style.zIndex = '100';
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.5s';
    
    document.querySelector('.game-container').appendChild(notification);
    
    // Show notification with animation
    setTimeout(() => {
        notification.style.opacity = '1';
    }, 100);
    
    // Add screen flash effect
    const flash = document.createElement('div');
    flash.style.position = 'absolute';
    flash.style.left = '0';
    flash.style.top = '0';
    flash.style.width = '100%';
    flash.style.height = '100%';
    flash.style.backgroundColor = 'white';
    flash.style.opacity = '0.4';
    flash.style.zIndex = '50';
    flash.style.transition = 'opacity 0.5s';
    document.querySelector('.game-container').appendChild(flash);
    
    // Hide and remove the flash
    setTimeout(() => {
        flash.style.opacity = '0';
        setTimeout(() => flash.remove(), 500);
    }, 300);
    
    // Play sound on category change
    playLevelUpSound();
    
    // Hide and remove notification after some time
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 500);
    }, 2000);
}

// Проверка столкновений
function checkCollisions() {
    // Сбрасываем флаг текущей платформы для всех платформ
    platforms.forEach(platform => platform.isCurrent = false);
    
    // Отслеживаем предыдущую платформу
    const previousPlatform = player.currentPlatform;
    
    platforms.forEach(platform => {
        const playerBottom = player.y + player.height;
        const platformTop = platform.y - platform.umbrellaTopOffset;
        
        if (player.velocityY > 0 && // Падаем вниз
            player.x + player.width > platform.x &&
            player.x < platform.x + platform.width &&
            playerBottom > platformTop &&
            playerBottom < platformTop + 10) {
            
            player.y = platformTop - player.height;
            player.velocityY = player.jumpForce;
            player.jumping = false;
            platform.isCurrent = true; // Устанавливаем флаг текущей платформы
            
            // Если предыдущая платформа была сломана, она должна исчезнуть
            if (previousPlatform && previousPlatform.isBroken && score >= 500) {
                const fadeOutPlatform = previousPlatform;
                const fadeOutAnimation = setInterval(() => {
                    // Уменьшаем прозрачность постепенно
                    if (fadeOutPlatform.opacity === undefined) fadeOutPlatform.opacity = 1;
                    fadeOutPlatform.opacity -= 0.1;
                    
                    if (fadeOutPlatform.opacity <= 0) {
                        clearInterval(fadeOutAnimation);
                        // Удаляем платформу из массива
                        platforms = platforms.filter(p => p !== fadeOutPlatform);
                    }
                }, 50);
            }
            
            player.currentPlatform = platform;
            
            // Увеличиваем скорость игрока при каждом прыжке
            player.speed += speedIncrement;

            // Увеличиваем счет только если поднялись на платформу выше
            if (platform.y < player.lastPlatformY) {
                score += 20; // Изменено со 100 на 20
                scoreElement.textContent = score;
                player.lastPlatformY = platform.y;
                
                // Проверяем, изменилась ли категория и показываем уведомление
                const prevCategory = getCategory(score - 20); // Изменено со 100 на 20
                const currentCategory = getCategory(score);
                if (prevCategory !== currentCategory) {
                    showCategoryChangeNotification(currentCategory);
                }
            }
        }
    });
}

// Обработка клавиш
document.addEventListener('keydown', (event) => {
    if (!isGameActive()) return;
    switch(event.code) {
        case 'KeyA':
        case 'ArrowLeft':
            player.moveLeft();
            break;
        case 'KeyD':
        case 'ArrowRight':
            player.moveRight();
            break;
    }
});

document.addEventListener('keyup', (event) => {
    if (!isGameActive()) return;
    if (event.code === 'KeyA' || event.code === 'KeyD' || 
        event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
        player.stop();
    }
});

// Add touch event handlers for mobile controls
const leftBtn = document.getElementById('leftBtn');
const rightBtn = document.getElementById('rightBtn');

// Process touch events for mobile devices
if (leftBtn && rightBtn) {
    // Left button - touch handling
    leftBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (isGameActive()) player.moveLeft();
    });
    
    leftBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (isGameActive()) player.stop();
    });
    
    // Right button - touch handling
    rightBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (isGameActive()) player.moveRight();
    });
    
    rightBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (isGameActive()) player.stop();
    });
    
    // For mouse support on desktop devices
    leftBtn.addEventListener('mousedown', () => {
        if (isGameActive()) player.moveLeft();
    });
    
    leftBtn.addEventListener('mouseup', () => {
        if (isGameActive()) player.stop();
    });
    
    rightBtn.addEventListener('mousedown', () => {
        if (isGameActive()) player.moveRight();
    });
    
    rightBtn.addEventListener('mouseup', () => {
        if (isGameActive()) player.stop();
    });
    
    // Stop movement when cursor leaves the button
    leftBtn.addEventListener('mouseleave', () => {
        if (isGameActive()) player.stop();
    });
    
    rightBtn.addEventListener('mouseleave', () => {
        if (isGameActive()) player.stop();
    });
}

// Обработка кликов по кнопкам, обработчик будет добавлен в window.addEventListener('DOMContentLoaded')

// Обработка кликов по кнопкам будет добавлена в window.addEventListener('DOMContentLoaded')

// Эти обработчики были перемещены в DOMContentLoaded

// Функция обновления таблицы лидеров
function updateLeaderboard() {
    // Получаем записи из localStorage
    let records = getLeaderboardRecords();
    
    // Сортируем по убыванию очков
    records.sort((a, b) => b.score - a.score);
    
    // Очищаем список
    leaderboardList.innerHTML = '';
    
    // Находим данные текущего игрока
    const currentPlayerIndex = records.findIndex(r => r.name === playerName);
    const currentPlayerRank = currentPlayerIndex !== -1 ? currentPlayerIndex + 1 : '-';
    const currentPlayerScore = currentPlayerIndex !== -1 ? records[currentPlayerIndex].score : 0;
    
    // Формируем содержимое для tbody
    let bodyContent = '';
    
    // Добавляем строку с персональным результатом
    if (currentPlayerIndex !== -1) {
        const category = getCategory(currentPlayerScore);
        bodyContent += `
            <tr style="background-color: rgba(138, 79, 255, 0.2);">
                <td colspan="4" style="padding: 10px; border: none;">
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 5px 15px;">
                        <div style="font-weight: bold;">Your best: ${currentPlayerScore} points</div>
                        <div style="display: flex; align-items: center;">
                            <div style="margin-right: 10px;">Rank: ${currentPlayerRank}</div>
                            <span class="category-badge" style="background-color: ${getCategoryColor(category)};">${category}</span>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    } else {
        bodyContent += `
            <tr style="background-color: rgba(138, 79, 255, 0.2);">
                <td colspan="4" style="padding: 10px; border: none;">
                    <div style="text-align: center; font-style: italic; color: #ffcc00;">
                        You don't have a record yet. Play to get on the leaderboard!
                    </div>
                </td>
            </tr>
        `;
    }
    
    // Добавляем поле поиска
    bodyContent += `
        <tr>
            <td colspan="4" style="border: none;">
                <div class="search-container">
                    <input type="text" id="leaderSearchInput" placeholder="Search by nickname..." style="width: 100%; padding: 10px; margin: 10px 0; border-radius: 6px;">
                </div>
            </td>
        </tr>
    `;
    
    // Добавляем всех игроков без ограничения
    records.forEach((rec, i) => {
        let rankClass = '';
        
        if (i === 0) {
            rankClass = 'gold-rank';
        } else if (i === 1) {
            rankClass = 'silver-rank';
        } else if (i === 2) {
            rankClass = 'bronze-rank';
        }
        
        const isCurrentPlayer = rec.name === playerName;
        const rowStyle = isCurrentPlayer ? 'background-color: rgba(138, 79, 255, 0.3); font-weight: bold;' : '';
        
        bodyContent += `
            <tr class="player-row" data-name="${rec.name.toLowerCase()}" style="${rowStyle}">
                <td class="${rankClass}" style="text-align: center; width: 15%; border: 1px solid rgba(255, 255, 255, 0.2);">${i + 1}</td>
                <td style="text-align: left; width: 35%; border: 1px solid rgba(255, 255, 255, 0.2);">${rec.name}</td>
                <td style="text-align: right; width: 20%; border: 1px solid rgba(255, 255, 255, 0.2);">${rec.score}</td>
                <td style="text-align: center; width: 30%; border: 1px solid rgba(255, 255, 255, 0.2);">
                    <span class="category-badge" style="background-color: ${getCategoryColor(getCategory(rec.score))};">${getCategory(rec.score)}</span>
                </td>
            </tr>
        `;
    });
    
    // Добавляем информацию о количестве участников
    bodyContent += `
        <tr>
            <td colspan="4" style="text-align: center; font-style: italic; border-top: 1px solid #ccc; padding-top: 10px; border: none;">
                Total players: ${records.length}
            </td>
        </tr>
    `;
    
    // Добавляем содержимое напрямую в tbody
    leaderboardList.innerHTML = bodyContent;
    
    // Добавляем обработчик для поиска
    const searchInput = document.getElementById('leaderSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const searchTerm = searchInput.value.toLowerCase();
            const rows = document.querySelectorAll('.player-row');
            
            rows.forEach(row => {
                const nameMatch = row.dataset.name && row.dataset.name.includes(searchTerm);
                row.style.display = nameMatch ? '' : 'none';
            });
        });
    }
}

// Функция для получения цвета категории
function getCategoryColor(category) {
    switch(category) {
        case 'Aprove?': return '#6c757d';
        case 'Gmpc': return '#28a745';
        case 'Arcian': return '#17a2b8';
        case 'PARASOL ☂️': return '#fd7e14';
        case 'Loosty GM': return '#dc3545';
        case 'Well you a monster': return '#7952b3';
        case 'A BOT?': return '#ff6b6b';
        case 'LEGEND': return '#ffc107';
        default: return '#6c757d';
    }
}

// Функция для получения записей таблицы лидеров из localStorage и сервера
function getLeaderboardRecords() {
    // Получаем записи из localStorage
    let localRecords = JSON.parse(localStorage.getItem('records') || '[]');
    
    // Здесь можно добавить код для получения записей с сервера и объединения с локальными
    
    // Сохраняем копию записей в sessionStorage для восстановления при перезапуске браузера
    sessionStorage.setItem('records_backup', JSON.stringify(localRecords));
    
    return localRecords;
}

// Функция для сохранения записей таблицы лидеров в localStorage и на сервер
function saveLeaderboardRecords(records) {
    // Сохраняем в localStorage
    localStorage.setItem('records', JSON.stringify(records));
    
    // Сохраняем в sessionStorage как резервную копию
    sessionStorage.setItem('records_backup', JSON.stringify(records));
    
    // Здесь можно добавить код для сохранения на сервер
    // Например, с использованием Fetch API для отправки данных на сервер
    
    // Пример кода для отправки на сервер:
    /*
    if (window.navigator.onLine) { // Проверяем, есть ли подключение к интернету
        fetch('https://your-server.com/api/leaderboard', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(records)
        })
        .then(response => {
            if (!response.ok) {
                console.error('Ошибка сохранения на сервере:', response.statusText);
            }
        })
        .catch(error => {
            console.error('Ошибка при отправке данных на сервер:', error);
        });
    }
    */
}

// Функция для загрузки таблицы лидеров с сервера
function loadLeaderboardFromServer() {
    // Здесь можно добавить код для загрузки таблицы лидеров с сервера
    // Например, с использованием Fetch API
    
    // Пример кода:
    /*
    if (window.navigator.onLine) {
        fetch('https://your-server.com/api/leaderboard')
            .then(response => {
                if (response.ok) {
                    return response.json();
                }
                throw new Error('Ошибка загрузки с сервера');
            })
            .then(serverRecords => {
                // Объединяем с локальными записями
                let localRecords = JSON.parse(localStorage.getItem('records') || '[]');
                
                // Создаем объединенный список и удаляем дубликаты
                const combinedRecords = [...localRecords];
                
                serverRecords.forEach(serverRec => {
                    const localIndex = combinedRecords.findIndex(localRec => 
                        localRec.name === serverRec.name);
                    
                    if (localIndex === -1) {
                        // Если записи нет локально, добавляем
                        combinedRecords.push(serverRec);
                    } else if (serverRec.score > combinedRecords[localIndex].score) {
                        // Если серверная запись лучше, обновляем
                        combinedRecords[localIndex] = serverRec;
                    }
                    // Если локальная запись лучше, оставляем её
                });
                
                // Сохраняем объединенные записи
                localStorage.setItem('records', JSON.stringify(combinedRecords));
                
                // Обновляем отображение
                updateLeaderboard();
            })
            .catch(error => {
                console.error('Ошибка при загрузке данных с сервера:', error);
                // Используем резервную копию из sessionStorage если есть
                const backupRecords = sessionStorage.getItem('records_backup');
                if (backupRecords) {
                    localStorage.setItem('records', backupRecords);
                }
            });
    } else {
        // Если нет подключения, используем резервную копию
        const backupRecords = sessionStorage.getItem('records_backup');
        if (backupRecords) {
            localStorage.setItem('records', backupRecords);
        }
    }
    */
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
    
    // Сохраняем обновленные записи
    saveLeaderboardRecords(records);
}

// Функция для отображения меню ввода ника
function showNameMenu() {
    const nameMenu = document.getElementById('nameMenu');
    if (nameMenu) nameMenu.style.display = 'flex';
    // Убираем размытие для лучшего вида в игровом контейнере
    // const gameContainer = document.querySelector('.game-container');
    // if (gameContainer) gameContainer.style.filter = 'blur(2px)';
    const playerNameInput = document.getElementById('playerNameInput');
    if (playerNameInput) {
        playerNameInput.value = playerName;
        playerNameInput.focus();
    }
}

// Функция для скрытия меню ввода ника
function hideNameMenu() {
    document.getElementById('nameMenu').style.display = 'none';
}

function showStartBtn() {
    document.getElementById('startBtn').style.display = 'inline-block';
}
function hideStartBtn() {
    document.getElementById('startBtn').style.display = 'none';
}
function saveName() {
    console.log('saveName called');
    const input = document.getElementById('playerNameInput').value.trim();
    if (!input) return;
    playerName = input;
    localStorage.setItem('playerName', playerName);
    hideNameMenu();
    
    // Fix: Always show the Start button after saving name
    showStartBtn();
    console.log('Start button should be visible now');
}
function startGame() {
    hideStartBtn();
    gameStarted = true;
    gameStartTime = Date.now(); // Запоминаем время начала игры
}
function isGameActive() { return gameStarted && !paused && !gameOver; }

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
    document.getElementById('restartBtn').onclick = restartGame;
    
    // Добавляем обработчик клика для блока Simple Controls
    document.getElementById('controlsFeature').addEventListener('click', () => {
        // Прокручиваем страницу к игровому контейнеру
        document.querySelector('.game-container').scrollIntoView({ behavior: 'smooth' });
    });
    
    // Обработчик для блока лидерборда
    document.getElementById('leaderboardFeature').addEventListener('click', () => {
        leaderboard.classList.remove('hidden');
        updateLeaderboard();
        paused = true;
        showPauseOverlay();
    });
    
    // Обработчик для закрытия лидерборда
    document.getElementById('closeLeaderboard').addEventListener('click', () => {
        leaderboard.classList.add('hidden');
        paused = false;
        hidePauseOverlay();
    });
    
    // Also add touch event listener for start button 
    document.getElementById('startBtn').addEventListener('touchstart', (e) => {
        e.preventDefault();
        startGame();
    });
    
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
    
    // Add detection for mobile devices
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
        document.querySelector('.mobile-controls').style.display = 'flex';
    }
    
    // Debug: Make button visible
    console.log('Initial DOM loaded, playerName:', playerName);
    if (playerName) {
        console.log('Player name exists, showing start button');
        document.getElementById('startBtn').style.display = 'inline-block';
    }
});

// Функция для показа красивого окна завершения игры
function showGameOverScreen(currentScore) {
    // Get all records from localStorage
    const records = JSON.parse(localStorage.getItem('records') || '[]');
    
    // Check if there's already a record for this nickname
    const prevRecord = records.find(rec => rec.name === playerName);
    const isNewRecord = !prevRecord || currentScore > prevRecord.score;
    
    // Save score
    saveScore();
    
    // Update records to determine position
    const updatedRecords = JSON.parse(localStorage.getItem('records') || '[]');
    updatedRecords.sort((a, b) => b.score - a.score);
    
    // Determine player rank
    const playerRank = updatedRecords.findIndex(rec => rec.name === playerName) + 1;
    
    // Fill information in game over screen
    document.querySelector('#gameOverScore span').textContent = currentScore;
    document.querySelector('#gameOverPlace span').textContent = playerRank;
    
    // Create motivational message
    let message = '';
    if (isNewRecord) {
        message = 'Congratulations! You\'ve set a new personal record!';
    } else {
        message = 'Don\'t worry, you can do better next time!';
    }
    document.getElementById('gameOverMessage').textContent = message;
    
    // Show game over screen
    document.getElementById('gameOverOverlay').style.display = 'flex';
    
    // Pause the game
    paused = true;
}

// Функция для перезапуска игры
function restartGame() {
    // Скрываем окно завершения игры
    document.getElementById('gameOverOverlay').style.display = 'none';
    
    // Сбрасываем все параметры
    score = 0;
    scoreElement.textContent = score;
    player.y = canvas.height - player.height;
    player.velocityY = player.jumpForce;
    player.velocityX = 0; // Сброс горизонтальной скорости при перезапуске
    cameraY = 0;
    player.lastPlatformY = canvas.height - player.height;
    player.currentPlatform = null;
    createInitialPlatforms();
    
    // Снимаем с паузы и продолжаем игру
    gameOver = false;
    paused = false;
    gameStartTime = Date.now(); // Сбрасываем время начала игры
}

// Игровой цикл
function gameLoop(timestamp) {
    // Вычисляем delta time
    if (!lastFrameTime) lastFrameTime = timestamp;
    deltaTime = (timestamp - lastFrameTime) / 1000; // Преобразуем в секунды
    lastFrameTime = timestamp;
    
    // Ограничиваем deltaTime для избежания скачков при низком FPS
    if (deltaTime > 0.2) deltaTime = 0.2; 
    
    if (!isGameActive()) {
        requestAnimationFrame(gameLoop);
        return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Обновляем позицию камеры (следуем и за подъемом и за падением)
    if (player.y < cameraY + canvas.height * 0.7) {
        // Если игрок поднимается вверх - камера следует за ним
        cameraY = player.y - canvas.height * 0.7;
    } else if (player.y > cameraY + canvas.height * 0.8) {
        // Если игрок падает вниз - камера тоже опускается, но медленнее
        cameraY = player.y - canvas.height * 0.8;
    }
    
    // Определяем текущий уровень сложности
    const difficultyLevel = getDifficultyLevel(score);
    
    // Увеличиваем гравитацию с уровнем сложности, с учетом delta time
    player.gravity = (0.1 + (difficultyLevel * 0.01)) / (targetFPS * deltaTime);
    
    // Корректируем силу прыжка, делаем её больше для компенсации увеличения скорости
    player.jumpForce = -10 + (difficultyLevel * 0.18); // Более плавная настройка силы прыжка
    
    // Уменьшаем скорость игрока с ростом сложности - с учетом delta time
    const normalizedSpeed = baseMoveSpeed * (deltaTime * targetFPS);
    player.speed = Math.max(normalizedSpeed * 0.5, normalizedSpeed * (1 - (difficultyLevel * 0.07)));
    
    // Добавляем эффект "дрожания" платформ для высоких уровней с учетом delta time
    if (difficultyLevel > 4) {
        platforms.forEach(platform => {
            // Уменьшаем вероятность в зависимости от delta time, чтобы эффект был одинаковым на разных FPS
            if (Math.random() > (0.95 + deltaTime * 0.05)) { 
                const shakeFactor = (Math.random() - 0.5) * (difficultyLevel - 3) * 1.5 * deltaTime * targetFPS;
                platform.x += shakeFactor;
                // Ограничиваем движение платформы в пределах экрана
                platform.x = Math.max(0, Math.min(canvas.width - platform.width, platform.x));
            }
        });
    }
    
    // Удаляем секцию с автоматическим исчезновением зонтиков - теперь они исчезают после того, как игрок спрыгивает с них
    // и только те, которые помечены как сломанные (isBroken = true)

    player.update();
    player.draw();
    
    // Удаляем платформы, которые ушли за низ экрана с запасом 300px для возможности восстановления
    platforms = platforms.filter(platform => platform.y < cameraY + canvas.height + 300);

    // Обновляем все платформы перед отрисовкой
    platforms = platforms.filter(platform => platform.update());
    
    // Генерируем новые платформы, если их меньше 15
    while (platforms.length < 15) {
        createNewPlatform();
    }
    
    // Сортируем платформы по высоте для правильного отображения
    platforms.sort((a, b) => a.y - b.y);
    platforms.forEach(platform => {
        // Если у платформы есть свойство opacity, используем его при отрисовке
        if (platform.opacity !== undefined && platform.opacity < 1) {
            ctx.globalAlpha = platform.opacity;
            platform.draw();
            ctx.globalAlpha = 1.0; // Возвращаем обратно
        } else {
            platform.draw();
        }
    });
    
    checkCollisions();
    
    // Новая логика проигрыша: если игрок пролетает ниже второго снизу зонтика
    // Не проверяем проигрыш в течение безопасного периода после начала игры
    const currentTime = Date.now();
    const isInSafePeriod = currentTime - gameStartTime < safeStartPeriod;
    
    // Проверяем проигрыш только если прошел безопасный период
    if (!isInSafePeriod && platforms.length >= 2) {
        // Сортируем платформы по высоте (снизу вверх)
        const sortedPlatforms = [...platforms].sort((a, b) => b.y - a.y);
        
        // Берем вторую снизу платформу
        const secondLowestPlatform = sortedPlatforms[1];
        
        // Если игрок ниже второй снизу платформы, считаем игру проигранной
        if (player.y > secondLowestPlatform.y + 50) {
            gameOver = true;
            
            // Сохраняем текущий счет
            const currentScore = score;
            
            // Вызываем функцию показа красивого окна
            showGameOverScreen(currentScore);
        }
    }
    
    requestAnimationFrame(gameLoop);
}

// Запуск игры
createInitialPlatforms();
requestAnimationFrame(gameLoop);

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

// Добавляем функцию для определения уровня сложности
function getDifficultyLevel(score) {
    if (score < 500) return 1;
    if (score < 1000) return 2;
    if (score < 1500) return 3;
    if (score < 2000) return 4;
    if (score < 2500) return 5;
    if (score < 3000) return 6;
    if (score < 3500) return 7;
    return 8;
} 