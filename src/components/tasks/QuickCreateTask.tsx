import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import {
    Bars3BottomLeftIcon,
    CalendarDaysIcon,
    ClockIcon,
    FlagIcon,
    PlusIcon,
    TagIcon,
    UserIcon
} from '@heroicons/react/24/outline'
import { createWorkTask } from '@/api/WorkTaskAPI'
import { getScheduleMembers } from '@/api/ScheduleAPI'
import { getBrands } from '@/api/BrandAPI'
import { useAuth } from '@/hooks/useAuth'
import { QuickTaskFormData, TaskPriority } from '@/types'
import {
    FREQUENCY_ORDER, TaskFrequency, frequencyTranslations, priorityTranslations
} from '@/utils/taskLabels'
import { Avatar, Button } from '@/components/ui'

/** Alta de un pendiente sin salir de donde va a vivir.
 *
 *  Toma lo mejor de las dos referencias: se escribe en el sitio, como en
 *  Notion, y el detalle se pide de forma progresiva con filas con icono, como
 *  en el calendario de Google. El contexto se hereda: crear dentro de la fila
 *  "Diario" de Nicole ya deja la cadencia y la responsable puestas, así que lo
 *  habitual es solo escribir el nombre y pulsar Enter. */

type Defaults = {
    assignee?: string
    frequency?: TaskFrequency
    project?: string
    brand?: string
}

type Props = {
    defaults?: Defaults
    /** Texto del disparador cerrado. */
    label?: string
    /** Compacto para las celdas de la matriz. */
    dense?: boolean
    onCreated?: () => void
}

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'urgent']

