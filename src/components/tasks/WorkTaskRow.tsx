import { useEffect, useRef, useState } from 'react'
import {
    CalendarDaysIcon, CheckIcon, EyeIcon, EyeSlashIcon, TrashIcon
} from '@heroicons/react/24/outline'
import { Task, TaskStatus } from '@/types'
import {
    ALERT_COLOR, FREQUENCY_ORDER,
    frequencyBadge, frequencyTranslations, getTaskLabel, labelPalette, labelTranslations
} from '@/utils/taskLabels'
import { Avatar, Badge } from '@/components/ui'

/** Fila de un pendiente, con todo lo que se le puede hacer sin abrir nada:
 *  cerrarlo, renombrarlo, cambiarle la cadencia o la fecha, ocultarlo y
 *  borrarlo.
 *
 *  La usan por igual Mantenimiento y Pendientes: son dos naturalezas distintas
 *  de trabajo, pero se manipulan igual, y tener dos filas parecidas terminaría
 *  en dos comportamientos distintos para el mismo gesto. */

type Props = {
    task: Task
    busy: boolean
    canEdit: boolean
    canHide: boolean
    /** La cadencia solo tiene sentido donde el trabajo se repite. */
    showFrequency?: boolean
    /** La fecha límite, en cambio, solo importa en lo que ocurre una vez. */
    showDueDate?: boolean
    onSetStatus: (taskId: string, status: TaskStatus) => void
    onPatch: (taskId: string, formData: Record<string, unknown>) => void
    onDelete: (taskId: string) => void
}

