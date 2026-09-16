import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { deleteWorkTask, getMyTasks, updateWorkTask, updateWorkTaskStatus } from '@/api/WorkTaskAPI'
import { getScheduleMembers } from '@/api/ScheduleAPI'
import { useAuth } from '@/hooks/useAuth'
import {
    LABEL_ORDER, RECURRING_FREQUENCIES, TaskLabel,
    frequencyTranslations, getTaskLabel, labelTranslations
} from '@/utils/taskLabels'
import { EmptyState, PageHeader } from '@/components/ui'
import QuickCreateTask from '@/components/tasks/QuickCreateTask'
import WorkTaskRow from '@/components/tasks/WorkTaskRow'
import { canEditTask, canHideTask } from '@/utils/taskPermissions'

/** Cadencias que se muestran aquí: todas las que implican repetición, más
 *  «según requerimiento», que es mantenimiento que ocurre cuando hace falta. */
const MAINTENANCE_FREQUENCIES = [...RECURRING_FREQUENCIES, 'onDemand' as const]

/** Operación y mantenimiento: el trabajo que se repite y se cierra en el día.
 *  Son las tareas sin proyecto. Se agrupan por cadencia —lo diario primero—
 *  porque es el orden en que se despachan. */
export default function MaintenanceView() {
    const { data: currentUser } = useAuth()
    const queryClient = useQueryClient()
    const [labelFilter, setLabelFilter] = useState<TaskLabel | 'open'>('open')
    const [personFilter, setPersonFilter] = useState<string>('all')

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

    /** Mantenimiento es lo que vuelve: tiene cadencia. Lo puntual —una vez y
     *  se acabó— no cabe aquí; vive en «Pendientes», dentro de Mi trabajo. */
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
    const groups = useMemo(() => MAINTENANCE_FREQUENCIES
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
                    <QuickCreateTask label="Nuevo de mantenimiento" defaults={{ frequency: 'weekly' }} />
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
                                    <WorkTaskRow
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
