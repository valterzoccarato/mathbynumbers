const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 800;
canvas.height = 600;

// ==================== MATEMATICA ====================
function isPrime(n) {
    if (n < 2) return false;
    for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
    return true;
}
function smallestPrimeFactor(n) {
    for (let i = 2; i * i <= n; i++) if (n % i === 0) return i;
    return n;
}
// "potenza": un solo fattore primo distinto (es. 16=2^4, 27=3^3)
function isPrimePower(n) {
    if (n < 4) return false;
    const p = smallestPrimeFactor(n);
    let x = n;
    while (x % p === 0) x /= p;
    return x === 1;
}
function classify(n) {
    if (isPrime(n)) return 'prime';
    if (isPrimePower(n)) return 'power';
    if (n % 3 === 0) return 'multiple3';
    return 'normal';
}

// Quanti colpi servono per distruggere un mattone primo.
// Il valore esatto ("tanti colpi quanto vale") va benissimo per i primi piccoli
// (2,3,5,7 -> 2-7 colpi), ma per un primo come 97 diventerebbe assurdo (97 colpi!).
// Sopra i 9, scaliamo: un colpo ogni 10 di valore, arrotondato per eccesso.
function hitsNeeded(n) {
    if (n <= 9) return n;
    return Math.ceil(n / 10);
}

const BRICK_COLORS = {
    normal: '#4a90d9',
    prime: '#ff4444',
    power: '#b06bff',
    multiple3: '#2fd9a8'
};

// ==================== GRIGLIA ====================
const COLS = 8;
const ROWS = 9;           // solo le prime FILLED_ROWS partono piene, il resto è riserva
const FILLED_ROWS = 3;
const GRID_TOP = 50;
const GRID_MARGIN = 20;
const CELL_GAP = 4;
const CELL_W = (canvas.width - GRID_MARGIN * 2 - CELL_GAP * (COLS - 1)) / COLS;
const CELL_H = 26;

const NUMBER_POOL = [
    60, 42, 35, 84, 120, 90, 56, 45, 72, 48, 96, 54, 63, 80, 100,
    36, 24, 32, 18, 27, 16, 50, 75, 40, 44, 66, 99, 28, 52, 68
];

let bricks = []; // bricks[row][col] = {value, type, alive, flash} oppure null

function cellX(col) { return GRID_MARGIN + col * (CELL_W + CELL_GAP); }
function cellY(row) { return GRID_TOP + row * (CELL_H + CELL_GAP); }
function cellCenterX(col) { return cellX(col) + CELL_W / 2; }
function cellCenterY(row) { return cellY(row) + CELL_H / 2; }

function makeBrick(value) {
    return { value, type: classify(value), alive: true, flash: 0, hitsTaken: 0 };
}

function initGrid() {
    bricks = [];
    for (let r = 0; r < ROWS; r++) {
        bricks.push(new Array(COLS).fill(null));
    }
    const shuffled = [...NUMBER_POOL].sort(() => Math.random() - 0.5);
    let i = 0;
    for (let r = 0; r < FILLED_ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const value = shuffled[i % shuffled.length];
            i++;
            bricks[r][c] = makeBrick(value);
        }
    }
}

function countAliveBricks() {
    let n = 0;
    for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++)
            if (bricks[r][c] && bricks[r][c].alive) n++;
    return n;
}

function ballGridPos() {
    const c = Math.floor((ball.x - GRID_MARGIN) / (CELL_W + CELL_GAP));
    const r = Math.floor((ball.y - GRID_TOP) / (CELL_H + CELL_GAP));
    return { r, c };
}

// Cerca la cella vuota più vicina a (r,c), esplorando ad anelli crescenti.
// Esclude la cella dove si trova la pallina in questo momento e le sue
// quattro adiacenti, cosi' un frammento appena nato non puo' mai chiuderla
// in una tasca senza uscita.
function findNearestEmptyCell(r, c) {
    const bp = ballGridPos();
    const forbidden = new Set([bp.r + ',' + bp.c]);
    [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dr, dc]) => {
        forbidden.add((bp.r + dr) + ',' + (bp.c + dc));
    });

    for (let radius = 1; radius < ROWS + COLS; radius++) {
        const candidates = [];
        for (let dr = -radius; dr <= radius; dr++) {
            for (let dc = -radius; dc <= radius; dc++) {
                if (Math.abs(dr) !== radius && Math.abs(dc) !== radius) continue;
                const nr = r + dr, nc = c + dc;
                if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
                if (bricks[nr][nc]) continue;
                if (forbidden.has(nr + ',' + nc)) continue;
                candidates.push({ r: nr, c: nc });
            }
        }
        if (candidates.length > 0) {
            return candidates[Math.floor(Math.random() * candidates.length)];
        }
    }
    return null;
}

