import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { useAuth } from '@/hooks/useAuth'
import { getScheduleMembers } from '@/api/ScheduleAPI'
import { getTaskDurationReport, ReportPeriod } from '@/api/ReportAPI'
import { REPORTS_OWNER_ID } from '@/utils/reportsAccess'
import {
    DEFAULT_TIMEZONE, addDays, addMonths, formatDayHeader, formatDuration, formatRangeLabel, formatTime,
    getZonedParts, startOfMonth
} from '@/utils/datetime'
import { EmptyState, PageHeader, StatTile } from '@/components/ui'
import PersonSwitcher from '@/components/team/PersonSwitcher'
import { TaskDurationRow } from '@/types'

/** Informe gerencial: cuánto tarda el equipo de "En proceso" a "Listo",
 *  contando solo horario de oficina. Es de una sola cuenta —lo bloquea el
 *  servidor por id exacto—; este `if` de más arriba es solo para no lanzar
 *  la consulta ni mostrar el filtro a quien de todos modos recibirá un 403. */

const PERIODS: { key: ReportPeriod, label: string }[] = [
    { key: 'weekly', label: 'Semanal' },
    { key: 'biweekly', label: 'Quincenal' },
    { key: 'monthly', label: 'Mensual' }
]

const REPORT_COLUMNS = `lg:grid lg:items-center lg:gap-2
    lg:grid-cols-[minmax(0,1fr)_8rem_10rem_10rem_7rem]`

function formatDateTime(iso: string, timezone: string) {
    const date = new Date(iso)
    const { dayNumber, month } = formatDayHeader(date, timezone)
    const year = getZonedParts(date, timezone).year
    return `${dayNumber} ${month} ${year}, ${formatTime(date, timezone)}`
}

/** Un paso de periodo hacia adelante o atrás, en horario local. La quincena
 *  no es un bloque móvil de 14 días: es 1–15 o 16–fin de mes. */
function stepAnchor(period: ReportPeriod, anchor: Date, direction: 1 | -1, timezone: string): Date {
    if (period === 'weekly') return addDays(anchor, 7 * direction)

    if (period === 'biweekly') {
        const p = getZonedParts(anchor, timezone)
        const firstHalf = p.day <= 15
        if (direction === 1) {
            return firstHalf ? addDays(startOfMonth(anchor, timezone), 15) : addMonths(anchor, 1, timezone)
        }
        return firstHalf ? addDays(addMonths(anchor, -1, timezone), 15) : startOfMonth(anchor, timezone)
    }

    return addMonths(anchor, direction, timezone)
}

function TaskRow({ row, timezone }: { row: TaskDurationRow, timezone: string }) {
    return (
        <li className={`px-3 py-2.5 border-b border-line last:border-b-0 flex flex-col gap-1
            ${REPORT_COLUMNS}`}>
            <p className="text-sm font-medium text-ink min-w-0 truncate" title={row.taskName}>
                {row.taskName}
            </p>
            <p className="text-xs text-ink-muted lg:min-w-0 lg:truncate">{row.assigneeName}</p>
            <p className="text-xs text-ink-subtle tabular">
                <span className="lg:hidden">Inicio: </span>
                {row.startedAt ? formatDateTime(row.startedAt, timezone) : 'Sin registro de inicio'}
            </p>
            <p className="text-xs text-ink-subtle tabular">
                <span className="lg:hidden">Fin: </span>
                {formatDateTime(row.finishedAt, timezone)}
            </p>
            <p className="text-sm font-semibold text-ink tabular">
                {row.businessMinutes !== null ? formatDuration(row.businessMinutes) : '—'}
            </p>
        </li>
    )
}

