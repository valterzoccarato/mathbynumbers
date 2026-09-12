<?php
// api.php — Classifica globale di Numeroids
//
// GET  -> restituisce i 6 migliori punteggi
// POST -> riceve {"initials": "ABC", "score": 1234}, lo inserisce se rientra
//         nei primi 6, e restituisce la classifica aggiornata
//
// Richiede config.php nella stessa cartella (vedi config.example.php).

require __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: ' . ALLOWED_ORIGIN);
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

const MAX_SCORES = 6;

try {
    $pdo = new PDO(
        'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
        DB_USER,
        DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Connessione al database fallita']);
    exit;
}

function topScores(PDO $pdo): array {
    $stmt = $pdo->query('SELECT initials, score FROM highscores ORDER BY score DESC, created_at ASC LIMIT ' . MAX_SCORES);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    echo json_encode(topScores($pdo));
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    if (!is_array($body)) {
        http_response_code(400);
        echo json_encode(['error' => 'JSON non valido']);
        exit;
    }

    // Pulizia e validazione, come lato client, ma qui e' quella che conta davvero
    $initials = strtoupper(preg_replace('/[^A-Za-z]/', '', $body['initials'] ?? ''));
    $initials = str_pad(substr($initials, 0, 3), 3, 'A');

    $score = isset($body['score']) ? (int) $body['score'] : 0;
    if ($score < 0) $score = 0;
    if ($score > 999999) $score = 999999;

    $stmt = $pdo->prepare('INSERT INTO highscores (initials, score) VALUES (:initials, :score)');
    $stmt->execute(['initials' => $initials, 'score' => $score]);

    // Tiene la tabella pulita: mantiene solo le righe che sono nella top 6 attuale
    $pdo->exec('
        DELETE FROM highscores
        WHERE id NOT IN (
            SELECT id FROM (
                SELECT id FROM highscores ORDER BY score DESC, created_at ASC LIMIT ' . MAX_SCORES . '
            ) AS keep_ids
        )
    ');

    echo json_encode(topScores($pdo));
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Metodo non consentito']);
