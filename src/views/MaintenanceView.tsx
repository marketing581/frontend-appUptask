import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import {
    ChevronRightIcon, MagnifyingGlassIcon, PlusIcon, XMarkIcon
} from '@heroicons/react/24/outline'
import { deleteWorkTask, getMyTasks, updateWorkTask, updateWorkTaskStatus } from '@/api/WorkTaskAPI'
import { getScheduleMembers } from '@/api/ScheduleAPI'
import { useAuth } from '@/hooks/useAuth'
import { Task } from '@/types'
import {
    LABEL_ORDER, RECURRING_FREQUENCIES, TaskFrequency, TaskLabel,
    frequencyTranslations, getTaskLabel, labelTranslations
} from '@/utils/taskLabels'
import { canEditTask, canHideTask } from '@/utils/taskPermissions'
import { Button, EmptyState, PageHeader } from '@/components/ui'
import PersonSwitcher from '@/components/team/PersonSwitcher'
import QuickCreateTask from '@/components/tasks/QuickCreateTask'
import WorkTaskRow, { TASK_COLUMNS } from '@/components/tasks/WorkTaskRow'

/** Cadencias que se muestran aquí: todas las que implican repetición, más
 *  «según requerimiento», que es mantenimiento que ocurre cuando hace falta. */
const MAINTENANCE_FREQUENCIES: TaskFrequency[] = [...RECURRING_FREQUENCIES, 'onDemand']

/** Operación y mantenimiento: el trabajo que se repite y se cierra en el día.
 *
 *  Se lee como una tabla, que es lo que pide una pantalla ancha: las columnas
 *  coinciden de fila en fila, así que se puede recorrer una sola —quién lleva
 *  qué, o qué está en proceso— sin leer el resto. Se agrupa por cadencia, lo
 *  diario primero, porque es el orden en que se despacha. */