export default function WorkTaskRow({
    task, busy, canEdit, canHide,
    showFrequency = true, showDueDate = false,
    onSetStatus, onPatch, onDelete
}: Props) {
    const label = getTaskLabel(task)
    const done = label === 'done' || !!task.doneForPeriod
    const assignee = task.assignee && typeof task.assignee !== 'string' ? task.assignee : null
    const area = task.brand && typeof task.brand !== 'string' ? task.brand : null

    const [name, setName] = useState(task.name)
    const [confirming, setConfirming] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => { setName(task.name) }, [task.name])

    /** El nombre se edita en la propia fila: renombrar un pendiente es
     *  frecuente y abrir un formulario para eso sobraría. */
    const commitName = () => {
        const next = name.trim()
        if (next.length === 0) { setName(task.name); return }
        if (next === task.name) return
        onPatch(task._id, { name: next })
    }

    const dueValue = task.dueDate ? task.dueDate.slice(0, 10) : ''

    return (
        <li className="group flex items-start gap-2.5 px-3 py-2 hover:bg-surface-sunken transition-colors">
            <button
                type="button"
                disabled={busy || !canEdit}
                onClick={() => onSetStatus(task._id, done ? 'pending' : 'done')}
                aria-label={done ? `Reabrir "${task.name}"` : `Marcar "${task.name}" como lista`}
                title={canEdit ? undefined : 'Solo su responsable o la encargada'}
                className={`mt-0.5 w-[18px] h-[18px] shrink-0 rounded-full border-2 grid place-content-center
                    transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    done
                        ? 'bg-stage-done border-stage-done text-white'
                        : 'border-line-strong text-transparent hover:border-stage-done hover:text-stage-done'
                }`}
            >
                <CheckIcon className="w-3 h-3" strokeWidth={3} />
            </button>

            <div className="min-w-0 flex-1">
                {canEdit ? (
                    <input
                        ref={inputRef}
                        value={name}
                        onChange={event => setName(event.target.value)}
                        onBlur={commitName}
                        onKeyDown={event => {
                            if (event.key === 'Enter') { event.preventDefault(); inputRef.current?.blur() }
                            if (event.key === 'Escape') { setName(task.name); inputRef.current?.blur() }
                        }}
                        aria-label={`Nombre de ${task.name}`}
                        className={`w-full border-0 p-0 bg-transparent text-sm font-medium leading-snug
                            focus:ring-0 rounded ${done ? 'text-ink-subtle line-through' : 'text-ink'}`}
                    />
                ) : (
                    <p className={`text-sm font-medium leading-snug ${
                        done ? 'text-ink-subtle line-through' : 'text-ink'
                    }`}>
                        {task.name}
                    </p>
                )}

                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    {task.doneForPeriod ? (
                        <Badge className="bg-emerald-100 text-emerald-800">
                            Hecho {task.frequency === 'daily' ? 'hoy' : 'en este periodo'}
                        </Badge>
                    ) : (
                        <Badge className={labelPalette[label].badge}>{labelTranslations[label]}</Badge>
                    )}

                    {showFrequency && (canEdit ? (
                        <select
                            value={task.frequency ?? 'none'}
                            onChange={event => onPatch(task._id, { frequency: event.target.value })}
                            aria-label={`Frecuencia de ${task.name}`}
                            className={`h-[22px] py-0 pl-1.5 pr-6 text-2xs font-semibold rounded border-0
                                max-w-[10rem] ${frequencyBadge} focus:ring-1 focus:ring-brand-500`}
                        >
                            {FREQUENCY_ORDER.map(frequency => (
                                <option key={frequency} value={frequency}>
                                    {frequencyTranslations[frequency]}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <Badge className={frequencyBadge}>
                            {frequencyTranslations[task.frequency ?? 'none']}
                        </Badge>
                    ))}

                    {showDueDate && canEdit && (
                        <label
                            className={`inline-flex items-center gap-1 h-[22px] px-1.5 rounded text-2xs
                                font-semibold cursor-pointer ${
                                dueValue ? frequencyBadge : 'text-ink-subtle hover:bg-slate-100'
                            }`}
                            title="Fecha límite"
                        >
                            <CalendarDaysIcon className="w-3 h-3 shrink-0" />
                            <input
                                type="date"
                                value={dueValue}
                                onChange={event => onPatch(task._id, {
                                    dueDate: event.target.value || null
                                })}
                                aria-label={`Fecha límite de ${task.name}`}
                                className="border-0 p-0 bg-transparent text-2xs font-semibold
                                    focus:ring-0 w-[6.5rem] cursor-pointer"
                            />
                        </label>
                    )}

                    {area && (
                        <span className="inline-flex items-center gap-1 text-2xs text-ink-subtle">
                            <span className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: area.color }} />
                            {area.name}
                        </span>
                    )}

                    {task.isPrivate && (
                        <Badge className="bg-slate-200 text-slate-700 ring-1 ring-inset ring-slate-400">
                            <EyeSlashIcon className="w-3 h-3" /> Solo tú lo ves
                        </Badge>
                    )}
                    {task.onHold?.active && (
                        <span className="text-2xs font-semibold" style={{ color: ALERT_COLOR }}>
                            En espera{task.onHold.waitingOn && ` de ${task.onHold.waitingOn}`}
                        </span>
                    )}

                    {assignee && (
                        <span className="ml-auto flex items-center gap-1.5">
                            <Avatar name={assignee.name} size="xs" />
                            <span className="text-2xs text-ink-subtle hidden sm:inline">
                                {assignee.name.split(' ')[0]}
                            </span>
                        </span>
                    )}
                </div>
            </div>

            {/* Acciones: ocultar solo sobre lo propio, eliminar con confirmación */}
            <div className="flex items-center gap-0.5 shrink-0">
                {canHide && (
                    <button
                        type="button"
                        onClick={() => onPatch(task._id, { isPrivate: !task.isPrivate })}
                        title={task.isPrivate ? 'Mostrarlo al equipo' : 'Ocultarlo: solo tú lo verás'}
                        aria-label={task.isPrivate ? 'Mostrar al equipo' : 'Ocultar al equipo'}
                        className={`w-7 h-7 grid place-content-center rounded transition-opacity
                            hover:bg-slate-200 ${
                            task.isPrivate
                                ? 'text-ink-muted'
                                : 'text-ink-subtle opacity-0 group-hover:opacity-100 focus:opacity-100'
                        }`}
                    >
                        {task.isPrivate
                            ? <EyeIcon className="w-4 h-4" />
                            : <EyeSlashIcon className="w-4 h-4" />}
                    </button>
                )}

                {canEdit && (confirming ? (
                    <span className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => onDelete(task._id)}
                            className="h-7 px-2 rounded text-2xs font-bold text-white bg-red-600 hover:bg-red-700"
                        >
                            Eliminar
                        </button>
                        <button
                            type="button"
                            onClick={() => setConfirming(false)}
                            className="h-7 px-2 rounded text-2xs font-semibold text-ink-muted hover:bg-slate-100"
                        >
                            No
                        </button>
                    </span>
                ) : (
                    <button
                        type="button"
                        onClick={() => setConfirming(true)}
                        title="Eliminar pendiente"
                        aria-label={`Eliminar "${task.name}"`}
                        className="w-7 h-7 grid place-content-center rounded text-ink-subtle
                            opacity-0 group-hover:opacity-100 focus:opacity-100
                            hover:bg-red-50 hover:text-red-600 transition-opacity"
                    >
                        <TrashIcon className="w-4 h-4" />
                    </button>
                ))}
            </div>
        </li>
    )
}
