import { useMemo, useState } from 'react'
import { ChevronRightIcon } from '@heroicons/react/24/outline'
import { UnscheduledRow } from '@/types'
import { formatDuration } from '@/utils/datetime'
import {
    alertBadge,
    frequencyBadge,
    frequencyShort,
    getTaskLabel,
    isRecurringFrequency,
    labelPalette,
    labelTranslations,
    priorityBadgeStyles,
    priorityTranslations
} from '@/utils/taskLabels'

type Props = {
    rows: UnscheduledRow[]
    selectedTaskId: string | null
    onSelect: (taskId: string | null) => void
}

/** Las tres naturalezas del trabajo, con las mismas reglas que "Mi trabajo":
 *  proyecto si cuelga de uno, mantenimiento si tiene cadencia, pendiente si
 *  no es ninguna de las dos. */
type Kind = 'maintenance' | 'project' | 'oneOff'

const kindOf = (row: UnscheduledRow): Kind => {
    if (row.task.project) return 'project'
    if ((row.task.frequency ?? 'none') !== 'none') return 'maintenance'
    return 'oneOff'
}

const GROUPS: { key: Kind, label: string, hint: string }[] = [
    { key: 'maintenance', label: 'Mantenimiento', hint: 'Se repite' },
    { key: 'project', label: 'Proyectos', hint: 'Con seguimiento' },
    { key: 'oneOff', label: 'Pendientes', hint: 'De una vez' }
]

function Row({ row, selected, onSelect }: {
    row: UnscheduledRow
    selected: boolean
    onSelect: () => void
}) {
    const {
        task, scheduledMinutes, scheduledDays, expectedPerWeek,
        estimatedMinutes, remainingMinutes, doneForPeriod, fullyScheduled
    } = row

    const project = task.project && typeof task.project !== 'string' ? task.project.projectName : null
    const area = task.brand && typeof task.brand !== 'string' ? task.brand : null
    const dragMinutes = estimatedMinutes && estimatedMinutes > 0 ? Math.min(estimatedMinutes, 240) : 30
    const recurring = isRecurringFrequency(task.frequency)

    return (
        <li>
            <button
                type="button"
                draggable
                onDragStart={event => {
                    event.dataTransfer.setData(
                        'application/x-uptask-task',
                        JSON.stringify({ taskId: task._id, minutes: dragMinutes })
                    )
                    event.dataTransfer.effectAllowed = 'copy'
                }}
                onClick={onSelect}
                className={`w-full text-left p-3 transition-colors cursor-grab active:cursor-grabbing ${
                    selected ? 'bg-brand-50 ring-1 ring-inset ring-brand-300' : 'hover:bg-surface-sunken'
                }`}
            >
                <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-bold text-slate-800 leading-tight">{task.name}</p>
                    <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${priorityBadgeStyles[task.priority]}`}>
                        {priorityTranslations[task.priority]}
                    </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    {doneForPeriod ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded
                            bg-emerald-100 text-emerald-800">
                            Hecho {task.frequency === 'daily' ? 'hoy' : 'en este periodo'}
                        </span>
                    ) : (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${labelPalette[getTaskLabel(task)].badge}`}>
                            {labelTranslations[getTaskLabel(task)]}
                        </span>
                    )}
                    {task.frequency && task.frequency !== 'none' && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${frequencyBadge}`}>
                            {frequencyShort[task.frequency]}
                        </span>
                    )}
                    {task.onHold?.active && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${alertBadge}`}>
                            En espera
                        </span>
                    )}
                    {project ? (
                        <span className="text-xs text-ink-subtle">{project}</span>
                    ) : area ? (
                        <span className="inline-flex items-center gap-1 text-xs text-ink-subtle">
                            <span className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: area.color }} />
                            {area.name}
                        </span>
                    ) : (
                        <span className="text-xs text-ink-subtle">Operativo</span>
                    )}
                </div>

                {/* Lo recurrente se mide en días cubiertos, no en minutos: una
                    tarea diaria necesita hueco cada día. */}
                <p className="text-xs text-ink-muted mt-1">
                    {recurring ? (
                        <>
                            <strong className={fullyScheduled ? 'text-stage-done' : undefined}>
                                {scheduledDays} de {expectedPerWeek}
                            </strong>{' '}
                            {expectedPerWeek === 1 ? 'vez' : 'días'} con hora esta semana
                            {estimatedMinutes !== null && (
                                <span className="text-ink-subtle"> · {formatDuration(estimatedMinutes)} cada vez</span>
                            )}
                        </>
                    ) : estimatedMinutes === null ? (
                        <span className="text-ink-subtle italic">Sin estimación · se reservan 30 min</span>
                    ) : scheduledMinutes === 0 ? (
                        <>Reserva <strong>{formatDuration(estimatedMinutes)}</strong></>
                    ) : (
                        <>
                            {formatDuration(scheduledMinutes)} esta semana
                            {(remainingMinutes ?? 0) > 0 && (
                                <> · faltan <strong>{formatDuration(remainingMinutes ?? 0)}</strong></>
                            )}
                        </>
                    )}
                </p>

                {selected && (
                    <p className="mt-2 text-xs text-brand-700 font-bold">
                        Haz clic en el calendario para darle hora
                    </p>
                )}
            </button>
        </li>
    )
}

