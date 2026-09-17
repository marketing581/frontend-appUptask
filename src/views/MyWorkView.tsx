import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { CheckIcon, ChevronDownIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { getScheduleMembers } from '@/api/ScheduleAPI'
import {
    deleteWorkTask, getMyTasks, getTaskPage, updateWorkTask, updateWorkTaskStatus
} from '@/api/WorkTaskAPI'
import { useAuth } from '@/hooks/useAuth'
import { Task } from '@/types'
import {
    DEFAULT_TIMEZONE, addDays, dayKey, getZonedParts, startOfWeek
} from '@/utils/datetime'
import { getTaskLabel } from '@/utils/taskLabels'
import { Button, EmptyState, PageHeader } from '@/components/ui'
import PersonSwitcher from '@/components/team/PersonSwitcher'
import QuickCreateTask from '@/components/tasks/QuickCreateTask'
import SimpleTaskRow from '@/components/tasks/SimpleTaskRow'
import { PlanDay } from '@/components/tasks/PlanDayPicker'
import { canEditTask, canHideTask } from '@/utils/taskPermissions'

/** "Mi trabajo": la primera pantalla, pensada para mirarla veinte veces al
 *  día y saber en un vistazo qué toca.
 *
 *  Antes repartía lo mismo en seis tarjetas —el día por horas, pendientes,
 *  mantenimiento, proyecto, vencidos, esperando aprobación— y había que leer
 *  las seis para saber qué hacer. Ahora es: una semana simple de lunes a
 *  viernes sin horas, una sola lista con todo lo abierto de donde se jala lo
 *  de la semana, y lo que ya se cerró, aparte. */

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
    'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const WEEKDAY_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie']

/** Cuántos pendientes cerrados se traen de golpe al abrir "Finalizados". */
const FINISHED_PAGE = 40

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

/** Naturaleza del trabajo, solo para poder acotar la lista cuando crece: por
 *  defecto se ve todo junto, como una sola lista de pendientes. */
type Kind = 'maintenance' | 'project' | 'oneOff'

const kindOf = (task: Task): Kind => {
    if (task.project) return 'project'
    if ((task.frequency ?? 'none') !== 'none') return 'maintenance'
    return 'oneOff'
}

const KIND_FILTERS: { key: Kind, label: string }[] = [
    { key: 'maintenance', label: 'Mantenimiento' },
    { key: 'project', label: 'Proyecto' },
    { key: 'oneOff', label: 'Pendientes' }
]

/** Pendientes ya cerrados: lo que se acaba de terminar y lo que se terminó
 *  hace tiempo. Va plegado, como una libreta de lo hecho: no estorba en el
 *  día a día, pero está a un clic cuando hace falta revisar o buscar algo. */