// ==================== PADDLE ====================
const paddle = {
    x: canvas.width / 2 - 45,
    y: canvas.height - 30,
    normalWidth: 90,
    wideWidth: 140,
    width: 90,
    height: 12,
    speed: 7
};
let paddleWide = false;
let paddleWideExpire = 0;

// ==================== PALLA ====================
const BALL_RADIUS = 6;
const ball = {
    x: canvas.width / 2,
    y: paddle.y - BALL_RADIUS,
    vx: 0,
    vy: 0,
    speed: 5.2,
    stuck: true
};

// ==================== POTENZIAMENTI ====================
let ballMode = 'normal'; // 'normal' | 'tripla'
let triplaExpire = 0;
let primeBreakerCharges = 0;
const TRIPLA_DURATION = 600;   // frame (~10s a 60fps)
const WIDE_DURATION = 600;

// Rete di sicurezza: se la pallina resta chiusa in una tasca (bug residuo
// o accumulo sfortunato di frammenti), dopo qualche secondo senza essersi
// spostata liberiamo un varco distruggendo un mattone vicino.
let stuckWatchTimer = 0;
let stuckWatchPos = { x: 0, y: 0 };
const STUCK_THRESHOLD_FRAMES = 180; // ~3 secondi a 60fps
const STUCK_MOVE_TOLERANCE = 40;    // pixel

let capsules = []; // {x,y,type}
const CAPSULE_TYPES = [
    { type: 'tripla', weight: 40, label: '3×', color: '#2fd9a8' },
    { type: 'primebreaker', weight: 25, label: 'P', color: '#ff4444' },
    { type: 'wide', weight: 20, label: 'L', color: '#4a90d9' },
    { type: 'life', weight: 15, label: '+1', color: '#ffe066' }
];
function pickCapsuleType() {
    const total = CAPSULE_TYPES.reduce((s, t) => s + t.weight, 0);
    let r = Math.random() * total;
    for (const t of CAPSULE_TYPES) {
        if (r < t.weight) return t;
        r -= t.weight;
    }
    return CAPSULE_TYPES[0];
}
function spawnCapsule(x, y) {
    capsules.push({ x, y, def: pickCapsuleType(), vy: 2.2, w: 34, h: 18 });
}

function applyCapsule(def) {
    if (def.type === 'tripla') {
        ballMode = 'tripla';
        triplaExpire = frame + TRIPLA_DURATION;
    } else if (def.type === 'primebreaker') {
        primeBreakerCharges += 3;
    } else if (def.type === 'wide') {
        paddleWide = true;
        paddleWideExpire = frame + WIDE_DURATION;
        paddle.width = paddle.wideWidth;
    } else if (def.type === 'life') {
        lives++;
        updateLives();
    }
    updatePowerupHud();
}

function updatePowerupHud() {
    const parts = [];
    if (ballMode === 'tripla') parts.push('3× ' + Math.max(0, Math.ceil((triplaExpire - frame) / 60)) + 's');
    if (primeBreakerCharges > 0) parts.push('P×' + primeBreakerCharges);
    if (paddleWide) parts.push('LARGO ' + Math.max(0, Math.ceil((paddleWideExpire - frame) / 60)) + 's');
    document.getElementById('powerupHud').textContent = parts.join(' · ');
}

// ==================== PUNTEGGIO / VITE ====================
let score = 0;
let lives = 3;
let gameRunning = false;
let frame = 0;

const SPLIT_POINTS = 5;
const TRIPLA_DESTROY_POINTS = 15;
function primePoints(p) { return 20 + p; }

function updateScore() { document.getElementById('score').textContent = score; }
function updateLives() { document.getElementById('lives').textContent = lives; }

// ==================== LOGICA DI COLPO ====================
function destroyBrick(r, c, points) {
    bricks[r][c] = null;
    score += points;
    updateScore();
}

function flashNeighbors(r, c) {
    const deltas = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    deltas.forEach(([dr, dc]) => {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) return;
        const b = bricks[nr][nc];
        if (b && b.alive) b.flash = 10;
    });
}

