<?php
// api/bootstrap.php - shared database bootstrap for anon.p2p.pm

declare(strict_types=1);

// SQLite database in the same directory as these API scripts
$dbFile = __DIR__ . '/data.sqlite';
$dsn = 'sqlite:' . $dbFile;

$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, null, null, $options);
} catch (Throwable $e) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}

// Ensure tables exist
$pdo->exec('CREATE TABLE IF NOT EXISTS strokes (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    created_at INTEGER NOT NULL
)');

$pdo->exec('CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    ip TEXT NOT NULL,
    rdns TEXT NULL
)');

// Simple 3‑day retention window (timestamps stored as ms since epoch)
$nowMs       = (int) floor(microtime(true) * 1000);
$threeDaysMs = 3 * 24 * 60 * 60 * 1000;
$cutoff      = $nowMs - $threeDaysMs;

$pdo->prepare('DELETE FROM strokes WHERE created_at < ?')->execute([$cutoff]);
$pdo->prepare('DELETE FROM messages WHERE created_at < ?')->execute([$cutoff]);

function json_response(array $data, int $statusCode = 200): void
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    // Allow use from the same origin, and optionally other origins if needed.
    header('Access-Control-Allow-Origin: *');
    echo json_encode($data);
    exit;
}

function get_client_ip(): string
{
    return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}

function get_client_rdns(string $ip): ?string
{
    $host = @gethostbyaddr($ip);
    if ($host === false || $host === $ip) {
        return null;
    }
    return $host;
}
