import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { CheckIcon, EyeIcon, EyeSlashIcon, TrashIcon } from '@heroicons/react/24/outline'
import { deleteWorkTask, getMyTasks, updateWorkTask, updateWorkTaskStatus } from '@/api/WorkTaskAPI'
import { getScheduleMembers } from '@/api/ScheduleAPI'
import { useAuth } from '@/hooks/useAuth'
import { Task } from '@/types'
import {
    ALERT_COLOR, FREQUENCY_ORDER, LABEL_ORDER, TaskLabel,
    frequencyBadge, frequencyTranslations, getTaskLabel, labelPalette, labelTranslations
} from '@/utils/taskLabels'
import { Avatar, Badge, EmptyState, PageHeader } from '@/components/ui'
import QuickCreateTask from '@/components/tasks/QuickCreateTask'

/** Operación y mantenimiento: el trabajo que se repite y se cierra en el día.
 *  Son las tareas sin proyecto. Se agrupan por cadencia —lo diario primero—
 *  porque es el orden en que se despachan. */
export default function MaintenanceView() {
    const { data: currentUser } = useAuth()
    const queryClient = useQueryClient()
    const [labelFilter, setLabelFilter] = useState<TaskLabel | 'open'>('open')
    const [personFilter, setPersonFilter] = useState<string>('all')

    const { data: tasks, isLoading } = useQuery({
        queryKey: ['myTasks', 'withDone'],
        queryFn: () => getMyTasks({ includeDone: true }),
        retry: false
    })

    const { data: members } = useQuery({
        queryKey: ['scheduleMembers'],
        queryFn: getScheduleMembers,
        retry: false
    })

    const refresh = () => {
        queryClient.invalidateQueries({ queryKey: ['myTasks'] })
        queryClient.invalidateQueries({ queryKey: ['teamBoard'] })
        queryClient.invalidateQueries({ queryKey: ['day'] })
        queryClient.invalidateQueries({ queryKey: ['unscheduled'] })
    }

    const { mutate: setStatus, isPending: updating } = useMutation({
        mutationFn: updateWorkTaskStatus,
        onError: (error: Error) => toast.error(error.message),
        onSuccess: result => {
            if (result?.awaitingApproval) toast.info('Enviada a validación')
            refresh()
        }
    })

    const { mutate: patchTask } = useMutation({
        mutationFn: updateWorkTask,
        onError: (error: Error) => toast.error(error.message),
        onSuccess: () => refresh()
    })

    const { mutate: removeTask } = useMutation({
        mutationFn: deleteWorkTask,
        onError: (error: Error) => toast.error(error.message),
        onSuccess: () => { toast.success('Pendiente eliminado'); refresh() }
    })

    const operational = useMemo(
        () => (tasks ?? []).filter(task => !task.project),
        [tasks]
    )

    const afterPerson = useMemo(() => personFilter === 'all'
        ? operational
        : operational.filter(task => {
            const assignee = task.assignee
            const id = assignee && typeof assignee !== 'string' ? assignee._id : assignee
            return id === personFilter
        }),
        [operational, personFilter]
    )

    const counts = useMemo(() => {
        const result: Record<string, number> = { open: 0 }
        for (const label of LABEL_ORDER) result[label] = 0
        for (const task of afterPerson) {
            const label = getTaskLabel(task)
            result[label]++
            if (label !== 'done') result.open++
        }
        return result
    }, [afterPerson])

    const visible = afterPerson.filter(task => {
        const label = getTaskLabel(task)
        return labelFilter === 'open' ? label !== 'done' : label === labelFilter
    })

    /** Agrupado por cadencia, en el orden en que se trabaja. */
    const groups = useMemo(() => FREQUENCY_ORDER
        .map(frequency => ({
            frequency,
            tasks: visible.filter(task => (task.frequency ?? 'none') === frequency)
        }))
        .filter(group => group.tasks.length > 0),
        [visible]
    )

    const FILTERS: { key: TaskLabel | 'open', label: string }[] = [
        { key: 'open', label: 'Abiertas' },
        ...LABEL_ORDER.map(label => ({ key: label, label: labelTranslations[label] }))
    ]

    return (
        <>
            <PageHeader
                title="Mantenimiento"
                subtitle="Lo operativo que se repite: contenido, diseño, campañas, formularios y bases de datos."
            />

            <div className="card overflow-hidden max-w-4xl">
                <div className="flex flex-wrap items-center gap-1 px-2 py-2 border-b border-line">
                    {FILTERS.map(item => {
                        const active = labelFilter === item.key
                        return (
                            <button
                                key={item.key}
                                type="button"
                                onClick={() => setLabelFilter(item.key)}
                                aria-pressed={active}
                                className={`h-8 px-2.5 rounded text-xs font-semibold whitespace-nowrap
                                    transition-colors ${
                                    active ? 'bg-brand-50 text-brand-700' : 'text-ink-muted hover:bg-slate-100'
                                }`}
                            >
                                {item.label}
                                <span className={`ml-1.5 tabular ${active ? 'text-brand-500' : 'text-ink-subtle'}`}>
                                    {counts[item.key] ?? 0}
                                </span>
                            </button>
                        )
                    })}

                    {members && members.length > 1 && (
                        <select
                            value={personFilter}
                            onChange={event => setPersonFilter(event.target.value)}
                            aria-label="Filtrar por responsable"
                            className="ml-auto h-8 py-0 pl-2 pr-7 text-xs font-medium
                                border-line-strong rounded text-ink-muted"
                        >
                            <option value="all">Todo el equipo</option>
                            {members.map(member => (
                                <option key={member._id} value={member._id}>
                                    {member._id === currentUser?._id ? 'Solo lo mío' : member.name}
                                </option>
                            ))}
                        </select>
                    )}
                </div>

                <div className="px-2 py-2 border-b border-line">
                    <QuickCreateTask label="Nuevo pendiente" />
                </div>

                {isLoading ? (
                    <EmptyState title="Cargando…" />
                ) : groups.length === 0 ? (
                    <EmptyState
                        title={labelFilter === 'open' ? 'Nada pendiente' : 'Sin tareas en esta etiqueta'}
                        hint={labelFilter === 'open' ? 'Todo el mantenimiento está al día.' : undefined}
                    />
                ) : (
                    groups.map(group => (
                        <section key={group.frequency}>
                            <h2 className="flex items-center gap-2 px-3 pt-3 pb-1 sticky top-0 bg-surface z-10">
                                <span className="eyebrow">{frequencyTranslations[group.frequency]}</span>
                                <span className="text-2xs font-semibold text-ink-subtle tabular">
                                    {group.tasks.length}
                                </span>
                            </h2>
                            <ul className="divide-y divide-line">
                                {group.tasks.map(task => (
                                    <Row
                                        key={task._id}
                                        task={task}
                                        busy={updating}
                                        canEdit={canEditTask(task, currentUser)}
                                        canHide={canHideTask(task, currentUser)}
                                        onSetStatus={(taskId, status) => setStatus({ taskId, status })}
                                        onPatch={(taskId, formData) =>
                                            patchTask({ taskId, formData: formData as never })}
                                        onDelete={taskId => removeTask(taskId)}
                                    />
                                ))}
                            </ul>
                            <div className="px-2 pb-2">
                                <QuickCreateTask
                                    defaults={{ frequency: group.frequency }}
                                    label={`Nuevo en ${frequencyTranslations[group.frequency].toLowerCase()}`}
                                />
                            </div>
                        </section>
                    ))
                )}
            </div>

            <p className="text-xs text-ink-subtle mt-3 max-w-4xl">
                La frecuencia describe cada cuánto toca hacer cada cosa y ordena la lista.
                La generación automática de cada ocurrencia —con su checklist, su historial
                y la opción de omitir con motivo— llega en la fase de recurrencias.
            </p>
        </>
    )
}

