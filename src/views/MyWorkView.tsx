import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { CheckIcon, PlusIcon } from '@heroicons/react/24/outline'
import { getDaySchedule } from '@/api/ScheduleAPI'
import { createWorkTask, getMyTasks, updateWorkTaskStatus } from '@/api/WorkTaskAPI'
import { useAuth } from '@/hooks/useAuth'
import { Task } from '@/types'
import { durationMinutes, formatDuration, formatTime, getZonedParts } from '@/utils/datetime'
import {
    ALERT_COLOR, frequencyBadge, frequencyShort, getTaskLabel, labelPalette, labelTranslations
} from '@/utils/taskLabels'
import { Avatar, Badge, Button, EmptyState, PageHeader, StatTile } from '@/components/ui'

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
    'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

const projectNameOf = (task: Task) =>
    task.project && typeof task.project !== 'string' ? task.project.projectName : null

/** Fila compacta de tarea, con la casilla de completar a la izquierda.
 *  Un clic cierra el trabajo operativo sin abrir nada. */
function TaskRow({ task, onComplete, busy, showProject = true }: {
    task: Task
    onComplete: (taskId: string) => void
    busy: boolean
    showProject?: boolean
}) {
    const label = getTaskLabel(task)
    const palette = labelPalette[label]
    const project = projectNameOf(task)
    const done = label === 'done' || !!task.doneForPeriod

    return (
        <li className="group flex items-start gap-2.5 px-3 py-2 hover:bg-surface-sunken transition-colors">
            <button
                type="button"
                disabled={busy || done}
                onClick={() => onComplete(task._id)}
                aria-label={done ? 'Ya está lista' : `Marcar "${task.name}" como lista`}
                className={`mt-0.5 w-[18px] h-[18px] shrink-0 rounded-full border-2 grid place-content-center
                    transition-colors disabled:pointer-events-none ${
                    done
                        ? 'bg-stage-done border-stage-done text-white'
                        : 'border-line-strong text-transparent hover:border-stage-done hover:text-stage-done'
                }`}
            >
                <CheckIcon className="w-3 h-3" strokeWidth={3} />
            </button>

            <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium leading-snug ${
                    done ? 'text-ink-subtle line-through' : 'text-ink'
                }`}>
                    {task.name}
                </p>
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    {task.doneForPeriod ? (
                        <Badge className="bg-emerald-100 text-emerald-800">
                            Hecho {task.frequency === 'daily' ? 'hoy' : 'en este periodo'}
                        </Badge>
                    ) : (
                        <Badge className={palette.badge}>{labelTranslations[label]}</Badge>
                    )}
                    {task.frequency && task.frequency !== 'none' && (
                        <Badge className={frequencyBadge}>{frequencyShort[task.frequency]}</Badge>
                    )}
                    {task.onHold?.active && (
                        <Badge variant="alert">
                            En espera{task.onHold.waitingOn && ` · ${task.onHold.waitingOn}`}
                        </Badge>
                    )}
                    {task.isPrivate && (
                        <Badge className="bg-slate-200 text-slate-700 ring-1 ring-inset ring-slate-400">
                            Solo tú lo ves
                        </Badge>
                    )}
                    {task.priority === 'urgent' && <Badge variant="alert">Urgente</Badge>}
                    {showProject && (
                        <span className="text-2xs text-ink-subtle truncate">
                            {project ?? 'Operativo'}
                        </span>
                    )}
                </div>
            </div>
        </li>
    )
}

export default function MyWorkView() {
    const { data: currentUser } = useAuth()
    const queryClient = useQueryClient()
    const [quickTask, setQuickTask] = useState('')
    const today = useMemo(() => new Date(), [])

    const { data: day } = useQuery({
        queryKey: ['day', today.toISOString().slice(0, 10)],
        queryFn: () => getDaySchedule({ date: today }),
        retry: false
    })

    const { data: tasks } = useQuery({
        queryKey: ['myTasks'],
        queryFn: () => getMyTasks(),
        retry: false
    })

    const refresh = () => {
        queryClient.invalidateQueries({ queryKey: ['myTasks'] })
        queryClient.invalidateQueries({ queryKey: ['day'] })
        queryClient.invalidateQueries({ queryKey: ['week'] })
        queryClient.invalidateQueries({ queryKey: ['unscheduled'] })
    }

    const { mutate: complete, isPending: completing } = useMutation({
        mutationFn: updateWorkTaskStatus,
        onError: (error: Error) => toast.error(error.message),
        onSuccess: result => {
            if (result?.awaitingApproval) {
                toast.info('Enviada a validación: tiene aprobadora asignada')
            } else {
                toast.success('Lista')
            }
            refresh()
        }
    })

    const { mutate: addTask, isPending: adding } = useMutation({
        mutationFn: createWorkTask,
        onError: (error: Error) => toast.error(error.message),
        onSuccess: () => { setQuickTask(''); refresh() }
    })

    const mine = useMemo(
        () => (tasks ?? []).filter(task => {
            const assignee = task.assignee
            const id = assignee && typeof assignee !== 'string' ? assignee._id : assignee
            return id === currentUser?._id
        }),
        [tasks, currentUser]
    )

    // Lo operativo se resuelve en el día; lo de proyecto arrastra seguimiento.
    const maintenance = mine.filter(task => !task.project)
    const projectWork = mine.filter(task => task.project)

    const timezone = day?.timezone ?? 'America/Lima'
    const parts = getZonedParts(today, timezone)
    const weekdayIndex = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12)).getUTCDay()

    const blocked = mine.filter(task => task.onHold?.active)
    const waitingValidation = mine.filter(task => getTaskLabel(task) === 'toValidate')

    const handleQuickAdd = (event: React.FormEvent) => {
        event.preventDefault()
        const name = quickTask.trim()
        if (name.length === 0 || adding) return
        addTask({ name })
    }

    return (
        <>
            <PageHeader
                title={`Hola, ${currentUser?.name.split(' ')[0] ?? ''}`}
                subtitle={`${WEEKDAYS[weekdayIndex]} ${parts.day} de ${MONTHS[parts.month - 1]}`}
                actions={
                    <Link to="/semana">
                        <Button variant="primary" size="md">Ir al calendario</Button>
                    </Link>
                }
            />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                <StatTile
                    label="Programado hoy"
                    value={formatDuration(day?.scheduledMinutes ?? 0)}
                    hint="en bloques de trabajo"
                />
                <StatTile
                    label="Entregables hoy"
                    value={String(day?.dueToday.length ?? 0)}
                    hint="con fecha límite hoy"
                />
                <StatTile
                    label="Vencidos"
                    value={String(day?.overdue.length ?? 0)}
                    tone={(day?.overdue.length ?? 0) > 0 ? ALERT_COLOR : undefined}
                    hint="fecha límite pasada"
                />
                <StatTile
                    label="En espera"
                    value={String(blocked.length)}
                    tone={blocked.length > 0 ? ALERT_COLOR : undefined}
                    hint="dependen de alguien más"
                />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-5">
                {/* Columna izquierda: el día */}
                <section className="space-y-5">
                    <div className="card overflow-hidden">
                        <div className="flex items-center justify-between px-3 h-11 border-b border-line">
                            <h2 className="text-sm font-bold text-ink">Mi día</h2>
                            <Link to="/semana" className="text-xs font-semibold text-brand-600 hover:underline">
                                Ver calendario
                            </Link>
                        </div>

                        {(day?.blocks.length ?? 0) === 0 ? (
                            <EmptyState
                                title="Nada programado hoy"
                                hint="Arrastra pendientes al calendario para saber cuándo harás cada cosa."
                            />
                        ) : (
                            <ul className="divide-y divide-line">
                                {day!.blocks.map(block => {
                                    const task = typeof block.task === 'string' ? null : block.task
                                    const accent = !task?.status
                                        ? '#94a3b8'
                                        : task.onHold?.active
                                            ? ALERT_COLOR
                                            : labelPalette[getTaskLabel(task as never)].solid
                                    return (
                                        <li key={block._id} className="flex items-center gap-3 px-3 py-2">
                                            <span className="w-1 h-8 rounded-full shrink-0"
                                                style={{ backgroundColor: accent }} />
                                            <span className="text-xs font-semibold text-ink-muted tabular w-[86px] shrink-0">
                                                {formatTime(new Date(block.start), timezone)}–
                                                {formatTime(new Date(block.end), timezone)}
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block text-sm font-medium text-ink truncate">
                                                    {task?.name ?? 'Tarea'}
                                                </span>
                                                <span className="block text-2xs text-ink-subtle">
                                                    {formatDuration(durationMinutes(block.start, block.end))}
                                                    {task?.status && ` · ${labelTranslations[getTaskLabel(task as never)]}`}
                                                </span>
                                            </span>
                                        </li>
                                    )
                                })}
                            </ul>
                        )}
                    </div>

                    {/* Mantenimiento: rápido, repetitivo, se termina en el día */}
                    <div className="card overflow-hidden">
                        <div className="flex items-center justify-between px-3 h-11 border-b border-line">
                            <div>
                                <h2 className="text-sm font-bold text-ink">Mantenimiento</h2>
                                <p className="text-2xs text-ink-subtle leading-none">
                                    Operativo del día a día
                                </p>
                            </div>
                            <Link to="/mantenimiento" className="text-xs font-semibold text-brand-600 hover:underline">
                                Ver todo
                            </Link>
                        </div>

                        <form onSubmit={handleQuickAdd} className="flex items-center gap-2 px-3 py-2 border-b border-line">
                            <PlusIcon className="w-4 h-4 text-ink-subtle shrink-0" />
                            <input
                                value={quickTask}
                                onChange={event => setQuickTask(event.target.value)}
                                placeholder="Añadir pendiente rápido y pulsar Enter…"
                                aria-label="Nuevo pendiente operativo"
                                className="flex-1 border-0 p-0 text-sm placeholder:text-ink-subtle
                                    focus:ring-0 bg-transparent"
                            />
                        </form>

                        {maintenance.length === 0 ? (
                            <EmptyState title="Sin pendientes operativos" hint="Todo el trabajo del día está cerrado." />
                        ) : (
                            <ul className="divide-y divide-line max-h-80 overflow-y-auto">
                                {maintenance.map(task => (
                                    <TaskRow
                                        key={task._id}
                                        task={task}
                                        busy={completing}
                                        showProject={false}
                                        onComplete={taskId => complete({ taskId, status: 'done' })}
                                    />
                                ))}
                            </ul>
                        )}
                    </div>
                </section>

                {/* Columna derecha: seguimiento */}
                <section className="space-y-5">
                    {(day?.overdue.length ?? 0) > 0 && (
                        <div className="card overflow-hidden border-red-200">
                            <div className="px-3 h-11 flex items-center border-b border-red-200 bg-red-50">
                                <h2 className="text-sm font-bold text-red-800">
                                    Vencidos ({day!.overdue.length})
                                </h2>
                            </div>
                            <ul className="divide-y divide-line">
                                {day!.overdue.map(task => (
                                    <TaskRow
                                        key={task._id}
                                        task={task}
                                        busy={completing}
                                        onComplete={taskId => complete({ taskId, status: 'done' })}
                                    />
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="card overflow-hidden">
                        <div className="flex items-center justify-between px-3 h-11 border-b border-line">
                            <div>
                                <h2 className="text-sm font-bold text-ink">Trabajo de proyecto</h2>
                                <p className="text-2xs text-ink-subtle leading-none">
                                    Con seguimiento y validación
                                </p>
                            </div>
                            <Link to="/proyectos" className="text-xs font-semibold text-brand-600 hover:underline">
                                Ver proyectos
                            </Link>
                        </div>

                        {projectWork.length === 0 ? (
                            <EmptyState
                                title="Sin tareas de proyecto"
                                hint="Las tareas que formen parte de un proyecto aparecerán aquí."
                            />
                        ) : (
                            <ul className="divide-y divide-line max-h-96 overflow-y-auto">
                                {projectWork.map(task => (
                                    <TaskRow
                                        key={task._id}
                                        task={task}
                                        busy={completing}
                                        onComplete={taskId => complete({ taskId, status: 'done' })}
                                    />
                                ))}
                            </ul>
                        )}
                    </div>

                    {waitingValidation.length > 0 && (
                        <div className="card overflow-hidden">
                            <div className="px-3 h-11 flex items-center border-b border-line">
                                <h2 className="text-sm font-bold text-ink">
                                    Esperando aprobación ({waitingValidation.length})
                                </h2>
                            </div>
                            <ul className="divide-y divide-line">
                                {waitingValidation.map(task => {
                                    const approver = task.review?.approver
                                    const approverName = approver && typeof approver !== 'string'
                                        ? approver.name
                                        : null
                                    return (
                                        <li key={task._id} className="flex items-center gap-2.5 px-3 py-2">
                                            <span className="w-1 h-8 rounded-full bg-stage-validate shrink-0" />
                                            <span className="min-w-0 flex-1">
                                                <span className="block text-sm font-medium text-ink truncate">
                                                    {task.name}
                                                </span>
                                                <span className="block text-2xs text-ink-subtle">
                                                    {approverName ? `Aprueba ${approverName}` : 'Sin aprobadora designada'}
                                                </span>
                                            </span>
                                            {approverName && <Avatar name={approverName} size="sm" />}
                                        </li>
                                    )
                                })}
                            </ul>
                        </div>
                    )}
                </section>
            </div>
        </>
    )
}
