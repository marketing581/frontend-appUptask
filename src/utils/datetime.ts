/** Conversión entre instantes UTC y hora de pared en la zona de la usuaria.
 *  Los bloques viajan en UTC; la rejilla se dibuja en hora local. */

export const DEFAULT_TIMEZONE = 'America/Lima'
export const SLOT_MINUTES = 15

export interface ZonedParts {
    year: number
    month: number
    day: number
    hour: number
    minute: number
    second: number
}

export function getZonedParts(date: Date, timezone: string): ZonedParts {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    })

    const parts: Record<string, string> = {}
    for (const part of formatter.formatToParts(date)) {
        if (part.type !== 'literal') parts[part.type] = part.value
    }

    return {
        year: Number(parts.year),
        month: Number(parts.month),
        day: Number(parts.day),
        hour: Number(parts.hour) % 24,
        minute: Number(parts.minute),
        second: Number(parts.second)
    }
}

function zoneOffsetMs(date: Date, timezone: string): number {
    const p = getZonedParts(date, timezone)
    const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
    return asIfUtc - date.getTime()
}

export function zonedTimeToUtc(
    year: number, month: number, day: number,
    hour: number, minute: number, timezone: string
): Date {
    const naive = Date.UTC(year, month - 1, day, hour, minute)
    const firstGuess = naive - zoneOffsetMs(new Date(naive), timezone)
    const refined = zoneOffsetMs(new Date(firstGuess), timezone)
    return new Date(naive - refined)
}

/** 1 = lunes ... 7 = domingo, en la zona dada. */
export function zonedWeekday(date: Date, timezone: string): number {
    const p = getZonedParts(date, timezone)
    const jsDay = new Date(Date.UTC(p.year, p.month - 1, p.day, 12)).getUTCDay()
    return jsDay === 0 ? 7 : jsDay
}

/** Lunes 00:00 local de la semana que contiene `date`. */
export function startOfWeek(date: Date, timezone: string): Date {
    const p = getZonedParts(date, timezone)
    const midnight = zonedTimeToUtc(p.year, p.month, p.day, 0, 0, timezone)
    return new Date(midnight.getTime() - (zonedWeekday(date, timezone) - 1) * 86400000)
}

export function addDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * 86400000)
}

export function addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60000)
}

/** Clave estable de día local, para agrupar bloques por columna. */
export function dayKey(date: Date, timezone: string): string {
    const p = getZonedParts(date, timezone)
    return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

export function formatTime(date: Date, timezone: string): string {
    const p = getZonedParts(date, timezone)
    return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`
}

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MONTH_LABELS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export function formatDayHeader(date: Date, timezone: string) {
    const p = getZonedParts(date, timezone)
    return {
        weekday: WEEKDAY_LABELS[zonedWeekday(date, timezone) - 1],
        dayNumber: p.day,
        month: MONTH_LABELS[p.month - 1]
    }
}

export function formatRangeLabel(start: Date, end: Date, timezone: string): string {
    const a = getZonedParts(start, timezone)
    const b = getZonedParts(end, timezone)
    if (a.month === b.month) {
        return `${a.day} – ${b.day} ${MONTH_LABELS[a.month - 1]} ${a.year}`
    }
    return `${a.day} ${MONTH_LABELS[a.month - 1]} – ${b.day} ${MONTH_LABELS[b.month - 1]} ${b.year}`
}

/** Minutos transcurridos desde el inicio de la franja visible. */
export function minutesFromWindowStart(date: Date, timezone: string, windowStartHour: number): number {
    const p = getZonedParts(date, timezone)
    return (p.hour - windowStartHour) * 60 + p.minute
}

export function durationMinutes(start: string | Date, end: string | Date): number {
    return (new Date(end).getTime() - new Date(start).getTime()) / 60000
}

export function formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes} min`
    const hours = Math.floor(minutes / 60)
    const rest = minutes % 60
    return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}

export function isSameDay(a: Date, b: Date, timezone: string): boolean {
    return dayKey(a, timezone) === dayKey(b, timezone)
}

/** Lista de zonas horarias razonables para el selector de preferencias. */
export const TIMEZONE_OPTIONS = [
    'America/Lima',
    'America/Bogota',
    'America/Mexico_City',
    'America/Santiago',
    'America/Buenos_Aires',
    'America/New_York',
    'Europe/Madrid'
]

/* ------------------------------------------------------- Mes y trimestre */

export const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** Primer instante del mes que contiene la fecha, en la zona indicada. */
export function startOfMonth(date: Date, timezone: string): Date {
    const parts = getZonedParts(date, timezone)
    return zonedTimeToUtc(parts.year, parts.month, 1, 0, 0, timezone)
}

export function addMonths(date: Date, months: number, timezone: string): Date {
    const parts = getZonedParts(date, timezone)
    const total = parts.month - 1 + months
    const year = parts.year + Math.floor(total / 12)
    const month = ((total % 12) + 12) % 12 + 1
    return zonedTimeToUtc(year, month, 1, 0, 0, timezone)
}

/** Rejilla de un mes: semanas completas de lunes a domingo, incluidos los
 *  días de los meses vecinos que hagan falta para cuadrarla. Es lo que permite
 *  que todas las filas tengan siete celdas. */
export function monthGridDays(month: Date, timezone: string): Date[] {
    const first = startOfMonth(month, timezone)
    const gridStart = startOfWeek(first, timezone)
    const nextMonth = addMonths(first, 1, timezone)

    const days: Date[] = []
    let cursor = gridStart
    // Se completa hasta cubrir el mes y cerrar la última semana.
    while (cursor < nextMonth || days.length % 7 !== 0) {
        days.push(cursor)
        cursor = addDays(cursor, 1)
        if (days.length > 42) break
    }
    return days
}

/** Los tres meses del trimestre natural al que pertenece la fecha. */
export function quarterMonths(date: Date, timezone: string): Date[] {
    const parts = getZonedParts(date, timezone)
    const firstMonth = Math.floor((parts.month - 1) / 3) * 3 + 1
    const start = zonedTimeToUtc(parts.year, firstMonth, 1, 0, 0, timezone)
    return [0, 1, 2].map(offset => addMonths(start, offset, timezone))
}

export function monthLabel(date: Date, timezone: string): string {
    const parts = getZonedParts(date, timezone)
    return `${MONTH_NAMES[parts.month - 1]} ${parts.year}`
}

export function quarterLabel(date: Date, timezone: string): string {
    const parts = getZonedParts(date, timezone)
    return `T${Math.floor((parts.month - 1) / 3) + 1} ${parts.year}`
}
