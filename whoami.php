<?php
require_once __DIR__ . '/auth.php';

$user = get_current_user_data();

if (!$user) {
    json_response(array(
        'loggedIn' => false
    ));
}

json_response(array(
    'loggedIn' => true,
    'user' => $user
));
?>