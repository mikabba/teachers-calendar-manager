<?php
require_once __DIR__ . '/auth.php';

$user = require_login();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond_error('Metodo non supportato.', 405);
}

$courseName = isset($_POST['courseName']) ? normalize_text($_POST['courseName']) : '';
$lessonDate = isset($_POST['lessonDate']) ? normalize_text($_POST['lessonDate']) : '';
$sala = isset($_POST['sala']) ? normalize_text($_POST['sala']) : '';
$startTime = isset($_POST['startTime']) ? normalize_time($_POST['startTime']) : '';
$durationMinutes = isset($_POST['durationMinutes']) ? normalize_duration_minutes($_POST['durationMinutes']) : 0;

if ($courseName === '') {
    respond_error('Nome corso vuoto.');
}

if (!$lessonDate || !parse_date_ymd($lessonDate)) {
    respond_error('Data non valida.');
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

$weekday = weekday_from_date($lessonDate);
if (!$weekday || !in_array($weekday, valid_tables(), true)) {
    respond_error('La data selezionata deve essere compresa tra lunedì e venerdì.');
}

$endMinutes = ensure_within_day_window($startMinutes, $durationMinutes);
$teacherName = isset($user['displayName']) ? normalize_text($user['displayName']) : normalize_text($user['username']);
$db = load_database();

foreach ($db['ordinary'] as $booking) {
    $bookingTable = isset($booking['table']) ? normalize_text($booking['table']) : '';
    $bookingSala = isset($booking['sala']) ? normalize_text($booking['sala']) : '';
    $bookingTeacher = isset($booking['teacherName']) ? normalize_text($booking['teacherName']) : '';

    if ($bookingTable === $weekday && $bookingSala === $sala && booking_overlaps_interval($booking, $startMinutes, $endMinutes)) {
        respond_error('Conflitto: la sala ' . $sala . ' è occupata da una lezione ordinaria nell\'orario selezionato.');
    }

    if ($bookingTable === $weekday && $bookingTeacher === $teacherName && booking_overlaps_interval($booking, $startMinutes, $endMinutes)) {
        respond_error('Conflitto: il docente ' . $teacherName . ' ha già una lezione ordinaria nell\'orario selezionato.');
    }
}

foreach ($db['recoveries'] as $booking) {
    $bookingDate = isset($booking['lessonDate']) ? normalize_text($booking['lessonDate']) : '';
    $bookingSala = isset($booking['sala']) ? normalize_text($booking['sala']) : '';
    $bookingTeacher = isset($booking['teacherName']) ? normalize_text($booking['teacherName']) : '';

    if ($bookingDate === $lessonDate && $bookingSala === $sala && booking_overlaps_interval($booking, $startMinutes, $endMinutes)) {
        respond_error('Conflitto: la sala ' . $sala . ' è già occupata il ' . $lessonDate . ' nell\'orario selezionato.');
    }

    if ($bookingDate === $lessonDate && $bookingTeacher === $teacherName && booking_overlaps_interval($booking, $startMinutes, $endMinutes)) {
        respond_error('Conflitto: il docente ' . $teacherName . ' risulta già occupato il ' . $lessonDate . ' nell\'orario selezionato.');
    }
}

$newBooking = normalize_booking_record(array(
    'bookingId' => generate_booking_id(),
    'lessonType' => 'recupero',
    'lessonDate' => $lessonDate,
    'table' => $weekday,
    'sala' => $sala,
    'courseName' => $courseName,
    'teacherName' => $teacherName,
    'startTime' => minutes_to_time_dot($startMinutes),
    'durationMinutes' => $durationMinutes,
    'createdAt' => now_iso(),
    'createdBy' => isset($user['username']) ? normalize_text($user['username']) : $teacherName
));

$db['recoveries'][] = $newBooking;
sort_recoveries($db['recoveries']);
save_database($db);

respond_success('Recupero salvato con successo.', array(
    'booking' => $newBooking
));
?>
