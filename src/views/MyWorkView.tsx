import { ComponentProps, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { getScheduleMembers } from '@/api/ScheduleAPI'
import {
    deleteWorkTask, getMyTasks, getTaskPage, requestWorkTaskReview,
    resolveWorkTaskReview, updateWorkTask, updateWorkTaskStatus
} from '@/api/WorkTaskAPI'
import { useAuth } from '@/hooks/useAuth'
import { Task } from '@/types'
import {
    DEFAULT_TIMEZONE, addDays, dayKey, getZonedParts, isSameDay, startOfWeek
} from '@/utils/datetime'
import { TaskLabel, getTaskLabel } from '@/utils/taskLabels'
import { TaskKind, kindOf } from '@/utils/taskKind'
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

/** Cuántos pendientes cerrados se traen de golpe al abrir "Finalizados".
 *  Más que en el histórico general: aquí hace falta cubrir de sobra la
 *  semana pasada y la actual para que la agrupación por semana no se quede
 *  corta a media semana. */
const FINISHED_PAGE = 80

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

const KIND_FILTERS: { key: TaskKind, label: string }[] = [
    { key: 'maintenance', label: 'Mantenimiento' },
    { key: 'project', label: 'Proyecto' },
    { key: 'oneOff', label: 'Pendientes' }
]

/** Pendientes ya cerrados: lo que se acaba de terminar y lo que se terminó
 *  hace tiempo. Va plegado, como una libreta de lo hecho: no estorba en el
 *  día a día, pero está a un clic cuando hace falta revisar o buscar algo. */
type FinishedBucket = 'today' | 'thisWeek' | 'older'

const BUCKET_LABEL: Record<FinishedBucket, string> = {
    today: 'Hoy',
    thisWeek: 'Esta semana',
    older: 'Anteriores'
}

/** La fecha real en que se cerró, no cuándo se tocó por última vez el
 *  registro: `updatedAt` cambia con cualquier edición posterior (renombrar,
 *  cambiar la descripción...), y eso la haría "saltar" a Hoy aunque se haya
 *  cerrado hace semanas. El historial de estados sí dice, sin ambigüedad,
 *  la última vez que de verdad llegó a Listo. */
function lastDoneAt(task: Task): Date | null {
    for (let i = task.statusHistory.length - 1; i >= 0; i--) {
        if (task.statusHistory[i].to === 'done') return new Date(task.statusHistory[i].changedAt)
    }
    return task.updatedAt ? new Date(task.updatedAt) : null
}

/** A qué grupo pertenece: hoy, en algún otro día de esta semana (mismo lunes
 *  de arranque que "Mi semana", para que "esta semana" signifique lo mismo
 *  en las dos partes de la pantalla), o antes.
 *
 *  Lo importado del histórico de Notion no trae una fecha real de cierre —el
 *  CSV de origen no la tenía— así que a la base le queda la fecha en que se
 *  corrió la migración, no la fecha en que de verdad se hizo el trabajo.
 *  Agruparlo por esa fecha inventada haría que cientos de tareas de hace
 *  meses parecieran cerradas "hoy". Se reconoce por la nota de su último
 *  cambio de estado: si nadie volvió a tocarla desde la importación, va
 *  directo a "Anteriores"; si alguien la retomó después, esa nota más
 *  reciente manda y sí cuenta como trabajo real de hoy o de esta semana. */
function bucketOf(task: Task, now: Date, timezone: string): FinishedBucket {
    const lastChange = task.statusHistory[task.statusHistory.length - 1]
    if (lastChange?.note?.includes('Importado del histórico de Notion')) return 'older'

    const finishedAt = lastDoneAt(task)
    if (!finishedAt) return 'older'
    if (isSameDay(finishedAt, now, timezone)) return 'today'
    const taskWeek = startOfWeek(finishedAt, timezone).getTime()
    const thisWeek = startOfWeek(now, timezone).getTime()
    return taskWeek === thisWeek ? 'thisWeek' : 'older'
}

type RowProps = Omit<ComponentProps<typeof SimpleTaskRow>, 'task'>

function FinishedTasks({ userId, now, timezone, rowProps, onDragOver, onDragLeave, onDrop, isDropTarget }: {
    userId?: string, now: Date, timezone: string
    rowProps: (task: Task, listTasks?: Task[]) => RowProps
    onDragOver: (event: React.DragEvent) => void
    onDragLeave: () => void
    onDrop: (event: React.DragEvent) => void
    isDropTarget: boolean
}) {
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
        enabled: !!userId,
        placeholderData: previous => previous,
        retry: false
    })

    // El servidor las trae ordenadas por última edición, no por cuándo se
    // cerraron de verdad —tocar la descripción de algo ya cerrado no debería
    // hacerlo saltar arriba—; se reordenan aquí por la fecha real de cierre.
    const tasks = useMemo(() => {
        return [...(data?.tasks ?? [])].sort(
            (a, b) => (lastDoneAt(b)?.getTime() ?? 0) - (lastDoneAt(a)?.getTime() ?? 0)
        )
    }, [data])
    const total = data?.total ?? 0

    /** Sin buscar, se agrupa por cuándo se cerró —Hoy primero, para lo que se
     *  acaba de terminar; luego el resto de esta semana; luego todo lo
     *  anterior—; buscando algo puntual, la agrupación no aporta y se
     *  muestra en una sola lista. */
    const groups = useMemo(() => {
        if (query) return null
        const buckets = new Map<FinishedBucket, typeof tasks>()
        for (const task of tasks) {
            const key = bucketOf(task, now, timezone)
            if (!buckets.has(key)) buckets.set(key, [])
            buckets.get(key)!.push(task)
        }
        return (['today', 'thisWeek', 'older'] as FinishedBucket[])
            .map(key => ({ key, tasks: buckets.get(key) ?? [] }))
            .filter(group => group.tasks.length > 0)
    }, [tasks, query, now, timezone])

    return (
        <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={`card overflow-hidden transition-shadow ${
                isDropTarget ? 'ring-2 ring-brand-500 shadow-raised' : ''
            }`}
        >
            <div className="flex items-center justify-between px-3 h-11 border-b border-line">
                <h2 className="text-sm font-bold text-ink">
                    Finalizados
                    {total > 0 && !query && (
                        <span className="ml-1.5 text-ink-subtle tabular font-semibold">{total}</span>
                    )}
                </h2>
            </div>

            <div>
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
                        <div className={`max-h-[85vh] overflow-y-auto scrollbar-none ${isFetching ? 'opacity-50' : ''}`}>
                            {groups ? (
                                // Agrupado por semana: de un vistazo, qué se
                                // cerró esta semana y qué quedó de la anterior.
                                groups.map(group => (
                                    <div key={group.key}>
                                        <p className="px-3 pt-2 pb-1 sticky top-0 bg-surface eyebrow">
                                            {BUCKET_LABEL[group.key]}
                                            <span className="ml-1.5 text-ink-subtle tabular normal-case font-semibold">
                                                {group.tasks.length}
                                            </span>
                                        </p>
                                        <ul className="divide-y divide-line">
                                            {group.tasks.map(task => (
                                                <SimpleTaskRow
                                                    key={task._id}
                                                    task={task}
                                                    showDayOptions={false}
                                                    {...rowProps(task, group.tasks)}
                                                />
                                            ))}
                                        </ul>
                                    </div>
                                ))
                            ) : (
                                <ul className="divide-y divide-line">
                                    {tasks.map(task => (
                                        <SimpleTaskRow
                                            key={task._id}
                                            task={task}
                                            showDayOptions={false}
                                            {...rowProps(task, tasks)}
                                        />
                                    ))}
                                </ul>
                            )}

                            {total > tasks.length && (
                                <p className="px-3 py-2 text-2xs text-ink-subtle border-t border-line">
                                    {query
                                        ? `${total} coinciden; se muestran ${tasks.length}. Afina la búsqueda.`
                                        : `Se muestran los ${tasks.length} más recientes de ${total}.`}
                                </p>
                            )}
                        </div>
                    )}
            </div>
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

    // En mobile, "Mi semana" se ve un día a la vez —los cinco días
    // completos, apilados, ocupan demasiado alto—; en desktop el grid de
    // cinco columnas los muestra todos y esta selección no se usa.
    const [selectedDay, setSelectedDay] = useState(
        () => weekDays.find(day => day.isToday)?.key ?? weekDays[0].key
    )

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

    const [kindFilter, setKindFilter] = useState<'all' | TaskKind>('all')

    /** En mobile, Pendientes / Por validar / Finalizados son pestañas —los
     *  tres bloques completos a la vez no caben sin comprimirlos ni generar
     *  scroll horizontal—; en desktop las tres columnas se ven siempre y esta
     *  pestaña no se usa. */
    const [activeTab, setActiveTab] = useState<'pending' | 'review' | 'done'>('pending')

    /** A dónde se soltaría el pendiente que se está arrastrando: la clave de
     *  un día, o "backlog" para devolverlo a la lista general. Solo pinta el
     *  resaltado; el `<select>` de cada fila hace exactamente lo mismo sin
     *  necesidad de arrastrar, para quien prefiera tocar en vez de arrastrar. */
    const [dragOverKey, setDragOverKey] = useState<string | null>(null)
    const ITEMS_MIME = 'application/x-uptask-plan-items'

    /** Lo elegido para mover de un tirón, con la etiqueta que tenía cada una
     *  al elegirla —hace falta para saber si hay que reabrirla al soltar, sin
     *  ir a buscarla otra vez—. Arrastrar cualquiera de las seleccionadas
     *  mueve a todas; arrastrar una que no está seleccionada mueve solo esa. */
    const [selection, setSelection] = useState<Map<string, TaskLabel>>(new Map())
    // La última fila donde se hizo Cmd/Ctrl+clic o Shift+clic: ancla del
    // rango cuando se vuelve a usar Shift.
    const [lastSelectedId, setLastSelectedId] = useState<string | null>(null)

    const toggleSelected = (taskId: string, taskLabel: TaskLabel) => {
        setSelection(current => {
            const next = new Map(current)
            if (next.has(taskId)) next.delete(taskId); else next.set(taskId, taskLabel)
            return next
        })
        setLastSelectedId(taskId)
    }

    /** Shift+clic entre la última fila elegida y esta, dentro de la misma
     *  lista visible —Pendientes, un día, Por validar o cada grupo de
     *  Finalizados—: seleccionar entre columnas distintas no tiene un rango
     *  que tenga sentido, así que ahí se cae a elegir solo esta fila. */
    const selectRange = (task: Task, listTasks: Task[]) => {
        const ids = listTasks.map(item => item._id)
        const anchor = lastSelectedId ? ids.indexOf(lastSelectedId) : -1
        const target = ids.indexOf(task._id)
        if (anchor === -1 || target === -1) {
            toggleSelected(task._id, getTaskLabel(task))
            return
        }
        const [from, to] = anchor < target ? [anchor, target] : [target, anchor]
        setSelection(current => {
            const next = new Map(current)
            for (let i = from; i <= to; i++) next.set(ids[i], getTaskLabel(listTasks[i]))
            return next
        })
        setLastSelectedId(task._id)
    }

    const readDraggedItems = (event: React.DragEvent): { id: string, label: TaskLabel }[] => {
        try {
            return JSON.parse(event.dataTransfer.getData(ITEMS_MIME) || '[]')
        } catch {
            return []
        }
    }

    const dropOnto = (targetKey: string | null) => (event: React.DragEvent) => {
        event.preventDefault()
        const items = readDraggedItems(event)
        setDragOverKey(null)
        setSelection(new Map())

        for (const { id, label: fromLabel } of items) {
            if (fromLabel === 'done') {
                // Sacarla de Finalizados la reabre: puede que haya quedado
                // algo por cerrar. Primero se reabre y, ya reabierta, se
                // programa.
                setStatus({ taskId: id, status: 'pending' }, {
                    onSuccess: () => patchTask({ taskId: id, formData: { plannedDate: targetKey } })
                })
            } else {
                patchTask({ taskId: id, formData: { plannedDate: targetKey } })
            }
        }
    }

    /** Soltar sobre "Por validar" o "Finalizados" no programa un día: cambia
     *  la etiqueta, igual que elegirla en el selector de cada fila —mismo
     *  camino, solo que arrastrando. */
    const dropOntoLabel = (label: TaskLabel) => (event: React.DragEvent) => {
        event.preventDefault()
        const items = readDraggedItems(event)
        setDragOverKey(null)
        setSelection(new Map())

        for (const { id, label: fromLabel } of items) {
            if (label === 'toValidate') {
                if (fromLabel === 'done') {
                    // Una tarea Listo no puede pedir validación directo —el
                    // servidor lo rechaza—: hay que reabrirla primero.
                    setStatus({ taskId: id, status: 'inProgress' }, {
                        onSuccess: () => requestReview({ taskId: id })
                    })
                } else {
                    requestReview({ taskId: id })
                }
            } else if (label === 'done' && fromLabel === 'toValidate') {
                resolveReview({ taskId: id, approved: true })
            } else {
                setStatus({ taskId: id, status: label })
            }
        }
    }

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

    const { mutate: requestReview, isPending: requestingReview } = useMutation({
        mutationFn: requestWorkTaskReview,
        onError: (error: Error) => toast.error(error.message),
        onSuccess: () => { toast.info('Enviada a validación'); refresh() }
    })

    const { mutate: resolveReview, isPending: resolvingReview } = useMutation({
        mutationFn: resolveWorkTaskReview,
        onError: (error: Error) => toast.error(error.message),
        onSuccess: (_result, variables) => {
            toast.success(variables.approved ? 'Lista' : 'Devuelta a en proceso')
            refresh()
        }
    })

    // Arrastrar a un día debe sentirse instantáneo: la tarjeta se mueve de
    // columna al soltar, sin esperar la vuelta del servidor. Si la petición
    // falla, se deshace sola con el dato que había antes.
    const { mutate: patchTask } = useMutation({
        mutationFn: updateWorkTask,
        onMutate: async ({ taskId, formData }) => {
            const queryKey = ['myTasks', personId]
            await queryClient.cancelQueries({ queryKey })
            const previous = queryClient.getQueryData<Task[]>(queryKey)
            if (previous) {
                queryClient.setQueryData<Task[]>(queryKey, previous.map(task =>
                    task._id === taskId ? { ...task, ...formData } as Task : task
                ))
            }
            return { previous, queryKey }
        },
        onError: (error: Error, _variables, context) => {
            toast.error(error.message)
            if (context?.previous) queryClient.setQueryData(context.queryKey, context.previous)
        },
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
    // "Por validar" es un espacio permanente, no de esta semana: una tarea
    // en revisión nunca vive en "Mi semana" ni en "Pendientes", esté o no
    // planificada, para no verla dos veces.
    const isAwaitingReview = (task: Task) => getTaskLabel(task) === 'toValidate'

    // A igual `order` (0 de fábrica, para lo que nunca se arrastró a mano),
    // `sort` es estable y conserva el orden que ya traían —el que decide el
    // servidor—; solo manda de verdad después de reordenar una lista a mano.
    const byOrder = (list: Task[]) => [...list].sort((a, b) => a.order - b.order)

    const tasksByDay = useMemo(() => {
        const map = new Map<string, Task[]>(weekDays.map(day => [day.key, []]))
        for (const task of mine) {
            if (isAwaitingReview(task)) continue
            const key = dayOf(task)
            if (key && map.has(key)) map.get(key)!.push(task)
        }
        for (const [key, list] of map) map.set(key, byOrder(list))
        return map
    }, [mine, weekDays])

    const plannedCount = useMemo(
        () => mine.filter(task => !isAwaitingReview(task) && isPlannedThisWeek(task)).length,
        [mine, isPlannedThisWeek]
    )
    const backlog = useMemo(
        () => byOrder(mine.filter(task => !isAwaitingReview(task) && !isPlannedThisWeek(task))),
        [mine, isPlannedThisWeek]
    )
    const reviewTasks = useMemo(() => byOrder(mine.filter(isAwaitingReview)), [mine])

    const kindsPresent = useMemo(() => new Set(backlog.map(kindOf)), [backlog])
    const visibleBacklog = kindFilter === 'all' ? backlog : backlog.filter(task => kindOf(task) === kindFilter)

    const overdueCount = useMemo(() => mine.filter(task => {
        if (getTaskLabel(task) === 'done' || task.doneForPeriod) return false
        return !!task.dueDate && task.dueDate.slice(0, 10) < todayKey
    }).length, [mine, todayKey])

    const parts = getZonedParts(now, timezone)
    const weekdayIndex = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12)).getUTCDay()

    /** "Por validar" no es un estado real: es pedir revisión, con su propio
     *  flujo de aprobación. Cambiar a cualquiera de los otros tres sigue
     *  siendo un simple cambio de estado —incluso saliendo de "Por
     *  validar", porque el servidor ya retira la revisión pedida en cuanto
     *  el estado deja de ser Listo. */
    const setLabel = (task: Task, next: TaskLabel) => {
        const current = getTaskLabel(task)
        if (next === 'toValidate') {
            requestReview({ taskId: task._id })
        } else if (next === 'done' && current === 'toValidate') {
            resolveReview({ taskId: task._id, approved: true })
        } else {
            setStatus({ taskId: task._id, status: next })
        }
    }

    /** Reordena a mano dentro de una lista: saca lo arrastrado de donde
     *  estaba, lo inserta junto al objetivo y reescribe el `order` de toda
     *  la lista visible en ese momento —listas cortas, así que no hace
     *  falta nada más fino que enteros consecutivos—. Solo se escribe lo
     *  que de verdad cambió de posición. */
    const reorderWithinList = (
        listTasks: Task[], draggedIds: string[], targetTaskId: string, position: 'before' | 'after'
    ) => {
        const draggedSet = new Set(draggedIds)
        const remaining = listTasks.filter(task => !draggedSet.has(task._id))
        const draggedInOrder = listTasks.filter(task => draggedSet.has(task._id))
        const targetIndex = remaining.findIndex(task => task._id === targetTaskId)
        const insertAt = targetIndex === -1
            ? remaining.length
            : position === 'after' ? targetIndex + 1 : targetIndex
        const next = [...remaining.slice(0, insertAt), ...draggedInOrder, ...remaining.slice(insertAt)]
        next.forEach((task, index) => {
            if (task.order !== index) patchTask({ taskId: task._id, formData: { order: index } })
        })
    }

    const rowProps = (task: Task, listTasks: Task[] = [task], listKey?: string) => {
        const approver = task.review?.approver && typeof task.review.approver !== 'string'
            ? task.review.approver
            : null
        // Quien resuelve la revisión es la aprobadora asignada o la
        // encargada, no necesariamente quien hizo la tarea: `canEdit` no
        // sirve aquí porque casi siempre es cierto para la propia dueña.
        const canResolveReview = currentUser?.role === 'manager' ||
            (!!approver && approver._id === currentUser?._id)

        return {
            weekDays,
            todayKey,
            busy: changingStatus || requestingReview || resolvingReview,
            canEdit: canEditTask(task, currentUser),
            canHide: canHideTask(task, currentUser),
            // Solo importa que exista: la etiqueta ya dice "Por validar",
            // no hace falta repetir cuánto lleva esperando ni quién aprueba.
            reviewInfo: !!task.review?.needed,
            canResolveReview,
            onApprove: (taskId: string) => resolveReview({ taskId, approved: true }),
            onRequestChanges: (taskId: string, note: string) =>
                resolveReview({ taskId, approved: false, note: note.trim() || undefined }),
            onSetLabel: (_taskId: string, label: TaskLabel) => setLabel(task, label),
            onSetDay: (taskId: string, dayKey: string | null) =>
                patchTask({ taskId, formData: { plannedDate: dayKey } }),
            onPatch: (taskId: string, formData: Record<string, unknown>) =>
                patchTask({ taskId, formData: formData as never }),
            onDelete: (taskId: string) => removeTask(taskId),
            selected: selection.has(task._id),
            onSelectClick: (mode: 'toggle' | 'range') =>
                mode === 'range' ? selectRange(task, listTasks) : toggleSelected(task._id, getTaskLabel(task)),
            selection,
            listKey,
            onReorder: listKey
                ? (draggedIds: string[], targetTaskId: string, position: 'before' | 'after') =>
                    reorderWithinList(listTasks, draggedIds, targetTaskId, position)
                : undefined
        }
    }

    // Un conteo aparte, liviano, solo para el número de la pestaña —
    // `FinishedTasks` ya trae su propio total, pero es interno a ese
    // componente y la pestaña vive un nivel arriba.
    const { data: doneCountData } = useQuery({
        queryKey: ['finishedCount', personId],
        queryFn: () => getTaskPage({ assignee: personId, status: 'done', limit: 1 }),
        enabled: !!personId,
        retry: false
    })
    const doneCount = doneCountData?.total ?? 0

    const TAB_ITEMS: { key: typeof activeTab, label: string, count: number }[] = [
        { key: 'pending', label: 'Pendientes', count: backlog.length },
        { key: 'review', label: 'Por validar', count: reviewTasks.length },
        { key: 'done', label: 'Finalizados', count: doneCount }
    ]

    const pendingColumn = (
        <div
            onDragOver={event => { event.preventDefault(); setDragOverKey('backlog') }}
            onDragLeave={() => setDragOverKey(current => current === 'backlog' ? null : current)}
            onDrop={dropOnto(null)}
            className={`card overflow-hidden transition-shadow ${
                dragOverKey === 'backlog' ? 'ring-2 ring-brand-500 shadow-raised' : ''
            }`}
        >
            <div className="flex items-center justify-between px-3 h-11 border-b border-line">
                <h2 className="text-sm font-bold text-ink">
                    Pendientes
                    {backlog.length > 0 && (
                        <span className="ml-1.5 text-ink-subtle tabular font-semibold">{backlog.length}</span>
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
                <ul className="divide-y divide-line max-h-[85vh] overflow-y-auto scrollbar-none">
                    {visibleBacklog.map(task => (
                        <SimpleTaskRow key={task._id} task={task} {...rowProps(task, visibleBacklog, 'backlog')} />
                    ))}
                </ul>
            )}
        </div>
    )

    const reviewColumn = (
        <div
            onDragOver={event => { event.preventDefault(); setDragOverKey('review') }}
            onDragLeave={() => setDragOverKey(current => current === 'review' ? null : current)}
            onDrop={dropOntoLabel('toValidate')}
            className={`card overflow-hidden transition-shadow ${
                dragOverKey === 'review' ? 'ring-2 ring-brand-500 shadow-raised' : ''
            }`}
        >
            <div className="flex items-center justify-between px-3 h-11 border-b border-line">
                <h2 className="text-sm font-bold text-ink">
                    Por validar
                    {reviewTasks.length > 0 && (
                        <span className="ml-1.5 text-ink-subtle tabular font-semibold">{reviewTasks.length}</span>
                    )}
                </h2>
            </div>
            {reviewTasks.length === 0 ? (
                <EmptyState
                    title="Nada esperando validación"
                    hint="Lo que se envíe a validar aparece aquí, sin importar la semana."
                />
            ) : (
                <ul className="divide-y divide-line max-h-[85vh] overflow-y-auto scrollbar-none">
                    {reviewTasks.map(task => (
                        <SimpleTaskRow key={task._id} task={task} showDayOptions={false} {...rowProps(task, reviewTasks, 'review')} />
                    ))}
                </ul>
            )}
        </div>
    )

    const doneColumn = (
        <FinishedTasks
            userId={personId}
            now={now}
            timezone={timezone}
            rowProps={rowProps}
            isDropTarget={dragOverKey === 'done'}
            onDragOver={event => { event.preventDefault(); setDragOverKey('done') }}
            onDragLeave={() => setDragOverKey(current => current === 'done' ? null : current)}
            onDrop={dropOntoLabel('done')}
        />
    )

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

            {/* Con dos o más marcadas, arrastrar cualquiera de ellas mueve a
                todas juntas —a un día, a Finalizados o a Por validar—; esta
                barra confirma cuántas hay elegidas y permite soltar la
                selección sin tener que ir desmarcándolas una por una. */}
            {selection.size > 0 && (
                <div className="flex items-center gap-3 mb-3 px-3 h-10 rounded-md
                    bg-brand-50 text-brand-700 text-sm font-semibold">
                    {selection.size === 1 ? '1 pendiente seleccionado' : `${selection.size} pendientes seleccionados`}
                    <button
                        type="button"
                        onClick={() => setSelection(new Map())}
                        className="ml-auto text-xs font-semibold text-brand-700 hover:text-brand-900 underline"
                    >
                        Quitar selección
                    </button>
                </div>
            )}

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

            {/* Mi semana: lunes a viernes, sin hora. Un pendiente de la lista
                de abajo se arrastra a uno de estos días, o se elige por su
                selector si no se quiere arrastrar; la semana se renueva sola
                cuando empieza la siguiente. */}
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

                <div className="lg:hidden mb-3 flex items-center gap-1 overflow-x-auto pb-0.5">
                    {weekDays.map(day => {
                        const count = tasksByDay.get(day.key)?.length ?? 0
                        return (
                            <button
                                key={day.key}
                                type="button"
                                onClick={() => setSelectedDay(day.key)}
                                aria-pressed={selectedDay === day.key}
                                className={`h-8 px-3 rounded-full text-xs font-semibold shrink-0 transition-colors ${
                                    selectedDay === day.key
                                        ? 'bg-brand-600 text-white'
                                        : day.isToday
                                            ? 'bg-brand-50 text-brand-700'
                                            : 'bg-slate-100 text-ink-muted'
                                }`}
                            >
                                {day.label}{count > 0 && ` · ${count}`}
                            </button>
                        )
                    })}
                </div>

                {/* En pantallas anchas, las columnas se reparten el ancho
                    disponible; en una laptop más angosta no caben apretadas,
                    así que se deja el ancho mínimo de cada una y aparece
                    scroll horizontal. La barra se ve siempre —`scroll`, no
                    `auto`— aunque en ese momento entren todas las columnas
                    sin necesidad de deslizar: así se nota en cualquier
                    pantalla de escritorio que esta fila se puede correr,
                    quepa o no todo de entrada. Pendientes queda fija a la
                    izquierda y Por validar + Finalizados fijas a la derecha:
                    no se pierden de vista al deslizar entre los días.
                    `items-start` evita que un día vacío se estire al alto
                    del más lleno: cada tarjeta mide lo que pesa su propio
                    contenido. */}
                <div className="flex flex-col lg:flex-row lg:items-start gap-3
                    lg:overflow-x-scroll lg:pb-2">
                    <div className="hidden lg:flex lg:flex-col lg:flex-1 lg:min-w-[15rem]
                        lg:sticky lg:left-0 lg:z-10 lg:bg-canvas">
                        {pendingColumn}
                    </div>

                    {weekDays.map(day => {
                        const dayTasks = tasksByDay.get(day.key) ?? []
                        const isDropTarget = dragOverKey === day.key
                        return (
                            <div
                                key={day.key}
                                onDragOver={event => { event.preventDefault(); setDragOverKey(day.key) }}
                                onDragLeave={() => setDragOverKey(current => current === day.key ? null : current)}
                                onDrop={dropOnto(day.key)}
                                className={`card overflow-hidden flex-col transition-shadow
                                    lg:flex-1 lg:min-w-[12rem] ${
                                    selectedDay === day.key ? 'flex' : 'hidden lg:flex'
                                } ${day.isToday ? 'ring-1 ring-brand-300' : ''} ${
                                    isDropTarget ? 'ring-2 ring-brand-500 shadow-raised' : ''
                                }`}
                            >
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

                                {dayTasks.length === 0 && isDropTarget ? (
                                    <p className="px-3 py-4 min-h-[4rem] flex items-center justify-center
                                        text-2xs text-center text-brand-600 font-semibold">
                                        Suelta aquí
                                    </p>
                                ) : (
                                    <>
                                        {dayTasks.length > 0 && (
                                            // Un día con muchos pendientes no empuja el resto
                                            // de la página hacia abajo: se desplaza por dentro,
                                            // con un tope generoso —casi toda una pantalla grande
                                            // de desktop— en vez de un número fijo de píxeles.
                                            <ul className="divide-y divide-line max-h-[85vh] overflow-y-auto scrollbar-none">
                                                {dayTasks.map(task => (
                                                    <SimpleTaskRow
                                                        key={task._id}
                                                        task={task}
                                                        {...rowProps(task, dayTasks, day.key)}
                                                    />
                                                ))}
                                            </ul>
                                        )}
                                        {/* Un día vacío invita a escribir, no solo a
                                            recibir lo que se arrastre. Va justo debajo
                                            del encabezado, sin estirarse al alto que le
                                            da el día con más pendientes. */}
                                        <div className={`px-2 py-1.5 ${dayTasks.length > 0 ? 'border-t border-line' : ''}`}>
                                            <QuickCreateTask
                                                label="Añadir"
                                                dense
                                                showFrequency={false}
                                                defaults={{ assignee: personId, frequency: 'none', plannedDate: day.key }}
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        )
                    })}

                    {/* Finalizados, junto a Viernes, y Por validar después:
                        así se ve la semana completa y lo ya cerrado en la
                        misma pantalla, sin bajar. Se deslizan con los días
                        —solo Pendientes queda fija—; en mobile se ven más
                        abajo, por pestaña. */}
                    <div className="hidden lg:flex lg:flex-col lg:flex-1 lg:min-w-[15rem]">{doneColumn}</div>
                    <div className="hidden lg:flex lg:flex-col lg:flex-1 lg:min-w-[13rem]">{reviewColumn}</div>
                </div>
            </section>

            {/* Pendientes / Por validar / Finalizados: en desktop ya se ven
                arriba, fijas a los costados de "Mi semana"; esta sección es
                solo para mobile, donde no caben sin apretarlas ni generar
                scroll horizontal, así que se ven de a una por pestaña. */}
            <div
                role="group"
                aria-label="Sección"
                className="lg:hidden mb-3 flex items-center gap-0.5 p-0.5 rounded-md bg-slate-100 w-fit"
            >
                {TAB_ITEMS.map(item => (
                    <button
                        key={item.key}
                        type="button"
                        onClick={() => setActiveTab(item.key)}
                        aria-pressed={activeTab === item.key}
                        className={`h-8 px-3 rounded text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                            activeTab === item.key
                                ? 'bg-surface text-ink shadow-card'
                                : 'text-ink-muted hover:text-ink'
                        }`}
                    >
                        {item.label}
                        {item.count > 0 && (
                            <span className="text-ink-subtle tabular">{item.count}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* En desktop las tres ya se ven arriba: esto es solo para la
                pestaña activa en mobile. */}
            <div className="grid grid-cols-1 gap-3 items-start lg:hidden">
                <div className={activeTab === 'pending' ? 'block' : 'hidden'}>{pendingColumn}</div>
                <div className={activeTab === 'review' ? 'block' : 'hidden'}>{reviewColumn}</div>
                <div className={activeTab === 'done' ? 'block' : 'hidden'}>{doneColumn}</div>
            </div>
        </>
    )
}
