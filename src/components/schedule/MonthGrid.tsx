import { useMemo } from 'react'
import { TimeBlock } from '@/types'
import {
    dayKey, durationMinutes, formatDuration, formatTime, getZonedParts, isSameDay, monthGridDays
} from '@/utils/datetime'
import { ALERT_COLOR, getTaskLabel, labelPalette } from '@/utils/taskLabels'
import { firstNameOf, personId } from '@/utils/people'

/** Vista de mes.
 *
 *  Responde otra pregunta que la semana: no «¿a qué hora?» sino «¿cómo viene
 *  el mes?». Por eso cada día muestra los primeros pendientes y cuántos más
 *  hay, en vez de una rejilla horaria que a este tamaño sería ilegible.
 *
 *  Un clic en un día lleva a esa semana, que es donde se coloca la hora. */

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

/** Cuántos bloques caben en una celda antes de resumir el resto. */
const VISIBLE_PER_DAY = 3

type Props = {
    month: Date
    timezone: string
    blocks: TimeBlock[]
    calendarOwnerId: string
    showWeekends: boolean
    onSelectBlock: (block: TimeBlock) => void
    /** Ir a la semana de ese día. */
    onOpenDay: (day: Date) => void
    /** Crear un bloque ese día, a la hora en que suele empezar la jornada. */
    onCreateOn: (day: Date) => void
}

const taskOf = (block: TimeBlock) => (typeof block.task === 'string' ? null : block.task)

function toneOf(block: TimeBlock) {
    const task = taskOf(block)
    if (!task?.status) return '#94a3b8'
    if (task.onHold?.active) return ALERT_COLOR
    return labelPalette[getTaskLabel(task as never)].solid
}

export default function MonthGrid({
    month, timezone, blocks, calendarOwnerId, showWeekends,
    onSelectBlock, onOpenDay, onCreateOn
}: Props) {
    const now = useMemo(() => new Date(), [])
    const days = useMemo(() => monthGridDays(month, timezone), [month, timezone])
    const monthNumber = getZonedParts(month, timezone).month

    const byDay = useMemo(() => {
        const map = new Map<string, TimeBlock[]>()
        for (const block of blocks) {
            const key = dayKey(new Date(block.start), timezone)
            if (!map.has(key)) map.set(key, [])
            map.get(key)!.push(block)
        }
        for (const list of map.values()) {
            list.sort((a, b) => a.start.localeCompare(b.start))
        }
        return map
    }, [blocks, timezone])

    const columns = showWeekends ? 7 : 5
    const visibleDays = showWeekends
        ? days
        : days.filter(day => {
            const weekday = new Date(day).getUTCDay()
            return weekday !== 0 && weekday !== 6
        })

    return (
        <div className="overflow-x-auto">
            <div className="min-w-[44rem]">
                <div
                    className="grid border-b border-line bg-surface-sunken"
                    style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
                >
                    {WEEKDAY_LABELS.slice(0, columns).map(label => (
                        <div key={label} className="px-2 py-1.5 text-center">
                            <span className="eyebrow">{label}</span>
                        </div>
                    ))}
                </div>

                <div
                    className="grid"
                    style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
                >
                    {visibleDays.map(day => {
                        const key = dayKey(day, timezone)
                        const parts = getZonedParts(day, timezone)
                        const dayBlocks = byDay.get(key) ?? []
                        const outside = parts.month !== monthNumber
                        const today = isSameDay(day, now, timezone)
                        const total = dayBlocks.reduce(
                            (sum, block) => sum + durationMinutes(block.start, block.end), 0
                        )

                        return (
                            <div
                                key={key}
                                onClick={() => onCreateOn(day)}
                                className={`min-h-[7rem] border-b border-r border-line p-1 cursor-pointer
                                    transition-colors hover:bg-surface-sunken ${
                                    outside ? 'bg-surface-sunken/60' : ''
                                }`}
                            >
                                <div className="flex items-center justify-between gap-1 px-0.5 mb-1">
                                    <button
                                        type="button"
                                        onClick={event => { event.stopPropagation(); onOpenDay(day) }}
                                        title="Ver esa semana"
                                        className={`w-6 h-6 grid place-content-center rounded-full text-xs
                                            font-semibold tabular transition-colors ${
                                            today
                                                ? 'bg-brand-600 text-white'
                                                : outside
                                                    ? 'text-ink-subtle hover:bg-slate-200'
                                                    : 'text-ink-muted hover:bg-slate-200'
                                        }`}
                                    >
                                        {parts.day}
                                    </button>
                                    {total > 0 && (
                                        <span className="text-2xs text-ink-subtle tabular">
                                            {formatDuration(total)}
                                        </span>
                                    )}
                                </div>

                                <div className="space-y-0.5">
                                    {dayBlocks.slice(0, VISIBLE_PER_DAY).map(block => {
                                        const task = taskOf(block)
                                        const ownerId = personId(block.user)
                                        const borrowed = !!ownerId && ownerId !== calendarOwnerId
                                        return (
                                            <button
                                                key={block._id}
                                                type="button"
                                                onClick={event => {
                                                    event.stopPropagation()
                                                    onSelectBlock(block)
                                                }}
                                                title={`${formatTime(new Date(block.start), timezone)} · ${task?.name ?? ''}${
                                                    borrowed ? ` · compartido por ${firstNameOf(block.user)}` : ''
                                                }`}
                                                className="w-full flex items-center gap-1 px-1 py-0.5 rounded
                                                    text-left hover:bg-slate-100 transition-colors"
                                            >
                                                <span
                                                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                                        borrowed ? 'ring-1 ring-offset-1 ring-ink-subtle' : ''
                                                    }`}
                                                    style={{ backgroundColor: toneOf(block) }}
                                                />
                                                <span className="text-2xs text-ink-subtle tabular shrink-0">
                                                    {formatTime(new Date(block.start), timezone)}
                                                </span>
                                                <span className="text-2xs text-ink truncate">
                                                    {task?.name ?? 'Tarea'}
                                                </span>
                                            </button>
                                        )
                                    })}

                                    {dayBlocks.length > VISIBLE_PER_DAY && (
                                        <button
                                            type="button"
                                            onClick={event => { event.stopPropagation(); onOpenDay(day) }}
                                            className="w-full px-1 text-left text-2xs font-semibold
                                                text-ink-muted hover:text-brand-600"
                                        >
                                            +{dayBlocks.length - VISIBLE_PER_DAY} más
                                        </button>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
