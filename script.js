$(document).ready(function () {
    const days = ["lunedi", "martedi", "mercoledi", "giovedi", "venerdi"];
    const sale = ["Semibreve", "Minima", "Semiminima", "Croma"];
    const dayIndexMap = { lunedi: 1, martedi: 2, mercoledi: 3, giovedi: 4, venerdi: 5 };
    const DAY_START_MINUTES = 15 * 60;
    const DAY_END_MINUTES = 20 * 60 + 30;

    let currentUser = null;
    let ordinaryBookings = [];
    let recoveryBookings = [];
    let mobileActiveDay = "lunedi";
    let adminSummaryShown = false;
    let activeModalSelector = null;
    let lastFocusedTrigger = null;
    let pendingRecoverySelection = null;
    let adminUsers = [];

    function normalizeText(value) {
        return $.trim(String(value || "")).replace(/\s+/g, " ");
    }

    function normalizeTime(value) {
        const raw = normalizeText(value).replace(/^ore\s+/i, "").replace(":", ".");
        const match = raw.match(/^(\d{1,2})\.(\d{2})$/);
        if (!match) return raw;
        return match[1].padStart(2, "0") + "." + match[2];
    }

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function dotToColon(value) {
        return normalizeTime(value).replace(".", ":");
    }

    function colonToDot(value) {
        return normalizeTime(value);
    }

    function timeToMinutes(value) {
        const normalized = normalizeTime(value);
        const match = normalized.match(/^(\d{2})\.(\d{2})$/);
        if (!match) return null;
        const hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
        return (hours * 60) + minutes;
    }

    function minutesToDot(minutes) {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return String(h).padStart(2, "0") + "." + String(m).padStart(2, "0");
    }

    function minutesToColon(minutes) {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
    }

    function formatDuration(minutes) {
        return minutes + " minuti";
    }

    function dayLabel(day) {
        const labels = {
            lunedi: "Lunedì",
            martedi: "Martedì",
            mercoledi: "Mercoledì",
            giovedi: "Giovedì",
            venerdi: "Venerdì"
        };
        return labels[day] || day;
    }

    function parseISODate(dateString) {
        const parts = String(dateString || "").split("-");
        if (parts.length !== 3) return null;
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);
        if ([year, month, day].some(Number.isNaN)) return null;
        return new Date(year, month - 1, day);
    }

    function formatDateShort(dateObj) {
        const dd = String(dateObj.getDate()).padStart(2, "0");
        const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
        const yyyy = dateObj.getFullYear();
        return dd + "/" + mm + "/" + yyyy;
    }

    function formatDateIso(dateObj) {
        return dateObj.getFullYear() + "-" + String(dateObj.getMonth() + 1).padStart(2, "0") + "-" + String(dateObj.getDate()).padStart(2, "0");
    }

    function getTodayScheduleDay() {
        const jsDay = new Date().getDay();
        const map = { 1: "lunedi", 2: "martedi", 3: "mercoledi", 4: "giovedi", 5: "venerdi" };
        return map[jsDay] || "lunedi";
    }

    function getReferenceDatesByDay() {
        const now = new Date();
        const jsDay = now.getDay();
        const currentWeekday = jsDay === 0 ? 7 : jsDay;
        const monday = new Date(now);
        monday.setHours(0, 0, 0, 0);
        monday.setDate(now.getDate() - (currentWeekday - 1));

        const result = {};
        days.forEach(function (dayKey) {
            const targetWeekday = dayIndexMap[dayKey];
            const refDate = new Date(monday);
            if (targetWeekday < currentWeekday) {
                refDate.setDate(monday.getDate() + 7 + (targetWeekday - 1));
            } else {
                refDate.setDate(monday.getDate() + (targetWeekday - 1));
            }
            result[dayKey] = refDate;
        });
        return result;
    }

    function updateDayHeaders(referenceDates) {
        days.forEach(function (dayKey) {
            const dateObj = referenceDates[dayKey];
            $("#day-date-" + dayKey).text(dateObj ? formatDateShort(dateObj) : "");
        });
    }

    function isMobileView() {
        return window.matchMedia("(max-width: 820px)").matches;
    }

    function getFocusableElements(container) {
        return $(container)
            .find('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')
            .filter(':visible');
    }

    function focusModal(selector) {
        const modal = $(selector);
        const focusable = getFocusableElements(modal);
        if (focusable.length) {
            focusable.first().trigger("focus");
        } else {
            modal.attr("tabindex", "-1").trigger("focus");
        }
    }

    function closeModalState() {
        $(".overlay").addClass("hidden").attr("aria-hidden", "true");
        activeModalSelector = null;
        $("body").removeClass("modal-open");
    }

    function openModal(selector, options) {
        const settings = options || {};
        const modal = $(selector);
        if (!modal.length) return;
        lastFocusedTrigger = settings.triggerElement || document.activeElement;
        modal.removeClass("hidden").attr("aria-hidden", "false");
        $("body").addClass("modal-open");
        activeModalSelector = selector;
        focusModal(selector);
    }

    function closeModal(selector, options) {
        const settings = options || {};
        const modal = $(selector);
        if (!modal.length) return;
        modal.addClass("hidden").attr("aria-hidden", "true");
        if (activeModalSelector === selector) activeModalSelector = null;
        if (!$(".overlay").not(".hidden").length) {
            $("body").removeClass("modal-open");
            if (settings.restoreFocus !== false && lastFocusedTrigger && typeof lastFocusedTrigger.focus === "function") {
                lastFocusedTrigger.focus();
            }
        }
    }

    function showNotification(message) {
        $("#notification-message").text(message);
        openModal("#notification-modal", { triggerElement: document.activeElement });
    }

    function showConfirm(message, onConfirm, onCancel) {
        $("#confirm-message").text(message);
        openModal("#confirm-modal", { triggerElement: document.activeElement });

        $("#confirm-yes").off("click").on("click", function () {
            closeModal("#confirm-modal");
            if (typeof onConfirm === "function") onConfirm();
        });

        $("#confirm-no").off("click").on("click", function () {
            closeModal("#confirm-modal");
            if (typeof onCancel === "function") onCancel();
        });
    }


    function isAdminUser() {
        return !!(currentUser && currentUser.role === "admin");
    }

    function sortUsersByDisplayName(list) {
        return (Array.isArray(list) ? list.slice() : []).sort(function (a, b) {
            return normalizeText(a.displayName).localeCompare(normalizeText(b.displayName), "it", { sensitivity: "base" });
        });
    }

    function setAdminButtonsVisibility() {
        const show = isAdminUser();
        $("#admin-add-user-btn, #admin-remove-user-btn, #admin-recover-credentials-btn").toggleClass("hidden", !show);
    }

    function clearAdminUserForm() {
        const form = $("#admin-user-form").get(0);
        if (form) form.reset();
        $("#admin-user-mode").val("add");
        $("#admin-user-add-fields").removeClass("hidden");
        $("#admin-user-remove-fields").addClass("hidden");
        $("#admin-remove-user-search").val("");
        $("#admin-remove-user-select").empty();
    }

    function clearResetPasswordPanel() {
        const form = $("#admin-reset-password-form").get(0);
        if (form) form.reset();
        $("#admin-credentials-select").empty();
        $("#admin-credentials-result").addClass("hidden");
        $("#credential-display-name, #credential-role, #credential-username, #credential-password").val("");
    }

    function clearChangePasswordForm() {
        const form = $("#change-password-form").get(0);
        if (form) form.reset();
    }

    function openChangePasswordModal(triggerElement) {
        if (!currentUser) {
            showNotification("Devi effettuare il login.");
            return;
        }
        clearChangePasswordForm();
        openModal("#change-password-modal", { triggerElement: triggerElement || document.activeElement });
    }

    function renderUserOptions(selector, users, options) {
        const settings = options || {};
        const select = $(selector);
        const previousValue = settings.keepValue ? String(select.val() || "") : "";
        select.empty();

        if (!users.length) {
            select.append('<option value="">Nessun utente trovato</option>');
            return;
        }

        users.forEach(function (user) {
            const label = (user.displayName || user.username || "Utente") + " · " + (user.role === "admin" ? "Admin" : "Docente");
            select.append('<option value="' + escapeHtml(user.username || "") + '">' + escapeHtml(label) + '</option>');
        });

        if (previousValue && select.find('option[value="' + previousValue.replace(/"/g, '\"') + '"]').length) {
            select.val(previousValue);
        } else {
            select.prop("selectedIndex", 0);
        }
    }

    function getFilteredAdminUsers(searchValue, options) {
        const settings = options || {};
        const query = normalizeText(searchValue).toLowerCase();
        return adminUsers.filter(function (user) {
            if (settings.excludeCurrent && currentUser && user.username === currentUser.username) {
                return false;
            }
            if (!query) return true;
            return normalizeText(user.displayName).toLowerCase().indexOf(query) !== -1 || normalizeText(user.username).toLowerCase().indexOf(query) !== -1;
        });
    }

    function renderRemoveUserList() {
        renderUserOptions("#admin-remove-user-select", getFilteredAdminUsers($("#admin-remove-user-search").val(), { excludeCurrent: true }), { keepValue: true });
    }

    function renderResetPasswordUserList() {
        renderUserOptions("#admin-credentials-select", getFilteredAdminUsers($("#admin-credentials-search").val()), { keepValue: true });
    }

    function loadAdminUsers(onDone) {
        if (!isAdminUser()) return;
        $.get("list_users.php", function (response) {
            adminUsers = sortUsersByDisplayName(Array.isArray(response.users) ? response.users : []);
            if (typeof onDone === "function") onDone();
        }, "json").fail(function (jqXHR) {
            let message = "Errore durante il caricamento utenti.";
            if (jqXHR.responseJSON && jqXHR.responseJSON.message) message = jqXHR.responseJSON.message;
            showNotification(message);
        });
    }

    function openAdminUserModal(mode, triggerElement) {
        if (!isAdminUser()) {
            showNotification("Permesso negato.");
            return;
        }

        clearAdminUserForm();
        const isRemove = mode === "remove";
        $("#admin-user-mode").val(isRemove ? "remove" : "add");
        $("#admin-user-modal-kicker").text(isRemove ? "Rimozione utente" : "Gestione utenti");
        $("#admin-user-modal-title").text(isRemove ? "Rimuovi utente" : "Aggiungi utente");
        $("#admin-user-modal-copy").text(isRemove ? "Seleziona un utente esistente da eliminare dall’archivio utenti privato." : "Inserisci i dati necessari per aggiornare l’archivio utenti privato.");
        $("#admin-user-submit-btn").text(isRemove ? "Rimuovi utente" : "Salva utente").toggleClass("btn-danger", isRemove).toggleClass("btn-primary", !isRemove);
        $("#admin-user-add-fields").toggleClass("hidden", isRemove);
        $("#admin-user-remove-fields").toggleClass("hidden", !isRemove);

        if (isRemove) {
            loadAdminUsers(function () {
                renderRemoveUserList();
                openModal("#admin-user-modal", { triggerElement: triggerElement || document.activeElement });
            });
            return;
        }

        openModal("#admin-user-modal", { triggerElement: triggerElement || document.activeElement });
    }

    function openResetPasswordModal(triggerElement) {
        if (!isAdminUser()) {
            showNotification("Permesso negato.");
            return;
        }
        clearResetPasswordPanel();
        loadAdminUsers(function () {
            renderResetPasswordUserList();
            openModal("#admin-reset-password-modal", { triggerElement: triggerElement || document.activeElement });
        });
    }

    function fillResetPasswordFields(response) {
        const user = response && response.user ? response.user : null;
        const tempPassword = response && response.temporaryPassword ? response.temporaryPassword : "";
        if (!user) {
            $("#admin-credentials-result").addClass("hidden");
            $("#credential-display-name, #credential-role, #credential-username, #credential-password").val("");
            return;
        }
        $("#credential-display-name").val(user.displayName || "");
        $("#credential-role").val(user.role === "admin" ? "Admin" : "Docente");
        $("#credential-username").val(user.username || "");
        $("#credential-password").val(tempPassword);
        $("#admin-credentials-result").removeClass("hidden");
    }

    function canDeleteOrdinary(booking) {
        if (!currentUser || !booking) return false;
        if (currentUser.role === "admin") return true;
        return normalizeText(currentUser.displayName) === normalizeText(booking.teacherName);
    }

    function getBookingBounds(booking) {
        const start = timeToMinutes(booking.startTime);
        let end = null;
        let duration = parseInt(booking.durationMinutes, 10) || 0;

        if (duration === 50 || duration === 60) {
            end = start + duration;
        } else if (Array.isArray(booking.slots) && booking.slots.length) {
            const slotMinutes = booking.slots.map(timeToMinutes).filter(Number.isFinite).sort(function (a, b) { return a - b; });
            if (slotMinutes.length) {
                duration = slotMinutes.length * 30;
                end = slotMinutes[0] + duration;
            }
        }

        if (!Number.isFinite(end)) {
            end = timeToMinutes(booking.endTime);
        }

        if (!Number.isFinite(end) || end <= start) {
            end = start + 30;
        }

        return {
            startMinutes: start,
            endMinutes: end,
            durationMinutes: end - start,
            startTime: minutesToDot(start),
            endTime: minutesToDot(end)
        };
    }

    function normalizeLoadedBooking(raw, typeOverride) {
        const booking = $.extend({}, raw || {});
        const bounds = getBookingBounds(booking);
        booking.lessonType = typeOverride || booking.lessonType || "ordinaria";
        booking.startTime = bounds.startTime;
        booking.endTime = bounds.endTime;
        booking.startMinutes = bounds.startMinutes;
        booking.endMinutes = bounds.endMinutes;
        booking.durationMinutes = bounds.durationMinutes;
        return booking;
    }

    function getDisplayedDayBookings(day, dateIso) {
        const ordinary = ordinaryBookings
            .filter(function (booking) { return normalizeText(booking.table) === day; })
            .map(function (booking) { return normalizeLoadedBooking(booking, "ordinaria"); });

        const recoveries = recoveryBookings
            .filter(function (booking) {
                return normalizeText(booking.table) === day && normalizeText(booking.lessonDate) === dateIso;
            })
            .map(function (booking) { return normalizeLoadedBooking(booking, "recupero"); });

        return ordinary.concat(recoveries).sort(function (a, b) {
            if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
            return a.endMinutes - b.endMinutes;
        });
    }

    function getRoomBookings(day, dateIso, sala) {
        return getDisplayedDayBookings(day, dateIso).filter(function (booking) {
            return normalizeText(booking.sala) === normalizeText(sala);
        });
    }

    function buildFreeIntervals(bookings) {
        const sorted = (bookings || [])
            .map(function (booking) { return [booking.startMinutes, booking.endMinutes]; })
            .filter(function (interval) { return Number.isFinite(interval[0]) && Number.isFinite(interval[1]); })
            .sort(function (a, b) { return a[0] - b[0]; });

        const merged = [];
        sorted.forEach(function (interval) {
            if (!merged.length) {
                merged.push(interval.slice());
                return;
            }
            const last = merged[merged.length - 1];
            if (interval[0] <= last[1]) {
                last[1] = Math.max(last[1], interval[1]);
            } else {
                merged.push(interval.slice());
            }
        });

        const free = [];
        let cursor = DAY_START_MINUTES;
        merged.forEach(function (interval) {
            if (interval[0] > cursor) {
                free.push({ startMinutes: cursor, endMinutes: interval[0] });
            }
            cursor = Math.max(cursor, interval[1]);
        });
        if (cursor < DAY_END_MINUTES) {
            free.push({ startMinutes: cursor, endMinutes: DAY_END_MINUTES });
        }

        return free.filter(function (interval) {
            return (interval.endMinutes - interval.startMinutes) >= 50;
        });
    }


    function getRoomTimelineSegments(bookings) {
        const sorted = (bookings || [])
            .filter(function (booking) {
                return Number.isFinite(booking.startMinutes) && Number.isFinite(booking.endMinutes);
            })
            .slice()
            .sort(function (a, b) {
                if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
                return a.endMinutes - b.endMinutes;
            });

        const segments = [];
        let cursor = DAY_START_MINUTES;

        sorted.forEach(function (booking) {
            if (booking.startMinutes > cursor) {
                segments.push({
                    segmentType: "free",
                    startMinutes: cursor,
                    endMinutes: booking.startMinutes,
                    durationMinutes: booking.startMinutes - cursor,
                    sala: booking.sala
                });
            }

            segments.push({
                segmentType: "booking",
                startMinutes: booking.startMinutes,
                endMinutes: booking.endMinutes,
                durationMinutes: booking.endMinutes - booking.startMinutes,
                booking: booking,
                sala: booking.sala
            });

            cursor = Math.max(cursor, booking.endMinutes);
        });

        if (cursor < DAY_END_MINUTES) {
            segments.push({
                segmentType: "free",
                startMinutes: cursor,
                endMinutes: DAY_END_MINUTES,
                durationMinutes: DAY_END_MINUTES - cursor,
                sala: sorted.length ? sorted[0].sala : ""
            });
        }

        if (!segments.length) {
            segments.push({
                segmentType: "free",
                startMinutes: DAY_START_MINUTES,
                endMinutes: DAY_END_MINUTES,
                durationMinutes: DAY_END_MINUTES - DAY_START_MINUTES,
                sala: ""
            });
        }

        return segments;
    }

    function renderTimelineActionCell(day, dateIso, sala, segment) {
        if (!currentUser) return "";

        if (segment.segmentType === "free") {
            return `<button type="button" class="btn btn-primary btn-small add-ordinary-btn" data-day="${escapeHtml(day)}" data-date="${escapeHtml(dateIso)}" data-sala="${escapeHtml(sala)}" data-interval-start="${escapeHtml(minutesToDot(segment.startMinutes))}" data-interval-end="${escapeHtml(minutesToDot(segment.endMinutes))}">Inserisci lezione</button>`;
        }

        const booking = segment.booking;
        if (booking && booking.lessonType === "ordinaria" && canDeleteOrdinary(booking)) {
            return `<button type="button" class="btn btn-danger btn-small delete-ordinary-btn" data-booking-id="${escapeHtml(booking.bookingId)}">Elimina</button>`;
        }

        return "";
    }

    function renderRoomTimelineCards(day, dateIso, sala, segments) {
        const cardsHtml = segments.map(function (segment) {
            const startLabel = minutesToColon(segment.startMinutes);
            const endLabel = minutesToColon(segment.endMinutes);
            const durationLabel = formatDuration(segment.durationMinutes);
            const isFree = segment.segmentType === "free";
            const booking = segment.booking || null;
            const cardType = isFree ? "mobile-free" : (booking.lessonType === "recupero" ? "mobile-recovery" : "mobile-ordinary");
            const chipClass = isFree ? "card-chip-free" : (booking.lessonType === "recupero" ? "card-chip-recovery" : "card-chip-ordinary");
            const chipLabel = isFree ? "Libero" : (booking.lessonType === "recupero" ? "Recupero" : "Ordinaria");
            const title = isFree ? "Spazio disponibile" : escapeHtml(booking.courseName || "Lezione senza titolo");
            const subtitle = isFree
                ? "Puoi inserire una lezione direttamente in questa fascia."
                : escapeHtml(booking.teacherName || "");
            const note = isFree
                ? `<p class="mobile-timeline-note">Intervallo prenotabile in ${escapeHtml(sala)}</p>`
                : '';
            const actions = renderTimelineActionCell(day, dateIso, sala, segment);

            return `
                <div class="mobile-timeline-card ${cardType}">
                    <div class="mobile-timeline-top">
                        <div>
                            <p class="mobile-timeline-time">${escapeHtml(startLabel)}–${escapeHtml(endLabel)}</p>
                            <p class="mobile-timeline-duration">${escapeHtml(durationLabel)}</p>
                        </div>
                        <span class="card-chip ${chipClass}">${chipLabel}</span>
                    </div>
                    <p class="mobile-timeline-title">${title}</p>
                    ${subtitle ? `<p class="mobile-timeline-subtitle">${subtitle}</p>` : ''}
                    ${note}
                    ${actions ? `<div class="mobile-timeline-actions">${actions}</div>` : ''}
                </div>
            `;
        }).join("");

        return `<div class="mobile-timeline-list">${cardsHtml}</div>`;
    }

    function renderRoomTimelineTable(day, dateIso, sala, segments) {
        const rowsHtml = segments.map(function (segment) {
            const startLabel = minutesToColon(segment.startMinutes);
            const endLabel = minutesToColon(segment.endMinutes);
            const durationLabel = formatDuration(segment.durationMinutes);
            const isFree = segment.segmentType === "free";
            const booking = segment.booking || null;
            const rowClass = isFree ? "timeline-row-free" : (booking.lessonType === "recupero" ? "timeline-row-recovery" : "timeline-row-ordinary");
            const status = isFree ? '<span class="card-chip card-chip-free">Libero</span>' : `<span class="card-chip ${booking.lessonType === "recupero" ? "card-chip-recovery" : "card-chip-ordinary"}">${booking.lessonType === "recupero" ? "Recupero" : "Ordinaria"}</span>`;
            const details = isFree
                ? `<strong>Spazio disponibile</strong><div class="timeline-subline">Puoi inserire una lezione direttamente in questa fascia.</div>`
                : `<strong>${escapeHtml(booking.courseName || 'Lezione senza titolo')}</strong><div class="timeline-subline">${escapeHtml(booking.teacherName || '')}</div>`;
            const actions = renderTimelineActionCell(day, dateIso, sala, segment);

            return `
                <tr class="${rowClass}">
                    <td class="timeline-time-cell">${escapeHtml(startLabel)}–${escapeHtml(endLabel)}</td>
                    <td>${status}</td>
                    <td class="timeline-details-cell">${details}</td>
                    <td>${escapeHtml(durationLabel)}</td>
                    <td class="timeline-actions-cell">${actions || '<span class="timeline-muted">—</span>'}</td>
                </tr>
            `;
        }).join("");

        return `
            <div class="table-wrap room-timeline-wrap hidden">
                <table class="summary-table room-timeline-table">
                    <thead>
                        <tr>
                            <th>Orario</th>
                            <th>Stato</th>
                            <th>Dettaglio</th>
                            <th>Durata</th>
                            <th>Azioni</th>
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>
        `;
    }

    function renderBookingCard(booking) {
        const chipClass = booking.lessonType === "recupero" ? "card-chip-recovery" : "card-chip-ordinary";
        const chipLabel = booking.lessonType === "recupero" ? "Recupero" : "Ordinaria";
        const canDelete = booking.lessonType === "ordinaria" && canDeleteOrdinary(booking);
        const actions = canDelete
            ? '<div class="card-actions"><button type="button" class="btn btn-danger btn-small delete-ordinary-btn" data-booking-id="' + escapeHtml(booking.bookingId) + '">Elimina</button></div>'
            : '';
        return `
            <div class="booking-card ${escapeHtml(booking.lessonType)}">
                <div class="card-head">
                    <div>
                        <p class="card-title">${escapeHtml(booking.courseName || 'Lezione senza titolo')}</p>
                        <p class="card-meta">${escapeHtml(booking.teacherName || '')}</p>
                    </div>
                    <span class="card-chip ${chipClass}">${chipLabel}</span>
                </div>
                <p class="card-meta">${escapeHtml(booking.sala)} · ${escapeHtml(dotToColon(booking.startTime))}–${escapeHtml(dotToColon(booking.endTime))}</p>
                ${actions}
            </div>
        `;
    }

    function renderDay(day, referenceDates) {
        const dateObj = referenceDates[day];
        const dateIso = formatDateIso(dateObj);
        const container = $("#day-content-" + day);
        if (!container.length) return;
        container.empty();

        sale.forEach(function (sala) {
            const roomBookings = getRoomBookings(day, dateIso, sala);
            const freeIntervals = buildFreeIntervals(roomBookings);
            const timelineSegments = getRoomTimelineSegments(roomBookings);

            const bookingsHtml = roomBookings.length
                ? `<div class="stack-list">${roomBookings.map(renderBookingCard).join("")}</div>`
                : '<p class="room-empty">Nessuna lezione programmata in questa aula.</p>';

            const freeHtml = freeIntervals.length
                ? `<div class="stack-list">${freeIntervals.map(function (interval) {
                    return `
                        <div class="free-interval-card">
                            <div class="card-head">
                                <div>
                                    <p class="card-title">Disponibilità ${escapeHtml(minutesToColon(interval.startMinutes))}–${escapeHtml(minutesToColon(interval.endMinutes))}</p>
                                    <p class="card-meta">Intervallo utile in ${escapeHtml(sala)}</p>
                                </div>
                                <span class="card-chip card-chip-free">Libero</span>
                            </div>
                            <p class="interval-note">Spazio prenotabile: ${escapeHtml(formatDuration(interval.endMinutes - interval.startMinutes))}</p>
                            ${currentUser ? `<div class="card-actions"><button type="button" class="btn btn-primary btn-small add-ordinary-btn" data-day="${escapeHtml(day)}" data-date="${escapeHtml(dateIso)}" data-sala="${escapeHtml(sala)}" data-interval-start="${escapeHtml(minutesToDot(interval.startMinutes))}" data-interval-end="${escapeHtml(minutesToDot(interval.endMinutes))}">Inserisci lezione</button></div>` : ''}
                        </div>
                    `;
                }).join("")}</div>`
                : '<p class="room-empty">Nessun intervallo prenotabile da almeno 50 minuti.</p>';

            const roomActions = currentUser ? `
                <div class="room-actions">
                    <button type="button" class="btn btn-secondary btn-small toggle-room-table-btn" aria-expanded="false">Apri vista tabellare</button>
                    <button type="button" class="btn btn-danger btn-small room-recovery-btn" data-sala="${escapeHtml(sala)}">Prenota recupero</button>
                </div>
            ` : `
                <div class="room-actions">
                    <button type="button" class="btn btn-secondary btn-small toggle-room-table-btn" aria-expanded="false">Apri vista tabellare</button>
                </div>
            `;

            container.append(`
                <section class="room-section">
                    <div class="room-header">
                        <div>
                            <h3 class="room-title">${escapeHtml(sala)}</h3>
                            <p class="room-subtitle">${escapeHtml(dayLabel(day))} · ${escapeHtml(formatDateShort(dateObj))} · copertura completa 15:00–20:30</p>
                        </div>
                        ${roomActions}
                    </div>
                    ${renderRoomTimelineCards(day, dateIso, sala, timelineSegments)}
                    ${renderRoomTimelineTable(day, dateIso, sala, timelineSegments)}
                    <div class="room-grid room-cards-layout">
                        <div class="room-column">
                            <h4>Lezioni in calendario</h4>
                            ${bookingsHtml}
                        </div>
                        <div class="room-column">
                            <h4>Intervalli disponibili</h4>
                            ${freeHtml}
                        </div>
                    </div>
                </section>
            `);
        });

        if (!container.children().length) {
            container.html('<div class="day-empty-message">Nessun contenuto disponibile per questo giorno.</div>');
        }
    }

    function renderCalendar() {
        const referenceDates = getReferenceDatesByDay();
        updateDayHeaders(referenceDates);
        days.forEach(function (day) { renderDay(day, referenceDates); });
        setupDayAccordions();
    }

    function renderRecoveriesTable() {
        const tbody = $("#recoveries-table tbody");
        tbody.empty();

        if (!recoveryBookings.length) {
            tbody.html('<tr><td colspan="7" class="empty-summary">Nessun recupero presente.</td></tr>');
            return;
        }

        recoveryBookings
            .map(function (booking) { return normalizeLoadedBooking(booking, "recupero"); })
            .sort(function (a, b) {
                const dateCmp = normalizeText(a.lessonDate).localeCompare(normalizeText(b.lessonDate));
                if (dateCmp !== 0) return dateCmp;
                return a.startMinutes - b.startMinutes;
            })
            .forEach(function (booking) {
                const canDelete = currentUser && (currentUser.role === "admin" || normalizeText(currentUser.displayName) === normalizeText(booking.teacherName));
                const action = canDelete
                    ? `<button type="button" class="btn btn-danger btn-small delete-recovery-btn" data-booking-id="${escapeHtml(booking.bookingId)}">Elimina</button>`
                    : "";
                tbody.append(`
                    <tr>
                        <td>${escapeHtml(booking.lessonDate)}</td>
                        <td>${escapeHtml(dayLabel(booking.table))}</td>
                        <td>${escapeHtml(dotToColon(booking.startTime))}–${escapeHtml(dotToColon(booking.endTime))}</td>
                        <td>${escapeHtml(booking.sala)}</td>
                        <td>${escapeHtml(booking.courseName)}</td>
                        <td>${escapeHtml(booking.teacherName)}</td>
                        <td>${action}</td>
                    </tr>
                `);
            });
    }

    function getTodayLessonSummary() {
        const now = new Date();
        const todayDay = getTodayScheduleDay();
        const referenceDates = getReferenceDatesByDay();
        const refDate = referenceDates[todayDay];
        const isActualToday = now.getDay() >= 1 && now.getDay() <= 5;
        const dateIso = formatDateIso(refDate);
        const lessons = getDisplayedDayBookings(todayDay, dateIso);

        if (!lessons.length) {
            return {
                hasLessons: false,
                dayLabelText: dayLabel(todayDay),
                dayDateText: refDate ? formatDateShort(refDate) : "",
                isActualToday: isActualToday
            };
        }

        const firstStart = lessons[0].startMinutes;
        const lastEnd = lessons.reduce(function (max, lesson) {
            return Math.max(max, lesson.endMinutes);
        }, lessons[0].endMinutes);

        const firstCourses = Array.from(new Set(lessons.filter(function (lesson) {
            return lesson.startMinutes === firstStart;
        }).map(function (lesson) {
            return lesson.courseName || "Lezione senza titolo";
        })));

        const lastCourses = Array.from(new Set(lessons.filter(function (lesson) {
            return lesson.endMinutes === lastEnd;
        }).map(function (lesson) {
            return lesson.courseName || "Lezione senza titolo";
        })));

        return {
            hasLessons: true,
            dayLabelText: dayLabel(todayDay),
            dayDateText: refDate ? formatDateShort(refDate) : "",
            isActualToday: isActualToday,
            firstTime: minutesToColon(firstStart),
            lastTime: minutesToColon(lastEnd),
            firstCourses: firstCourses,
            lastCourses: lastCourses
        };
    }

    function showAdminTodaySummaryIfNeeded() {
        if (!currentUser || currentUser.role !== "admin" || adminSummaryShown) return;

        const summary = getTodayLessonSummary();
        const summaryScopeLabel = summary.isActualToday ? "Riepilogo di oggi" : "Riepilogo calendario";
        const subtitleParts = [summary.dayLabelText];
        if (summary.dayDateText) subtitleParts.push(summary.dayDateText);
        subtitleParts.push(summary.isActualToday ? "riepilogo automatico di oggi" : "riepilogo automatico del calendario");

        $("#admin-summary-kicker").text(summaryScopeLabel);
        $("#admin-summary-title").text(summary.isActualToday ? "Lezioni della giornata" : "Lezioni del giorno selezionato");
        $("#admin-summary-subtitle").text(subtitleParts.join(" · "));

        if (!summary.hasLessons) {
            $("#admin-summary-content").html(`
                <div class="admin-summary-block">
                    <h3>${summary.isActualToday ? "Nessuna lezione oggi" : "Nessuna lezione nel giorno selezionato"}</h3>
                    <p>Per ${escapeHtml(summary.dayLabelText)}${summary.dayDateText ? " " + escapeHtml(summary.dayDateText) : ""} non risultano lezioni programmate.</p>
                </div>
            `);
        } else {
            const firstList = summary.firstCourses.map(function (course) { return "<li>" + escapeHtml(course) + "</li>"; }).join("");
            const lastList = summary.lastCourses.map(function (course) { return "<li>" + escapeHtml(course) + "</li>"; }).join("");
            $("#admin-summary-content").html(`
                <div class="admin-summary-block">
                    <h3>Orario inizio prima lezione: ${escapeHtml(summary.firstTime)}</h3>
                    <ul>${firstList}</ul>
                </div>
                <div class="admin-summary-block">
                    <h3>Orario fine ultima lezione: ${escapeHtml(summary.lastTime)}</h3>
                    <ul>${lastList}</ul>
                </div>
            `);
        }

        adminSummaryShown = true;
        openModal("#admin-summary-modal", { triggerElement: document.activeElement });
    }

    function resetRecoveryState() {
        const form = $("#recovery-search-form").get(0);
        if (form) form.reset();
        $("#recovery-teacher-name").val(currentUser ? (currentUser.displayName || "") : "");
        $("#recovery-duration").val("50");
        $("#recovery-preferred-room-group").addClass("hidden");
        $("#recovery-preferred-room").val("");
        $("#availability-box").addClass("hidden");
        $("#availability-intervals").empty();
        $("#recovery-booking-box").addClass("hidden");
        $("#selected-recovery-interval-label").text("");
        $("#recovery-start-time").val("");
        $("#recovery-room-label").val("");
        pendingRecoverySelection = null;
    }

    function openRecoveryModal(triggerElement, options) {
        const settings = options || {};
        resetRecoveryState();
        if (settings.sala) {
            $("#recovery-preferred-room-group").removeClass("hidden");
            $("#recovery-preferred-room").val(settings.sala);
        }
        openModal("#recovery-modal", { triggerElement: triggerElement || document.activeElement });
    }

    function openOrdinaryModal(button) {
        const day = normalizeText($(button).attr("data-day"));
        const dateIso = normalizeText($(button).attr("data-date"));
        const sala = normalizeText($(button).attr("data-sala"));
        const intervalStart = normalizeTime($(button).attr("data-interval-start"));
        const intervalEnd = normalizeTime($(button).attr("data-interval-end"));

        $("#ordinary-day-key").val(day);
        $("#ordinary-room-key").val(sala);
        $("#ordinary-interval-start").val(intervalStart);
        $("#ordinary-interval-end").val(intervalEnd);
        $("#ordinary-course-name").val("");
        $("#ordinary-teacher-name").val(currentUser ? (currentUser.displayName || "") : "");
        $("#ordinary-duration").val("50");
        $("#ordinary-room-label").val(sala);
        $("#ordinary-start-time").val(dotToColon(intervalStart));
        $("#ordinary-slot-label").text(dayLabel(day) + " · " + formatDateShort(parseISODate(dateIso)) + " · " + sala + " · disponibilità " + dotToColon(intervalStart) + "–" + dotToColon(intervalEnd));
        openModal("#ordinary-modal", { triggerElement: button });
    }

    function validateStartWithinInterval(startDot, durationMinutes, intervalStartDot, intervalEndDot) {
        const startMinutes = timeToMinutes(startDot);
        const intervalStartMinutes = timeToMinutes(intervalStartDot);
        const intervalEndMinutes = timeToMinutes(intervalEndDot);
        if ([startMinutes, intervalStartMinutes, intervalEndMinutes].some(function (value) { return !Number.isFinite(value); })) {
            return { ok: false, message: "Orario non valido." };
        }
        if (startMinutes < intervalStartMinutes) {
            return { ok: false, message: "L’orario di inizio deve essere dentro l’intervallo selezionato." };
        }
        if ((startMinutes + durationMinutes) > intervalEndMinutes) {
            return { ok: false, message: "La durata scelta supera il limite dell’intervallo selezionato." };
        }
        if (startMinutes < DAY_START_MINUTES || (startMinutes + durationMinutes) > DAY_END_MINUTES) {
            return { ok: false, message: "L’orario deve rientrare tra le 15:00 e le 20:30." };
        }
        return { ok: true };
    }

    function renderRecoveryAvailability(intervals, lessonDate, weekdayLabelText, durationMinutes) {
        const container = $("#availability-intervals");
        const preferredRoom = normalizeText($("#recovery-preferred-room").val());
        const filteredIntervals = preferredRoom
            ? (intervals || []).filter(function (interval) { return normalizeText(interval.sala) === preferredRoom; })
            : (intervals || []);

        container.empty();

        if (!filteredIntervals.length) {
            container.html('<div class="day-empty-message">Nessun intervallo disponibile per la durata selezionata' + (preferredRoom ? ' nell’aula scelta.' : '.') + '</div>');
            $("#recovery-booking-box").addClass("hidden");
            return;
        }

        filteredIntervals.forEach(function (interval) {
            container.append(`
                <div class="availability-interval-card">
                    <div class="card-head">
                        <div>
                            <p class="card-title">${escapeHtml(interval.sala)}</p>
                            <p class="card-meta">${escapeHtml(dotToColon(interval.intervalStart))}–${escapeHtml(dotToColon(interval.intervalEnd))}</p>
                        </div>
                        <span class="card-chip card-chip-free">Libero</span>
                    </div>
                    <p class="card-meta">Durata richiesta: ${escapeHtml(formatDuration(durationMinutes))}</p>
                    <div class="card-actions">
                        <button type="button" class="btn btn-primary btn-small choose-recovery-interval-btn" data-sala="${escapeHtml(interval.sala)}" data-interval-start="${escapeHtml(interval.intervalStart)}" data-interval-end="${escapeHtml(interval.intervalEnd)}" data-lesson-date="${escapeHtml(lessonDate)}" data-weekday-label="${escapeHtml(weekdayLabelText)}" data-duration-minutes="${escapeHtml(durationMinutes)}">Scegli intervallo</button>
                    </div>
                </div>
            `);
        });
    }

    function setupDayAccordions() {
        if (isMobileView()) {
            $(".mobile-day-tab").removeClass("active").attr({ "aria-selected": "false", tabindex: "-1" });
            $('.mobile-day-tab[data-day="' + mobileActiveDay + '"]').addClass("active").attr({ "aria-selected": "true", tabindex: "0" });
            $(".day-table").hide().each(function () {
                const day = normalizeText($(this).attr("data-day"));
                const isActive = day === mobileActiveDay;
                const card = $(this).find(".day-card").first();
                $(this).toggleClass("mobile-active", isActive).toggle(isActive);
                card.removeClass("is-collapsed");
                $(this).find(".day-toggle").attr("aria-expanded", isActive ? "true" : "false");
            });
            $(".room-timeline-wrap").addClass("hidden");
            $(".room-cards-layout").addClass("hidden");
            $(".toggle-room-table-btn").attr("aria-expanded", "false").text("Apri vista tabellare");
            return;
        }
        $(".mobile-day-tab").attr({ "aria-selected": "false", tabindex: "-1" });
        $(".room-timeline-wrap").addClass("hidden");
        $(".room-cards-layout").removeClass("hidden");
        $(".toggle-room-table-btn").attr("aria-expanded", "false").text("Apri vista tabellare");

        const todayDay = getTodayScheduleDay();
        $(".day-table").show().removeClass("mobile-active").each(function () {
            const day = normalizeText($(this).attr("data-day"));
            const isToday = day === todayDay;
            const card = $(this).find(".day-card").first();
            card.toggleClass("is-collapsed", !isToday);
            $(this).find(".day-toggle").attr("aria-expanded", isToday ? "true" : "false");
        });
    }

    function refreshData() {
        $.get("load.php", function (response) {
            ordinaryBookings = Array.isArray(response.ordinary) ? response.ordinary : [];
            recoveryBookings = Array.isArray(response.recoveries) ? response.recoveries : [];
            renderCalendar();
            renderRecoveriesTable();
            showAdminTodaySummaryIfNeeded();
        }, "json").fail(function (jqXHR) {
            if (jqXHR.status === 401) {
                setLoggedOutState();
                return;
            }
            let message = "Errore durante il caricamento.";
            if (jqXHR.responseJSON && jqXHR.responseJSON.message) message = jqXHR.responseJSON.message;
            showNotification(message);
        });
    }

    function setLoggedInState(user) {
        currentUser = user || null;
        adminSummaryShown = false;
        mobileActiveDay = getTodayScheduleDay();
        $("#login-section").addClass("hidden");
        $("#app-section").removeClass("hidden");
        $("#user-panel").removeClass("hidden");
        $("#user-display-name").text(currentUser.displayName || currentUser.username || "");
        $("#user-role-label").text(currentUser.role === "admin" ? "Segreteria / Admin" : "Docente");
        $("#ordinary-teacher-name").val(currentUser.displayName || "");
        $("#recovery-teacher-name").val(currentUser.displayName || "");
        setAdminButtonsVisibility();
        refreshData();
    }

    function setLoggedOutState() {
        currentUser = null;
        adminSummaryShown = false;
        mobileActiveDay = getTodayScheduleDay();
        ordinaryBookings = [];
        recoveryBookings = [];
        resetRecoveryState();
        $("#app-section").addClass("hidden");
        $("#user-panel").addClass("hidden");
        $("#login-section").removeClass("hidden");
        $("#user-display-name, #user-role-label").text("");
        adminUsers = [];
        setAdminButtonsVisibility();
        closeModalState();
        $("#username, #password").val("");
        days.forEach(function (day) {
            $("#day-date-" + day).text("");
            $("#day-content-" + day).empty();
        });
        $("#recoveries-table tbody").html('<tr><td colspan="7" class="empty-summary">Nessun recupero presente.</td></tr>');
    }

    function checkSession() {
        $.get("whoami.php", function (response) {
            if (response && response.loggedIn && response.user) {
                setLoggedInState(response.user);
            } else {
                setLoggedOutState();
            }
        }, "json").fail(function () {
            setLoggedOutState();
        });
    }

    $("#login-form").on("submit", function (event) {
        event.preventDefault();
        $.post("login.php", { username: $("#username").val(), password: $("#password").val() }, function (response) {
            if (response.status === "success" && response.user) {
                $("#login-form")[0].reset();
                setLoggedInState(response.user);
            } else {
                showNotification(response.message || "Errore di accesso.");
            }
        }, "json").fail(function (jqXHR) {
            let message = "Errore di accesso.";
            if (jqXHR.responseJSON && jqXHR.responseJSON.message) message = jqXHR.responseJSON.message;
            showNotification(message);
        });
    });

    $("#logout-btn").on("click", function () {
        $.post("logout.php", {}, function () {
            setLoggedOutState();
        }, "json").fail(function () {
            setLoggedOutState();
        });
    });


    $("#change-password-btn").on("click", function () {
        openChangePasswordModal(this);
    });

    $("#change-password-form").on("submit", function (event) {
        event.preventDefault();

        const currentPassword = $("#change-password-current").val();
        const newPassword = $("#change-password-new").val();
        const confirmPassword = $("#change-password-confirm").val();

        if (!currentPassword || !newPassword || !confirmPassword) {
            showNotification("Compila tutti i campi della password.");
            return;
        }

        if (newPassword.length < 8) {
            showNotification("La nuova password deve contenere almeno 8 caratteri.");
            return;
        }

        if (newPassword !== confirmPassword) {
            showNotification("La conferma della nuova password non coincide.");
            return;
        }

        $.post("change_password.php", {
            currentPassword: currentPassword,
            newPassword: newPassword
        }, function (response) {
            if (response && response.status === "success") {
                closeModal("#change-password-modal");
                clearChangePasswordForm();
                showNotification(response.message || "Password aggiornata con successo.");
                return;
            }
            showNotification((response && response.message) || "Errore durante l'aggiornamento della password.");
        }, "json").fail(function (jqXHR) {
            let message = "Errore durante l'aggiornamento della password.";
            if (jqXHR && jqXHR.responseJSON && jqXHR.responseJSON.message) message = jqXHR.responseJSON.message;
            showNotification(message);
        });
    });

    $("#admin-add-user-btn").on("click", function () {
        openAdminUserModal("add", this);
    });

    $("#admin-remove-user-btn").on("click", function () {
        openAdminUserModal("remove", this);
    });

    $("#admin-recover-credentials-btn").on("click", function () {
        openResetPasswordModal(this);
    });

    $("#admin-remove-user-search").on("input", function () {
        renderRemoveUserList();
    });

    $("#admin-credentials-search").on("input", function () {
        renderResetPasswordUserList();
    });

    $("#admin-credentials-select").on("change", function () {
        fillResetPasswordFields(null);
    });

    $("#admin-reset-password-form").on("submit", function (event) {
        event.preventDefault();

        const username = normalizeText($("#admin-credentials-select").val());
        if (!username) {
            showNotification("Seleziona un utente.");
            return;
        }

        const selectedUser = adminUsers.find(function (user) {
            return String(user.username) === String(username);
        });
        const displayLabel = selectedUser ? (selectedUser.displayName || selectedUser.username) : username;

        showConfirm("Vuoi recuperare le credenziali dell’utente \"" + displayLabel + "\"? Verrà generata una password temporanea.", function () {
            $.post("get_user_credentials.php", { username: username }, function (response) {
                if (response && response.status === "success") {
                    fillResetPasswordFields(response);
                    return;
                }
                showNotification((response && response.message) || "Errore durante il recupero credenziali.");
            }, "json").fail(function (jqXHR) {
                let message = "Errore durante il recupero credenziali.";
                if (jqXHR.responseJSON && jqXHR.responseJSON.message) message = jqXHR.responseJSON.message;
                showNotification(message);
            });
        });
    });

    $("#admin-user-form").on("submit", function (event) {
        event.preventDefault();
        const mode = normalizeText($("#admin-user-mode").val());

        if (mode === "remove") {
            const username = normalizeText($("#admin-remove-user-select").val());
            if (!username) {
                showNotification("Seleziona un utente da rimuovere.");
                return;
            }

            const selectedUser = adminUsers.find(function (user) {
                return String(user.username) === String(username);
            });
            const displayLabel = selectedUser ? (selectedUser.displayName || selectedUser.username) : username;

            showConfirm('Vuoi rimuovere l\'utente "' + displayLabel + '"?', function () {
                $.post("remove_user.php", { username: username }, function (response) {
                    if (response && response.status === "success") {
                        closeModal("#admin-user-modal");
                        loadAdminUsers();
                        showNotification(response.message || "Utente rimosso con successo.");
                        return;
                    }
                    showNotification((response && response.message) || "Errore durante la rimozione utente.");
                }, "json").fail(function (jqXHR) {
                    let message = "Errore durante la rimozione utente.";
                    if (jqXHR.responseJSON && jqXHR.responseJSON.message) message = jqXHR.responseJSON.message;
                    showNotification(message);
                });
            });
            return;
        }

        const displayName = normalizeText($("#admin-user-display-name").val());
        const username = normalizeText($("#admin-user-username").val()).toLowerCase();
        const password = String($("#admin-user-password").val() || "").trim();
        const role = normalizeText($("#admin-user-role").val());

        if (!displayName || !username || !password || !role) {
            showNotification("Compila tutti i campi utente.");
            return;
        }

        if (password.length < 8) {
            showNotification("La password iniziale deve contenere almeno 8 caratteri.");
            return;
        }

        $.post("add_user.php", {
            displayName: displayName,
            username: username,
            password: password,
            role: role
        }, function (response) {
            if (response && response.status === "success") {
                closeModal("#admin-user-modal");
                clearAdminUserForm();
                loadAdminUsers();
                showNotification(response.message || "Utente aggiunto con successo.");
                return;
            }
            showNotification((response && response.message) || "Errore durante il salvataggio utente.");
        }, "json").fail(function (jqXHR) {
            let message = "Errore durante il salvataggio utente.";
            if (jqXHR.responseJSON && jqXHR.responseJSON.message) message = jqXHR.responseJSON.message;
            showNotification(message);
        });
    });

    $("#new-recovery-btn").on("click", function () {
        if (!currentUser) {
            showNotification("Devi effettuare il login.");
            return;
        }
        openRecoveryModal(this);
    });

    $(document).on("click", ".add-ordinary-btn", function () {
        if (!currentUser) {
            showNotification("Devi effettuare il login.");
            return;
        }
        openOrdinaryModal(this);
    });


    $(document).on("click", ".room-recovery-btn", function () {
        if (!currentUser) {
            showNotification("Devi effettuare il login.");
            return;
        }
        const sala = normalizeText($(this).attr("data-sala"));
        openRecoveryModal(this, { sala: sala });
    });

    $(document).on("click", ".toggle-room-table-btn", function () {
        const button = $(this);
        const section = button.closest(".room-section");
        const tableWrap = section.find(".room-timeline-wrap").first();
        const cardsLayout = section.find(".room-cards-layout").first();
        const willOpen = tableWrap.hasClass("hidden");
        tableWrap.toggleClass("hidden", !willOpen);
        cardsLayout.toggleClass("hidden", willOpen);
        button.attr("aria-expanded", willOpen ? "true" : "false");
        button.text(willOpen ? "Chiudi vista tabellare" : "Apri vista tabellare");
    });

    $("#ordinary-form").on("submit", function (event) {
        event.preventDefault();
        const day = normalizeText($("#ordinary-day-key").val());
        const sala = normalizeText($("#ordinary-room-key").val());
        const intervalStart = normalizeTime($("#ordinary-interval-start").val());
        const intervalEnd = normalizeTime($("#ordinary-interval-end").val());
        const startTime = colonToDot($("#ordinary-start-time").val());
        const durationMinutes = parseInt($("#ordinary-duration").val(), 10) || 0;
        const courseName = normalizeText($("#ordinary-course-name").val());

        if (!courseName) {
            showNotification("Inserisci il nome del corso.");
            return;
        }

        const validation = validateStartWithinInterval(startTime, durationMinutes, intervalStart, intervalEnd);
        if (!validation.ok) {
            showNotification(validation.message);
            return;
        }

        $.post("save_ordinary.php", {
            table: day,
            sala: sala,
            startTime: startTime,
            durationMinutes: durationMinutes,
            courseName: courseName
        }, function (response) {
            if (response.status === "success") {
                closeModal("#ordinary-modal");
                $("#ordinary-form")[0].reset();
                refreshData();
            } else {
                showNotification(response.message || "Errore durante il salvataggio.");
            }
        }, "json").fail(function (jqXHR) {
            let message = "Errore durante il salvataggio.";
            if (jqXHR.responseJSON && jqXHR.responseJSON.message) message = jqXHR.responseJSON.message;
            showNotification(message);
        });
    });

    $("#recovery-search-form").on("submit", function (event) {
        event.preventDefault();
        const courseName = normalizeText($("#recovery-course-name").val());
        const lessonDate = normalizeText($("#recovery-date").val());
        const durationMinutes = parseInt($("#recovery-duration").val(), 10) || 0;

        if (!courseName) {
            showNotification("Inserisci il nome del corso.");
            return;
        }
        if (!lessonDate) {
            showNotification("Inserisci la data del recupero.");
            return;
        }

        $.post("check_recovery_availability.php", {
            lessonDate: lessonDate,
            durationMinutes: durationMinutes
        }, function (response) {
            if (response.status !== "success") {
                showNotification(response.message || "Errore durante il controllo disponibilità.");
                return;
            }
            $("#availability-box").removeClass("hidden");
            const preferredRoom = normalizeText($("#recovery-preferred-room").val());
            $("#availability-caption").text("Data selezionata: " + lessonDate + " · " + response.weekdayLabel + " · durata richiesta: " + formatDuration(durationMinutes) + (preferredRoom ? " · aula: " + preferredRoom : ""));
            renderRecoveryAvailability(Array.isArray(response.intervals) ? response.intervals : [], lessonDate, response.weekdayLabel, durationMinutes);
        }, "json").fail(function (jqXHR) {
            let message = "Errore durante il controllo disponibilità.";
            if (jqXHR.responseJSON && jqXHR.responseJSON.message) message = jqXHR.responseJSON.message;
            showNotification(message);
        });
    });

    $(document).on("click", ".choose-recovery-interval-btn", function () {
        pendingRecoverySelection = {
            sala: normalizeText($(this).attr("data-sala")),
            intervalStart: normalizeTime($(this).attr("data-interval-start")),
            intervalEnd: normalizeTime($(this).attr("data-interval-end")),
            lessonDate: normalizeText($(this).attr("data-lesson-date")),
            weekdayLabel: normalizeText($(this).attr("data-weekday-label")),
            durationMinutes: parseInt($(this).attr("data-duration-minutes"), 10) || 0
        };

        $("#selected-recovery-interval-label").text(
            pendingRecoverySelection.weekdayLabel + " · " + pendingRecoverySelection.lessonDate + " · " + pendingRecoverySelection.sala + " · disponibilità " + dotToColon(pendingRecoverySelection.intervalStart) + "–" + dotToColon(pendingRecoverySelection.intervalEnd)
        );
        $("#recovery-room-label").val(pendingRecoverySelection.sala);
        $("#recovery-start-time").val(dotToColon(pendingRecoverySelection.intervalStart));
        $("#recovery-booking-box").removeClass("hidden");
    });

    $("#save-recovery-btn").on("click", function () {
        const courseName = normalizeText($("#recovery-course-name").val());
        const lessonDate = normalizeText($("#recovery-date").val());
        const startTime = colonToDot($("#recovery-start-time").val());

        if (!pendingRecoverySelection) {
            showNotification("Seleziona prima un intervallo disponibile.");
            return;
        }

        const validation = validateStartWithinInterval(
            startTime,
            pendingRecoverySelection.durationMinutes,
            pendingRecoverySelection.intervalStart,
            pendingRecoverySelection.intervalEnd
        );
        if (!validation.ok) {
            showNotification(validation.message);
            return;
        }

        $.post("save_recovery.php", {
            courseName: courseName,
            lessonDate: lessonDate,
            sala: pendingRecoverySelection.sala,
            startTime: startTime,
            durationMinutes: pendingRecoverySelection.durationMinutes
        }, function (response) {
            if (response.status === "success") {
                closeModal("#recovery-modal");
                resetRecoveryState();
                refreshData();
            } else {
                showNotification(response.message || "Errore durante il salvataggio del recupero.");
            }
        }, "json").fail(function (jqXHR) {
            let message = "Errore durante il salvataggio del recupero.";
            if (jqXHR.responseJSON && jqXHR.responseJSON.message) message = jqXHR.responseJSON.message;
            showNotification(message);
        });
    });

    $(document).on("click", ".delete-ordinary-btn", function () {
        const bookingId = $(this).attr("data-booking-id");
        const booking = ordinaryBookings.find(function (item) {
            return String(item.bookingId) === String(bookingId);
        });
        if (!booking) {
            showNotification("Prenotazione non trovata.");
            return;
        }

        showConfirm(
            'Vuoi eliminare la lezione ordinaria "' + (booking.courseName || "") + '"?',
            function () {
                $.post("delete_ordinary.php", { bookingId: bookingId }, function (response) {
                    if (response.status === "success") {
                        refreshData();
                    } else {
                        showNotification(response.message || "Errore durante l’eliminazione.");
                    }
                }, "json").fail(function (jqXHR) {
                    let message = "Errore durante l’eliminazione.";
                    if (jqXHR.responseJSON && jqXHR.responseJSON.message) message = jqXHR.responseJSON.message;
                    showNotification(message);
                });
            }
        );
    });

    $(document).on("click", ".delete-recovery-btn", function () {
        const bookingId = $(this).attr("data-booking-id");
        const booking = recoveryBookings.find(function (item) {
            return String(item.bookingId) === String(bookingId);
        });
        if (!booking) {
            showNotification("Recupero non trovato.");
            return;
        }

        showConfirm(
            'Vuoi eliminare il recupero "' + (booking.courseName || "") + '" del ' + booking.lessonDate + '?',
            function () {
                $.ajax({
                    url: "delete_recovery.php",
                    method: "POST",
                    dataType: "json",
                    data: { bookingId: bookingId },
                    success: function (response) {
                        if (response.status === "success") {
                            refreshData();
                        } else {
                            showNotification(response.message || "Errore durante l’eliminazione del recupero.");
                        }
                    },
                    error: function (jqXHR) {
                        let message = "Errore durante l’eliminazione del recupero.";
                        if (jqXHR.responseJSON && jqXHR.responseJSON.message) message = jqXHR.responseJSON.message;
                        showNotification(message);
                    }
                });
            }
        );
    });

    $("#close-ordinary-modal").on("click", function () { closeModal("#ordinary-modal"); });
    $("#close-recovery-modal").on("click", function () { closeModal("#recovery-modal"); resetRecoveryState(); });
    $("#close-change-password-modal, #cancel-change-password-btn").on("click", function () { closeModal("#change-password-modal"); clearChangePasswordForm(); });
    $("#close-admin-user-modal").on("click", function () { closeModal("#admin-user-modal"); });
    $("#close-admin-credentials-modal, #close-admin-credentials-btn").on("click", function () { closeModal("#admin-reset-password-modal"); });
    $("#close-notification").on("click", function () { closeModal("#notification-modal"); });
    $("#close-admin-summary-modal, #close-admin-summary-btn").on("click", function () { closeModal("#admin-summary-modal"); });

    $(window).on("click", function (event) {
        if ($(event.target).is($("#ordinary-modal"))) closeModal("#ordinary-modal");
        if ($(event.target).is($("#recovery-modal"))) { closeModal("#recovery-modal"); resetRecoveryState(); }
        if ($(event.target).is($("#change-password-modal"))) closeModal("#change-password-modal");
        if ($(event.target).is($("#admin-user-modal"))) closeModal("#admin-user-modal");
        if ($(event.target).is($("#admin-reset-password-modal"))) closeModal("#admin-reset-password-modal");
        if ($(event.target).is($("#confirm-modal"))) closeModal("#confirm-modal");
        if ($(event.target).is($("#notification-modal"))) closeModal("#notification-modal");
        if ($(event.target).is($("#admin-summary-modal"))) closeModal("#admin-summary-modal");
    });

    $(document).on("keydown", function (event) {
        if (!activeModalSelector) return;
        const modal = $(activeModalSelector);
        if (!modal.length || modal.hasClass("hidden")) return;

        if (event.key === "Escape") {
            event.preventDefault();
            if (activeModalSelector === "#recovery-modal") resetRecoveryState();
            closeModal(activeModalSelector);
            return;
        }

        if (event.key !== "Tab") return;
        const focusable = getFocusableElements(modal);
        if (!focusable.length) {
            event.preventDefault();
            return;
        }

        const first = focusable.get(0);
        const last = focusable.get(focusable.length - 1);
        const active = document.activeElement;
        if (event.shiftKey && active === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && active === last) {
            event.preventDefault();
            first.focus();
        }
    });

    $(document).on("click", ".day-toggle", function (event) {
        const dayTable = $(this).closest(".day-table");
        const day = normalizeText(dayTable.attr("data-day"));
        if (isMobileView()) {
            event.preventDefault();
            mobileActiveDay = day;
            setupDayAccordions();
            return;
        }

        const card = $(this).closest(".day-card");
        const isCollapsed = card.hasClass("is-collapsed");
        card.toggleClass("is-collapsed", !isCollapsed);
        $(this).attr("aria-expanded", isCollapsed ? "true" : "false");
    });

    $(document).on("click", ".mobile-day-tab", function () {
        mobileActiveDay = normalizeText($(this).attr("data-day"));
        setupDayAccordions();
    });

    $(window).on("resize", function () {
        setupDayAccordions();
    });

    mobileActiveDay = getTodayScheduleDay();
    setupDayAccordions();
    checkSession();
});
