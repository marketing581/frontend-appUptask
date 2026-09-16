import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { CheckIcon, EyeSlashIcon, LockClosedIcon } from '@heroicons/react/24/outline'
import { LockClosedIcon as LockSolid } from '@heroicons/react/20/solid'
import { getTeamBoard } from '@/api/ScheduleAPI'
import { updateWorkTask, updateWorkTaskStatus } from '@/api/WorkTaskAPI'
import { useAuth } from '@/hooks/useAuth'
import { Task, TeamPanel } from '@/types'
import { formatDuration } from '@/utils/datetime'
import {
    ALERT_COLOR, TaskFrequency, getTaskLabel, labelPalette, labelTranslations
} from '@/utils/taskLabels'
import { Avatar, Badge, PageHeader } from '@/components/ui'
import QuickCreateTask from '@/components/tasks/QuickCreateTask'

/** Panel del equipo como matriz: una fila por cadencia, una columna por
 *  persona.
 *
 *  Se lee en los dos sentidos —a lo ancho, quién hace qué a diario; hacia
 *  abajo, todo lo de una persona por cadencia—, que es lo que hace falta para
 *  repartir carga. La cabecera y la primera columna quedan fijas para no
 *  perder la referencia al desplazarse. */

/** "Proyectos" no es una cadencia, pero ocupa su propia fila: es trabajo con
 *  seguimiento, no operación repetitiva. */
type RowKey = TaskFrequency | 'project'

const ROWS: { key: RowKey, label: string, hint: string }[] = [
    { key: 'daily', label: 'Diario', hint: 'Todos los días' },
    { key: 'everyOtherDay', label: 'Interdiario', hint: 'Día sí, día no' },
    { key: 'weekly', label: 'Semanal', hint: 'Cada semana' },
    { key: 'biweekly', label: 'Quincenal', hint: 'Cada dos semanas' },
    { key: 'monthly', label: 'Mensual', hint: 'Una vez al mes' },
    { key: 'onDemand', label: 'Según requerimiento', hint: 'Cuando se pide' },
    { key: 'none', label: 'Pendientes', hint: 'De una sola vez' },
    { key: 'project', label: 'Proyectos', hint: 'Con seguimiento' }
]

const VIEWS = [
    { key: 'day' as const, label: 'El día', rows: ['daily', 'everyOtherDay', 'none'] as RowKey[] },
    // Lo puntual entra en la semana: es buena parte de lo que se despacha en
    // ella y dejarlo fuera daba una foto incompleta de la carga.
    {
        key: 'week' as const,
        label: 'La semana',
        rows: ['daily', 'everyOtherDay', 'weekly', 'none'] as RowKey[]
    },
    { key: 'all' as const, label: 'Todo', rows: ROWS.map(row => row.key) }
]

const rowKeyOf = (task: Task): RowKey =>
    task.project ? 'project' : (task.frequency ?? 'none')

