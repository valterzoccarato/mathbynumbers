const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = 800;
canvas.height = 600;

let score = 0;
let lives = 3;
let level = 1;
let gameRunning = false;
let keys = {};
let shipDestroyed = false;
let shipFragments = [];
let levelTransitioning = false;
let lastShootTime = 0;
const shootCooldown = 250; // millisecondi tra uno sparo e l'altro
let ammo = 40; // munizioni iniziali
let ammoRechargeTimer = null; // timer per ricarica automatica

// Nave
const ship = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    angle: 0,
    velocity: { x: 0, y: 0 },
    size: 15,
    turnSpeed: 0.06,
    thrust: 0.08,
    friction: 0.98
};

// Array per proiettili e asteroidi
let bullets = [];
let asteroids = [];

// Gestione tasti
document.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    if (e.key === ' ' && gameRunning) {
        e.preventDefault();
        shoot();
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

// Funzione per sparare
function shoot() {
    // Controlla se ci sono munizioni
    if (ammo <= 0) {
        return;
    }

    const currentTime = Date.now();

    // Controlla se è passato abbastanza tempo dall'ultimo sparo
    if (currentTime - lastShootTime < shootCooldown) {
        return;
    }

    lastShootTime = currentTime;

    const bulletSpeed = 7;
    bullets.push({
        x: ship.x + Math.cos(ship.angle) * ship.size,
        y: ship.y + Math.sin(ship.angle) * ship.size,
        velocity: {
            x: Math.cos(ship.angle) * bulletSpeed + ship.velocity.x,
            y: Math.sin(ship.angle) * bulletSpeed + ship.velocity.y
        },
        life: 60
    });

    // Riduci munizioni
    ammo--;
    updateAmmo();

    // Se le munizioni sono a zero, avvia timer per ricarica automatica
    if (ammo === 0 && !ammoRechargeTimer) {
        ammoRechargeTimer = setTimeout(() => {
            ammo = 20;
            updateAmmo();
            ammoRechargeTimer = null;
        }, 15000); // 15 secondi
    }
}

// Numeri e colori degli asteroidi
const asteroidColors = ['#FF0000', '#00FF00', '#FFFF00', '#00FFFF', '#FF00FF', '#FFA500']; // Rosso, Verde, Giallo, Ciano, Magenta, Arancio
const MIN_NUMBER = 1;
const MAX_NUMBER = 9;

function randomNumber() {
    return Math.floor(Math.random() * (MAX_NUMBER - MIN_NUMBER + 1)) + MIN_NUMBER;
}

// Creazione asteroidi
function createAsteroid(x, y, size, number) {
    const angle = Math.random() * Math.PI * 2;
    const baseSpeed = 0.5 + (level * 0.15);
    const speed = Math.random() * baseSpeed + baseSpeed;

    // Se non è specificato un numero, scegline uno casuale
    const value = number !== undefined ? number : randomNumber();
    const color = asteroidColors[value % asteroidColors.length];

    asteroids.push({
        x: x || Math.random() * canvas.width,
        y: y || Math.random() * canvas.height,
        velocity: {
            x: Math.cos(angle) * speed,
            y: Math.sin(angle) * speed
        },
        size: size || 40,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.05,
        number: value,
        color: color
    });
}

// Inizializzazione asteroidi
function initAsteroids() {
    asteroids = [];
    const asteroidCount = 3 + level;
    for (let i = 0; i < asteroidCount; i++) {
        let x, y;
        do {
            x = Math.random() * canvas.width;
            y = Math.random() * canvas.height;
        } while (distance(x, y, ship.x, ship.y) < 150);

        createAsteroid(x, y, 40);
    }
}

// Calcolo distanza
function distance(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

// Creazione frammenti nave
function createShipFragments() {
    shipFragments = [];
    const fragmentCount = 8;

    for (let i = 0; i < fragmentCount; i++) {
        const angle = (i / fragmentCount) * Math.PI * 2;
        const speed = Math.random() * 2 + 1;

        shipFragments.push({
            x: ship.x,
            y: ship.y,
            velocity: {
                x: Math.cos(angle) * speed + ship.velocity.x,
                y: Math.sin(angle) * speed + ship.velocity.y
            },
            size: ship.size / 3,
            life: 60,
            angle: angle
        });
    }
}

// Aggiornamento frammenti nave
function updateShipFragments() {
    shipFragments = shipFragments.filter(fragment => {
        fragment.x += fragment.velocity.x;
        fragment.y += fragment.velocity.y;
        fragment.life--;
        fragment.velocity.x *= 0.98;
        fragment.velocity.y *= 0.98;

        return fragment.life > 0;
    });
}

// Disegno frammenti nave
function drawShipFragments() {
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;

    shipFragments.forEach(fragment => {
        ctx.save();
        ctx.translate(fragment.x, fragment.y);
        ctx.rotate(fragment.angle);

        ctx.beginPath();
        ctx.moveTo(fragment.size, 0);
        ctx.lineTo(-fragment.size, -fragment.size / 2);
        ctx.lineTo(-fragment.size, fragment.size / 2);
        ctx.closePath();
        ctx.stroke();

        ctx.restore();
    });
}

// Aggiornamento nave
function updateShip() {
    if (shipDestroyed) return;

    if (keys['ArrowLeft']) {
        ship.angle -= ship.turnSpeed;
    }
    if (keys['ArrowRight']) {
        ship.angle += ship.turnSpeed;
    }
    if (keys['ArrowUp']) {
        ship.velocity.x += Math.cos(ship.angle) * ship.thrust;
        ship.velocity.y += Math.sin(ship.angle) * ship.thrust;
    }

    ship.velocity.x *= ship.friction;
    ship.velocity.y *= ship.friction;

    ship.x += ship.velocity.x;
    ship.y += ship.velocity.y;

    // Wrap around
    if (ship.x < 0) ship.x = canvas.width;
    if (ship.x > canvas.width) ship.x = 0;
    if (ship.y < 0) ship.y = canvas.height;
    if (ship.y > canvas.height) ship.y = 0;
}

// Disegno nave
function drawShip() {
    if (shipDestroyed) return;

    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(ship.angle);

    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ship.size, 0);
    ctx.lineTo(-ship.size, -ship.size / 2);
    ctx.lineTo(-ship.size / 2, 0);
    ctx.lineTo(-ship.size, ship.size / 2);
    ctx.closePath();
    ctx.stroke();

    // Propulsore
    if (keys['ArrowUp']) {
        ctx.fillStyle = 'orange';
        ctx.beginPath();
        ctx.moveTo(-ship.size, -5);
        ctx.lineTo(-ship.size - 10, 0);
        ctx.lineTo(-ship.size, 5);
        ctx.closePath();
        ctx.fill();
    }

    ctx.restore();
}

// Aggiornamento proiettili
function updateBullets() {
    bullets = bullets.filter(bullet => {
        bullet.x += bullet.velocity.x;
        bullet.y += bullet.velocity.y;
        bullet.life--;

        // Rimuovi proiettili fuori dallo schermo (non wrappare)
        if (bullet.x < 0 || bullet.x > canvas.width || bullet.y < 0 || bullet.y > canvas.height) {
            return false;
        }

        return bullet.life > 0;
    });
}

// Disegno proiettili
function drawBullets() {
    ctx.fillStyle = 'white';
    bullets.forEach(bullet => {
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, 2, 0, Math.PI * 2);
        ctx.fill();
    });
}

