(function ($) {
    const days = ["lunedi", "martedi", "mercoledi", "giovedi", "venerdi"];
    const sale = ["Semibreve", "Minima", "Semiminima", "Croma"];
    const dayIndexMap = { lunedi: 1, martedi: 2, mercoledi: 3, giovedi: 4, venerdi: 5 };
    const dayLabels = {
        lunedi: "Lunedì",
        martedi: "Martedì",
        mercoledi: "Mercoledì",
        giovedi: "Giovedì",
        venerdi: "Venerdì"
    };
    const DAY_START_MINUTES = 15 * 60;
    const DAY_END_MINUTES = 20 * 60 + 30;

    function normalizeText(value) {
        return $.trim(String(value || "")).replace(/\s+/g, " ");
    }

    function normalizeTime(value) {
        const raw = normalizeText(value).replace(/^ore\s+/i, "").replace(":", ".");
        const match = raw.match(/^(\d{1,2})\.(\d{2})$/);
        if (!match) return raw;
        return match[1].padStart(2, "0") + "." + match[2];
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

    function minutesToColon(minutes) {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
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

        if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
            return null;
        }

        return {
            startMinutes: start,
            endMinutes: end,
            durationMinutes: end - start
        };
    }

    function normalizeLoadedBooking(raw, typeOverride) {
        const booking = $.extend({}, raw || {});
        const bounds = getBookingBounds(booking);
        if (!bounds) return null;
        booking.lessonType = typeOverride || booking.lessonType || "ordinaria";
        booking.startMinutes = bounds.startMinutes;
        booking.endMinutes = bounds.endMinutes;
        booking.durationMinutes = bounds.durationMinutes;
        return booking;
    }

    function getDisplayedDayBookings(day, dateIso, ordinaryBookings, recoveryBookings) {
        const ordinary = (ordinaryBookings || [])
            .filter(function (booking) { return normalizeText(booking.table) === day; })
            .map(function (booking) { return normalizeLoadedBooking(booking, "ordinaria"); })
            .filter(Boolean);

        const recoveries = (recoveryBookings || [])
            .filter(function (booking) {
                return normalizeText(booking.table) === day && normalizeText(booking.lessonDate) === dateIso;
            })
            .map(function (booking) { return normalizeLoadedBooking(booking, "recupero"); })
            .filter(Boolean);

        return ordinary.concat(recoveries).sort(function (a, b) {
            if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
            return a.endMinutes - b.endMinutes;
        });
    }

    function buildRoomSegments(day, dateIso, ordinaryBookings, recoveryBookings) {
        const bookings = getDisplayedDayBookings(day, dateIso, ordinaryBookings, recoveryBookings);
        const result = {};

        sale.forEach(function (sala) {
            const roomBookings = bookings
                .filter(function (booking) {
                    return normalizeText(booking.sala) === normalizeText(sala);
                })
                .sort(function (a, b) {
                    if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
                    return a.endMinutes - b.endMinutes;
                });

            const segments = [];
            let cursor = DAY_START_MINUTES;

            roomBookings.forEach(function (booking) {
                const bookingStart = Math.max(DAY_START_MINUTES, booking.startMinutes);
                const bookingEnd = Math.min(DAY_END_MINUTES, booking.endMinutes);
                if (bookingEnd <= DAY_START_MINUTES || bookingStart >= DAY_END_MINUTES || bookingEnd <= bookingStart) {
                    return;
                }

                if (bookingStart > cursor) {
                    segments.push({
                        type: "free",
                        startMinutes: cursor,
                        endMinutes: bookingStart,
                        durationMinutes: bookingStart - cursor
                    });
                }

                if (bookingStart < cursor) {
                    return;
                }

                segments.push({
                    type: normalizeText(booking.lessonType) === "recupero" ? "recovery" : "ordinary",
                    startMinutes: bookingStart,
                    endMinutes: bookingEnd,
                    durationMinutes: bookingEnd - bookingStart,
                    courseName: booking.courseName || "Lezione",
                    teacherName: booking.teacherName || "",
                    lessonType: normalizeText(booking.lessonType) === "recupero" ? "Recupero" : "Ordinaria"
                });

                cursor = bookingEnd;
            });

            if (cursor < DAY_END_MINUTES) {
                segments.push({
                    type: "free",
                    startMinutes: cursor,
                    endMinutes: DAY_END_MINUTES,
                    durationMinutes: DAY_END_MINUTES - cursor
                });
            }

            result[sala] = segments;
        });

        return result;
    }

    function notify(message) {
        if (typeof window.showNotification === "function") {
            window.showNotification(message);
            return;
        }
        const modalMessage = document.getElementById("notification-message");
        const modal = document.getElementById("notification-modal");
        if (modalMessage && modal) {
            modalMessage.textContent = message;
            modal.classList.remove("hidden");
            modal.setAttribute("aria-hidden", "false");
            document.body.classList.add("modal-open");
            return;
        }
        window.alert(message);
    }

    function setLoading($button, isLoading) {
        if (!$button || !$button.length) return;
        if (!$button.data("original-label")) {
            $button.data("original-label", $button.text());
        }
        $button.toggleClass("is-loading", !!isLoading);
        $button.prop("disabled", !!isLoading);
        $button.text(isLoading ? "Preparazione PDF..." : $button.data("original-label"));
    }

    function getSegmentPalette(type) {
        if (type === "free") {
            return {
                fill: [240, 253, 244],
                border: [134, 239, 172],
                title: [22, 101, 52],
                body: [22, 101, 52]
            };
        }
        if (type === "recovery") {
            return {
                fill: [255, 247, 237],
                border: [253, 186, 116],
                title: [154, 52, 18],
                body: [124, 45, 18]
            };
        }
        return {
            fill: [239, 246, 255],
            border: [191, 219, 254],
            title: [30, 64, 175],
            body: [30, 64, 175]
        };
    }

    function drawWrappedText(doc, lines, x, y, width, lineHeight, maxBottom) {
        let cursorY = y;
        lines.forEach(function (line) {
            const safeLine = String(line || "");
            const wrapped = doc.splitTextToSize(safeLine, width);
            wrapped.forEach(function (wrappedLine) {
                if (cursorY + lineHeight > maxBottom) return;
                doc.text(wrappedLine, x, cursorY);
                cursorY += lineHeight;
            });
        });
        return cursorY;
    }

    function drawSegment(doc, segment, x, y, width, height) {
        const palette = getSegmentPalette(segment.type);
        const innerPadX = 2.4;
        const innerPadY = 2.2;
        const bottomLimit = y + height - innerPadY;

        doc.setFillColor.apply(doc, palette.fill);
        doc.setDrawColor.apply(doc, palette.border);
        doc.roundedRect(x, y, width, height, 1.8, 1.8, "FD");

        const slotLabel = minutesToColon(segment.startMinutes) + "–" + minutesToColon(segment.endMinutes);

        if (segment.type === "free") {
            if (height < 9) {
                doc.setFont("helvetica", "bold");
                doc.setFontSize(7);
                doc.setTextColor.apply(doc, palette.title);
                doc.text(slotLabel + "  Libero", x + innerPadX, y + (height / 2) + 1);
                return;
            }

            doc.setFont("helvetica", "bold");
            doc.setFontSize(height < 16 ? 7.5 : 8.5);
            doc.setTextColor.apply(doc, palette.title);
            doc.text("Libero", x + innerPadX, y + innerPadY + 3);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(7);
            doc.setTextColor.apply(doc, palette.body);
            drawWrappedText(doc, [slotLabel], x + innerPadX, y + innerPadY + 7.5, width - (innerPadX * 2), 3.2, bottomLimit);
            return;
        }

        const compact = height < 14;
        const veryCompact = height < 10;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(veryCompact ? 6.5 : compact ? 7 : 8.5);
        doc.setTextColor.apply(doc, palette.title);
        let currentY = y + innerPadY + (veryCompact ? 2.8 : 3.4);
        currentY = drawWrappedText(doc, [segment.courseName || "Lezione"], x + innerPadX, currentY, width - (innerPadX * 2), veryCompact ? 2.8 : 3.4, bottomLimit);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(veryCompact ? 5.8 : compact ? 6.4 : 7);
        doc.setTextColor.apply(doc, palette.body);
        drawWrappedText(doc, [segment.teacherName || "", segment.lessonType + " · " + slotLabel], x + innerPadX, currentY + 0.6, width - (innerPadX * 2), veryCompact ? 2.6 : 3.1, bottomLimit);
    }

    function generatePdf(day, referenceDate, roomSegments) {
        const jsPDF = window.jspdf && window.jspdf.jsPDF;
        if (!jsPDF || typeof window.jspdf.jsPDF !== "function") {
            throw new Error("Libreria PDF non disponibile.");
        }

        const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const marginX = 12;
        const topY = 14;
        const totalDuration = DAY_END_MINUTES - DAY_START_MINUTES;
        const dateLabel = formatDateShort(referenceDate);
        const title = "Disponibilità aule - " + dayLabels[day];

        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.text(title, marginX, topY);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(71, 85, 105);
        doc.text("Data: " + dateLabel + " · Copertura completa 15:00–20:30", marginX, topY + 7);
        doc.text("Vista PDF basata sulla stessa segmentazione della vista tabellare.", marginX, topY + 13);

        const gridTop = topY + 20;
        const gridHeight = pageHeight - gridTop - 12;
        const gap = 4;
        const columnWidth = (pageWidth - (marginX * 2) - (gap * (sale.length - 1))) / sale.length;

        sale.forEach(function (sala, index) {
            const x = marginX + index * (columnWidth + gap);
            const y = gridTop;
            const headerHeight = 12;
            const bodyY = y + headerHeight;
            const bodyHeight = gridHeight - headerHeight;
            const segments = roomSegments[sala] || [];

            doc.setFillColor(29, 78, 216);
            doc.setDrawColor(191, 219, 254);
            doc.roundedRect(x, y, columnWidth, gridHeight, 2.5, 2.5, "FD");
            doc.setFillColor(255, 255, 255);
            doc.rect(x + 0.2, bodyY, columnWidth - 0.4, bodyHeight - 0.2, "F");

            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(255, 255, 255);
            doc.text(sala, x + 3, y + 7.5);

            let currentY = bodyY + 1.2;
            segments.forEach(function (segment, segmentIndex) {
                const rawHeight = (segment.durationMinutes / totalDuration) * (bodyHeight - 2.4);
                const nextY = segmentIndex === segments.length - 1 ? (bodyY + bodyHeight - 1.2) : (currentY + rawHeight);
                const segmentHeight = Math.max(6, nextY - currentY);
                drawSegment(doc, segment, x + 1.2, currentY, columnWidth - 2.4, segmentHeight);
                currentY += rawHeight;
            });
        });

        const fileDate = formatDateIso(referenceDate);
        const fileName = ("aule-" + day + "-" + fileDate + ".pdf").toLowerCase();
        doc.save(fileName);
    }

    function exportDayPdf(day, buttonEl) {
        const $button = $(buttonEl || []);
        const referenceDates = getReferenceDatesByDay();
        const referenceDate = referenceDates[day];
        if (!referenceDate) {
            notify("Giorno non valido per l'esportazione.");
            return;
        }

        setLoading($button, true);
        $.ajax({
            url: "load.php",
            method: "GET",
            dataType: "json"
        }).done(function (response) {
            const ordinaryBookings = Array.isArray(response.ordinary) ? response.ordinary : [];
            const recoveryBookings = Array.isArray(response.recoveries) ? response.recoveries : [];
            const dateIso = formatDateIso(referenceDate);
            const roomSegments = buildRoomSegments(day, dateIso, ordinaryBookings, recoveryBookings);
            generatePdf(day, referenceDate, roomSegments);
        }).fail(function (jqXHR) {
            let message = "Errore durante la generazione del PDF.";
            if (jqXHR && jqXHR.responseJSON && jqXHR.responseJSON.message) {
                message = jqXHR.responseJSON.message;
            } else if (jqXHR && jqXHR.status === 401) {
                message = "Devi effettuare il login per scaricare il PDF.";
            }
            notify(message);
        }).always(function () {
            setLoading($button, false);
        });
    }

    $(document).on("click", ".export-day-pdf-btn", function () {
        const day = normalizeText($(this).attr("data-day"));
        exportDayPdf(day, this);
    });

    window.calendarPdfExport = {
        exportDayPdf: exportDayPdf
    };
})(jQuery);
