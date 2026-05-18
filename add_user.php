<?php
require_once __DIR__ . '/auth.php';

require_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond_error('Metodo non supportato.', 405);
}

$displayName = isset($_POST['displayName']) ? normalize_text($_POST['displayName']) : '';
$username = isset($_POST['username']) ? strtolower(normalize_text($_POST['username'])) : '';
$password = isset($_POST['password']) ? trim((string)$_POST['password']) : '';
$role = isset($_POST['role']) ? normalize_role($_POST['role']) : '';

if ($displayName === '' || $username === '' || $password === '' || $role === '') {
    respond_error('Compila tutti i campi utente.');
}

if (!preg_match('/^[a-z0-9._-]{3,50}$/', $username)) {
    respond_error('Username non valido. Usa almeno 3 caratteri tra lettere, numeri, punto, trattino o underscore.');
}

if (mb_strlen($password) < 8) {
    respond_error('La password iniziale deve contenere almeno 8 caratteri.');
}

$users = read_users();
foreach ($users as $user) {
    if (!is_array($user)) {
        continue;
    }
    $currentUsername = isset($user['username']) ? strtolower(normalize_text($user['username'])) : '';
    $currentDisplayName = isset($user['displayName']) ? normalize_text($user['displayName']) : '';
    if ($currentUsername === $username) {
        respond_error('Esiste già un utente con questo username.');
    }
    if ($currentDisplayName !== '' && strcasecmp($currentDisplayName, $displayName) === 0) {
        respond_error('Esiste già un utente con questo display name.');
    }
}

$newUser = array(
    'username' => $username,
    'displayName' => $displayName,
    'role' => $role
);
set_user_password($newUser, $password);
$users[] = $newUser;

usort($users, function ($a, $b) {
    $nameA = isset($a['displayName']) ? $a['displayName'] : '';
    $nameB = isset($b['displayName']) ? $b['displayName'] : '';
    return strcasecmp($nameA, $nameB);
});

save_users($users);

respond_success('Utente aggiunto con successo.', array(
    'user' => array(
        'username' => $username,
        'displayName' => $displayName,
        'role' => $role
    )
));
?>