/** Ocultar al equipo es potestad de la encargada, y solo sobre lo suyo: el
 *  servidor aplica la misma regla, esto solo evita mostrar un botón inútil. */
function canHideTask(task: Task, user?: { _id: string, role?: string }) {
    if (!user || user.role !== 'manager') return false
    const assignee = task.assignee
    const id = assignee && typeof assignee !== 'string' ? assignee._id : assignee
    return id === user._id
}

function canEditTask(task: Task, user?: { _id: string, role?: string }) {
    if (!user) return false
    if (user.role === 'manager') return true
    const assignee = task.assignee
    const id = assignee && typeof assignee !== 'string' ? assignee._id : assignee
    return id === user._id
}

function Row({ task, busy, canEdit, canHide, onSetStatus, onPatch, onDelete }: {
    task: Task
    busy: boolean
    canEdit: boolean
    canHide: boolean
    onSetStatus: (taskId: string, status: 'pending' | 'inProgress' | 'done') => void
    onPatch: (taskId: string, formData: Record<string, unknown>) => void
    onDelete: (taskId: string) => void
}) {
    const label = getTaskLabel(task)
    const done = label === 'done' || !!task.doneForPeriod
    const assignee = task.assignee && typeof task.assignee !== 'string' ? task.assignee : null
    const area = task.brand && typeof task.brand !== 'string' ? task.brand : null

    const [name, setName] = useState(task.name)
    const [confirming, setConfirming] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => { setName(task.name) }, [task.name])

    /** El nombre se edita en la propia fila: renombrar un pendiente operativo
     *  es frecuente y abrir un formulario para eso sobraría. */
    const commitName = () => {
        const next = name.trim()
        if (next.length === 0) { setName(task.name); return }
        if (next === task.name) return
        onPatch(task._id, { name: next })
    }

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

                    {canEdit ? (
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
