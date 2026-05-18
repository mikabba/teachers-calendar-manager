<?php
require_once __DIR__ . '/auth.php';

require_login();

$db = load_database();
sort_recoveries($db['recoveries']);

json_response(array(
    'ordinary' => array_values($db['ordinary']),
    'recoveries' => array_values($db['recoveries'])
));
?>