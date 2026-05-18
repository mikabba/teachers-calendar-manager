<?php
require_once __DIR__ . '/auth.php';

$currentUser = require_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond_error('Metodo non supportato.', 405);
}

$username = isset($_POST['username']) ? strtolower(normalize_text($_POST['username'])) : '';
if ($username === '') {
    respond_error('Seleziona un utente da rimuovere.');
}

$users = read_users();
$updated = array();
$removed = null;
$adminCount = 0;

foreach ($users as $user) {
    if (!is_array($user)) {
        continue;
    }
    $role = isset($user['role']) ? normalize_role($user['role']) : 'teacher';
    if ($role === 'admin') {
        $adminCount++;
    }
}

foreach ($users as $user) {
    if (!is_array($user)) {
        continue;
    }

    $currentUsername = isset($user['username']) ? strtolower(normalize_text($user['username'])) : '';
    if ($currentUsername === $username) {
        $removed = $user;
        continue;
    }
    $updated[] = $user;
}

if (!$removed) {
    respond_error('Utente non trovato.', 404);
}

$removedRole = isset($removed['role']) ? normalize_role($removed['role']) : 'teacher';
if ($currentUser['username'] === $username) {
    respond_error('Non puoi rimuovere l’utente con cui hai effettuato l’accesso.');
}

if ($removedRole === 'admin' && $adminCount <= 1) {
    respond_error('Non puoi rimuovere l’ultimo admin disponibile.');
}

save_users($updated);

respond_success('Utente rimosso con successo.', array(
    'user' => array(
        'username' => $username,
        'displayName' => isset($removed['displayName']) ? normalize_text($removed['displayName']) : $username,
        'role' => $removedRole
    )
));
?>