function hitBrick(r, c, fromShockwave) {
    const b = bricks[r][c];
    if (!b || !b.alive) return;

    if (b.type === 'prime') {
        if (primeBreakerCharges > 0) {
            primeBreakerCharges--;
            updatePowerupHud();
            destroyBrick(r, c, primePoints(b.value));
            return;
        }
        b.hitsTaken++;
        b.flash = 6;
        if (b.hitsTaken >= hitsNeeded(b.value)) {
            destroyBrick(r, c, primePoints(b.value));
        }
        return;
    }

    if (b.type === 'multiple3' && ballMode === 'tripla' && !fromShockwave) {
        spawnCapsule(cellCenterX(c), cellCenterY(r));
        destroyBrick(r, c, TRIPLA_DESTROY_POINTS);
        return;
    }

    // Scomposizione: value = p * q, p = fattore primo piu' piccolo
    const p = smallestPrimeFactor(b.value);
    const q = b.value / p;
    const wasPower = b.type === 'power';
    const wasMultiple3 = b.type === 'multiple3';

    score += SPLIT_POINTS;
    updateScore();

    if (wasMultiple3) spawnCapsule(cellCenterX(c), cellCenterY(r));

    if (q === 1) {
        // b.value era in realta' primo (non dovrebbe succedere, per sicurezza)
        destroyBrick(r, c, primePoints(b.value));
        return;
    }

    // Il fattore q resta in questa cella
    b.value = q;
    b.type = classify(q);
    b.flash = 4;

    // Il fattore primo p va nella cella libera piu' vicina
    const spot = findNearestEmptyCell(r, c);
    if (spot) {
        bricks[spot.r][spot.c] = makeBrick(p);
        bricks[spot.r][spot.c].flash = 6;
    } else {
        // nessuno spazio libero: il frammento si "dissolve" ma vale comunque punti
        score += primePoints(p);
        updateScore();
    }

    if (wasPower && !fromShockwave) {
        score += 25;
        updateScore();
        flashNeighbors(r, c);
    }
}

// ==================== INPUT ====================
const keys = {};
document.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    if (e.key === ' ' && gameRunning && ball.stuck) {
        e.preventDefault();
        launchBall();
    }
});
document.addEventListener('keyup', (e) => { keys[e.key] = false; });

function launchBall() {
    ball.stuck = false;
    const angle = -Math.PI / 2 + (Math.random() * 0.6 - 0.3);
    ball.vx = Math.cos(angle) * ball.speed;
    ball.vy = Math.sin(angle) * ball.speed;
}

function resetBallOnPaddle() {
    ball.stuck = true;
    ball.x = paddle.x + paddle.width / 2;
    ball.y = paddle.y - BALL_RADIUS;
    ball.vx = 0;
    ball.vy = 0;
}

// ==================== AGGIORNAMENTO ====================
function updatePaddle() {
    if (keys['ArrowLeft']) paddle.x -= paddle.speed;
    if (keys['ArrowRight']) paddle.x += paddle.speed;
    paddle.x = Math.max(0, Math.min(canvas.width - paddle.width, paddle.x));
    if (ball.stuck) {
        ball.x = paddle.x + paddle.width / 2;
        ball.y = paddle.y - BALL_RADIUS;
    }
}

function updateBall() {
    if (ball.stuck) return;
    ball.x += ball.vx;
    ball.y += ball.vy;

    if (ball.x - BALL_RADIUS < 0) { ball.x = BALL_RADIUS; ball.vx *= -1; }
    if (ball.x + BALL_RADIUS > canvas.width) { ball.x = canvas.width - BALL_RADIUS; ball.vx *= -1; }
    if (ball.y - BALL_RADIUS < 0) { ball.y = BALL_RADIUS; ball.vy *= -1; }

    // Paddle
    if (ball.vy > 0 &&
        ball.y + BALL_RADIUS >= paddle.y &&
        ball.y + BALL_RADIUS <= paddle.y + paddle.height + 8 &&
        ball.x >= paddle.x && ball.x <= paddle.x + paddle.width) {
        const hitPos = (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2); // -1..1
        const angle = hitPos * (Math.PI / 3); // max 60 gradi
        const speed = Math.hypot(ball.vx, ball.vy);
        ball.vx = Math.sin(angle) * speed;
        ball.vy = -Math.abs(Math.cos(angle) * speed);
        ball.y = paddle.y - BALL_RADIUS;
    }

    // Fuori dal fondo
    if (ball.y - BALL_RADIUS > canvas.height) {
        lives--;
        updateLives();
        if (lives <= 0) {
            gameOver();
        } else {
            resetBallOnPaddle();
        }
    }

    // Mattoni
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const b = bricks[r][c];
            if (!b || !b.alive) continue;
            const bx = cellX(c), by = cellY(r);
            const closestX = Math.max(bx, Math.min(ball.x, bx + CELL_W));
            const closestY = Math.max(by, Math.min(ball.y, by + CELL_H));
            const dx = ball.x - closestX, dy = ball.y - closestY;
            if (dx * dx + dy * dy < BALL_RADIUS * BALL_RADIUS) {
                // determina asse di rimbalzo dalla penetrazione
                const overlapX = BALL_RADIUS - Math.abs(dx);
                const overlapY = BALL_RADIUS - Math.abs(dy);
                if (overlapX < overlapY) ball.vx *= -1;
                else ball.vy *= -1;
                hitBrick(r, c, false);
                return; // un solo mattone per frame
            }
        }
    }
}

