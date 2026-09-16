import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import {
    createTimeBlock,
    deleteTimeBlock,
    getScheduleMembers,
    getRangeSchedule,
    getUnscheduledTasks,
    getWeekSchedule,
    leaveTimeBlock,
    updateSchedulePreferences,
    updateTimeBlock
} from '@/api/ScheduleAPI'
import {
    createWorkTask,
    requestWorkTaskReview,
    resolveWorkTaskReview,
    updateWorkTaskStatus
} from '@/api/WorkTaskAPI'
import { TaskLabel } from '@/utils/taskLabels'
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from '@heroicons/react/24/outline'
import { Avatar, Badge, Button, PageHeader } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { GuestConflict, TimeBlock } from '@/types'
import {
    addDays, addMonths, durationMinutes, formatDuration, formatRangeLabel,
    monthGridDays, monthLabel, quarterLabel, quarterMonths, startOfMonth
} from '@/utils/datetime'
import WeekGrid from '@/components/schedule/WeekGrid'
import MonthGrid from '@/components/schedule/MonthGrid'
import QuarterGrid from '@/components/schedule/QuarterGrid'
import UnscheduledPanel from '@/components/schedule/UnscheduledPanel'
import BlockFormModal from '@/components/schedule/BlockFormModal'
import QuickCreateTask from '@/components/tasks/QuickCreateTask'