export default function QuickCreateTask({ defaults, label = 'Nuevo pendiente', dense, onCreated }: Props) {
    const { data: currentUser } = useAuth()
    const queryClient = useQueryClient()
    const nameRef = useRef<HTMLInputElement>(null)

    const [open, setOpen] = useState(false)
    const [showDetail, setShowDetail] = useState(false)
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [assignee, setAssignee] = useState(defaults?.assignee ?? '')
    const [frequency, setFrequency] = useState<TaskFrequency>(defaults?.frequency ?? 'none')
    const [brand, setBrand] = useState(defaults?.brand ?? '')
    const [priority, setPriority] = useState<TaskPriority>('medium')
    const [dueDate, setDueDate] = useState('')
    const [estimate, setEstimate] = useState('')

    const isManager = currentUser?.role === 'manager'

    const { data: members } = useQuery({
        queryKey: ['scheduleMembers'],
        queryFn: getScheduleMembers,
        enabled: open && isManager,
        retry: false
    })

    const { data: brands } = useQuery({
        queryKey: ['brands'],
        queryFn: getBrands,
        enabled: open,
        retry: false
    })

    useEffect(() => {
        if (open) nameRef.current?.focus()
    }, [open])

    const reset = () => {
        setName('')
        setDescription('')
        setShowDetail(false)
        setAssignee(defaults?.assignee ?? '')
        setFrequency(defaults?.frequency ?? 'none')
        setBrand(defaults?.brand ?? '')
        setPriority('medium')
        setDueDate('')
        setEstimate('')
    }

    const { mutate: create, isPending } = useMutation({
        mutationFn: createWorkTask,
        onError: (error: Error) => toast.error(error.message),
        onSuccess: () => {
            toast.success('Pendiente creado')
            reset()
            // Se queda abierto: encadenar altas es lo normal al vaciar la cabeza.
            nameRef.current?.focus()
            queryClient.invalidateQueries({ queryKey: ['myTasks'] })
            queryClient.invalidateQueries({ queryKey: ['teamBoard'] })
            queryClient.invalidateQueries({ queryKey: ['day'] })
            queryClient.invalidateQueries({ queryKey: ['unscheduled'] })
            onCreated?.()
        }
    })

    const close = () => {
        reset()
        setOpen(false)
    }

    const submit = () => {
        const trimmed = name.trim()
        if (trimmed.length === 0 || isPending) return

        const payload: QuickTaskFormData & Record<string, unknown> = { name: trimmed }
        if (description.trim()) payload.description = description.trim()
        if (assignee) payload.assignee = assignee
        if (frequency !== 'none') payload.frequency = frequency
        if (brand) payload.brand = brand
        if (priority !== 'medium') payload.priority = priority
        if (dueDate) payload.dueDate = dueDate
        if (estimate) payload.estimatedMinutes = Number(estimate)
        if (defaults?.project) payload.project = defaults.project

        create(payload)
    }

    const onKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'Escape') {
            event.preventDefault()
            close()
        }
        // Enter guarda desde cualquier campo salvo el área de detalle,
        // donde hace falta para escribir varias líneas.
        if (event.key === 'Enter' && !event.shiftKey) {
            const target = event.target as HTMLElement
            if (target.tagName !== 'TEXTAREA') {
                event.preventDefault()
                submit()
            }
        }
    }

    if (!open) {
        return (
            <button
                type="button"
                onClick={() => setOpen(true)}
                className={`w-full flex items-center gap-1.5 rounded text-ink-subtle
                    hover:text-brand-600 hover:bg-brand-50 transition-colors ${
                    dense ? 'px-1.5 py-1 text-2xs font-semibold' : 'px-2 py-1.5 text-xs font-semibold'
                }`}
            >
                <PlusIcon className={dense ? 'w-3 h-3' : 'w-4 h-4'} /> {label}
            </button>
        )
    }

    const fieldClass = `h-7 py-0 text-xs rounded border-line-strong text-ink-muted
        focus:border-brand-500 focus:ring-brand-500`

    return (
        <div
            onKeyDown={onKeyDown}
            className="rounded-md border border-brand-300 bg-surface shadow-raised p-2 space-y-2"
        >
            <input
                ref={nameRef}
                value={name}
                onChange={event => setName(event.target.value)}
                placeholder="Escribe un nombre…"
                aria-label="Nombre del pendiente"
                className="w-full border-0 border-b border-line p-0 pb-1.5 text-sm font-medium
                    text-ink placeholder:text-ink-subtle focus:border-brand-500 focus:ring-0"
            />

            {showDetail && (
                <label className="flex items-start gap-2">
                    <Bars3BottomLeftIcon className="w-4 h-4 text-ink-subtle mt-1.5 shrink-0" />
                    <textarea
                        value={description}
                        onChange={event => setDescription(event.target.value)}
                        rows={2}
                        placeholder="Detalle (opcional)"
                        aria-label="Detalle"
                        className="flex-1 text-xs rounded border-line-strong text-ink-muted
                            placeholder:text-ink-subtle focus:border-brand-500 focus:ring-brand-500"
                    />
                </label>
            )}

            {/* Filas con icono, como en el calendario: lo esencial a la vista */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                {isManager && members && members.length > 0 && (
                    <label className="flex items-center gap-1.5" title="Responsable">
                        <UserIcon className="w-4 h-4 text-ink-subtle shrink-0" />
                        <select
                            value={assignee || currentUser?._id || ''}
                            onChange={event => setAssignee(event.target.value)}
                            aria-label="Responsable"
                            className={`${fieldClass} pl-1.5 pr-6 max-w-[9rem]`}
                        >
                            {members.map(member => (
                                <option key={member._id} value={member._id}>
                                    {member._id === currentUser?._id ? 'Yo' : member.name}
                                </option>
                            ))}
                        </select>
                    </label>
                )}

                <label className="flex items-center gap-1.5" title="Cadencia">
                    <ClockIcon className="w-4 h-4 text-ink-subtle shrink-0" />
                    <select
                        value={frequency}
                        onChange={event => setFrequency(event.target.value as TaskFrequency)}
                        aria-label="Cadencia"
                        className={`${fieldClass} pl-1.5 pr-6 max-w-[10rem]`}
                    >
                        {FREQUENCY_ORDER.map(item => (
                            <option key={item} value={item}>{frequencyTranslations[item]}</option>
                        ))}
                    </select>
                </label>

                {brands && brands.length > 0 && (
                    <label className="flex items-center gap-1.5" title="Área">
                        <TagIcon className="w-4 h-4 text-ink-subtle shrink-0" />
                        <select
                            value={brand}
                            onChange={event => setBrand(event.target.value)}
                            aria-label="Área"
                            className={`${fieldClass} pl-1.5 pr-6 max-w-[8rem]`}
                        >
                            <option value="">Sin área</option>
                            {brands.map(item => (
                                <option key={item._id} value={item._id}>{item.name}</option>
                            ))}
                        </select>
                    </label>
                )}

                {showDetail && (
                    <>
                        <label className="flex items-center gap-1.5" title="Prioridad">
                            <FlagIcon className="w-4 h-4 text-ink-subtle shrink-0" />
                            <select
                                value={priority}
                                onChange={event => setPriority(event.target.value as TaskPriority)}
                                aria-label="Prioridad"
                                className={`${fieldClass} pl-1.5 pr-6`}
                            >
                                {PRIORITIES.map(item => (
                                    <option key={item} value={item}>{priorityTranslations[item]}</option>
                                ))}
                            </select>
                        </label>

                        <label className="flex items-center gap-1.5" title="Fecha límite">
                            <CalendarDaysIcon className="w-4 h-4 text-ink-subtle shrink-0" />
                            <input
                                type="date"
                                value={dueDate}
                                onChange={event => setDueDate(event.target.value)}
                                aria-label="Fecha límite"
                                className={`${fieldClass} px-1.5`}
                            />
                        </label>

                        <label className="flex items-center gap-1.5" title="Esfuerzo estimado en minutos">
                            <ClockIcon className="w-4 h-4 text-ink-subtle shrink-0" />
                            <input
                                type="number"
                                min={5}
                                step={5}
                                value={estimate}
                                onChange={event => setEstimate(event.target.value)}
                                placeholder="min"
                                aria-label="Esfuerzo estimado en minutos"
                                className={`${fieldClass} px-1.5 w-20 tabular`}
                            />
                        </label>
                    </>
                )}
            </div>

            <div className="flex items-center gap-2 pt-0.5">
                <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={submit}
                    disabled={isPending || name.trim().length === 0}
                >
                    {isPending ? 'Guardando…' : 'Guardar'}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={close}>
                    Cancelar
                </Button>

                {!showDetail && (
                    <button
                        type="button"
                        onClick={() => setShowDetail(true)}
                        className="text-2xs font-semibold text-ink-muted hover:text-brand-600"
                    >
                        Más opciones
                    </button>
                )}

                <span className="ml-auto text-2xs text-ink-subtle hidden sm:block">
                    Enter guarda · Esc cancela
                </span>
            </div>

            {assignee && assignee !== currentUser?._id && members && (
                <p className="flex items-center gap-1.5 text-2xs text-ink-subtle">
                    <Avatar
                        name={members.find(member => member._id === assignee)?.name ?? ''}
                        size="xs"
                    />
                    Se asignará a {members.find(member => member._id === assignee)?.name}
                </p>
            )}
        </div>
    )
}
