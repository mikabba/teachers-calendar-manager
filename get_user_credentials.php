<?php
require_once __DIR__ . '/auth.php';

$currentUser = require_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond_error('Metodo non supportato.', 405);
}

$username = isset($_POST['username']) ? strtolower(normalize_text($_POST['username'])) : '';
if ($username === '') {
    respond_error('Utente non specificato.');
}

$users = read_users();
$index = find_user_index_by_username($users, $username);
if ($index < 0) {
    respond_error('Utente non trovato.', 404);
}

$role = isset($users[$index]['role']) ? normalize_role($users[$index]['role']) : 'teacher';
if ($role === 'admin' && $currentUser['username'] === $username) {
    respond_error("Per motivi di sicurezza non puoi recuperare le credenziali dell'admin con cui hai effettuato l'accesso da questo pannello. Usa il cambio password personale.", 400);
}

$tempPassword = bin2hex(random_bytes(6));
set_user_password($users[$index], $tempPassword);
save_users($users);

respond_success('Credenziali recuperate con successo.', array(
    'user' => array(
        'username' => isset($users[$index]['username']) ? normalize_text($users[$index]['username']) : $username,
        'displayName' => isset($users[$index]['displayName']) ? normalize_text($users[$index]['displayName']) : $username,
        'role' => $role
    ),
    'temporaryPassword' => $tempPassword
));
?>
