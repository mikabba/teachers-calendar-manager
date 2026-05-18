<?php
require_once __DIR__ . '/auth.php';

$user = require_login();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond_error('Metodo non supportato.', 405);
}

$table = isset($_POST['table']) ? normalize_text($_POST['table']) : '';
$sala = isset($_POST['sala']) ? normalize_text($_POST['sala']) : '';
$startTime = isset($_POST['startTime']) ? normalize_time($_POST['startTime']) : '';
$durationMinutes = isset($_POST['durationMinutes']) ? normalize_duration_minutes($_POST['durationMinutes']) : 0;
$courseName = isset($_POST['courseName']) ? normalize_text($_POST['courseName']) : '';

if ($table === '' || !in_array($table, valid_tables(), true)) {
    respond_error('Giorno non valido.');
}

if ($sala === '' || !in_array($sala, valid_sale(), true)) {
    respond_error('Sala non valida.');
}

$startMinutes = time_to_minutes($startTime);
if ($startMinutes === null) {
    respond_error('Orario iniziale non valido.');
}

if ($durationMinutes <= 0) {
    respond_error('Durata non valida.');
}

if ($courseName === '') {
    respond_error('Nome corso vuoto.');
}

$endMinutes = ensure_within_day_window($startMinutes, $durationMinutes);
$teacherName = isset($user['displayName']) ? normalize_text($user['displayName']) : normalize_text($user['username']);
$db = load_database();

foreach ($db['ordinary'] as $booking) {
    $bookingTable = isset($booking['table']) ? normalize_text($booking['table']) : '';
    $bookingSala = isset($booking['sala']) ? normalize_text($booking['sala']) : '';
    $bookingTeacher = isset($booking['teacherName']) ? normalize_text($booking['teacherName']) : '';

    if ($bookingTable === $table && $bookingSala === $sala && booking_overlaps_interval($booking, $startMinutes, $endMinutes)) {
        respond_error('Conflitto: la sala ' . $sala . ' è già occupata nell\'orario selezionato.');
    }

    if ($bookingTable === $table && $bookingTeacher === $teacherName && booking_overlaps_interval($booking, $startMinutes, $endMinutes)) {
        respond_error('Conflitto: il docente ' . $teacherName . ' risulta già occupato nell\'orario selezionato.');
    }
}

$newBooking = normalize_booking_record(array(
    'bookingId' => generate_booking_id(),
    'lessonType' => 'ordinaria',
    'table' => $table,
    'sala' => $sala,
    'courseName' => $courseName,
    'teacherName' => $teacherName,
    'startTime' => minutes_to_time_dot($startMinutes),
    'durationMinutes' => $durationMinutes,
    'createdAt' => now_iso(),
    'createdBy' => isset($user['username']) ? normalize_text($user['username']) : $teacherName
));

$db['ordinary'][] = $newBooking;
save_database($db);

respond_success('Lezione ordinaria salvata con successo.', array(
    'booking' => $newBooking
));
?>
