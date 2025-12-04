<?php
// api/save_stroke.php - persist a Fabric.js stroke

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

$id     = isset($payload['id']) ? (string) $payload['id'] : null;
$object = $payload['object'] ?? null;

if ($id === null || $object === null) {
    json_response(['error' => 'Missing id or object'], 400);
}

$data = json_encode($object, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if ($data === false) {
    json_response(['error' => 'Failed to encode stroke'], 400);
}

$nowMs = (int) floor(microtime(true) * 1000);

$stmt = $pdo->prepare('INSERT OR REPLACE INTO strokes (id, data, created_at) VALUES (?, ?, ?)');
$stmt->execute([$id, $data, $nowMs]);

json_response([
    'ok'         => true,
    'id'         => $id,
    'created_at' => $nowMs,
]);