export default function MyWeekView() {
    const { data: currentUser } = useAuth()
    const queryClient = useQueryClient()

    const [anchor, setAnchor] = useState(() => new Date())
    const [view, setView] = useState<'week' | 'month' | 'quarter'>('week')
    const [viewedUserId, setViewedUserId] = useState<string | undefined>(undefined)
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    // Se guarda el id, no el bloque: así el modal siempre lee los datos
    // recién traídos y refleja los cambios de etiqueta al instante.
    const [modal, setModal] = useState<{ open: boolean, start: Date | null, blockId: string | null }>({
        open: false, start: null, blockId: null
    })

    const viewingOther = !!viewedUserId && viewedUserId !== currentUser?._id

    const { data: week, isLoading } = useQuery({
        queryKey: ['week', viewedUserId ?? 'me', anchor.toISOString().slice(0, 10)],
        queryFn: () => getWeekSchedule({ date: anchor, userId: viewedUserId }),
        retry: false
    })

    const { data: unscheduled } = useQuery({
        queryKey: ['unscheduled', viewedUserId ?? 'me', anchor.toISOString().slice(0, 10)],
        queryFn: () => getUnscheduledTasks(viewedUserId, anchor),
        retry: false
    })

    const { data: members } = useQuery({
        queryKey: ['scheduleMembers'],
        queryFn: getScheduleMembers,
        retry: false
    })

    const modalBlock = modal.blockId
        ? week?.blocks.find(block => block._id === modal.blockId) ?? null
        : null

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ['week'] })
        queryClient.invalidateQueries({ queryKey: ['range'] })
        queryClient.invalidateQueries({ queryKey: ['unscheduled'] })
        queryClient.invalidateQueries({ queryKey: ['day'] })
    }

    const warnConflicts = (conflicts?: TimeBlock[], guestConflicts?: GuestConflict[]) => {
        if (conflicts && conflicts.length > 0) {
            toast.warn(`Se cruza con ${conflicts.length} bloque(s) ya programado(s). No se movió nada automáticamente.`)
        }
        // Etiquetar a alguien le ocupa una hora: si ya tenía algo ahí, se dice.
        // No se impide —a veces se solapa a propósito—, pero no se oculta.
        for (const row of guestConflicts ?? []) {
            toast.warn(
                `${row.user.name.split(' ')[0]} ya tiene ${row.count} bloque(s) a esa hora.`
            )
        }
    }

    const { mutate: createBlock, isPending: isCreating } = useMutation({
        mutationFn: createTimeBlock,
        onError: (error: Error) => toast.error(error.message),
        onSuccess: data => {
            toast.success(
                (data?.block.guests?.length ?? 0) > 0
                    ? 'Bloque programado y compartido'
                    : 'Bloque programado'
            )
            warnConflicts(data?.conflicts, data?.guestConflicts)
            invalidate()
            setModal({ open: false, start: null, blockId: null })
            setSelectedTaskId(null)
        }
    })

    const { mutate: moveBlock } = useMutation({
        mutationFn: updateTimeBlock,
        onError: (error: Error) => {
            toast.error(error.message)
            invalidate()
        },
        onSuccess: data => {
            warnConflicts(data?.conflicts, data?.guestConflicts)
            invalidate()
            setModal({ open: false, start: null, blockId: null })
        }
    })

    const { mutate: leaveBlock } = useMutation({
        mutationFn: leaveTimeBlock,
        onError: (error: Error) => toast.error(error.message),
        onSuccess: () => {
            toast.success('Te quitaste del bloque')
            invalidate()
            setModal({ open: false, start: null, blockId: null })
        }
    })

    const { mutate: removeBlock } = useMutation({
        mutationFn: deleteTimeBlock,
        onError: (error: Error) => toast.error(error.message),
        onSuccess: () => {
            toast.success('Bloque quitado del calendario')
            invalidate()
            setModal({ open: false, start: null, blockId: null })
        }
    })

    const { mutate: changeStatus, isPending: isChangingStatus } = useMutation({
        mutationFn: updateWorkTaskStatus,
        onError: (error: Error) => toast.error(error.message),
        onSuccess: result => {
            if (result?.awaitingApproval) {
                toast.info('Tiene aprobadora asignada: pasa a Por validar, no a Listo')
            } else {
                toast.success('Etiqueta actualizada')
            }
            invalidate()
        }
    })

    const { mutate: sendToValidation, isPending: isRequestingReview } = useMutation({
        mutationFn: requestWorkTaskReview,
        onError: (error: Error) => toast.error(error.message),
        onSuccess: () => { toast.success('Enviada a validación'); invalidate() }
    })

    const { mutate: approve, isPending: isApproving } = useMutation({
        mutationFn: resolveWorkTaskReview,
        onError: (error: Error) => toast.error(error.message),
        onSuccess: () => { toast.success('Aprobada'); invalidate() }
    })

    /** Cada etiqueta destino corresponde a una acción distinta sobre la tarea. */
    const handleChangeTaskLabel = (taskId: string, target: TaskLabel) => {
        const task = modalBlock && typeof modalBlock.task !== 'string' ? modalBlock.task : null
        const current = task?.review?.needed ? 'toValidate' : task?.status

        if (target === 'toValidate') {
            sendToValidation({ taskId })
        } else if (target === 'done' && current === 'toValidate') {
            approve({ taskId, approved: true })
        } else {
            changeStatus({ taskId, status: target })
        }
    }

    const { mutate: savePrefs } = useMutation({
        mutationFn: updateSchedulePreferences,
        onError: (error: Error) => toast.error(error.message),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['week'] })
            queryClient.invalidateQueries({ queryKey: ['user'] })
        }
    })

    const timezone = week?.timezone ?? 'America/Lima'

    /** La franja visible es de quien mira, no de quien se mira.
     *
     *  Antes salía de las preferencias del calendario abierto, así que al ver
     *  el de otra persona el control no hacía nada: guardaba en tu perfil y la
     *  rejilla seguía leyendo el suyo. Ahora es un ajuste de vista —como en
     *  cualquier calendario— y por eso funciona siempre, en el calendario de
     *  quien sea, sin pedir permiso y sin reescribir los ajustes de nadie. */
    const prefs = currentUser?.schedulePrefs
        ?? week?.schedulePrefs
        ?? { dayStartHour: 8, dayEndHour: 18, showWeekends: false }

    const days = useMemo(() => {
        if (!week) return []
        const start = new Date(week.weekStart)
        const count = prefs.showWeekends ? 7 : 5
        return Array.from({ length: count }, (_, i) => addDays(start, i))
    }, [week, prefs.showWeekends])

    const months = useMemo(
        () => view === 'quarter' ? quarterMonths(anchor, timezone) : [startOfMonth(anchor, timezone)],
        [view, anchor, timezone]
    )

    /** Rango que hay que pedir: la rejilla del mes incluye días de los meses
     *  vecinos, y esos bloques también se pintan. */
    const range = useMemo(() => {
        if (view === 'week') return null
        const grids = months.map(month => monthGridDays(month, timezone))
        const flat = grids.flat()
        return { from: flat[0], to: addDays(flat[flat.length - 1], 1) }
    }, [view, months, timezone])

    const { data: rangeData } = useQuery({
        queryKey: ['range', viewedUserId ?? 'me', range?.from.toISOString(), range?.to.toISOString()],
        queryFn: () => getRangeSchedule({ from: range!.from, to: range!.to, userId: viewedUserId }),
        enabled: !!range,
        retry: false
    })

    /** Ir a un día concreto: se cambia a la semana, que es donde se pone hora. */
    const openDay = (day: Date) => {
        setAnchor(day)
        setView('week')
    }

    /** Avanzar o retroceder según lo que se esté mirando. */
    const step = (direction: 1 | -1) => {
        if (view === 'week') return setAnchor(addDays(anchor, 7 * direction))
        setAnchor(addMonths(anchor, (view === 'month' ? 1 : 3) * direction, timezone))
    }

    const periodLabel = view === 'week'
        ? null
        : view === 'month' ? monthLabel(anchor, timezone) : quarterLabel(anchor, timezone)

    const scheduledThisWeek = useMemo(
        () => (week?.blocks ?? []).reduce((total, block) => total + durationMinutes(block.start, block.end), 0),
        [week]
    )

    /** Clic en un hueco: si hay una tarea elegida en "Por programar", se
     *  programa directo; si no, se abre el formulario. */
    const handleCreateAt = (start: Date) => {
        // Un segundo clic mientras se guarda crearía un bloque duplicado.
        if (isCreating) return

        if (selectedTaskId) {
            createBlock({
                task: selectedTaskId,
                start: start.toISOString(),
                end: new Date(start.getTime() + 30 * 60000).toISOString(),
                userId: viewedUserId
            })
            return
        }
        setModal({ open: true, start, blockId: null })
    }

    const handleSubmitBlock = async (payload: {
        taskId: string | null, newTaskName: string | null
        start: Date, end: Date, note: string, guests: string[]
    }) => {
        // Crear la tarea tarda, y hasta que arranca la mutación del bloque el
        // botón seguiría activo: un segundo envío duplicaría tarea y bloque.
        if (isSubmitting) return
        setIsSubmitting(true)
        try {
            await submitBlock(payload)
        } finally {
            setIsSubmitting(false)
        }
    }

    const submitBlock = async (payload: {
        taskId: string | null, newTaskName: string | null
        start: Date, end: Date, note: string, guests: string[]
    }) => {
        if (modalBlock) {
            moveBlock({
                blockId: modalBlock._id,
                start: payload.start.toISOString(),
                end: payload.end.toISOString(),
                note: payload.note,
                guests: payload.guests
            })
            return
        }

        let taskId = payload.taskId
        if (!taskId && payload.newTaskName) {
            try {
                const created = await createWorkTask({
                    name: payload.newTaskName,
                    assignee: viewedUserId,
                    estimatedMinutes: durationMinutes(payload.start, payload.end)
                })
                taskId = created!._id
            } catch (error) {
                return toast.error((error as Error).message)
            }
        }
        if (!taskId) return

        createBlock({
            task: taskId,
            start: payload.start.toISOString(),
            end: payload.end.toISOString(),
            note: payload.note,
            userId: viewedUserId,
            guests: payload.guests
        })
    }

    if (isLoading) return <p className="text-center py-20 text-sm text-ink-muted">Cargando tu semana…</p>
    if (!week) return <p className="text-center py-20 text-sm text-red-600">No se pudo cargar el calendario</p>

    const weekEndVisible = addDays(new Date(week.weekStart), days.length - 1)

    return (
        <>
            <PageHeader
                title="Calendario"
                subtitle={viewingOther
                    ? `Estás viendo el calendario de ${week.user.name}. Arrastra desde la derecha para darle hora.`
                    : 'Arrastra un pendiente desde la derecha hasta la hora en que lo harás.'}
            />

            {/* Barra de control */}
            <div className="card flex flex-wrap items-center gap-x-3 gap-y-2 p-2 mb-3">
                <div className="flex items-center gap-0.5">
                    <button
                        onClick={() => step(-1)}
                        className="w-7 h-7 grid place-content-center rounded text-ink-muted hover:bg-slate-100"
                        aria-label={view === 'week' ? 'Semana anterior'
                            : view === 'month' ? 'Mes anterior' : 'Trimestre anterior'}
                    >
                        <ChevronLeftIcon className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setAnchor(new Date())}
                        className="h-7 px-2.5 rounded text-xs font-semibold text-ink-muted hover:bg-slate-100"
                    >Hoy</button>
                    <button
                        onClick={() => step(1)}
                        className="w-7 h-7 grid place-content-center rounded text-ink-muted hover:bg-slate-100"
                        aria-label={view === 'week' ? 'Semana siguiente'
                            : view === 'month' ? 'Mes siguiente' : 'Trimestre siguiente'}
                    >
                        <ChevronRightIcon className="w-4 h-4" />
                    </button>
                </div>

                <p className="text-sm font-bold text-ink tabular capitalize">
                    {periodLabel ?? formatRangeLabel(new Date(week.weekStart), weekEndVisible, timezone)}
                </p>

                {/* Semana, mes o trimestre. Cada una responde una pregunta
                    distinta: a qué hora, cómo viene el mes, cómo viene el
                    trimestre. */}
                <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-slate-100">
                    {([
                        { key: 'week' as const, label: 'Semana' },
                        { key: 'month' as const, label: 'Mes' },
                        { key: 'quarter' as const, label: 'Trimestre' }
                    ]).map(item => (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => setView(item.key)}
                            aria-pressed={view === item.key}
                            className={`h-7 px-2.5 rounded text-xs font-semibold transition-colors ${
                                view === item.key
                                    ? 'bg-surface text-ink shadow-card'
                                    : 'text-ink-muted hover:text-ink'
                            }`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>

                {view === 'week' && (
                    <Badge variant="outline">{formatDuration(scheduledThisWeek)} programadas</Badge>
                )}

                {/* Cambiar de calendario con un gesto, no escondido en un menú */}
                {members && members.length > 1 && (
                    <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-slate-100">
                        {members.map(member => {
                            const active = (viewedUserId ?? currentUser?._id) === member._id
                            const isSelf = member._id === currentUser?._id
                            return (
                                <button
                                    key={member._id}
                                    type="button"
                                    aria-pressed={active}
                                    onClick={() => setViewedUserId(isSelf ? undefined : member._id)}
                                    className={`h-7 pl-1 pr-2.5 rounded flex items-center gap-1.5 text-xs
                                        font-semibold transition-colors ${
                                        active ? 'bg-surface text-ink shadow-card' : 'text-ink-muted hover:text-ink'
                                    }`}
                                >
                                    <Avatar name={member.name} size="xs" />
                                    {isSelf ? 'Yo' : member.name.split(' ')[0]}
                                </button>
                            )
                        })}
                    </div>
                )}

                <div className="ml-auto flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs font-medium text-ink-muted"
                        title="Ajuste tuyo: se aplica a cualquier calendario que abras">
                        <input
                            type="checkbox"
                            checked={prefs.showWeekends}
                            onChange={event => savePrefs({ schedulePrefs: { showWeekends: event.target.checked } })}
                            className="w-3.5 h-3.5 rounded border-line-strong text-brand-600 focus:ring-brand-500"
                        />
                        Fines de semana
                    </label>

                    <label className={`flex items-center gap-1 text-xs font-medium text-ink-muted ${
                        view === 'week' ? '' : 'hidden'
                    }`} title="Ajuste tuyo: se aplica a cualquier calendario que abras">
                        Franja
                        <input
                            type="number" min={0} max={23} value={prefs.dayStartHour}
                            onChange={event => savePrefs({ schedulePrefs: { dayStartHour: Number(event.target.value) } })}
                            className="w-12 h-7 py-0 px-1.5 text-xs text-center border-line-strong rounded tabular"
                            aria-label="Hora de inicio de la franja"
                        />
                        <span className="text-ink-subtle">a</span>
                        <input
                            type="number" min={1} max={24} value={prefs.dayEndHour}
                            onChange={event => savePrefs({ schedulePrefs: { dayEndHour: Number(event.target.value) } })}
                            className="w-12 h-7 py-0 px-1.5 text-xs text-center border-line-strong rounded tabular"
                            aria-label="Hora de fin de la franja"
                        />
                    </label>
                </div>
            </div>

            <div className={`grid grid-cols-1 gap-3 ${
                view === 'week' ? 'xl:grid-cols-[1fr_300px]' : ''
            }`}>
                <div className="card overflow-hidden">
                    {view === 'month' ? (
                        <MonthGrid
                            month={months[0]}
                            timezone={timezone}
                            blocks={rangeData?.blocks ?? []}
                            calendarOwnerId={viewedUserId ?? currentUser?._id ?? ''}
                            showWeekends={prefs.showWeekends}
                            onSelectBlock={block =>
                                setModal({ open: true, start: null, blockId: block._id })}
                            onOpenDay={openDay}
                            onCreateOn={day => {
                                // Como en un calendario al uso: pulsar un día del mes
                                // propone crear ahí, a la hora en que empieza la jornada.
                                const start = new Date(day)
                                start.setUTCHours(start.getUTCHours() + prefs.dayStartHour)
                                setModal({ open: true, start, blockId: null })
                            }}
                        />
                    ) : view === 'quarter' ? (
                        <QuarterGrid
                            months={months}
                            timezone={timezone}
                            blocks={rangeData?.blocks ?? []}
                            showWeekends={prefs.showWeekends}
                            onOpenDay={openDay}
                        />
                    ) : (
                    <WeekGrid
                        timezone={timezone}
                        windowStartHour={prefs.dayStartHour}
                        windowEndHour={prefs.dayEndHour}
                        days={days}
                        blocks={week.blocks}
                        onCreateAt={handleCreateAt}
                        onCommit={(blockId, start, end) => moveBlock({
                            blockId, start: start.toISOString(), end: end.toISOString()
                        })}
                        onSelect={block => setModal({ open: true, start: null, blockId: block._id })}
                        calendarOwnerId={viewedUserId ?? currentUser?._id ?? ''}
                        onDropTask={(taskId, start, minutes) => {
                            if (isCreating) return
                            createBlock({
                                task: taskId,
                                start: start.toISOString(),
                                end: new Date(start.getTime() + minutes * 60000).toISOString(),
                                userId: viewedUserId
                            })
                        }}
                    />
                    )}
                </div>

                {view === 'week' && (
                <aside className="card overflow-hidden self-start">
                    <div className="px-3 h-11 flex flex-col justify-center border-b border-line">
                        <h2 className="text-sm font-bold text-ink">Por programar</h2>
                        <p className="text-2xs text-ink-subtle leading-none">
                            Elige una y haz clic en el calendario
                        </p>
                    </div>
                    <UnscheduledPanel
                        rows={unscheduled ?? []}
                        selectedTaskId={selectedTaskId}
                        onSelect={setSelectedTaskId}
                    />
                    {/* Crear el pendiente y programarlo son dos gestos distintos,
                        y aquí hacen falta los dos al planificar la semana. */}
                    <div className="p-2 border-t border-line space-y-1">
                        <QuickCreateTask label="Nuevo pendiente" />
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-full"
                            onClick={() => setModal({ open: true, start: null, blockId: null })}
                        >
                            <PlusIcon className="w-4 h-4" /> Programar con formulario
                        </Button>
                    </div>
                </aside>
                )}
            </div>

            <BlockFormModal
                isOpen={modal.open}
                onClose={() => setModal({ open: false, start: null, blockId: null })}
                timezone={timezone}
                initialStart={modal.start}
                block={modalBlock}
                options={unscheduled ?? []}
                preselectedTaskId={selectedTaskId}
                onSubmit={handleSubmitBlock}
                onDelete={removeBlock}
                isSaving={isCreating || isSubmitting}
                onChangeTaskLabel={handleChangeTaskLabel}
                isChangingLabel={isChangingStatus || isRequestingReview || isApproving}
                members={members ?? []}
                calendarOwnerId={viewedUserId ?? currentUser?._id ?? ''}
                currentUserId={currentUser?._id ?? ''}
                onLeave={leaveBlock}
            />
        </>
    )
}
