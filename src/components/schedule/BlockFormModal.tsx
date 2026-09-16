import { Fragment, useEffect, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { CheckIcon, UserPlusIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { TimeBlock, UnscheduledRow } from '@/types'
import { formatDuration, getZonedParts, zonedTimeToUtc } from '@/utils/datetime'
import { LABEL_ORDER, TaskLabel, getTaskLabel, labelPalette, labelTranslations } from '@/utils/taskLabels'
import { firstNameOf, personId } from '@/utils/people'
import { Avatar } from '@/components/ui'

const DURATION_PRESETS = [15, 30, 60, 120]

type Person = { _id: string, name: string }

type SubmitPayload = {
    taskId: string | null
    newTaskName: string | null
    start: Date
    end: Date
    note: string
    guests: string[]
}

type Props = {
    isOpen: boolean
    onClose: () => void
    timezone: string
    /** Hora elegida en el calendario al hacer clic en un hueco. */
    initialStart: Date | null
    /** Bloque existente cuando se está editando. */
    block: TimeBlock | null
    options: UnscheduledRow[]
    preselectedTaskId: string | null
    onSubmit: (payload: SubmitPayload) => void
    onDelete: (blockId: string) => void
    isSaving: boolean
    /** Cambia la etiqueta de la tarea, no la del bloque. */
    onChangeTaskLabel: (taskId: string, target: TaskLabel) => void
    isChangingLabel: boolean
    /** Equipo al que se puede etiquetar en un pendiente compartido. */
    members: Person[]
    /** De quién es el calendario que se está editando. */
    calendarOwnerId: string
    /** Quien está mirando, para saber si es invitada y no dueña del bloque. */
    currentUserId: string
    /** Deja de aparecer en un bloque en el que te etiquetaron. */
    onLeave: (blockId: string) => void
}


const toDateInput = (date: Date, timezone: string) => {
    const p = getZonedParts(date, timezone)
    return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

const toTimeInput = (date: Date, timezone: string) => {
    const p = getZonedParts(date, timezone)
    return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`
}

export default function BlockFormModal({
    isOpen, onClose, timezone, initialStart, block, options,
    preselectedTaskId, onSubmit, onDelete, isSaving,
    onChangeTaskLabel, isChangingLabel,
    members, calendarOwnerId, currentUserId, onLeave
}: Props) {
    const isEditing = !!block
    const blockTask = block && typeof block.task !== 'string' ? block.task : null
    const currentLabel = blockTask?.status ? getTaskLabel(blockTask as never) : null

    const [mode, setMode] = useState<'existing' | 'new'>('existing')
    const [taskId, setTaskId] = useState('')
    const [newTaskName, setNewTaskName] = useState('')
    const [dateValue, setDateValue] = useState('')
    const [timeValue, setTimeValue] = useState('')
    const [minutes, setMinutes] = useState(30)
    const [note, setNote] = useState('')
    const [guests, setGuests] = useState<string[]>([])
    const [error, setError] = useState('')

    useEffect(() => {
        if (!isOpen) return

        const reference = block ? new Date(block.start) : initialStart ?? new Date()
        setDateValue(toDateInput(reference, timezone))
        setTimeValue(toTimeInput(reference, timezone))
        setError('')
        setNote(block?.note ?? '')
        setGuests((block?.guests ?? []).map(personId).filter(Boolean))

        if (block) {
            const length = (new Date(block.end).getTime() - new Date(block.start).getTime()) / 60000
            setMinutes(length)
            setTaskId(typeof block.task === 'string' ? block.task : block.task._id)
            setMode('existing')
        } else {
            setMinutes(30)
            setTaskId(preselectedTaskId ?? '')
            setNewTaskName('')
            setMode(preselectedTaskId ? 'existing' : options.length > 0 ? 'existing' : 'new')
        }
    }, [isOpen, block, initialStart, preselectedTaskId, timezone, options.length])

    const computeRange = () => {
        const [year, month, day] = dateValue.split('-').map(Number)
        const [hour, minute] = timeValue.split(':').map(Number)
        const start = zonedTimeToUtc(year, month, day, hour, minute, timezone)
        return { start, end: new Date(start.getTime() + minutes * 60000) }
    }

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault()
        setError('')

        if (mode === 'existing' && !taskId) {
            return setError('Elige una tarea o crea una nueva')
        }
        if (mode === 'new' && newTaskName.trim().length === 0) {
            return setError('Escribe el nombre de la nueva tarea')
        }
        if (!dateValue || !timeValue) {
            return setError('Indica día y hora de inicio')
        }
        if (minutes < 15) {
            return setError('La duración mínima es de 15 minutos')
        }

        const { start, end } = computeRange()
        onSubmit({
            taskId: mode === 'existing' ? taskId : null,
            newTaskName: mode === 'new' ? newTaskName.trim() : null,
            start,
            end,
            note,
            guests
        })
    }

    const preview = dateValue && timeValue ? computeRange() : null

    /** Quien es dueña del calendario no puede ser además invitada suya. */
    const invitables = members.filter(member => member._id !== calendarOwnerId)
    const blockOwnerId = block ? personId(block.user) : calendarOwnerId
    /** Se está mirando un bloque de otra persona en el que a una la etiquetaron. */
    const viewingAsGuest = !!block && blockOwnerId !== currentUserId &&
        (block.guests ?? []).some(guest => personId(guest) === currentUserId)
    const blockOwnerName = block ? firstNameOf(block.user) : ''
    /** Un pendiente reservado no se comparte: el servidor lo rechaza y aquí
     *  se explica antes de intentarlo. */
    const taskIsPrivate = !!blockTask?.isPrivate

    const toggleGuest = (id: string) => setGuests(current =>
        current.includes(id) ? current.filter(item => item !== id) : [...current, id]
    )

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100"
                    leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-ink/40" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100"
                            leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-lg rounded-xl bg-surface shadow-overlay overflow-hidden">
                                <div className="px-5 pt-4 pb-3 border-b border-line">
                                <Dialog.Title className="text-base font-bold text-ink">
                                    {isEditing ? 'Editar bloque' : 'Programar trabajo'}
                                </Dialog.Title>
                                <p className="text-xs text-ink-muted mt-0.5">
                                    Un bloque dice <strong>cuándo</strong> trabajarás. Terminarlo no
                                    completa la tarea.
                                </p>

                                {viewingAsGuest && (
                                    <p className="mt-3 rounded-lg bg-amber-50 border border-amber-200
                                        px-3 py-2 text-xs text-amber-900">
                                        Te etiquetaron en este bloque, que es del calendario
                                        de <strong>{blockOwnerName}</strong>. Puedes verlo y quitarte,
                                        pero moverlo o cambiarlo le corresponde a ella.
                                    </p>
                                )}

                                </div>

                                <form onSubmit={handleSubmit}
                                    className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
                                    {!isEditing && (
                                        <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-slate-100 w-fit">
                                            <button
                                                type="button"
                                                onClick={() => setMode('existing')}
                                                className={`h-7 px-3 rounded text-xs font-semibold transition-colors ${
                                                    mode === 'existing'
                                                        ? 'bg-surface text-ink shadow-card'
                                                        : 'text-ink-muted hover:text-ink'
                                                }`}
                                            >
                                                Tarea existente
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setMode('new')}
                                                className={`h-7 px-3 rounded text-xs font-semibold transition-colors ${
                                                    mode === 'new'
                                                        ? 'bg-surface text-ink shadow-card'
                                                        : 'text-ink-muted hover:text-ink'
                                                }`}
                                            >
                                                Tarea nueva
                                            </button>
                                        </div>
                                    )}

                                    {mode === 'existing' ? (
                                        <div>
                                            <label htmlFor="task" className="block text-xs font-semibold text-ink-muted mb-1">
                                                Tarea
                                            </label>
                                            <select
                                                id="task"
                                                value={taskId}
                                                onChange={event => setTaskId(event.target.value)}
                                                disabled={isEditing}
                                                className="w-full h-9 rounded-md border-line-strong text-sm text-ink disabled:bg-surface-sunken
                                                    focus:border-brand-500 focus:ring-brand-500"
                                            >
                                                <option value="">Elige una tarea…</option>
                                                {options.map(({ task }) => (
                                                    <option key={task._id} value={task._id}>{task.name}</option>
                                                ))}
                                                {isEditing && !options.some(o => o.task._id === taskId) && (
                                                    <option value={taskId}>
                                                        {typeof block!.task === 'string' ? 'Tarea' : block!.task.name}
                                                    </option>
                                                )}
                                            </select>
                                        </div>
                                    ) : (
                                        <div>
                                            <label htmlFor="newTask" className="block text-xs font-semibold text-ink-muted mb-1">
                                                Nombre de la tarea
                                            </label>
                                            <input
                                                id="newTask"
                                                type="text"
                                                value={newTaskName}
                                                onChange={event => setNewTaskName(event.target.value)}
                                                placeholder="Por ejemplo: Revisar formularios web"
                                                className="w-full h-9 rounded-md border-line-strong text-sm text-ink
                                                focus:border-brand-500 focus:ring-brand-500"
                                            />
                                            <p className="text-xs text-ink-subtle mt-1">
                                                Se crea como tarea puntual a tu nombre. Podrás completarla después.
                                            </p>
                                        </div>
                                    )}

                                    {/* La etiqueta pertenece a la tarea, no al bloque: cambiarla
                                        aquí se refleja en el tablero y en el proyecto. */}
                                    {isEditing && currentLabel && blockTask && (
                                        <div className="rounded-md bg-surface-sunken p-3">
                                            <span className="block text-sm font-bold text-slate-700">
                                                Etiqueta de la tarea
                                            </span>
                                            <p className="text-xs text-ink-subtle mb-2">
                                                Marca cómo va <strong>{blockTask.name}</strong>. El bloque se queda donde está.
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {LABEL_ORDER.map(label => {
                                                    const active = currentLabel === label
                                                    return (
                                                        <button
                                                            key={label}
                                                            type="button"
                                                            disabled={isChangingLabel || active}
                                                            aria-pressed={active}
                                                            onClick={() => onChangeTaskLabel(blockTask._id, label)}
                                                            className={`h-8 px-3 rounded-md text-xs font-semibold transition-colors disabled:cursor-default ${
                                                                active
                                                                    ? labelPalette[label].button
                                                                    : 'bg-surface border border-line-strong text-ink-muted hover:border-ink-subtle disabled:opacity-50'
                                                            }`}
                                                        >
                                                            {labelTranslations[label]}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                            {currentLabel === 'toValidate' && (
                                                <p className="text-xs text-amber-800 mt-2">
                                                    Esperando aprobación. Solo la aprobadora puede pasarla a Listo.
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label htmlFor="date" className="block text-xs font-semibold text-ink-muted mb-1">Día</label>
                                            <input
                                                id="date" type="date" value={dateValue}
                                                onChange={event => setDateValue(event.target.value)}
                                                className="w-full h-9 rounded-md border-line-strong text-sm text-ink
                                                focus:border-brand-500 focus:ring-brand-500"
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="time" className="block text-xs font-semibold text-ink-muted mb-1">Hora de inicio</label>
                                            <input
                                                id="time" type="time" step={900} value={timeValue}
                                                onChange={event => setTimeValue(event.target.value)}
                                                className="w-full h-9 rounded-md border-line-strong text-sm text-ink
                                                focus:border-brand-500 focus:ring-brand-500"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <span className="block text-xs font-semibold text-ink-muted mb-1">Duración</span>
                                        <div className="flex flex-wrap gap-2">
                                            {DURATION_PRESETS.map(preset => (
                                                <button
                                                    key={preset}
                                                    type="button"
                                                    onClick={() => setMinutes(preset)}
                                                    className={`h-8 px-3 rounded-md text-xs font-semibold border transition-colors ${
                                                        minutes === preset
                                                            ? 'bg-brand-50 border-brand-300 text-brand-700'
                                                            : 'bg-surface border-line-strong text-ink-muted hover:border-ink-subtle'
                                                    }`}
                                                >
                                                    {formatDuration(preset)}
                                                </button>
                                            ))}
                                            <input
                                                type="number" min={15} step={15} value={minutes}
                                                onChange={event => setMinutes(Number(event.target.value))}
                                                aria-label="Duración personalizada en minutos"
                                                className="w-20 h-8 rounded-md border-line-strong text-sm tabular text-ink
                                                focus:border-brand-500 focus:ring-brand-500"
                                            />
                                            <span className="self-center text-xs text-ink-subtle">min</span>
                                        </div>
                                    </div>

                                    {preview && (
                                        <p className="text-xs text-ink-muted bg-surface-sunken rounded-md px-2.5 py-2">
                                            Termina a las{' '}
                                            <strong>
                                                {String(getZonedParts(preview.end, timezone).hour).padStart(2, '0')}:
                                                {String(getZonedParts(preview.end, timezone).minute).padStart(2, '0')}
                                            </strong>{' '}
                                            ({formatDuration(minutes)}) · zona {timezone}
                                        </p>
                                    )}

                                    {/* Pendiente compartido. Como en un calendario al
                                        uso: se etiqueta a quien participa y el bloque
                                        aparece también en su semana. Sigue siendo un
                                        solo bloque, así que moverlo lo mueve para
                                        todas. */}
                                    {invitables.length > 0 && (
                                        <div>
                                            <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted mb-1.5">
                                                <UserPlusIcon className="w-4 h-4 text-slate-400" />
                                                Compartir con
                                                <span className="font-normal text-slate-400">(opcional)</span>
                                            </span>

                                            {taskIsPrivate ? (
                                                <p className="text-xs text-ink-muted bg-surface-sunken rounded-md p-2">
                                                    Este pendiente está marcado como «Solo tú lo ves».
                                                    Quítale esa marca para poder compartirlo.
                                                </p>
                                            ) : (
                                                <>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {invitables.map(member => {
                                                            const active = guests.includes(member._id)
                                                            return (
                                                                <button
                                                                    key={member._id}
                                                                    type="button"
                                                                    onClick={() => toggleGuest(member._id)}
                                                                    aria-pressed={active}
                                                                    className={`h-8 pl-1 pr-2.5 rounded-full flex items-center gap-1.5
                                                                        text-xs font-semibold transition-colors border ${
                                                                        active
                                                                            ? 'bg-brand-50 border-brand-300 text-brand-700'
                                                                            : 'bg-surface border-line-strong text-ink-muted hover:border-ink-subtle'
                                                                    }`}
                                                                >
                                                                    <Avatar name={member.name} size="xs" />
                                                                    {member.name.split(' ')[0]}
                                                                    {active && <CheckIcon className="w-3.5 h-3.5" strokeWidth={3} />}
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                    <p className="text-xs text-ink-subtle mt-1.5">
                                                        {guests.length === 0
                                                            ? 'Nadie más lo verá en su calendario.'
                                                            : 'Les aparecerá en su calendario a esta misma hora. ' +
                                                              'Es un solo bloque: si lo mueves, se mueve para todas.'}
                                                    </p>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    <div>
                                        <label htmlFor="note" className="block text-xs font-semibold text-ink-muted mb-1">
                                            Nota <span className="font-normal text-slate-400">(opcional)</span>
                                        </label>
                                        <input
                                            id="note" type="text" value={note}
                                            onChange={event => setNote(event.target.value)}
                                            className="w-full h-9 rounded-md border-line-strong text-sm text-ink
                                                focus:border-brand-500 focus:ring-brand-500"
                                        />
                                    </div>

                                    {error && <p className="text-xs text-red-600 font-semibold">{error}</p>}

                                    <div className="flex items-center justify-between pt-1 -mx-5 -mb-4 px-5 py-3
                                        border-t border-line bg-surface-sunken sticky bottom-0">
                                        {isEditing ? (
                                            viewingAsGuest ? (
                                                <button
                                                    type="button"
                                                    onClick={() => onLeave(block!._id)}
                                                    className="flex items-center gap-1 text-xs font-semibold
                                                        text-ink-muted hover:text-red-600"
                                                >
                                                    <XMarkIcon className="w-4 h-4" /> Quitarme de este bloque
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => onDelete(block!._id)}
                                                    className="text-xs font-semibold text-red-600 hover:underline"
                                                >
                                                    Quitar del calendario
                                                </button>
                                            )
                                        ) : <span />}

                                        <div className="flex gap-2">
                                            <button
                                                type="button" onClick={onClose}
                                                className="h-9 px-3.5 text-xs font-semibold text-ink-muted
                                                    hover:bg-slate-100 rounded-md transition-colors"
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                type="submit" disabled={isSaving}
                                                className="h-9 px-4 text-xs font-semibold text-white bg-brand-600
                                                    hover:bg-brand-700 rounded-md shadow-card
                                                    disabled:opacity-50 transition-colors"
                                            >
                                                {isSaving ? 'Guardando…' : isEditing ? 'Guardar' : 'Programar'}
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    )
}
