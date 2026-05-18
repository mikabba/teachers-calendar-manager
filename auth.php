<?php
$sessionSecure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
session_set_cookie_params(array(
    'lifetime' => 0,
    'path' => '/',
    'secure' => $sessionSecure,
    'httponly' => true,
    'samesite' => 'Lax'
));
session_start();

define('PRIVATE_DIR', __DIR__ . '/private');
define('USERS_FILE', PRIVATE_DIR . '/users.php');
define('DATABASE_FILE', PRIVATE_DIR . '/database.php');
define('DAY_START_MINUTES', 15 * 60);
define('DAY_END_MINUTES', 20 * 60 + 30);

function json_response($data, $httpCode = 200) {
    http_response_code($httpCode);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function respond_error($message, $httpCode = 400, $extra = array()) {
    json_response(array_merge(array(
        'status' => 'error',
        'message' => $message
    ), $extra), $httpCode);
}

function respond_success($message, $extra = array()) {
    json_response(array_merge(array(
        'status' => 'success',
        'message' => $message
    ), $extra), 200);
}

function normalize_text($value) {
    $value = trim((string)$value);
    $value = preg_replace('/\s+/', ' ', $value);
    return $value;
}

function normalize_time($value) {
    $value = normalize_text($value);
    $value = str_ireplace('ore ', '', $value);
    $value = str_replace(':', '.', $value);

    if (preg_match('/^(\d{1,2})\.(\d{2})$/', $value, $m)) {
        return str_pad($m[1], 2, '0', STR_PAD_LEFT) . '.' . $m[2];
    }

    return $value;
}

function time_to_minutes($value) {
    $value = normalize_time($value);
    if (!preg_match('/^(\d{2})\.(\d{2})$/', $value, $m)) {
        return null;
    }

    $hours = intval($m[1], 10);
    $minutes = intval($m[2], 10);

    if ($hours < 0 || $hours > 23 || $minutes < 0 || $minutes > 59) {
        return null;
    }

    return ($hours * 60) + $minutes;
}

function minutes_to_time_dot($minutes) {
    $minutes = intval($minutes, 10);
    $hours = floor($minutes / 60);
    $mins = $minutes % 60;
    return str_pad((string)$hours, 2, '0', STR_PAD_LEFT) . '.' . str_pad((string)$mins, 2, '0', STR_PAD_LEFT);
}

function minutes_to_time_colon($minutes) {
    $minutes = intval($minutes, 10);
    $hours = floor($minutes / 60);
    $mins = $minutes % 60;
    return str_pad((string)$hours, 2, '0', STR_PAD_LEFT) . ':' . str_pad((string)$mins, 2, '0', STR_PAD_LEFT);
}

function normalize_duration_minutes($value) {
    $duration = intval($value, 10);
    return in_array($duration, array(50, 60), true) ? $duration : 0;
}

function normalize_role($value) {
    $role = strtolower(normalize_text($value));
    return in_array($role, array('admin', 'teacher'), true) ? $role : '';
}

function valid_tables() {
    return array('lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi');
}

function valid_sale() {
    return array('Semibreve', 'Minima', 'Semiminima', 'Croma');
}

function valid_times() {
    return array(
        '15.00','15.30','16.00','16.30','17.00','17.30',
        '18.00','18.30','19.00','19.30','20.00','20.30',
        '21.00','21.30'
    );
}

function valid_weekday_numbers() {
    return array(
        'lunedi' => 1,
        'martedi' => 2,
        'mercoledi' => 3,
        'giovedi' => 4,
        'venerdi' => 5
    );
}

function ensure_parent_directory($filePath) {
    $dir = dirname($filePath);
    if (is_dir($dir)) {
        return;
    }
    if (!@mkdir($dir, 0755, true) && !is_dir($dir)) {
        respond_error('Impossibile creare la cartella privata dei dati.', 500);
    }
}

function php_array_file_content($payload) {
    return "<?php
return " . var_export($payload, true) . ";
";
}

function ensure_data_file($filePath, $default = array()) {
    ensure_parent_directory($filePath);
    if (!file_exists($filePath)) {
        $ok = @file_put_contents($filePath, php_array_file_content($default), LOCK_EX);
        if ($ok === false) {
            respond_error('Impossibile creare il file: ' . basename($filePath), 500);
        }
        @chmod($filePath, 0640);
    }
}

function read_data_file($filePath, $default = array()) {
    ensure_data_file($filePath, $default);

    $data = @require $filePath;
    if (!is_array($data)) {
        return $default;
    }

    return $data;
}

function write_data_file($filePath, $payload, $openErrorMessage, $lockErrorMessage, $writeErrorMessage) {
    ensure_parent_directory($filePath);
    $fp = @fopen($filePath, 'c+');
    if (!$fp) {
        respond_error($openErrorMessage, 500);
    }

    if (!flock($fp, LOCK_EX)) {
        fclose($fp);
        respond_error($lockErrorMessage, 500);
    }

    $content = php_array_file_content($payload);
    rewind($fp);
    if (!ftruncate($fp, 0)) {
        flock($fp, LOCK_UN);
        fclose($fp);
        respond_error($writeErrorMessage, 500);
    }

    $result = fwrite($fp, $content);
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);

    if ($result === false) {
        respond_error($writeErrorMessage, 500);
    }

    @chmod($filePath, 0640);
}