function FinishedTasks({ userId }: { userId?: string }) {
    const [open, setOpen] = useState(false)
    const [term, setTerm] = useState('')
    const query = useDebounced(term, 300)

    // La búsqueda la resuelve el servidor sobre todo el histórico: filtrar
    // solo la página cargada haría que algo que sí existe pareciera no estar.
    const { data, isLoading, isFetching } = useQuery({
        queryKey: ['finishedTasks', userId, query],
        queryFn: () => getTaskPage({
            assignee: userId,
            status: 'done',
            limit: FINISHED_PAGE,
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
                <h2 className="text-sm font-bold text-ink">Finalizados</h2>
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
                            placeholder="Buscar en lo que ya cerraste…"
                            aria-label="Buscar en finalizados"
                            className="flex-1 border-0 p-0 text-sm placeholder:text-ink-subtle
                                focus:ring-0 bg-transparent"
                        />
                    </label>

                    {isLoading ? (
                        <p className="px-3 py-6 text-center text-sm text-ink-muted">Cargando…</p>
                    ) : tasks.length === 0 ? (
                        <EmptyState
                            title={query ? 'Nada con ese nombre' : 'Todavía no hay nada cerrado'}
                            hint={query ? undefined : 'Lo que vayas marcando como hecho quedará aquí.'}
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
                                        <span className="text-sm text-ink-muted leading-snug truncate">
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
    const now = useMemo(() => new Date(), [])
    const timezone = currentUser?.timezone ?? DEFAULT_TIMEZONE
    const todayKey = dayKey(now, timezone)

    /** Lunes a viernes de la semana en curso. Se recalcula sola cada semana:
     *  como se guarda una fecha real por tarea y no un "hoy"/"mañana"
     *  relativo, en cuanto cambia la semana el lunes vuelve a estar vacío
     *  sin que haga falta ningún reinicio manual. */
    const weekDays: PlanDay[] = useMemo(() => {
        const monday = startOfWeek(now, timezone)
        return WEEKDAY_SHORT.map((label, index) => {
            const date = addDays(monday, index)
            const key = dayKey(date, timezone)
            return { key, label, isToday: key === todayKey }
        })
    }, [now, timezone, todayKey])

    const weekRangeLabel = useMemo(() => {
        const first = getZonedParts(addDays(startOfWeek(now, timezone), 0), timezone)
        const last = getZonedParts(addDays(startOfWeek(now, timezone), 4), timezone)
        return first.month === last.month
            ? `${first.day} – ${last.day} de ${MONTHS[last.month - 1]}`
            : `${first.day} de ${MONTHS[first.month - 1]} – ${last.day} de ${MONTHS[last.month - 1]}`
    }, [now, timezone])

    /** La encargada puede abrir esta misma pantalla para Nicole o Sofianne: es
     *  la vista de «qué le toca a una persona», y necesita responderla también
     *  de quien coordina. Las demás solo se ven a sí mismas, y el servidor
     *  aplica esa misma regla. */
    const isManager = currentUser?.role === 'manager'
    const [viewing, setViewing] = useState<string>('')
    const personId = viewing || currentUser?._id

    const { data: members } = useQuery({
        queryKey: ['scheduleMembers'],
        queryFn: getScheduleMembers,
        enabled: isManager,
        retry: false
    })

    const person = members?.find(member => member._id === personId)
    const isSelf = !viewing || viewing === currentUser?._id
    const firstName = person?.name.split(' ')[0] ?? ''

    // Sin fechas ni horas: lo abierto es lo abierto, esté o no planificado
    // para algún día. El servidor ya excluye lo cerrado por defecto.
    const { data: tasks, isLoading } = useQuery({
        queryKey: ['myTasks', personId],
        queryFn: () => getMyTasks({ assignee: personId }),
        enabled: !!personId,
        retry: false
    })

    const [kindFilter, setKindFilter] = useState<'all' | Kind>('all')

    const refresh = () => {
        queryClient.invalidateQueries({ queryKey: ['myTasks'] })
        queryClient.invalidateQueries({ queryKey: ['finishedTasks'] })
        queryClient.invalidateQueries({ queryKey: ['day'] })
        queryClient.invalidateQueries({ queryKey: ['week'] })
        queryClient.invalidateQueries({ queryKey: ['unscheduled'] })
        queryClient.invalidateQueries({ queryKey: ['teamBoard'] })
    }

    const { mutate: setStatus, isPending: changingStatus } = useMutation({
        mutationFn: updateWorkTaskStatus,
        onError: (error: Error) => toast.error(error.message),
        onSuccess: result => {
            if (result?.awaitingApproval) {
                toast.info('Enviada a validación: tiene aprobadora asignada')
            } else if (result?.status === 'done' || result?.occurrenceCompleted) {
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

    const mine = useMemo(() => tasks ?? [], [tasks])

    // `plannedDate` se guarda como fecha simple ("YYYY-MM-DD"), igual que
    // `dueDate`: se compara tomando esos mismos diez caracteres, sin volver a
    // interpretarla por zona horaria. Reinterpretarla movería la fecha un día
    // según a qué hora del día se mire, y "el martes" dejaría de ser el martes.
    const weekKeys = useMemo(() => new Set(weekDays.map(day => day.key)), [weekDays])
    const dayOf = (task: Task) => task.plannedDate?.slice(0, 10) ?? null
    const isPlannedThisWeek = useMemo(
        () => (task: Task) => {
            const key = dayOf(task)
            return !!key && weekKeys.has(key)
        },
        [weekKeys]
    )

    const tasksByDay = useMemo(() => {
        const map = new Map<string, Task[]>(weekDays.map(day => [day.key, []]))
        for (const task of mine) {
            const key = dayOf(task)
            if (key && map.has(key)) map.get(key)!.push(task)
        }
        return map
    }, [mine, weekDays])

    const plannedCount = useMemo(() => mine.filter(isPlannedThisWeek).length, [mine, isPlannedThisWeek])
    const backlog = useMemo(() => mine.filter(task => !isPlannedThisWeek(task)), [mine, isPlannedThisWeek])

    const kindsPresent = useMemo(() => new Set(backlog.map(kindOf)), [backlog])
    const visibleBacklog = kindFilter === 'all' ? backlog : backlog.filter(task => kindOf(task) === kindFilter)

    const overdueCount = useMemo(() => mine.filter(task => {
        if (getTaskLabel(task) === 'done' || task.doneForPeriod) return false
        return !!task.dueDate && task.dueDate.slice(0, 10) < todayKey
    }).length, [mine, todayKey])

    const parts = getZonedParts(now, timezone)
    const weekdayIndex = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12)).getUTCDay()

    const rowProps = (task: Task) => ({
        weekDays,
        todayKey,
        busy: changingStatus,
        canEdit: canEditTask(task, currentUser),
        canHide: canHideTask(task, currentUser),
        onSetStatus: (taskId: string, status: Task['status']) => setStatus({ taskId, status }),
        onSetDay: (taskId: string, dayKey: string | null) =>
            patchTask({ taskId, formData: { plannedDate: dayKey } }),
        onPatch: (taskId: string, formData: Record<string, unknown>) =>
            patchTask({ taskId, formData: formData as never }),
        onDelete: (taskId: string) => removeTask(taskId)
    })

    return (
        <>
            <PageHeader
                title={isSelf
                    ? `Hola, ${currentUser?.name.split(' ')[0] ?? ''}`
                    : `Trabajo de ${firstName}`}
                subtitle={`${WEEKDAYS[weekdayIndex]} ${parts.day} de ${MONTHS[parts.month - 1]}`}
                actions={
                    <Link to="/semana">
                        <Button variant="secondary" size="md">Ir al calendario</Button>
                    </Link>
                }
            />

            {isManager && members && members.length > 1 && (
                <div className="mb-4">
                    <PersonSwitcher
                        members={members}
                        value={personId ?? ''}
                        onChange={setViewing}
                        currentUserId={currentUser?._id}
                        selfLabel="Lo mío"
                    />
                </div>
            )}

            {overdueCount > 0 && (
                <p className="flex items-center gap-1.5 text-xs font-semibold text-red-700 mb-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-600 shrink-0" />
                    {overdueCount === 1 ? '1 pendiente vencido' : `${overdueCount} pendientes vencidos`}
                </p>
            )}

            {/* Mi semana: lunes a viernes, sin hora. Tocar la estrella de un
                pendiente de la lista de abajo lo trae a uno de estos días; la
                semana se renueva sola cuando empieza la siguiente. */}
            <section className="mb-5">
                <div className="flex items-baseline justify-between mb-2">
                    <h2 className="text-sm font-bold text-ink">
                        Mi semana
                        {plannedCount > 0 && (
                            <span className="ml-1.5 text-ink-subtle tabular font-semibold">{plannedCount}</span>
                        )}
                    </h2>
                    <p className="text-2xs text-ink-subtle capitalize">{weekRangeLabel}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    {weekDays.map(day => {
                        const dayTasks = tasksByDay.get(day.key) ?? []
                        return (
                            <div key={day.key} className={`card overflow-hidden flex flex-col ${
                                day.isToday ? 'ring-1 ring-brand-300' : ''
                            }`}>
                                <div className={`flex items-center justify-between px-3 h-9 border-b border-line
                                    shrink-0 ${day.isToday ? 'bg-brand-50' : 'bg-surface-sunken'}`}>
                                    <span className={`text-xs font-bold ${
                                        day.isToday ? 'text-brand-700' : 'text-ink-muted'
                                    }`}>
                                        {day.label}
                                    </span>
                                    {dayTasks.length > 0 && (
                                        <span className="text-2xs font-semibold text-ink-subtle tabular">
                                            {dayTasks.length}
                                        </span>
                                    )}
                                </div>

                                {dayTasks.length === 0 ? (
                                    <p className="px-3 py-4 text-2xs text-ink-subtle text-center flex-1">
                                        Nada
                                    </p>
                                ) : (
                                    <ul className="divide-y divide-line">
                                        {dayTasks.map(task => (
                                            <SimpleTaskRow key={task._id} task={task} {...rowProps(task)} />
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )
                    })}
                </div>
            </section>

            <div className="max-w-2xl space-y-5">
                {/* Todos mis pendientes: una sola lista, sin separar por tipo
                    salvo que haga falta acotarla. De aquí se jala hacia un día
                    de "Mi semana" con la estrella de cada fila. */}
                <div className="card overflow-hidden">
                    <div className="flex items-center justify-between px-3 h-11 border-b border-line">
                        <h2 className="text-sm font-bold text-ink">
                            Todos mis pendientes
                            {backlog.length > 0 && (
                                <span className="ml-1.5 text-ink-subtle tabular font-semibold">
                                    {backlog.length}
                                </span>
                            )}
                        </h2>
                    </div>

                    <div className="px-2 py-2 border-b border-line">
                        <QuickCreateTask
                            label="Nuevo pendiente"
                            showFrequency={false}
                            defaults={{ assignee: personId, frequency: 'none' }}
                        />
                    </div>

                    {kindsPresent.size > 1 && (
                        <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 border-b border-line">
                            <button
                                type="button"
                                onClick={() => setKindFilter('all')}
                                aria-pressed={kindFilter === 'all'}
                                className={`h-7 px-2.5 rounded text-xs font-semibold transition-colors ${
                                    kindFilter === 'all'
                                        ? 'bg-brand-50 text-brand-700'
                                        : 'text-ink-muted hover:bg-slate-100'
                                }`}
                            >
                                Todo
                            </button>
                            {KIND_FILTERS.filter(item => kindsPresent.has(item.key)).map(item => (
                                <button
                                    key={item.key}
                                    type="button"
                                    onClick={() => setKindFilter(item.key)}
                                    aria-pressed={kindFilter === item.key}
                                    className={`h-7 px-2.5 rounded text-xs font-semibold transition-colors ${
                                        kindFilter === item.key
                                            ? 'bg-brand-50 text-brand-700'
                                            : 'text-ink-muted hover:bg-slate-100'
                                    }`}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {isLoading ? (
                        <p className="px-3 py-6 text-center text-sm text-ink-muted">Cargando…</p>
                    ) : visibleBacklog.length === 0 ? (
                        <EmptyState
                            title={backlog.length === 0 ? 'Sin pendientes abiertos' : 'Nada con ese filtro'}
                            hint={backlog.length === 0 ? 'Todo lo que tienes está en tu semana o ya está cerrado.' : undefined}
                        />
                    ) : (
                        <ul className="divide-y divide-line">
                            {visibleBacklog.map(task => (
                                <SimpleTaskRow key={task._id} task={task} {...rowProps(task)} />
                            ))}
                        </ul>
                    )}
                </div>

                <FinishedTasks userId={personId} />
            </div>
        </>
    )
}