export default function TeamBoardView() {
    const { data: currentUser } = useAuth()
    const queryClient = useQueryClient()
    const today = useMemo(() => new Date(), [])
    const [view, setView] = useState<'day' | 'week' | 'all'>('week')

    const { data: board, isLoading } = useQuery({
        queryKey: ['teamBoard', today.toISOString().slice(0, 10)],
        queryFn: () => getTeamBoard(today),
        retry: false
    })

    const refresh = () => {
        queryClient.invalidateQueries({ queryKey: ['teamBoard'] })
        queryClient.invalidateQueries({ queryKey: ['myTasks'] })
        queryClient.invalidateQueries({ queryKey: ['day'] })
    }

    const { mutate: setStatus, isPending: busy } = useMutation({
        mutationFn: updateWorkTaskStatus,
        onError: (error: Error) => toast.error(error.message),
        onSuccess: result => {
            if (result?.awaitingApproval) toast.info('Enviada a validación')
            else toast.success('Tarea actualizada')
            refresh()
        }
    })

    const { mutate: setPrivacy } = useMutation({
        mutationFn: updateWorkTask,
        onError: (error: Error) => toast.error(error.message),
        onSuccess: task => {
            toast.success(task?.isPrivate ? 'Marcada como reservada' : 'Ya es visible para el equipo')
            refresh()
        }
    })

    /** Índice cadencia → persona → tareas, para no recorrer la lista en cada celda. */
    const matrix = useMemo(() => {
        const result = new Map<string, Map<RowKey, Task[]>>()
        for (const panel of board?.panels ?? []) {
            const byRow = new Map<RowKey, Task[]>()
            for (const task of panel.tasks) {
                const key = rowKeyOf(task)
                if (!byRow.has(key)) byRow.set(key, [])
                byRow.get(key)!.push(task)
            }
            result.set(panel.user._id, byRow)
        }
        return result
    }, [board])

    if (isLoading) return <p className="text-center py-20 text-sm text-ink-muted">Cargando el equipo…</p>
    if (!board) return <p className="text-center py-20 text-sm text-red-600">No se pudo cargar el panel</p>

    const isManagerRole = currentUser?.role === 'manager'
    const activeRows = ROWS.filter(row => VIEWS.find(item => item.key === view)!.rows.includes(row.key))
    const gridTemplate = `156px repeat(${board.panels.length}, minmax(220px, 1fr))`

    return (
        <>
            <PageHeader
                title="Panel del equipo"
                subtitle={
                    isManagerRole
                        ? 'Qué lleva cada persona por cadencia. Puedes editarlo todo.'
                        : 'Qué lleva cada persona por cadencia. Solo puedes editar lo tuyo.'
                }
                actions={
                    <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-slate-100">
                        {VIEWS.map(item => (
                            <button
                                key={item.key}
                                type="button"
                                onClick={() => setView(item.key)}
                                aria-pressed={view === item.key}
                                className={`h-7 px-3 rounded text-xs font-semibold transition-colors ${
                                    view === item.key
                                        ? 'bg-surface text-ink shadow-card'
                                        : 'text-ink-muted hover:text-ink'
                                }`}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                }
            />

            <div className="card overflow-hidden">
                <div className="overflow-auto max-h-[calc(100vh-12rem)]">
                    {/* Sin `min-w-max`: las columnas reparten el ancho disponible y
                        solo desbordan (con scroll) cuando no caben en su mínimo. */}
                    <div style={{ display: 'grid', gridTemplateColumns: gridTemplate }}>

                        {/* Esquina vacía: ancla de la cabecera y de la primera columna */}
                        <div className="sticky top-0 left-0 z-30 bg-surface border-b border-r border-line" />
                        {board.panels.map(panel => (
                            <PersonHeader
                                key={panel.user._id}
                                panel={panel}
                                isSelf={panel.user._id === currentUser?._id}
                                canEdit={isManagerRole || panel.user._id === currentUser?._id}
                            />
                        ))}

                        {activeRows.map(row => {
                            const total = board.panels.reduce(
                                (sum, panel) => sum + (matrix.get(panel.user._id)?.get(row.key)?.length ?? 0), 0
                            )
                            // En las vistas enfocadas se ocultan las cadencias vacías;
                            // en "Todo" se mantienen para ver el mapa completo.
                            if (total === 0 && view !== 'all') return null

                            return (
                                <RowGroup
                                    key={row.key}
                                    row={row}
                                    total={total}
                                    panels={board.panels}
                                    matrix={matrix}
                                    currentUserId={currentUser?._id}
                                    isManagerRole={!!isManagerRole}
                                    busy={busy}
                                    onSetStatus={(taskId, status) => setStatus({ taskId, status })}
                                    onTogglePrivacy={(taskId, isPrivate) =>
                                        setPrivacy({ taskId, formData: { isPrivate } as never })}
                                />
                            )
                        })}
                    </div>
                </div>
            </div>

            {isManagerRole && (
                <p className="text-xs text-ink-subtle mt-3">
                    Puedes ocultar tus propios pendientes al equipo con el icono del ojo.
                    Nadie más verá el pendiente ni sabrá que existe; si le reservas hora,
                    en su calendario aparecerá solo como «Reservado».
                </p>
            )}
        </>
    )
}

function PersonHeader({ panel, isSelf, canEdit }: {
    panel: TeamPanel
    isSelf: boolean
    canEdit: boolean
}) {
    const open = panel.tasks.length

    return (
        <div className="sticky top-0 z-20 bg-surface border-b border-line px-3 py-2.5">
            <div className="flex items-center gap-2">
                <Avatar name={panel.user.name} size="md" />
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-ink truncate leading-tight">
                        {panel.user.name}
                        {isSelf && <span className="text-ink-subtle font-medium"> · tú</span>}
                    </p>
                    <p className="text-2xs text-ink-subtle leading-tight truncate">
                        {panel.user.role === 'manager' ? 'Encargada' : 'Integrante'}
                    </p>
                </div>
                {!canEdit && (
                    <span title="Solo lectura">
                        <LockClosedIcon className="w-3.5 h-3.5 text-ink-subtle" />
                    </span>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <Badge variant="outline">{open} abierta{open === 1 ? '' : 's'}</Badge>
                <Badge variant="outline">
                    {panel.scheduledToday > 0 ? `${formatDuration(panel.scheduledToday)} hoy` : 'sin bloques'}
                </Badge>
                <Link
                    to={`/semana?userId=${panel.user._id}`}
                    className="ml-auto text-2xs font-semibold text-brand-600 hover:underline"
                >
                    Su calendario
                </Link>
            </div>
        </div>
    )
}

function RowGroup({
    row, total, panels, matrix, currentUserId, isManagerRole, busy, onSetStatus, onTogglePrivacy
}: {
    row: { key: RowKey, label: string, hint: string }
    total: number
    panels: TeamPanel[]
    matrix: Map<string, Map<RowKey, Task[]>>
    currentUserId?: string
    isManagerRole: boolean
    busy: boolean
    onSetStatus: (taskId: string, status: 'pending' | 'inProgress' | 'done') => void
    onTogglePrivacy: (taskId: string, isPrivate: boolean) => void
}) {
    return (
        <>
            <div className="sticky left-0 z-10 bg-surface-sunken border-b border-r border-line px-3 py-3">
                <p className="text-xs font-bold text-ink leading-tight">{row.label}</p>
                <p className="text-2xs text-ink-subtle leading-tight mt-0.5">{row.hint}</p>
                <p className="text-2xs font-semibold text-ink-subtle tabular mt-1.5">{total} en total</p>
            </div>

            {panels.map(panel => {
                const tasks = matrix.get(panel.user._id)?.get(row.key) ?? []
                const canEdit = isManagerRole || panel.user._id === currentUserId
                // Ocultar al equipo es potestad de la encargada, y solo sobre lo suyo.
                const canReserve = isManagerRole && panel.user._id === currentUserId

                return (
                    <div key={panel.user._id} className="group/cell border-b border-line p-1.5">
                        {tasks.length === 0 ? (
                            <p className="text-2xs text-ink-subtle/50 px-1.5 py-1">—</p>
                        ) : (
                            <ul className="space-y-1">
                                {tasks.map(task => (
                                    <TaskChip
                                        key={task._id}
                                        task={task}
                                        canEdit={canEdit}
                                        canReserve={canReserve}
                                        busy={busy}
                                        onSetStatus={onSetStatus}
                                        onTogglePrivacy={onTogglePrivacy}
                                    />
                                ))}
                            </ul>
                        )}

                        {/* Crear aquí hereda la persona y la cadencia de la celda */}
                        {canEdit && row.key !== 'project' && (
                            <div className="mt-1 opacity-0 group-hover/cell:opacity-100 focus-within:opacity-100
                                transition-opacity">
                                <QuickCreateTask
                                    dense
                                    label="Añadir"
                                    defaults={{
                                        assignee: panel.user._id,
                                        frequency: row.key === 'none' ? 'none' : row.key
                                    }}
                                />
                            </div>
                        )}
                    </div>
                )
            })}
        </>
    )
}

function TaskChip({ task, canEdit, canReserve, busy, onSetStatus, onTogglePrivacy }: {
    task: Task
    canEdit: boolean
    canReserve: boolean
    busy: boolean
    onSetStatus: (taskId: string, status: 'pending' | 'inProgress' | 'done') => void
    onTogglePrivacy: (taskId: string, isPrivate: boolean) => void
}) {
    const label = getTaskLabel(task)
    const palette = labelPalette[label]
    const doneNow = label === 'done' || !!task.doneForPeriod
    const area = task.brand && typeof task.brand !== 'string' ? task.brand : null
    const project = task.project && typeof task.project !== 'string' ? task.project.projectName : null
    const hasMeta = label !== 'pending' || task.onHold?.active || area || project

    return (
        <li
            className={`group rounded-md hover:shadow-card transition-shadow px-2 py-1.5 ${
                task.isPrivate
                    ? 'border-2 border-dashed border-slate-400 bg-slate-100'
                    : 'border border-line bg-surface'
            }`}
            style={task.isPrivate ? undefined : { borderLeftWidth: 3, borderLeftColor: palette.solid }}
        >
            {task.isPrivate && (
                <p className="flex items-center gap-1 text-2xs font-bold text-slate-600
                    uppercase tracking-wide mb-1">
                    <LockSolid className="w-3 h-3" /> Solo tú lo ves
                </p>
            )}
            <div className="flex items-start gap-1.5">
                <button
                    type="button"
                    disabled={!canEdit || busy}
                    onClick={() => onSetStatus(task._id, doneNow ? 'pending' : 'done')}
                    aria-label={`Marcar "${task.name}" como lista`}
                    title={canEdit ? 'Marcar como lista' : 'Solo su responsable o la encargada'}
                    className={`mt-px w-4 h-4 shrink-0 rounded-full border-2 grid place-content-center
                        transition-colors disabled:opacity-30 disabled:cursor-not-allowed
                        ${doneNow
                            ? 'bg-stage-done border-stage-done text-white'
                            : `border-line-strong text-transparent ${
                                canEdit ? 'hover:border-stage-done hover:text-stage-done' : ''}`}`}
                >
                    <CheckIcon className="w-2.5 h-2.5" strokeWidth={3} />
                </button>

                <p className={`min-w-0 flex-1 text-xs font-medium leading-snug ${
                    doneNow ? 'text-ink-subtle line-through' : 'text-ink'
                }`}>
                    {task.name}
                </p>

                {canReserve && (
                    <button
                        type="button"
                        onClick={() => onTogglePrivacy(task._id, !task.isPrivate)}
                        title={task.isPrivate
                            ? 'Hacerla visible para el equipo'
                            : 'Ocultar al equipo: solo tú la verás'}
                        aria-label={task.isPrivate ? 'Dejar de ocultar' : 'Ocultar al equipo'}
                        className={`shrink-0 w-5 h-5 grid place-content-center rounded
                            hover:bg-slate-200 transition-opacity ${
                            task.isPrivate
                                ? 'text-ink-muted'
                                : 'text-ink-subtle opacity-0 group-hover:opacity-100 focus:opacity-100'
                        }`}
                    >
                        <EyeSlashIcon className="w-3 h-3" />
                    </button>
                )}
            </div>

            {/* Solo se muestra lo que aporta: "Pendiente" es el estado por
                defecto y repetirlo en cada ficha sería ruido. */}
            {hasMeta && (
                <div className="flex flex-wrap items-center gap-1 mt-1 pl-[22px]">
                    {label !== 'pending' && (
                        <Badge className={palette.badge}>{labelTranslations[label]}</Badge>
                    )}
                    {task.onHold?.active && (
                        <span className="text-2xs font-semibold" style={{ color: ALERT_COLOR }}>
                            En espera
                        </span>
                    )}
                    {area && (
                        <span className="inline-flex items-center gap-1 text-2xs text-ink-subtle">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: area.color }} />
                            {area.name}
                        </span>
                    )}
                    {project && <span className="text-2xs text-ink-subtle truncate">{project}</span>}
                </div>
            )}
        </li>
    )
}
