import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { useAuth } from '@/hooks/useAuth'
import { getScheduleMembers } from '@/api/ScheduleAPI'
import { getFinishedTasks } from '@/api/WorkTaskAPI'
import { FinishedRow } from '@/types'
import {
    DEFAULT_TIMEZONE, addDays, dayKey, formatDayHeader, formatRangeLabel, formatTime, startOfWeek
} from '@/utils/datetime'
import { PageHeader } from '@/components/ui'
import PersonSwitcher from '@/components/team/PersonSwitcher'

/** Lo logrado, día a día: una semana a la vez, de lunes a domingo —el
 *  trabajo también se cierra en fin de semana, así que "Mi semana" (que
 *  solo cubre de lunes a viernes) se quedaría corta para esto—, agrupado
 *  por la fecha real en que cada pendiente llegó a Listo. */

const WEEK_LENGTH = 7

export default function FinalizadosView() {
    const { data: currentUser } = useAuth()
    const [anchor, setAnchor] = useState(() => new Date())
    const [personId, setPersonId] = useState('all')

    const timezone = currentUser?.timezone ?? DEFAULT_TIMEZONE
    const isManager = currentUser?.role === 'manager'

    const { data: members } = useQuery({
        queryKey: ['scheduleMembers'],
        queryFn: getScheduleMembers,
        enabled: isManager,
        retry: false
    })

    const weekStart = useMemo(() => startOfWeek(anchor, timezone), [anchor, timezone])
    const weekEnd = useMemo(() => addDays(weekStart, WEEK_LENGTH), [weekStart])
    const days = useMemo(
        () => Array.from({ length: WEEK_LENGTH }, (_, i) => addDays(weekStart, i)),
        [weekStart]
    )
    const todayKey = useMemo(() => dayKey(new Date(), timezone), [timezone])

    const { data, isLoading, isError } = useQuery({
        queryKey: ['finishedByDay', personId, weekStart.toISOString()],
        queryFn: () => getFinishedTasks({
            assignee: personId === 'all' ? undefined : personId,
            from: weekStart,
            to: weekEnd
        }),
        retry: false
    })

    const rowsByDay = useMemo(() => {
        const map = new Map<string, FinishedRow[]>(days.map(day => [dayKey(day, timezone), []]))
        for (const row of data?.rows ?? []) {
            const key = dayKey(new Date(row.finishedAt), timezone)
            if (map.has(key)) map.get(key)!.push(row)
        }
        return map
    }, [data, days, timezone])

    const total = data?.rows.length ?? 0

    return (
        <>
            <PageHeader
                title="Finalizados"
                subtitle="Lo que se ha logrado, día a día"
            />

            <div className="card flex flex-wrap items-center gap-x-3 gap-y-2 p-2 mb-3">
                <div className="flex items-center gap-0.5">
                    <button
                        onClick={() => setAnchor(current => addDays(current, -WEEK_LENGTH))}
                        className="w-7 h-7 grid place-content-center rounded text-ink-muted hover:bg-slate-100"
                        aria-label="Semana anterior"
                    >
                        <ChevronLeftIcon className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setAnchor(new Date())}
                        className="h-7 px-2.5 rounded text-xs font-semibold text-ink-muted hover:bg-slate-100"
                    >Hoy</button>
                    <button
                        onClick={() => setAnchor(current => addDays(current, WEEK_LENGTH))}
                        className="w-7 h-7 grid place-content-center rounded text-ink-muted hover:bg-slate-100"
                        aria-label="Semana siguiente"
                    >
                        <ChevronRightIcon className="w-4 h-4" />
                    </button>
                </div>

                <p className="text-sm font-bold text-ink tabular capitalize">
                    {formatRangeLabel(weekStart, addDays(weekEnd, -1), timezone)}
                </p>

                <span className="text-2xs text-ink-subtle">
                    {total > 0 ? `${total} finalizado${total === 1 ? '' : 's'} esta semana` : 'Nada finalizado esta semana'}
                </span>

                {isManager && members && members.length > 0 && (
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

            {!isLoading && !isError && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
                    {days.map(day => {
                        const key = dayKey(day, timezone)
                        const { weekday, dayNumber, month } = formatDayHeader(day, timezone)
                        const isToday = key === todayKey
                        const rows = rowsByDay.get(key) ?? []

                        return (
                            <div
                                key={key}
                                className={`card overflow-hidden flex flex-col ${
                                    isToday ? 'ring-1 ring-brand-300' : ''
                                }`}
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
        </>
    )
}