function freeTrappedBall() {
    const bp = ballGridPos();
    const candidates = [];
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            const nr = bp.r + dr, nc = bp.c + dc;
            if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
            const b = bricks[nr][nc];
            if (b && b.alive) candidates.push({ r: nr, c: nc });
        }
    }
    if (candidates.length === 0) return;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    const b = bricks[pick.r][pick.c];
    destroyBrick(pick.r, pick.c, b.type === 'prime' ? primePoints(b.value) : SPLIT_POINTS);
}

function updateStuckWatchdog() {
    if (ball.stuck) { stuckWatchTimer = 0; return; }
    const moved = Math.hypot(ball.x - stuckWatchPos.x, ball.y - stuckWatchPos.y);
    if (moved > STUCK_MOVE_TOLERANCE) {
        stuckWatchPos = { x: ball.x, y: ball.y };
        stuckWatchTimer = 0;
    } else {
        stuckWatchTimer++;
        if (stuckWatchTimer > STUCK_THRESHOLD_FRAMES) {
            freeTrappedBall();
            stuckWatchTimer = 0;
        }
    }
}

function updateCapsules() {
    capsules = capsules.filter((cap) => {
        cap.y += cap.vy;
        const caught = cap.y + cap.h >= paddle.y &&
            cap.y <= paddle.y + paddle.height &&
            cap.x + cap.w / 2 >= paddle.x &&
            cap.x - cap.w / 2 <= paddle.x + paddle.width;
        if (caught) {
            applyCapsule(cap.def);
            return false;
        }
        return cap.y < canvas.height;
    });
}

function updatePowerTimers() {
    if (ballMode === 'tripla' && frame > triplaExpire) {
        ballMode = 'normal';
        updatePowerupHud();
    }
    if (paddleWide && frame > paddleWideExpire) {
        paddleWide = false;
        paddle.width = paddle.normalWidth;
        updatePowerupHud();
    }
    // aggiorna il countdown mostrato anche senza scatti di stato
    if (frame % 30 === 0) updatePowerupHud();
}

function checkLevelClear() {
    if (countAliveBricks() === 0) {
        initGrid();
        resetBallOnPaddle();
    }
}

// ==================== DISEGNO ====================
function drawBricks() {
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const b = bricks[r][c];
            if (!b || !b.alive) continue;
            const x = cellX(c), y = cellY(r);
            ctx.fillStyle = b.flash > 0 ? '#ffffff' : BRICK_COLORS[b.type];
            if (b.flash > 0) b.flash--;
            ctx.fillRect(x, y, CELL_W, CELL_H);
            ctx.strokeStyle = 'rgba(0,0,0,0.35)';
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, CELL_W, CELL_H);
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            if (b.type === 'prime' && b.hitsTaken > 0) {
                ctx.font = 'bold 12px Courier New';
                ctx.fillText(b.value, x + CELL_W / 2, y + CELL_H / 2 - 5);
                ctx.font = '10px Courier New';
                ctx.fillStyle = '#ffe066';
                ctx.fillText(b.hitsTaken + '/' + hitsNeeded(b.value), x + CELL_W / 2, y + CELL_H / 2 + 8);
            } else {
                ctx.font = 'bold 13px Courier New';
                ctx.fillText(b.value, x + CELL_W / 2, y + CELL_H / 2 + 1);
            }
        }
    }
}