function read_users() {
    $users = read_data_file(USERS_FILE, array());
    return is_array($users) ? $users : array();
}

function save_users($users) {
    write_data_file(USERS_FILE, array_values($users), 'Impossibile aprire users.php', 'Impossibile bloccare users.php', 'Errore scrittura users.php');
}

function user_display_data($user) {
    $username = isset($user['username']) ? normalize_text($user['username']) : '';
    return array(
        'username' => $username,
        'displayName' => isset($user['displayName']) ? normalize_text($user['displayName']) : $username,
        'role' => isset($user['role']) ? normalize_role($user['role']) : 'teacher'
    );
}

function build_password_hash($plainPassword) {
    return password_hash((string)$plainPassword, PASSWORD_DEFAULT);
}

function user_has_password_hash($user) {
    return is_array($user) && isset($user['passwordHash']) && is_string($user['passwordHash']) && $user['passwordHash'] !== '';
}

function verify_user_password($user, $plainPassword) {
    if (!is_array($user)) {
        return false;
    }

    if (user_has_password_hash($user)) {
        return password_verify((string)$plainPassword, (string)$user['passwordHash']);
    }

    $legacyPassword = isset($user['password']) ? (string)$user['password'] : '';
    return hash_equals($legacyPassword, (string)$plainPassword);
}

function user_needs_password_upgrade($user) {
    if (!is_array($user)) {
        return false;
    }

    if (!user_has_password_hash($user)) {
        return true;
    }

    return password_needs_rehash((string)$user['passwordHash'], PASSWORD_DEFAULT);
}

function set_user_password(&$user, $plainPassword) {
    $user['passwordHash'] = build_password_hash($plainPassword);
    if (isset($user['password'])) {
        unset($user['password']);
    }
}

function upgrade_user_password_if_needed(&$users, $index, $plainPassword) {
    if (!isset($users[$index]) || !is_array($users[$index])) {
        return;
    }

    if (!user_needs_password_upgrade($users[$index])) {
        return;
    }

    set_user_password($users[$index], $plainPassword);
    save_users($users);
}

function find_user_index_by_username($users, $username) {
    $username = strtolower(normalize_text($username));
    foreach ($users as $index => $user) {
        if (!is_array($user)) {
            continue;
        }
        $currentUsername = isset($user['username']) ? strtolower(normalize_text($user['username'])) : '';
        if ($currentUsername === $username) {
            return $index;
        }
    }
    return -1;
}

function get_current_user_data() {
    if (
        !isset($_SESSION['user']) ||
        !is_array($_SESSION['user']) ||
        empty($_SESSION['user']['username'])
    ) {
        return null;
    }

    return $_SESSION['user'];
}

function require_login() {
    $user = get_current_user_data();
    if (!$user) {
        respond_error('Devi effettuare il login.', 401);
    }
    return $user;
}

function require_admin() {
    $user = require_login();
    if (!is_admin($user)) {
        respond_error('Permesso negato.', 403);
    }
    return $user;
}

function is_admin($user) {
    return isset($user['role']) && $user['role'] === 'admin';
}

function now_iso() {
    return date('c');
}

function generate_booking_id() {
    return 'bk_' . date('YmdHis') . '_' . bin2hex(random_bytes(4));
}

function parse_date_ymd($date) {
    $date = normalize_text($date);
    $dt = DateTime::createFromFormat('Y-m-d', $date);
    if (!$dt || $dt->format('Y-m-d') !== $date) {
        return null;
    }
    return $dt;
}

function weekday_from_date($date) {
    $dt = parse_date_ymd($date);
    if (!$dt) {
        return null;
    }

    $dayMap = array_flip(valid_weekday_numbers());
    $num = intval($dt->format('N'));
    return isset($dayMap[$num]) ? $dayMap[$num] : null;
}

function weekday_label($table) {
    $labels = array(
        'lunedi' => 'Lunedì',
        'martedi' => 'Martedì',
        'mercoledi' => 'Mercoledì',
        'giovedi' => 'Giovedì',
        'venerdi' => 'Venerdì'
    );
    return isset($labels[$table]) ? $labels[$table] : $table;
}

