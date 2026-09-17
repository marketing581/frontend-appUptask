import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { EyeIcon, EyeSlashIcon, TrashIcon } from '@heroicons/react/24/outline'
import { Task } from '@/types'
import { ALERT_COLOR, TaskLabel, frequencyShort, getTaskLabel } from '@/utils/taskLabels'
import { Badge } from '@/components/ui'
import TaskStatusControl from './TaskStatusControl'
import PlanDayPicker, { PlanDay } from './PlanDayPicker'

/** Fila de la vista simplificada de "Mi trabajo": lo único que importa
 *  momento a momento. Cambiar el estado y jalar algo a hoy son gestos de un
 *  clic; el resto —renombrar, ocultar, borrar— sigue ahí pero no compite por
 *  atención. */

type Props = {
    task: Task
    /** Los cinco días de la semana en curso (lunes a viernes), para el
     *  selector de planificación y para saber si el vencimiento es hoy. */
    weekDays: PlanDay[]
    /** "YYYY-MM-DD" del día de hoy, en la zona de quien mira. */
    todayKey: string
    canEdit: boolean
    canHide: boolean
    busy: boolean
    /** Cambia el estado —incluido "Por validar", que no es un estado real
     *  sino su propio flujo de aprobación— por su nombre en cada transición. */
    onSetLabel: (taskId: string, label: TaskLabel) => void
    /** `null` quita el pendiente de la semana. */
    onSetDay: (taskId: string, dayKey: string | null) => void
    onPatch: (taskId: string, formData: Record<string, unknown>) => void
    onDelete: (taskId: string) => void
}

export default function SimpleTaskRow({
    task, weekDays, todayKey, canEdit, canHide, busy,
    onSetLabel, onSetDay, onPatch, onDelete
}: Props) {
    const label = getTaskLabel(task)
    const done = label === 'done' || !!task.doneForPeriod
    // Una recurrente hecha hoy se ve como "Listo" aunque el estado real siga
    // en Pendiente —vuelve a hacer falta mañana—; el control muestra ese
    // avance visible, no el dato interno.
    const effectiveLabel: TaskLabel = task.doneForPeriod ? 'done' : label
    const [name, setName] = useState(task.name)
    const [confirming, setConfirming] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => { setName(task.name) }, [task.name])

    const commitName = () => {
        const next = name.trim()
        if (next.length === 0) { setName(task.name); return }
        if (next === task.name) return
        onPatch(task._id, { name: next })
    }

    const project = task.project && typeof task.project !== 'string' ? task.project : null
    const recurring = task.frequency && task.frequency !== 'none'

    // La fecha límite se guarda como fecha simple ("YYYY-MM-DD"), sin hora:
    // se compara igual, tomando esos mismos diez caracteres, para no
    // reinterpretarla por zona horaria y correrla un día en el camino. Y solo
    // se anuncia cuando ya toca hacer algo con ella: hoy o vencida. Una fecha
    // futura no aporta nada en una vista para el momento.
    const dueKey = task.dueDate ? task.dueDate.slice(0, 10) : null
    const overdue = !done && !!dueKey && dueKey < todayKey
    const dueToday = !done && dueKey === todayKey

    const plannedKey = task.plannedDate ? task.plannedDate.slice(0, 10) : null

    return (
        <li
            draggable={canEdit}
            onDragStart={event => {
                event.dataTransfer.setData('application/x-uptask-plan-task', task._id)
                event.dataTransfer.effectAllowed = 'move'
            }}
            className={`group flex items-start gap-2 px-3 py-2 hover:bg-surface-sunken transition-colors ${
                canEdit ? 'cursor-grab active:cursor-grabbing' : ''
            }`}
        >
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
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
                            title={task.name}
                            className={`min-w-0 flex-1 border-0 p-0 bg-transparent text-sm font-medium
                                leading-snug focus:ring-0 rounded truncate ${
                                done ? 'text-ink-subtle line-through' : 'text-ink'
                            }`}
                        />
                    ) : (
                        <p title={task.name} className={`min-w-0 flex-1 truncate text-sm font-medium leading-snug ${
                            done ? 'text-ink-subtle line-through' : 'text-ink'
                        }`}>
                            {task.name}
                        </p>
                    )}
                </div>

                {/* El estado va primero, como un tag más: se cambia con el
                    mismo gesto con que se lee el resto —de qué tipo es, si
                    espera validación o respuesta, si está vencida. */}
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <TaskStatusControl
                        label={effectiveLabel}
                        disabled={busy || !canEdit}
                        onChange={next => onSetLabel(task._id, next)}
                    />
                    {task.onHold?.active && (
                        <span className="text-2xs font-semibold" style={{ color: ALERT_COLOR }}>
                            En espera{task.onHold.waitingOn && ` de ${task.onHold.waitingOn}`}
                        </span>
                    )}
                    {overdue && <Badge variant="alert">Vencido</Badge>}
                    {dueToday && !overdue && (
                        <Badge className="bg-amber-100 text-amber-900">Vence hoy</Badge>
                    )}
                    {recurring && (
                        <span className="text-2xs text-ink-subtle">
                            {frequencyShort[task.frequency]}
                        </span>
                    )}
                    {project && (
                        <Link
                            to={`/projects/${project._id}`}
                            onClick={event => event.stopPropagation()}
                            className="text-2xs text-ink-subtle hover:text-brand-600 hover:underline truncate"
                        >
                            {project.projectName}
                        </Link>
                    )}
                    {task.isPrivate && (
                        <Badge className="bg-slate-200 text-slate-700 ring-1 ring-inset ring-slate-400">
                            Solo tú lo ves
                        </Badge>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
                <PlanDayPicker
                    days={weekDays}
                    activeKey={plannedKey}
                    onSelect={dayKey => onSetDay(task._id, dayKey)}
                />

                {canHide && (
                    <button
                        type="button"
                        onClick={() => onPatch(task._id, { isPrivate: !task.isPrivate })}
                        title={task.isPrivate ? 'Mostrarlo al equipo' : 'Ocultarlo: solo tú lo verás'}
                        aria-label={task.isPrivate ? 'Mostrar al equipo' : 'Ocultar al equipo'}
                        className={`w-7 h-7 grid place-content-center rounded-full transition-opacity
                            hover:bg-slate-200 ${
                            task.isPrivate
                                ? 'text-ink-muted'
                                : 'text-ink-subtle opacity-0 group-hover:opacity-100 focus:opacity-100'
                        }`}
                    >
                        {task.isPrivate ? <EyeIcon className="w-4 h-4" /> : <EyeSlashIcon className="w-4 h-4" />}
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
                        className="w-7 h-7 grid place-content-center rounded-full text-ink-subtle
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
