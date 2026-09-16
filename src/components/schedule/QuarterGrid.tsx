import { useMemo } from 'react'
import { TimeBlock } from '@/types'
import {
    dayKey, durationMinutes, formatDuration, getZonedParts, isSameDay, monthGridDays, monthLabel
} from '@/utils/datetime'

/** Vista de trimestre: los tres meses juntos.
 *
 *  A este tamaño no caben los nombres de los pendientes, y forzarlos daría una
 *  pared de texto ilegible. Lo que sí se lee es la **carga**: cada día se
 *  pinta más oscuro cuantas más horas tiene reservadas, así que de un vistazo
 *  se ven las semanas apretadas y los huecos. Es para planificar de lejos, no
 *  para trabajar el día.
 *
 *  Un clic en cualquier día lleva a esa semana. */

const WEEKDAY_INITIALS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

/** Horas a partir de las cuales un día se considera lleno. */
const FULL_DAY_MINUTES = 6 * 60

type Props = {
    months: Date[]
    timezone: string
    blocks: TimeBlock[]
    showWeekends: boolean
    onOpenDay: (day: Date) => void
}

export default function QuarterGrid({
    months, timezone, blocks, showWeekends, onOpenDay
}: Props) {
    const now = useMemo(() => new Date(), [])

    const minutesByDay = useMemo(() => {
        const map = new Map<string, { minutes: number, count: number }>()
        for (const block of blocks) {
            const key = dayKey(new Date(block.start), timezone)
            const current = map.get(key) ?? { minutes: 0, count: 0 }
            current.minutes += durationMinutes(block.start, block.end)
            current.count += 1
            map.set(key, current)
        }
        return map
    }, [blocks, timezone])

    const columns = showWeekends ? 7 : 5

    return (
        <div className="p-3">
            <div className="grid gap-4 lg:grid-cols-3">
                {months.map(month => {
                    const monthNumber = getZonedParts(month, timezone).month
                    const days = monthGridDays(month, timezone).filter(day => {
                        if (showWeekends) return true
                        const weekday = new Date(day).getUTCDay()
                        return weekday !== 0 && weekday !== 6
                    })

                    const monthMinutes = days.reduce((sum, day) => {
                        if (getZonedParts(day, timezone).month !== monthNumber) return sum
                        return sum + (minutesByDay.get(dayKey(day, timezone))?.minutes ?? 0)
                    }, 0)

                    return (
                        <section key={month.toISOString()}>
                            <header className="flex items-baseline justify-between mb-1.5 px-0.5">
                                <h3 className="text-xs font-bold text-ink capitalize">
                                    {monthLabel(month, timezone)}
                                </h3>
                                <span className="text-2xs text-ink-subtle tabular">
                                    {monthMinutes > 0 ? formatDuration(monthMinutes) : '—'}
                                </span>
                            </header>

                            <div
                                className="grid gap-px"
                                style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
                            >
                                {WEEKDAY_INITIALS.slice(0, columns).map((initial, index) => (
                                    <div
                                        key={index}
                                        className="text-center text-2xs font-semibold text-ink-subtle pb-1"
                                    >
                                        {initial}
                                    </div>
                                ))}

                                {days.map(day => {
                                    const key = dayKey(day, timezone)
                                    const parts = getZonedParts(day, timezone)
                                    const outside = parts.month !== monthNumber
                                    const today = isSameDay(day, now, timezone)
                                    const load = minutesByDay.get(key)
                                    const minutes = load?.minutes ?? 0

                                    // La intensidad dice cuánto hay reservado. El texto
                                    // del título lo cuenta en palabras, porque el color
                                    // solo no debería ser la única fuente.
                                    const ratio = Math.min(1, minutes / FULL_DAY_MINUTES)
                                    const background = minutes === 0
                                        ? undefined
                                        : `rgba(112, 40, 232, ${0.12 + ratio * 0.5})`
                                    const strong = ratio > 0.55

                                    return (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => onOpenDay(day)}
                                            title={minutes === 0
                                                ? `${parts.day}/${parts.month}: sin nada programado`
                                                : `${parts.day}/${parts.month}: ${formatDuration(minutes)} en ${load!.count} bloque(s)`}
                                            className={`aspect-square grid place-content-center rounded text-2xs
                                                tabular transition-colors ${
                                                outside ? 'opacity-35' : ''
                                            } ${
                                                today ? 'ring-1 ring-brand-600 font-bold' : ''
                                            } ${
                                                minutes === 0
                                                    ? 'text-ink-subtle hover:bg-slate-100'
                                                    : strong
                                                        ? 'text-white font-semibold'
                                                        : 'text-ink font-semibold'
                                            }`}
                                            style={{ backgroundColor: background }}
                                        >
                                            {parts.day}
                                        </button>
                                    )
                                })}
                            </div>
                        </section>
                    )
                })}
            </div>

            <p className="flex items-center gap-2 mt-4 text-2xs text-ink-subtle">
                Carga del día
                <span className="flex items-center gap-0.5">
                    {[0, 0.25, 0.5, 0.75, 1].map(step => (
                        <span
                            key={step}
                            className="w-4 h-3 rounded-sm border border-line"
                            style={{
                                backgroundColor: step === 0
                                    ? undefined
                                    : `rgba(112, 40, 232, ${0.12 + step * 0.5})`
                            }}
                        />
                    ))}
                </span>
                de vacío a {formatDuration(FULL_DAY_MINUTES)} o más · pasa el cursor para ver el detalle
            </p>
        </div>
    )
}
