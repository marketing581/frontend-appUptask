import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { CheckIcon, ChevronDownIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { getDaySchedule } from '@/api/ScheduleAPI'
import {
    deleteWorkTask, getMyTasks, getTaskPage, updateWorkTask, updateWorkTaskStatus
} from '@/api/WorkTaskAPI'
import { useAuth } from '@/hooks/useAuth'
import { Task } from '@/types'
import { durationMinutes, formatDuration, formatTime, getZonedParts } from '@/utils/datetime'
import {
    ALERT_COLOR, frequencyBadge, frequencyShort, getTaskLabel, labelPalette, labelTranslations
} from '@/utils/taskLabels'
import { Avatar, Badge, Button, EmptyState, PageHeader, StatTile } from '@/components/ui'
import QuickCreateTask from '@/components/tasks/QuickCreateTask'
import WorkTaskRow from '@/components/tasks/WorkTaskRow'
import { canEditTask, canHideTask } from '@/utils/taskPermissions'

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
    'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

/** Cuántos pendientes cerrados se traen de golpe. El histórico completo puede
 *  ser de cientos y casi nunca se mira entero: se muestran los últimos y se
 *  dice cuántos quedan. */
const PAST_PAGE = 40

/** Espera a que se deje de escribir antes de consultar: una petición por
 *  tecla pulsada no aporta nada y satura la lista de resultados a medias. */
function useDebounced(value: string, delay: number) {
    const [settled, setSettled] = useState(value)
    useEffect(() => {
        const timer = setTimeout(() => setSettled(value), delay)
        return () => clearTimeout(timer)
    }, [value, delay])
    return settled
}

const projectNameOf = (task: Task) =>
    task.project && typeof task.project !== 'string' ? task.project.projectName : null

/** Fila compacta de solo lectura, para las listas donde no se edita
 *  (lo vencido, lo de proyecto). */
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

/** Histórico de pendientes puntuales ya cerrados.
 *
 *  Va plegado: no es trabajo por hacer, es memoria. Se abre para responder
 *  «¿esto ya lo hicimos?», y por eso lo primero que ofrece al abrirse es un
 *  buscador y no una lista interminable. */
function PastTasks({ userId }: { userId?: string }) {
    const [open, setOpen] = useState(false)
    const [term, setTerm] = useState('')
    const query = useDebounced(term, 300)

    // La búsqueda la resuelve el servidor sobre todo el histórico: filtrar solo
    // la página cargada haría que un pendiente que sí existe pareciera no estar.
    const { data, isLoading, isFetching } = useQuery({
        queryKey: ['pastTasks', userId, query],
        queryFn: () => getTaskPage({
            assignee: userId,
            kind: 'oneOff',
            status: 'done',
            limit: PAST_PAGE,
            q: query || undefined
        }),
        enabled: open && !!userId,
        placeholderData: previous => previous,
        retry: false
    })

    const tasks = useMemo(() => data?.tasks ?? [], [data])
    const total = data?.total ?? 0

    return (
        <div className="card overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen(value => !value)}
                aria-expanded={open}
                className="w-full flex items-center justify-between px-3 h-11 text-left
                    hover:bg-surface-sunken transition-colors"
            >
                <div>
                    <h2 className="text-sm font-bold text-ink">Pendientes pasados</h2>
                    <p className="text-2xs text-ink-subtle leading-none">
                        Lo puntual que ya cerraste
                    </p>
                </div>
                <span className="flex items-center gap-2">
                    {open && total > 0 && !query && (
                        <span className="text-2xs font-semibold text-ink-subtle tabular">{total}</span>
                    )}
                    <ChevronDownIcon
                        className={`w-4 h-4 text-ink-subtle transition-transform ${open ? 'rotate-180' : ''}`}
                    />
                </span>
            </button>

            {open && (
                <div className="border-t border-line">
                    <label className="flex items-center gap-2 px-3 py-2 border-b border-line">
                        <MagnifyingGlassIcon className="w-4 h-4 text-ink-subtle shrink-0" />
                        <input
                            value={term}
                            onChange={event => setTerm(event.target.value)}
                            placeholder="Buscar en el histórico…"
                            aria-label="Buscar en pendientes pasados"
                            className="flex-1 border-0 p-0 text-sm placeholder:text-ink-subtle
                                focus:ring-0 bg-transparent"
                        />
                    </label>

                    {isLoading ? (
                        <p className="px-3 py-6 text-center text-sm text-ink-muted">Cargando…</p>
                    ) : tasks.length === 0 ? (
                        <EmptyState
                            title={query ? 'Nada con ese nombre' : 'Todavía no hay histórico'}
                            hint={query ? undefined : 'Aquí quedará lo puntual que vayas cerrando.'}
                        />
                    ) : (
                        <>
                            <ul className={`divide-y divide-line max-h-96 overflow-y-auto
                                ${isFetching ? 'opacity-50' : ''}`}>
                                {tasks.map(task => (
                                    <li key={task._id} className="flex items-start gap-2.5 px-3 py-1.5">
                                        <CheckIcon
                                            className="w-3.5 h-3.5 mt-1 shrink-0 text-stage-done"
                                            strokeWidth={3}
                                        />
                                        <span className="text-sm text-ink-muted leading-snug">
                                            {task.name}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                            {total > tasks.length && (
                                <p className="px-3 py-2 text-2xs text-ink-subtle border-t border-line">
                                    {query
                                        ? `${total} coinciden; se muestran ${tasks.length}. Afina la búsqueda.`
                                        : `Se muestran los ${tasks.length} más recientes de ${total}.`}
                                </p>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    )
}

export default function MyWorkView() {
    const { data: currentUser } = useAuth()
    const queryClient = useQueryClient()
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
        queryClient.invalidateQueries({ queryKey: ['pastTasks'] })
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

    const mine = useMemo(
        () => (tasks ?? []).filter(task => {
            const assignee = task.assignee
            const id = assignee && typeof assignee !== 'string' ? assignee._id : assignee
            return id === currentUser?._id
        }),
        [tasks, currentUser]
    )

    /** Tres naturalezas de trabajo, que se piensan y se despachan distinto:
     *   - mantenimiento: vuelve solo, se cierra en el día;
     *   - pendientes: ocurren una vez y desaparecen de la lista al cerrarlos;
     *   - proyecto: arrastran seguimiento, validación y entregables.
     *  No hace falta un campo nuevo: la cadencia y el proyecto ya lo dicen. */
    const maintenance = mine.filter(task => !task.project && task.frequency !== 'none')
    const oneOff = mine.filter(task => !task.project && (task.frequency ?? 'none') === 'none')
    const projectWork = mine.filter(task => task.project)

    const timezone = day?.timezone ?? 'America/Lima'
    const parts = getZonedParts(today, timezone)
    const weekdayIndex = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12)).getUTCDay()

    const blocked = mine.filter(task => task.onHold?.active)
    const waitingValidation = mine.filter(task => getTaskLabel(task) === 'toValidate')

    const rowProps = (task: Task) => ({
        busy: completing,
        canEdit: canEditTask(task, currentUser),
        canHide: canHideTask(task, currentUser),
        onSetStatus: (taskId: string, status: 'pending' | 'inProgress' | 'done') =>
            complete({ taskId, status }),
        onPatch: (taskId: string, formData: Record<string, unknown>) =>
            patchTask({ taskId, formData: formData as never }),
        onDelete: (taskId: string) => removeTask(taskId)
    })

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

                    {/* Pendientes: ocurren una vez y se acaban. Es donde va a
                        parar casi todo lo que surge en el día. */}
                    <div className="card overflow-hidden">
                        <div className="flex items-center justify-between px-3 h-11 border-b border-line">
                            <div>
                                <h2 className="text-sm font-bold text-ink">
                                    Pendientes
                                    {oneOff.length > 0 && (
                                        <span className="ml-1.5 text-ink-subtle tabular font-semibold">
                                            {oneOff.length}
                                        </span>
                                    )}
                                </h2>
                                <p className="text-2xs text-ink-subtle leading-none">
                                    De una sola vez, sin cadencia ni proyecto
                                </p>
                            </div>
                            <Link to="/semana" className="text-xs font-semibold text-brand-600 hover:underline">
                                Programar
                            </Link>
                        </div>

                        <div className="px-2 py-2 border-b border-line">
                            <QuickCreateTask label="Nuevo pendiente" defaults={{ frequency: 'none' }} />
                        </div>

                        {oneOff.length === 0 ? (
                            <EmptyState
                                title="Sin pendientes sueltos"
                                hint="Lo que surja y no se repita, anótalo aquí."
                            />
                        ) : (
                            <ul className="divide-y divide-line max-h-96 overflow-y-auto">
                                {oneOff.map(task => (
                                    <WorkTaskRow
                                        key={task._id}
                                        task={task}
                                        showFrequency={false}
                                        showDueDate
                                        {...rowProps(task)}
                                    />
                                ))}
                            </ul>
                        )}
                    </div>

                    <PastTasks userId={currentUser?._id} />
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

                    {/* Mantenimiento: rápido, repetitivo, se termina en el día */}
                    <div className="card overflow-hidden">
                        <div className="flex items-center justify-between px-3 h-11 border-b border-line">
                            <div>
                                <h2 className="text-sm font-bold text-ink">
                                    Mantenimiento
                                    {maintenance.length > 0 && (
                                        <span className="ml-1.5 text-ink-subtle tabular font-semibold">
                                            {maintenance.length}
                                        </span>
                                    )}
                                </h2>
                                <p className="text-2xs text-ink-subtle leading-none">
                                    Operativo que se repite
                                </p>
                            </div>
                            <Link to="/mantenimiento" className="text-xs font-semibold text-brand-600 hover:underline">
                                Ver todo
                            </Link>
                        </div>

                        {maintenance.length === 0 ? (
                            <EmptyState
                                title="Sin mantenimiento abierto"
                                hint="Lo que se repite cada día o cada semana vive en Mantenimiento."
                            />
                        ) : (
                            <ul className="divide-y divide-line max-h-80 overflow-y-auto">
                                {maintenance.map(task => (
                                    <WorkTaskRow key={task._id} task={task} {...rowProps(task)} />
                                ))}
                            </ul>
                        )}
                    </div>

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
