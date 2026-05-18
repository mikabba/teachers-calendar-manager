<?php
require_once __DIR__ . '/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond_error('Metodo non supportato.', 405);
}

$username = isset($_POST['username']) ? normalize_text($_POST['username']) : '';
$password = isset($_POST['password']) ? (string)$_POST['password'] : '';

if ($username === '' || $password === '') {
    respond_error('Inserisci username e password.');
}

$users = read_users();
$index = find_user_index_by_username($users, $username);
if ($index < 0 || !verify_user_password($users[$index], $password)) {
    respond_error('Credenziali non valide.', 401);
}

upgrade_user_password_if_needed($users, $index, $password);
$sessionUser = user_display_data($users[$index]);
session_regenerate_id(true);
$_SESSION['user'] = $sessionUser;

respond_success('Login effettuato con successo.', array(
    'user' => $sessionUser
));
?>