// Aggiornamento asteroidi
function updateAsteroids() {
    asteroids.forEach(asteroid => {
        asteroid.x += asteroid.velocity.x;
        asteroid.y += asteroid.velocity.y;
        asteroid.rotation += asteroid.rotationSpeed;

        if (asteroid.x < -asteroid.size) asteroid.x = canvas.width + asteroid.size;
        if (asteroid.x > canvas.width + asteroid.size) asteroid.x = -asteroid.size;
        if (asteroid.y < -asteroid.size) asteroid.y = canvas.height + asteroid.size;
        if (asteroid.y > canvas.height + asteroid.size) asteroid.y = -asteroid.size;
    });
}

// Disegno asteroidi
function drawAsteroids() {
    asteroids.forEach(asteroid => {
        ctx.save();
        ctx.translate(asteroid.x, asteroid.y);
        ctx.rotate(asteroid.rotation);

        // Disegna il numero (solo contorno)
        ctx.strokeStyle = asteroid.color;
        ctx.lineWidth = 2;
        ctx.font = `bold ${asteroid.size * 1.4}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeText(asteroid.number, 0, 0);

        ctx.restore();
    });
}

// Controllo collisioni
function checkCollisions() {
    // Proiettili vs asteroidi
    for (let i = bullets.length - 1; i >= 0; i--) {
        for (let j = asteroids.length - 1; j >= 0; j--) {
            const dist = distance(bullets[i].x, bullets[i].y, asteroids[j].x, asteroids[j].y);

            if (dist < asteroids[j].size) {
                const asteroid = asteroids[j];

                // Rimuovi proiettile e asteroide
                bullets.splice(i, 1);
                asteroids.splice(j, 1);

                // Incrementa punteggio
                score += asteroid.size === 40 ? 20 : asteroid.size === 20 ? 50 : 100;
                updateScore();

                // Crea tanti nuovi asteroidi quanto vale il numero colpito
                if (asteroid.size > 10 && asteroid.number > 0) {
                    const newSize = asteroid.size / 2;

                    // Genera meno figli del valore colpito, altrimenti la crescita è troppo esplosiva:
                    // con numeri 1-9 la media di "asteroid.number" è 5, che porta a troppi asteroidi
                    // in cascata. Dimezzando (arrotondato per eccesso) si tiene sotto controllo.
                    const childCount = Math.ceil(asteroid.number / 2);
                    for (let k = 0; k < childCount; k++) {
                        createAsteroid(asteroid.x, asteroid.y, newSize, randomNumber());
                    }

                    // Munizioni proporzionali ai figli effettivamente creati
                    ammo += childCount * 2;
                    updateAmmo();
                }

                break;
            }
        }
    }

    // Nave vs asteroidi
    if (!shipDestroyed) {
        asteroids.forEach((asteroid, index) => {
            const dist = distance(ship.x, ship.y, asteroid.x, asteroid.y);

            if (dist < asteroid.size + ship.size) {
                asteroids.splice(index, 1);
                lives--;
                updateLives();

                // Distruggi la nave
                shipDestroyed = true;
                createShipFragments();

                if (lives <= 0) {
                    setTimeout(() => {
                        gameOver();
                    }, 2000);
                } else {
                    setTimeout(() => {
                        resetShip();
                        shipDestroyed = false;
                        shipFragments = [];
                    }, 2000);
                }
            }
        });
    }

    // Spawn nuovi asteroidi se finiti
    if (asteroids.length === 0 && !shipDestroyed && !levelTransitioning) {
        levelTransitioning = true;
        level++;
        setTimeout(() => {
            initAsteroids();
            levelTransitioning = false;
        }, 1000);
    }
}

// Reset nave
function resetShip() {
    ship.x = canvas.width / 2;
    ship.y = canvas.height / 2;
    ship.velocity = { x: 0, y: 0 };
    ship.angle = 0;
}

// Aggiorna punteggio
function updateScore() {
    document.getElementById('score').textContent = score;
}

// Aggiorna vite
function updateLives() {
    document.getElementById('lives').textContent = lives;
}

// Aggiorna munizioni
function updateAmmo() {
    document.getElementById('ammo').textContent = ammo;
}

// Game over
function gameOver() {
    gameRunning = false;
    document.getElementById('finalScore').textContent = score;
    document.getElementById('gameOver').classList.remove('hidden');

    const recordForm = document.getElementById('newRecordForm');
    if (isHighScore(score)) {
        recordForm.classList.remove('hidden');
        document.getElementById('initialsInput').value = '';
        renderHighScores('highscoreListGameOver'); // mostra la classifica attuale, prima del salvataggio
        setTimeout(() => document.getElementById('initialsInput').focus(), 50);
    } else {
        recordForm.classList.add('hidden');
        renderHighScores('highscoreListGameOver');
    }
}

// Inizia gioco
function startGame() {
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('gameOver').classList.add('hidden');

    gameRunning = true;
    score = 0;
    lives = 3;
    level = 1;
    bullets = [];
    shipDestroyed = false;
    shipFragments = [];
    levelTransitioning = false;
    lastShootTime = 0;
    ammo = 40;

    // Cancella eventuale timer di ricarica
    if (ammoRechargeTimer) {
        clearTimeout(ammoRechargeTimer);
        ammoRechargeTimer = null;
    }

    updateScore();
    updateLives();
    updateAmmo();
    resetShip();
    initAsteroids();
}

// Loop di gioco
function gameLoop() {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (gameRunning) {
        updateShip();
        updateBullets();
        updateAsteroids();
        updateShipFragments();
        checkCollisions();

        drawShip();
        drawBullets();
        drawAsteroids();
        drawShipFragments();
    }

    requestAnimationFrame(gameLoop);
}

// ---------- Classifica (record) ----------
const HS_KEY = 'numeroids_highscores';
const MAX_SCORES = 6;

function getHighScores() {
    try {
        const data = JSON.parse(localStorage.getItem(HS_KEY));
        return Array.isArray(data) ? data : [];
    } catch (e) {
        return [];
    }
}

function isHighScore(s) {
    const scores = getHighScores();
    if (scores.length < MAX_SCORES) return s > 0;
    return s > scores[scores.length - 1].score;
}

function saveHighScore(initials, s) {
    const clean = (initials || '').toUpperCase().replace(/[^A-Z]/g, '').padEnd(3, 'A').slice(0, 3);
    const scores = getHighScores();
    scores.push({ initials: clean, score: s });
    scores.sort((a, b) => b.score - a.score);
    scores.splice(MAX_SCORES);
    localStorage.setItem(HS_KEY, JSON.stringify(scores));
}

function renderHighScores(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const scores = getHighScores();
    el.innerHTML = '';
    for (let i = 0; i < MAX_SCORES; i++) {
        const entry = scores[i];
        const li = document.createElement('li');
        li.innerHTML =
            '<span class="rank">' + (i + 1) + '</span>' +
            '<span class="initials">' + (entry ? entry.initials : '---') + '</span>' +
            '<span class="points">' + (entry ? entry.score : '-') + '</span>';
        el.appendChild(li);
    }
}

renderHighScores('highscoreListStart');

document.getElementById('initialsInput').addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
});
document.getElementById('initialsInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('saveRecordBtn').click();
});
document.getElementById('saveRecordBtn').addEventListener('click', () => {
    const initials = document.getElementById('initialsInput').value;
    saveHighScore(initials, score);
    document.getElementById('newRecordForm').classList.add('hidden');
    renderHighScores('highscoreListGameOver');
    renderHighScores('highscoreListStart');
});

// Event listeners
document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);

// Avvia loop
gameLoop();
