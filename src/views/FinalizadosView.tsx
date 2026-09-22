import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { useAuth } from '@/hooks/useAuth'
import { getScheduleMembers } from '@/api/ScheduleAPI'
import { getFinishedTasks } from '@/api/WorkTaskAPI'
import { FinishedRow } from '@/types'
import {
    DEFAULT_TIMEZONE, addDays, addMonths, dayKey, formatDayHeader, formatRangeLabel, formatTime,
    getZonedParts, monthGridDays, monthLabel, quarterLabel, quarterMonths, startOfMonth, startOfWeek,
    zonedTimeToUtc
} from '@/utils/datetime'
import { EmptyState, PageHeader } from '@/components/ui'
import PersonSwitcher from '@/components/team/PersonSwitcher'

/** Lo logrado, día a día: agrupado por la fecha real en que cada pendiente
 *  llegó a Listo, no por cuándo se tocó por última vez el registro.
 *
 *  Tres formas de mirarlo, cada una a la pregunta que responde mejor:
 *  semana para el detalle día a día (lunes a domingo —el cierre también
 *  pasa en fin de semana, así que "Mi semana", que solo cubre de lunes a
 *  viernes, se quedaría corta—), mes y trimestre para el panorama, con el
 *  detalle de un día a un clic en vez de amontonado en la celda. */

type ViewMode = 'week' | 'month' | 'quarter'
const WEEK_LENGTH = 7

