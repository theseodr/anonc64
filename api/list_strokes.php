<?php
// api/list_strokes.php - list strokes created after a given timestamp

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$since = isset($_GET['since']) ? (int) $_GET['since'] : 0;

$stmt = $pdo->prepare('SELECT id, data, created_at FROM strokes WHERE created_at > ? ORDER BY created_at ASC');
$stmt->execute([$since]);
$rows = $stmt->fetchAll();

$strokes = [];
foreach ($rows as $row) {
    $object = json_decode($row['data'], true);
    if (!is_array($object)) {
        continue;
    }
    $strokes[] = [
        'id'         => $row['id'],
        'object'     => $object,
        'created_at' => (int) $row['created_at'],
    ];
}

json_response(['strokes' => $strokes]);