/** Lo que falta por programar: tareas abiertas cuyo esfuerzo estimado todavía
 *  no está cubierto por bloques.
 *
 *  Se agrupa por naturaleza del trabajo —igual que en "Mi trabajo"— porque
 *  mantenimiento, proyecto y pendiente suelto se piensan distinto: una lista
 *  sin ese contexto obliga a leer nombre por nombre para adivinar de qué se
 *  trata. Se elige una tarea y luego se hace clic en el calendario, o se
 *  arrastra directo, para darle hora. */
export default function UnscheduledPanel({ rows, selectedTaskId, onSelect }: Props) {
    const [collapsed, setCollapsed] = useState<Set<Kind>>(new Set())

    const groups = useMemo(() => GROUPS
        .map(group => ({ ...group, rows: rows.filter(row => kindOf(row) === group.key) }))
        .filter(group => group.rows.length > 0),
        [rows]
    )

    if (rows.length === 0) {
        return (
            <div className="p-4 text-sm text-slate-500">
                No queda trabajo sin programar.
            </div>
        )
    }

    const toggle = (key: Kind) => setCollapsed(current => {
        const next = new Set(current)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        return next
    })

    return (
        <div className="divide-y divide-slate-100">
            {groups.map(group => (
                <div key={group.key}>
                    <button
                        type="button"
                        onClick={() => toggle(group.key)}
                        aria-expanded={!collapsed.has(group.key)}
                        className="w-full flex items-center gap-1.5 px-3 py-1.5 bg-surface-sunken
                            hover:bg-slate-100 transition-colors sticky top-0 z-10"
                    >
                        <ChevronRightIcon
                            className={`w-3 h-3 text-ink-subtle shrink-0 transition-transform ${
                                collapsed.has(group.key) ? '' : 'rotate-90'
                            }`}
                        />
                        <span className="text-2xs font-bold text-ink">{group.label}</span>
                        <span className="text-2xs text-ink-subtle">{group.hint}</span>
                        <span className="ml-auto text-2xs font-semibold text-ink-subtle tabular">
                            {group.rows.length}
                        </span>
                    </button>

                    {!collapsed.has(group.key) && (
                        <ul className="divide-y divide-slate-100">
                            {group.rows.map(row => (
                                <Row
                                    key={row.task._id}
                                    row={row}
                                    selected={selectedTaskId === row.task._id}
                                    onSelect={() => onSelect(selectedTaskId === row.task._id ? null : row.task._id)}
                                />
                            ))}
                        </ul>
                    )}
                </div>
            ))}
        </div>
    )
}
