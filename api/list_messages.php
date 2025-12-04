<?php
// api/list_messages.php - list chat messages since a given timestamp

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$since = isset($_GET['since']) ? (int) $_GET['since'] : 0;

$stmt = $pdo->prepare('SELECT id, text, created_at, ip, rdns FROM messages WHERE created_at > ? ORDER BY created_at ASC');
$stmt->execute([$since]);
$rows = $stmt->fetchAll();

$messages = [];
foreach ($rows as $row) {
    $messages[] = [
        'id'         => (int) $row['id'],
        'text'       => $row['text'],
        'created_at' => (int) $row['created_at'],
        'ip'         => $row['ip'],
        'rdns'       => $row['rdns'],
    ];
}

json_response(['messages' => $messages]);