export default function FinalizadosView() {
    const { data: currentUser } = useAuth()
    const [view, setView] = useState<ViewMode>('week')
    const [anchor, setAnchor] = useState(() => new Date())
    const [personId, setPersonId] = useState('all')
    const [selectedDay, setSelectedDay] = useState<string | null>(null)

    const timezone = currentUser?.timezone ?? DEFAULT_TIMEZONE
    const todayKey = useMemo(() => dayKey(new Date(), timezone), [timezone])

    const { data: members } = useQuery({
        queryKey: ['scheduleMembers'],
        queryFn: getScheduleMembers,
        enabled: !!currentUser,
        retry: false
    })

    // Rango a pedir al servidor: la semana completa, el mes completo o los
    // tres meses del trimestre —siempre `[start, end)`, igual que Informes.
    const range = useMemo(() => {
        if (view === 'week') {
            const start = startOfWeek(anchor, timezone)
            return { start, end: addDays(start, WEEK_LENGTH) }
        }
        if (view === 'month') {
            const start = startOfMonth(anchor, timezone)
            return { start, end: addMonths(start, 1, timezone) }
        }
        const months = quarterMonths(anchor, timezone)
        return { start: months[0], end: addMonths(months[2], 1, timezone) }
    }, [view, anchor, timezone])

    // La rejilla del mes completa semanas enteras con días vecinos; el
    // trimestre es simplemente sus tres meses, cada uno con su propia
    // rejilla. La semana no necesita rejilla: son sus siete días tal cual.
    const weekDays = useMemo(
        () => Array.from({ length: WEEK_LENGTH }, (_, i) => addDays(range.start, i)),
        [range]
    )
    const monthGrids = useMemo(() => {
        if (view === 'month') return [{ month: startOfMonth(anchor, timezone), days: monthGridDays(anchor, timezone) }]
        if (view === 'quarter') {
            return quarterMonths(anchor, timezone).map(month => ({ month, days: monthGridDays(month, timezone) }))
        }
        return []
    }, [view, anchor, timezone])

    // Cambiar de vista o de periodo deja atrás cualquier día que se hubiera
    // elegido para ver el detalle: pertenecía al periodo anterior.
    useEffect(() => { setSelectedDay(null) }, [view, range])

    const { data, isLoading, isError } = useQuery({
        queryKey: ['finishedByDay', personId, view, range.start.toISOString()],
        queryFn: () => getFinishedTasks({
            assignee: personId === 'all' ? undefined : personId,
            from: range.start,
            to: range.end
        }),
        retry: false
    })

    const rowsByDay = useMemo(() => {
        const map = new Map<string, FinishedRow[]>()
        for (const row of data?.rows ?? []) {
            const key = dayKey(new Date(row.finishedAt), timezone)
            if (!map.has(key)) map.set(key, [])
            map.get(key)!.push(row)
        }
        return map
    }, [data, timezone])

    const total = data?.rows.length ?? 0

    const step = (direction: 1 | -1) => {
        if (view === 'week') return setAnchor(current => addDays(current, WEEK_LENGTH * direction))
        if (view === 'month') return setAnchor(current => addMonths(current, direction, timezone))
        return setAnchor(current => addMonths(current, 3 * direction, timezone))
    }

    const periodLabel = view === 'week'
        ? formatRangeLabel(range.start, addDays(range.end, -1), timezone)
        : view === 'month' ? monthLabel(anchor, timezone) : quarterLabel(anchor, timezone)

    const selectedRows = selectedDay ? rowsByDay.get(selectedDay) ?? [] : []
    // El mediodía evita cualquier salto de fecha al reconvertir por zona
    // horaria —a diferencia de la medianoche, que en un huso al este de UTC
    // caería del lado del día anterior.
    const selectedDayDate = useMemo(() => {
        if (!selectedDay) return null
        const [year, month, day] = selectedDay.split('-').map(Number)
        return zonedTimeToUtc(year, month, day, 12, 0, timezone)
    }, [selectedDay, timezone])

    return (
        <>
            <PageHeader
                title="Finalizados"
                subtitle="Lo que se ha logrado, día a día"
            />

            <div className="card flex flex-wrap items-center gap-x-3 gap-y-2 p-2 mb-3">
                <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-slate-100">
                    {([
                        { key: 'week' as const, label: 'Semanal' },
                        { key: 'month' as const, label: 'Mensual' },
                        { key: 'quarter' as const, label: 'Trimestral' }
                    ]).map(item => (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => setView(item.key)}
                            aria-pressed={view === item.key}
                            className={`h-7 px-2.5 rounded text-xs font-semibold transition-colors ${
                                view === item.key
                                    ? 'bg-surface text-ink shadow-card'
                                    : 'text-ink-muted hover:text-ink'
                            }`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-0.5">
                    <button
                        onClick={() => step(-1)}
                        className="w-7 h-7 grid place-content-center rounded text-ink-muted hover:bg-slate-100"
                        aria-label="Periodo anterior"
                    >
                        <ChevronLeftIcon className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setAnchor(new Date())}
                        className="h-7 px-2.5 rounded text-xs font-semibold text-ink-muted hover:bg-slate-100"
                    >Hoy</button>
                    <button
                        onClick={() => step(1)}
                        className="w-7 h-7 grid place-content-center rounded text-ink-muted hover:bg-slate-100"
                        aria-label="Periodo siguiente"
                    >
                        <ChevronRightIcon className="w-4 h-4" />
                    </button>
                </div>

                <p className="text-sm font-bold text-ink tabular capitalize">{periodLabel}</p>

                <span className="text-2xs text-ink-subtle">
                    {total > 0 ? `${total} finalizado${total === 1 ? '' : 's'}` : 'Nada finalizado en este periodo'}
                </span>

                {members && members.length > 0 && (
                    <div className="ml-auto">
                        <PersonSwitcher
                            members={members}
                            value={personId}
                            onChange={setPersonId}
                            currentUserId={currentUser?._id}
                            allOption="Todo el equipo"
                        />
                    </div>
                )}
            </div>

            {isError && <p className="text-center py-16 text-sm text-red-600">No se pudo cargar Finalizados</p>}
            {isLoading && <p className="text-center py-16 text-sm text-ink-muted">Cargando…</p>}

            {!isLoading && !isError && view === 'week' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
                    {weekDays.map(day => {
                        const key = dayKey(day, timezone)
                        const { weekday, dayNumber, month } = formatDayHeader(day, timezone)
                        const isToday = key === todayKey
                        const rows = rowsByDay.get(key) ?? []

                        return (
                            <div
                                key={key}
                                className={`card overflow-hidden flex flex-col ${isToday ? 'ring-1 ring-brand-300' : ''}`}
                            >
                                <div className={`flex items-center justify-between px-3 h-9 border-b border-line
                                    shrink-0 ${isToday ? 'bg-brand-50' : 'bg-surface-sunken'}`}>
                                    <span className={`text-xs font-bold ${isToday ? 'text-brand-700' : 'text-ink-muted'}`}>
                                        {weekday} <span className="tabular font-normal text-ink-subtle">{dayNumber} {month}</span>
                                    </span>
                                    {rows.length > 0 && (
                                        <span className="text-2xs font-semibold text-ink-subtle tabular">{rows.length}</span>
                                    )}
                                </div>

                                {rows.length === 0 ? (
                                    <p className="px-3 py-4 text-2xs text-ink-subtle text-center">Nada</p>
                                ) : (
                                    <ul className="divide-y divide-line max-h-[60vh] overflow-y-auto scrollbar-none">
                                        {rows.map(row => (
                                            <li key={row.taskId} className="px-3 py-2 text-sm">
                                                <p className="text-ink font-medium leading-snug">{row.taskName}</p>
                                                <p className="text-2xs text-ink-subtle tabular mt-0.5">
                                                    {formatTime(new Date(row.finishedAt), timezone)}
                                                    {personId === 'all' && ` · ${row.assigneeName.split(' ')[0]}`}
                                                </p>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {!isLoading && !isError && view !== 'week' && (
                <div className={view === 'quarter' ? 'grid grid-cols-1 lg:grid-cols-3 gap-3' : ''}>
                    {monthGrids.map(({ month, days }) => (
                        <MonthCalendar
                            key={month.toISOString()}
                            days={days}
                            month={month}
                            timezone={timezone}
                            todayKey={todayKey}
                            rowsByDay={rowsByDay}
                            compact={view === 'quarter'}
                            selectedDay={selectedDay}
                            onSelectDay={setSelectedDay}
                        />
                    ))}
                </div>
            )}

            {!isLoading && !isError && view !== 'week' && selectedDay && (
                <div className="card overflow-hidden mt-3">
                    <div className="flex items-center justify-between px-3 h-11 border-b border-line">
                        <h2 className="text-sm font-bold text-ink capitalize">
                            {selectedDayDate && formatRangeLabel(selectedDayDate, selectedDayDate, timezone)}
                            {selectedRows.length > 0 && (
                                <span className="ml-1.5 text-ink-subtle tabular font-semibold">{selectedRows.length}</span>
                            )}
                        </h2>
                        <button
                            type="button"
                            onClick={() => setSelectedDay(null)}
                            className="text-2xs font-semibold text-ink-muted hover:text-ink"
                        >
                            Cerrar
                        </button>
                    </div>
                    {selectedRows.length === 0 ? (
                        <EmptyState title="Nada finalizado ese día" />
                    ) : (
                        <ul className="divide-y divide-line max-h-96 overflow-y-auto scrollbar-none">
                            {selectedRows.map(row => (
                                <li key={row.taskId} className="px-3 py-2 text-sm flex items-center justify-between gap-3">
                                    <p className="text-ink font-medium leading-snug">{row.taskName}</p>
                                    <p className="text-2xs text-ink-subtle tabular shrink-0">
                                        {formatTime(new Date(row.finishedAt), timezone)}
                                        {personId === 'all' && ` · ${row.assigneeName.split(' ')[0]}`}
                                    </p>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </>
    )
}

/** Un mes en cuadrícula, de lunes a domingo. En `compact` (trimestre) cada
 *  celda es solo el número y un contador: tres meses a la vista a la vez no
 *  dejan sitio para más. En mensual se ven hasta dos títulos de muestra. */
function MonthCalendar({ days, month, timezone, todayKey, rowsByDay, compact, selectedDay, onSelectDay }: {
    days: Date[]
    month: Date
    timezone: string
    todayKey: string
    rowsByDay: Map<string, FinishedRow[]>
    compact: boolean
    selectedDay: string | null
    onSelectDay: (key: string) => void
}) {
    const monthNumber = getZonedParts(month, timezone).month
    const inMonth = (day: Date) => getZonedParts(day, timezone).month === monthNumber

    return (
        <div className="card overflow-hidden">
            {!compact && (
                <div className="px-3 h-9 flex items-center border-b border-line bg-surface-sunken">
                    <h2 className="text-xs font-bold text-ink capitalize">{monthLabel(month, timezone)}</h2>
                </div>
            )}
            {compact && (
                <div className="px-3 h-8 flex items-center border-b border-line bg-surface-sunken">
                    <h2 className="text-2xs font-bold text-ink-muted capitalize">{monthLabel(month, timezone)}</h2>
                </div>
            )}

            <div className="grid grid-cols-7 border-b border-line">
                {WEEKDAY_LETTERS.map(letter => (
                    <div key={letter} className="text-2xs font-semibold text-ink-subtle text-center py-1">
                        {letter}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7">
                {days.map(day => {
                    const key = dayKey(day, timezone)
                    const rows = rowsByDay.get(key) ?? []
                    const isToday = key === todayKey
                    const isSelected = key === selectedDay
                    const faded = !inMonth(day)

                    return (
                        <button
                            key={key}
                            type="button"
                            onClick={() => onSelectDay(key)}
                            className={`text-left border-b border-r border-line last:border-r-0 p-1 transition-colors
                                focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-500
                                ${compact ? 'h-12' : 'h-20'}
                                ${isSelected ? 'bg-brand-50' : rows.length > 0 ? 'hover:bg-surface-sunken' : 'hover:bg-surface-sunken/60'}
                                ${faded ? 'opacity-40' : ''}`}
                        >
                            <span className={`text-2xs tabular inline-flex items-center justify-center w-4 h-4 rounded-full
                                ${isToday ? 'bg-brand-600 text-white font-bold' : 'text-ink-muted'}`}>
                                {getZonedParts(day, timezone).day}
                            </span>
                            {rows.length > 0 && (
                                <>
                                    <span className="ml-1 text-2xs font-semibold text-brand-700 tabular">{rows.length}</span>
                                    {!compact && (
                                        <div className="mt-0.5 space-y-0.5">
                                            {rows.slice(0, 2).map(row => (
                                                <p key={row.taskId} className="text-2xs text-ink-muted truncate leading-tight">
                                                    {row.taskName}
                                                </p>
                                            ))}
                                            {rows.length > 2 && (
                                                <p className="text-2xs text-ink-subtle leading-tight">+{rows.length - 2} más</p>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

const WEEKDAY_LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
