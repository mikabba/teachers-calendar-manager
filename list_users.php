<?php
require_once __DIR__ . '/auth.php';

require_admin();

$users = read_users();
$list = array();

foreach ($users as $user) {
    if (!is_array($user)) {
        continue;
    }

    $list[] = array(
        'username' => isset($user['username']) ? normalize_text($user['username']) : '',
        'displayName' => isset($user['displayName']) ? normalize_text($user['displayName']) : '',
        'role' => isset($user['role']) ? normalize_role($user['role']) : 'teacher'
    );
}

usort($list, function ($a, $b) {
    return strcasecmp($a['displayName'], $b['displayName']);
});

respond_success('Utenti caricati.', array('users' => $list));
?>