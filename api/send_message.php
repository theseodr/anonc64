<?php
// api/send_message.php - store a chat message with IP and reverse DNS

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Method not allowed'], 405);
}

$raw = file_get_contents('php://input');
$payload = json_decode($raw, true);

if (!is_array($payload)) {
    json_response(['error' => 'Invalid JSON payload'], 400);
}

$text = isset($payload['text']) ? trim((string) $payload['text']) : '';
if ($text === '') {
    json_response(['error' => 'Message text required'], 400);
}

$nowMs = (int) floor(microtime(true) * 1000);
$ip    = get_client_ip();
$rdns  = get_client_rdns($ip);

$stmt = $pdo->prepare('INSERT INTO messages (text, created_at, ip, rdns) VALUES (?, ?, ?, ?)');
$stmt->execute([$text, $nowMs, $ip, $rdns]);

$id = (int) $pdo->lastInsertId();

json_response([
    'ok'         => true,
    'id'         => $id,
    'text'       => $text,
    'created_at' => $nowMs,
    'ip'         => $ip,
    'rdns'       => $rdns,
]);