export default function MaintenanceView() {
    const { data: currentUser } = useAuth()
    const queryClient = useQueryClient()
    const [labelFilter, setLabelFilter] = useState<TaskLabel | 'open'>('open')
    const [personFilter, setPersonFilter] = useState<string>('all')
    const [term, setTerm] = useState('')
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
    const [creating, setCreating] = useState<TaskFrequency | null>(null)

    // El filtro por naturaleza lo aplica el servidor: el histórico de
    // pendientes puntuales es de cientos y no pinta nada en esta pantalla.
    const { data: tasks, isLoading } = useQuery({
        queryKey: ['myTasks', 'maintenance'],
        queryFn: () => getMyTasks({ kind: 'maintenance', includeDone: true }),
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

    const operational = useMemo(() => tasks ?? [], [tasks])

    const afterPerson = useMemo(() => personFilter === 'all'
        ? operational
        : operational.filter(task => {
            const assignee = task.assignee
            const id = assignee && typeof assignee !== 'string' ? assignee._id : assignee
            return id === personFilter
        }),
        [operational, personFilter]
    )

    const afterSearch = useMemo(() => {
        const needle = term.trim().toLowerCase()
        if (!needle) return afterPerson
        return afterPerson.filter(task => task.name.toLowerCase().includes(needle))
    }, [afterPerson, term])

    const counts = useMemo(() => {
        const result: Record<string, number> = { open: 0 }
        for (const label of LABEL_ORDER) result[label] = 0
        for (const task of afterSearch) {
            const label = getTaskLabel(task)
            result[label]++
            if (label !== 'done') result.open++
        }
        return result
    }, [afterSearch])

    const visible = afterSearch.filter(task => {
        const label = getTaskLabel(task)
        return labelFilter === 'open' ? label !== 'done' : label === labelFilter
    })

    /** Agrupado por cadencia, en el orden en que se trabaja. Los grupos sin
     *  nada dentro no se pintan: un encabezado vacío solo ocupa sitio. */
    const groups = useMemo(() => MAINTENANCE_FREQUENCIES
        .map(frequency => ({
            frequency,
            tasks: visible.filter(task => (task.frequency ?? 'none') === frequency)
        }))
        .filter(group => group.tasks.length > 0),
        [visible]
    )

    // Buscar y no ver resultados por tener un grupo plegado sería desconcertante.
    useEffect(() => {
        if (term.trim()) setCollapsed(new Set())
    }, [term])

    const toggleGroup = (frequency: string) => setCollapsed(current => {
        const next = new Set(current)
        if (next.has(frequency)) next.delete(frequency)
        else next.add(frequency)
        return next
    })

    const FILTERS: { key: TaskLabel | 'open', label: string }[] = [
        { key: 'open', label: 'Abiertas' },
        ...LABEL_ORDER.map(label => ({ key: label, label: labelTranslations[label] }))
    ]

    const filtering = labelFilter !== 'open' || personFilter !== 'all' || term.trim().length > 0

    const rowProps = (task: Task) => ({
        busy: updating,
        canEdit: canEditTask(task, currentUser),
        canHide: canHideTask(task, currentUser),
        onSetStatus: (taskId: string, status: 'pending' | 'inProgress' | 'done') =>
            setStatus({ taskId, status }),
        onPatch: (taskId: string, formData: Record<string, unknown>) =>
            patchTask({ taskId, formData: formData as never }),
        onDelete: (taskId: string) => removeTask(taskId)
    })

    return (
        <>
            <PageHeader
                title="Mantenimiento"
                subtitle="Lo operativo que se repite: contenido, diseño, campañas, formularios y bases de datos."
                actions={
                    <Button variant="primary" size="md" onClick={() => setCreating('weekly')}>
                        <PlusIcon className="w-4 h-4" /> Nuevo
                    </Button>
                }
            />

            <div className="card overflow-hidden">
                {/* Barra de trabajo: buscar, acotar por etiqueta y por persona.
                    Se queda pegada arriba porque la lista es larga y los
                    filtros se cambian mientras se recorre. */}
                <div className="sticky top-0 z-20 bg-surface border-b border-line">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
                        <label className="flex items-center gap-2 h-8 px-2.5 rounded-md bg-surface-sunken
                            border border-line focus-within:border-brand-400 focus-within:ring-1
                            focus-within:ring-brand-400 w-full sm:w-60 order-1">
                            <MagnifyingGlassIcon className="w-4 h-4 text-ink-subtle shrink-0" />
                            <input
                                value={term}
                                onChange={event => setTerm(event.target.value)}
                                placeholder="Buscar…"
                                aria-label="Buscar en mantenimiento"
                                className="flex-1 min-w-0 border-0 p-0 bg-transparent text-xs
                                    placeholder:text-ink-subtle focus:ring-0"
                            />
                            {term && (
                                <button
                                    type="button"
                                    onClick={() => setTerm('')}
                                    aria-label="Limpiar búsqueda"
                                    className="shrink-0 text-ink-subtle hover:text-ink"
                                >
                                    <XMarkIcon className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </label>

                        <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-slate-100
                            order-3 sm:order-2 overflow-x-auto">
                            {FILTERS.map(item => {
                                const active = labelFilter === item.key
                                return (
                                    <button
                                        key={item.key}
                                        type="button"
                                        onClick={() => setLabelFilter(item.key)}
                                        aria-pressed={active}
                                        className={`h-7 px-2.5 rounded text-xs font-semibold whitespace-nowrap
                                            transition-colors ${
                                            active
                                                ? 'bg-surface text-ink shadow-card'
                                                : 'text-ink-muted hover:text-ink'
                                        }`}
                                    >
                                        {item.label}
                                        <span className={`ml-1.5 tabular ${
                                            active ? 'text-brand-600' : 'text-ink-subtle'
                                        }`}>
                                            {counts[item.key] ?? 0}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>

                        <div className="order-2 sm:order-3 sm:ml-auto flex items-center gap-2">
                            {filtering && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setLabelFilter('open')
                                        setPersonFilter('all')
                                        setTerm('')
                                    }}
                                    className="text-2xs font-semibold text-ink-muted hover:text-brand-600
                                        whitespace-nowrap"
                                >
                                    Quitar filtros
                                </button>
                            )}
                            <PersonSwitcher
                                members={members ?? []}
                                value={personFilter}
                                onChange={setPersonFilter}
                                currentUserId={currentUser?._id}
                                allOption="Todo el equipo"
                                selfLabel="Mías"
                                size="sm"
                            />
                        </div>
                    </div>

                    {/* Cabecera de columnas: solo en ancho, donde la lista se lee
                        como tabla. En móvil no hay columnas que rotular. */}
                    <div className={`hidden lg:grid px-4 py-1.5 border-t border-line bg-surface-sunken
                        ${TASK_COLUMNS}`}>
                        <span />
                        <span className="eyebrow">Pendiente</span>
                        <span className="eyebrow">Estado</span>
                        <span className="eyebrow">Cadencia</span>
                        <span className="eyebrow">Área</span>
                        <span className="eyebrow">Responsable</span>
                        <span />
                    </div>
                </div>

                {creating && (
                    <div className="px-3 py-2 border-b border-line bg-brand-50/40">
                        <QuickCreateTask
                            startOpen
                            defaults={{ frequency: creating }}
                            onClose={() => setCreating(null)}
                        />
                    </div>
                )}

                {isLoading ? (
                    <EmptyState title="Cargando…" />
                ) : groups.length === 0 ? (
                    <EmptyState
                        title={term.trim()
                            ? `Nada que coincida con «${term.trim()}»`
                            : labelFilter === 'open' ? 'Nada pendiente' : 'Sin tareas en esta etiqueta'}
                        hint={!term.trim() && labelFilter === 'open'
                            ? 'Todo el mantenimiento está al día.'
                            : undefined}
                    />
                ) : (
                    groups.map(group => {
                        const isCollapsed = collapsed.has(group.frequency)
                        const openCount = group.tasks.filter(task => getTaskLabel(task) !== 'done').length

                        return (
                            <section key={group.frequency}>
                                {/* Cabecera de grupo: plegable, con el recuento a la
                                    vista para no tener que abrirla y ver si hay algo. */}
                                <div className="flex items-center gap-2 px-3 h-9 bg-surface-sunken
                                    border-y border-line">
                                    <button
                                        type="button"
                                        onClick={() => toggleGroup(group.frequency)}
                                        aria-expanded={!isCollapsed}
                                        className="flex items-center gap-1.5 text-ink-muted hover:text-ink
                                            rounded transition-colors"
                                    >
                                        <ChevronRightIcon
                                            className={`w-3.5 h-3.5 transition-transform ${
                                                isCollapsed ? '' : 'rotate-90'
                                            }`}
                                        />
                                        <span className="text-xs font-bold text-ink">
                                            {frequencyTranslations[group.frequency]}
                                        </span>
                                        <span className="text-2xs font-semibold text-ink-subtle tabular">
                                            {group.tasks.length}
                                        </span>
                                    </button>

                                    {openCount > 0 && openCount < group.tasks.length && (
                                        <span className="text-2xs text-ink-subtle">
                                            {openCount} sin cerrar
                                        </span>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => setCreating(group.frequency)}
                                        className="ml-auto flex items-center gap-1 h-6 px-2 rounded
                                            text-2xs font-semibold text-ink-subtle
                                            hover:bg-brand-50 hover:text-brand-600 transition-colors"
                                    >
                                        <PlusIcon className="w-3 h-3" /> Añadir
                                    </button>
                                </div>

                                {!isCollapsed && (
                                    <ul className="divide-y divide-line">
                                        {group.tasks.map(task => (
                                            <WorkTaskRow
                                                key={task._id}
                                                task={task}
                                                variant="table"
                                                {...rowProps(task)}
                                            />
                                        ))}
                                    </ul>
                                )}
                            </section>
                        )
                    })
                )}
            </div>

            <p className="text-xs text-ink-subtle mt-3 max-w-3xl">
                La frecuencia describe cada cuánto toca hacer cada cosa y ordena la lista.
                La generación automática de cada ocurrencia —con su checklist, su historial
                y la opción de omitir con motivo— llega en la fase de recurrencias.
            </p>
        </>
    )
}
