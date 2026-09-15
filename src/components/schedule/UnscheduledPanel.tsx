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

/** Lo que falta por programar: tareas abiertas cuyo esfuerzo estimado todavía
 *  no está cubierto por bloques. Se elige una y luego se hace clic en el
 *  calendario para darle hora. */
export default function UnscheduledPanel({ rows, selectedTaskId, onSelect }: Props) {
    if (rows.length === 0) {
        return (
            <div className="p-4 text-sm text-slate-500">
                No queda trabajo sin programar.
            </div>
        )
    }

    return (
        <ul className="divide-y divide-slate-100">
            {rows.map(({ task, scheduledMinutes, scheduledDays, expectedPerWeek,
                        estimatedMinutes, remainingMinutes, doneForPeriod, fullyScheduled }) => {
                const selected = selectedTaskId === task._id
                const project = task.project && typeof task.project !== 'string' ? task.project.projectName : null
                const area = task.brand && typeof task.brand !== 'string' ? task.brand : null

                const dragMinutes = estimatedMinutes && estimatedMinutes > 0
                    ? Math.min(estimatedMinutes, 240)
                    : 30
                const recurring = isRecurringFrequency(task.frequency)

                return (
                    <li key={task._id}>
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
                            onClick={() => onSelect(selected ? null : task._id)}
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

                            {/* Lo recurrente se mide en días cubiertos, no en
                                minutos: una tarea diaria necesita hueco cada día. */}
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
            })}
        </ul>
    )
}