function load_database() {
    $data = read_data_file(DATABASE_FILE, array(
        'ordinary' => array(),
        'recoveries' => array()
    ));

    if (!isset($data['ordinary']) || !is_array($data['ordinary'])) {
        $data['ordinary'] = array();
    }

    if (!isset($data['recoveries']) || !is_array($data['recoveries'])) {
        $data['recoveries'] = array();
    }

    return $data;
}

function save_database($data) {
    if (!isset($data['ordinary']) || !is_array($data['ordinary'])) {
        $data['ordinary'] = array();
    }
    if (!isset($data['recoveries']) || !is_array($data['recoveries'])) {
        $data['recoveries'] = array();
    }

    write_data_file(DATABASE_FILE, $data, 'Impossibile aprire database.php', 'Impossibile bloccare database.php', 'Errore scrittura database.php');
}

function booking_occupies_time($booking, $time) {
    if (!isset($booking['slots']) || !is_array($booking['slots'])) {
        return false;
    }

    $time = normalize_time($time);

    foreach ($booking['slots'] as $slotTime) {
        if (normalize_time($slotTime) === $time) {
            return true;
        }
    }

    return false;
}

function sort_recoveries(&$recoveries) {
    usort($recoveries, function ($a, $b) {
        $dateA = isset($a['lessonDate']) ? $a['lessonDate'] : '';
        $dateB = isset($b['lessonDate']) ? $b['lessonDate'] : '';

        if ($dateA !== $dateB) {
            return strcmp($dateA, $dateB);
        }

        $boundsA = booking_time_bounds($a);
        $boundsB = booking_time_bounds($b);
        return $boundsA['startMinutes'] - $boundsB['startMinutes'];
    });
}

function booking_time_bounds($booking) {
    $startMinutes = null;
    $endMinutes = null;

    if (isset($booking['startTime'])) {
        $startMinutes = time_to_minutes($booking['startTime']);
    }

    if ($startMinutes === null && isset($booking['slots']) && is_array($booking['slots']) && count($booking['slots']) > 0) {
        $slotMinutes = array();
        foreach ($booking['slots'] as $slotTime) {
            $parsed = time_to_minutes($slotTime);
            if ($parsed !== null) {
                $slotMinutes[] = $parsed;
            }
        }
        sort($slotMinutes);
        if (count($slotMinutes) > 0) {
            $startMinutes = $slotMinutes[0];
            $endMinutes = $slotMinutes[0] + (count($slotMinutes) * 30);
        }
    }

    if ($startMinutes === null) {
        $startMinutes = DAY_START_MINUTES;
    }

    if ($endMinutes === null && isset($booking['durationMinutes'])) {
        $durationMinutes = normalize_duration_minutes($booking['durationMinutes']);
        if ($durationMinutes > 0) {
            $endMinutes = $startMinutes + $durationMinutes;
        }
    }

    if ($endMinutes === null && isset($booking['durationSlots'])) {
        $durationSlots = intval($booking['durationSlots'], 10);
        if ($durationSlots > 0) {
            $endMinutes = $startMinutes + ($durationSlots * 30);
        }
    }

    if ($endMinutes === null && isset($booking['endTime'])) {
        $parsedEnd = time_to_minutes($booking['endTime']);
        if ($parsedEnd !== null) {
            $endMinutes = $parsedEnd;
        }
    }

    if ($endMinutes === null || $endMinutes <= $startMinutes) {
        $endMinutes = $startMinutes + 30;
    }

    $durationMinutes = $endMinutes - $startMinutes;

    return array(
        'startMinutes' => $startMinutes,
        'endMinutes' => $endMinutes,
        'durationMinutes' => $durationMinutes,
        'startTime' => minutes_to_time_dot($startMinutes),
        'endTime' => minutes_to_time_dot($endMinutes)
    );
}

function intervals_overlap($startA, $endA, $startB, $endB) {
    return $startA < $endB && $endA > $startB;
}

function booking_overlaps_interval($booking, $startMinutes, $endMinutes) {
    $bounds = booking_time_bounds($booking);
    return intervals_overlap($bounds['startMinutes'], $bounds['endMinutes'], $startMinutes, $endMinutes);
}

function ensure_within_day_window($startMinutes, $durationMinutes) {
    $endMinutes = $startMinutes + $durationMinutes;
    if ($startMinutes < DAY_START_MINUTES || $endMinutes > DAY_END_MINUTES) {
        respond_error('L\'orario deve rientrare tra le 15:00 e le 20:30.');
    }
    return $endMinutes;
}

function normalize_booking_record($booking) {
    $bounds = booking_time_bounds($booking);
    $booking['startTime'] = $bounds['startTime'];
    $booking['endTime'] = $bounds['endTime'];
    $booking['durationMinutes'] = $bounds['durationMinutes'];
    return $booking;
}
?>
