<?php
require_once __DIR__ . '/auth.php';

$user = require_login();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond_error('Metodo non supportato.', 405);
}

$bookingId = isset($_POST['bookingId']) ? normalize_text($_POST['bookingId']) : '';

if ($bookingId === '') {
    respond_error('bookingId mancante.');
}

$db = load_database();
$updated = array();
$deleted = null;

foreach ($db['ordinary'] as $booking) {
    $currentId = isset($booking['bookingId']) ? normalize_text($booking['bookingId']) : '';

    if ($currentId === $bookingId) {
        $deleted = $booking;
        continue;
    }

    $updated[] = $booking;
}

if (!$deleted) {
    respond_error('Prenotazione non trovata.', 404);
}

$bookingTeacher = isset($deleted['teacherName']) ? normalize_text($deleted['teacherName']) : '';
$currentDisplayName = isset($user['displayName']) ? normalize_text($user['displayName']) : '';

if (!is_admin($user) && $bookingTeacher !== $currentDisplayName) {
    respond_error('Puoi eliminare solo le tue prenotazioni.', 403);
}

$db['ordinary'] = $updated;
save_database($db);

respond_success('Prenotazione ordinaria eliminata con successo.');
?>