function drawPaddle() {
    ctx.fillStyle = paddleWide ? '#4a90d9' : '#fff';
    ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
}

function drawBall() {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = ballMode === 'tripla' ? '#2fd9a8' : (primeBreakerCharges > 0 ? '#ff4444' : '#fff');
    ctx.fill();
}

function drawCapsules() {
    capsules.forEach((cap) => {
        ctx.fillStyle = cap.def.color;
        ctx.fillRect(cap.x - cap.w / 2, cap.y, cap.w, cap.h);
        ctx.fillStyle = '#000';
        ctx.font = 'bold 11px Courier New';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(cap.def.label, cap.x, cap.y + cap.h / 2 + 1);
    });
}

// ==================== CLASSIFICA ====================
const HS_KEY = 'fattoroids_highscores';
const MAX_SCORES = 6;
let lastKnownScores = [];

function getLocalHighScores() {
    try {
        const data = JSON.parse(localStorage.getItem(HS_KEY));
        return Array.isArray(data) ? data : [];
    } catch (e) { return []; }
}
function saveLocalHighScore(entry) {
    const scores = getLocalHighScores();
    scores.push(entry);
    scores.sort((a, b) => b.score - a.score);
    scores.splice(MAX_SCORES);
    localStorage.setItem(HS_KEY, JSON.stringify(scores));
    return scores;
}
function loadHighScores() {
    lastKnownScores = getLocalHighScores();
    return lastKnownScores;
}
function isHighScore(s) {
    if (lastKnownScores.length < MAX_SCORES) return s > 0;
    return s > lastKnownScores[lastKnownScores.length - 1].score;
}
function submitHighScore(initials, s) {
    const clean = (initials || '').toUpperCase().replace(/[^A-Z]/g, '').padEnd(3, 'A').slice(0, 3);
    lastKnownScores = saveLocalHighScore({ initials: clean, score: s });
    return lastKnownScores;
}
function renderHighScores(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.innerHTML = '';
    for (let i = 0; i < MAX_SCORES; i++) {
        const entry = lastKnownScores[i];
        const li = document.createElement('li');
        li.innerHTML =
            '<span class="rank">' + (i + 1) + '</span>' +
            '<span class="initials">' + (entry ? entry.initials : '---') + '</span>' +
            '<span class="points">' + (entry ? entry.score : '-') + '</span>';
        el.appendChild(li);
    }
}
loadHighScores();
renderHighScores('highscoreListStart');

document.getElementById('initialsInput').addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
});
document.getElementById('initialsInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('saveRecordBtn').click();
});
document.getElementById('saveRecordBtn').addEventListener('click', () => {
    const initials = document.getElementById('initialsInput').value;
    submitHighScore(initials, score);
    document.getElementById('newRecordForm').classList.add('hidden');
    renderHighScores('highscoreListGameOver');
    renderHighScores('highscoreListStart');
});

// ==================== CICLO DI GIOCO ====================
function gameOver() {
    gameRunning = false;
    document.getElementById('finalScore').textContent = score;
    document.getElementById('gameOver').classList.remove('hidden');

    const recordForm = document.getElementById('newRecordForm');
    if (isHighScore(score)) {
        recordForm.classList.remove('hidden');
        document.getElementById('initialsInput').value = '';
        renderHighScores('highscoreListGameOver');
        setTimeout(() => document.getElementById('initialsInput').focus(), 50);
    } else {
        recordForm.classList.add('hidden');
        renderHighScores('highscoreListGameOver');
    }
}

function startGame() {
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('gameOver').classList.add('hidden');

    gameRunning = true;
    score = 0;
    lives = 3;
    ballMode = 'normal';
    primeBreakerCharges = 0;
    paddleWide = false;
    paddle.width = paddle.normalWidth;
    paddle.x = canvas.width / 2 - paddle.width / 2;
    capsules = [];
    frame = 0;

    updateScore();
    updateLives();
    updatePowerupHud();
    initGrid();
    resetBallOnPaddle();
}

function gameLoop() {
    frame++;
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (gameRunning) {
        updatePaddle();
        updateBall();
        updateStuckWatchdog();
        updateCapsules();
        updatePowerTimers();
        checkLevelClear();

        drawBricks();
        drawCapsules();
        drawPaddle();
        drawBall();
    }

    requestAnimationFrame(gameLoop);
}

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);

gameLoop();