export default function InformesView() {
    const { data: currentUser } = useAuth()
    const [period, setPeriod] = useState<ReportPeriod>('weekly')
    const [anchor, setAnchor] = useState(() => new Date())
    const [personId, setPersonId] = useState('all')

    const hasAccess = currentUser?._id === REPORTS_OWNER_ID
    const timezone = currentUser?.timezone ?? DEFAULT_TIMEZONE

    const { data: members } = useQuery({
        queryKey: ['scheduleMembers'],
        queryFn: getScheduleMembers,
        retry: false,
        enabled: hasAccess
    })

    const { data: report, isLoading, isError } = useQuery({
        queryKey: ['taskDurationReport', period, anchor.toISOString().slice(0, 10), personId],
        queryFn: () => getTaskDurationReport({ period, anchor, personId: personId === 'all' ? undefined : personId }),
        enabled: hasAccess,
        retry: false
    })

    const periodLabel = useMemo(() => {
        if (!report) return null
        const start = new Date(report.periodStart)
        const end = addDays(new Date(report.periodEnd), -1)
        return formatRangeLabel(start, end, timezone)
    }, [report, timezone])

    if (!hasAccess) {
        return (
            <EmptyState
                title="No tienes acceso a esta sección"
                hint="Los informes de tiempo son de una sola cuenta."
            />
        )
    }

    return (
        <>
            <PageHeader
                title="Informes"
                subtitle="Cuánto tarda el equipo en resolver un pendiente, en horario laboral."
            />

            <div className="card flex flex-wrap items-center gap-x-3 gap-y-2 p-2 mb-3">
                <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-slate-100">
                    {PERIODS.map(item => (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => setPeriod(item.key)}
                            aria-pressed={period === item.key}
                            className={`h-7 px-2.5 rounded text-xs font-semibold transition-colors ${
                                period === item.key
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
                        onClick={() => setAnchor(current => stepAnchor(period, current, -1, timezone))}
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
                        onClick={() => setAnchor(current => stepAnchor(period, current, 1, timezone))}
                        className="w-7 h-7 grid place-content-center rounded text-ink-muted hover:bg-slate-100"
                        aria-label="Periodo siguiente"
                    >
                        <ChevronRightIcon className="w-4 h-4" />
                    </button>
                </div>

                <p className="text-sm font-bold text-ink tabular capitalize">{periodLabel ?? '—'}</p>

                <div className="ml-auto">
                    <PersonSwitcher
                        members={members ?? []}
                        value={personId}
                        onChange={setPersonId}
                        currentUserId={currentUser?._id}
                        allOption="Todo el equipo"
                    />
                </div>
            </div>

            {isLoading && <p className="text-center py-16 text-sm text-ink-muted">Cargando informe…</p>}
            {isError && <p className="text-center py-16 text-sm text-red-600">No se pudo cargar el informe</p>}

            {report && (
                <>
                    <div className="grid grid-cols-2 gap-3 mb-3 max-w-md">
                        <StatTile label="Tareas finalizadas" value={String(report.finishedCount)} />
                        <StatTile
                            label="Tiempo promedio"
                            value={report.averageMinutes !== null
                                ? formatDuration(Math.round(report.averageMinutes))
                                : '—'}
                            hint={report.averageMinutes === null ? 'Sin tareas con registro de inicio' : undefined}
                        />
                    </div>

                    <p className="text-2xs text-ink-subtle leading-snug mb-3 max-w-2xl">
                        Tiempo de En proceso a Listo, de lunes a viernes de 8 a. m. a 6 p. m. Excluye noches
                        y fines de semana. Incluye la espera de validación dentro de ese horario.
                    </p>

                    <div className="card overflow-hidden">
                        <div className={`hidden lg:grid px-3 h-9 items-center border-b border-line
                            bg-surface-sunken ${REPORT_COLUMNS}`}>
                            <p className="eyebrow">Tarea</p>
                            <p className="eyebrow">Responsable</p>
                            <p className="eyebrow">Inicio</p>
                            <p className="eyebrow">Fin</p>
                            <p className="eyebrow">Tiempo</p>
                        </div>

                        {report.rows.length === 0 ? (
                            <EmptyState
                                title="Sin tareas finalizadas en este periodo"
                                hint="Cambia el periodo o la persona para ver otro rango."
                            />
                        ) : (
                            <ul className="max-h-[32rem] overflow-y-auto">
                                {report.rows.map(row => (
                                    <TaskRow key={row.taskId} row={row} timezone={timezone} />
                                ))}
                            </ul>
                        )}
                    </div>
                </>
            )}
        </>
    )
}
