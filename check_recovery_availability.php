<?php
require_once __DIR__ . '/auth.php';

$user = require_login();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond_error('Metodo non supportato.', 405);
}

$lessonDate = isset($_POST['lessonDate']) ? normalize_text($_POST['lessonDate']) : '';
$durationMinutes = isset($_POST['durationMinutes']) ? normalize_duration_minutes($_POST['durationMinutes']) : 0;

if (!$lessonDate || !parse_date_ymd($lessonDate)) {
    respond_error('Data non valida.');
}

if ($durationMinutes <= 0) {
    respond_error('Durata non valida.');
}

$weekday = weekday_from_date($lessonDate);
if (!$weekday || !in_array($weekday, valid_tables(), true)) {
    respond_error('La data selezionata deve essere compresa tra lunedì e venerdì.');
}

$db = load_database();
$teacherName = isset($user['displayName']) ? normalize_text($user['displayName']) : normalize_text($user['username']);
$results = array();

foreach (valid_sale() as $sala) {
    $occupied = array();

    foreach ($db['ordinary'] as $booking) {
        $bookingTable = isset($booking['table']) ? normalize_text($booking['table']) : '';
        $bookingSala = isset($booking['sala']) ? normalize_text($booking['sala']) : '';
        $bookingTeacher = isset($booking['teacherName']) ? normalize_text($booking['teacherName']) : '';

        if ($bookingTable !== $weekday) {
            continue;
        }

        if ($bookingSala === $sala || $bookingTeacher === $teacherName) {
            $bounds = booking_time_bounds($booking);
            $occupied[] = array($bounds['startMinutes'], $bounds['endMinutes']);
        }
    }

    foreach ($db['recoveries'] as $booking) {
        $bookingDate = isset($booking['lessonDate']) ? normalize_text($booking['lessonDate']) : '';
        $bookingSala = isset($booking['sala']) ? normalize_text($booking['sala']) : '';
        $bookingTeacher = isset($booking['teacherName']) ? normalize_text($booking['teacherName']) : '';

        if ($bookingDate !== $lessonDate) {
            continue;
        }

        if ($bookingSala === $sala || $bookingTeacher === $teacherName) {
            $bounds = booking_time_bounds($booking);
            $occupied[] = array($bounds['startMinutes'], $bounds['endMinutes']);
        }
    }

    usort($occupied, function ($a, $b) {
        return $a[0] - $b[0];
    });

    $merged = array();
    foreach ($occupied as $interval) {
        if (!$merged) {
            $merged[] = $interval;
            continue;
        }

        $lastIndex = count($merged) - 1;
        if ($interval[0] <= $merged[$lastIndex][1]) {
            if ($interval[1] > $merged[$lastIndex][1]) {
                $merged[$lastIndex][1] = $interval[1];
            }
        } else {
            $merged[] = $interval;
        }
    }

    $cursor = DAY_START_MINUTES;
    foreach ($merged as $interval) {
        if (($interval[0] - $cursor) >= $durationMinutes) {
            $results[] = array(
                'weekday' => $weekday,
                'weekdayLabel' => weekday_label($weekday),
                'lessonDate' => $lessonDate,
                'sala' => $sala,
                'intervalStart' => minutes_to_time_dot($cursor),
                'intervalEnd' => minutes_to_time_dot($interval[0]),
                'durationMinutes' => $durationMinutes
            );
        }
        if ($interval[1] > $cursor) {
            $cursor = $interval[1];
        }
    }

    if ((DAY_END_MINUTES - $cursor) >= $durationMinutes) {
        $results[] = array(
            'weekday' => $weekday,
            'weekdayLabel' => weekday_label($weekday),
            'lessonDate' => $lessonDate,
            'sala' => $sala,
            'intervalStart' => minutes_to_time_dot($cursor),
            'intervalEnd' => minutes_to_time_dot(DAY_END_MINUTES),
            'durationMinutes' => $durationMinutes
        );
    }
}

json_response(array(
    'status' => 'success',
    'weekday' => $weekday,
    'weekdayLabel' => weekday_label($weekday),
    'lessonDate' => $lessonDate,
    'intervals' => $results
));
?>
