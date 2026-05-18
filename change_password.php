<?php
require_once __DIR__ . '/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond_error('Metodo non supportato.', 405);
}

$currentUser = require_login();
$currentPassword = isset($_POST['currentPassword']) ? (string)$_POST['currentPassword'] : '';
$newPassword = isset($_POST['newPassword']) ? (string)$_POST['newPassword'] : '';

if ($currentPassword === '' || $newPassword === '') {
    respond_error('Compila tutti i campi richiesti.');
}

if (mb_strlen($newPassword) < 8) {
    respond_error('La nuova password deve contenere almeno 8 caratteri.');
}

$users = read_users();
$index = find_user_index_by_username($users, $currentUser['username']);
if ($index < 0) {
    respond_error('Utente non trovato.', 404);
}

if (!verify_user_password($users[$index], $currentPassword)) {
    respond_error('La password attuale non è corretta.', 401);
}

set_user_password($users[$index], $newPassword);
save_users($users);

respond_success('Password aggiornata con successo.');
?>
