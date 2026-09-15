import { Fragment, useEffect, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { TimeBlock, UnscheduledRow } from '@/types'
import { formatDuration, getZonedParts, zonedTimeToUtc } from '@/utils/datetime'
import { LABEL_ORDER, TaskLabel, getTaskLabel, labelPalette, labelTranslations } from '@/utils/taskLabels'

const DURATION_PRESETS = [15, 30, 60, 120]

type SubmitPayload = {
    taskId: string | null
    newTaskName: string | null
    start: Date
    end: Date
    note: string
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
    onChangeTaskLabel, isChangingLabel
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
    const [error, setError] = useState('')

    useEffect(() => {
        if (!isOpen) return

        const reference = block ? new Date(block.start) : initialStart ?? new Date()
        setDateValue(toDateInput(reference, timezone))
        setTimeValue(toTimeInput(reference, timezone))
        setError('')
        setNote(block?.note ?? '')

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
            note
        })
    }

    const preview = dateValue && timeValue ? computeRange() : null

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100"
                    leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/50" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100"
                            leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
                                <Dialog.Title className="text-xl font-black text-slate-800">
                                    {isEditing ? 'Editar bloque' : 'Programar trabajo'}
                                </Dialog.Title>
                                <p className="text-sm text-slate-500 mt-1">
                                    Un bloque dice <strong>cuándo</strong> trabajarás. Terminarlo no
                                    completa la tarea.
                                </p>

                                <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                                    {!isEditing && (
                                        <div className="flex gap-2 text-sm">
                                            <button
                                                type="button"
                                                onClick={() => setMode('existing')}
                                                className={`px-3 py-1.5 rounded font-bold ${
                                                    mode === 'existing' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600'
                                                }`}
                                            >
                                                Tarea existente
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setMode('new')}
                                                className={`px-3 py-1.5 rounded font-bold ${
                                                    mode === 'new' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600'
                                                }`}
                                            >
                                                Tarea nueva
                                            </button>
                                        </div>
                                    )}

                                    {mode === 'existing' ? (
                                        <div>
                                            <label htmlFor="task" className="block text-sm font-bold text-slate-700 mb-1">
                                                Tarea
                                            </label>
                                            <select
                                                id="task"
                                                value={taskId}
                                                onChange={event => setTaskId(event.target.value)}
                                                disabled={isEditing}
                                                className="w-full rounded border border-slate-300 p-2 text-sm disabled:bg-slate-100"
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
                                            <label htmlFor="newTask" className="block text-sm font-bold text-slate-700 mb-1">
                                                Nombre de la tarea
                                            </label>
                                            <input
                                                id="newTask"
                                                type="text"
                                                value={newTaskName}
                                                onChange={event => setNewTaskName(event.target.value)}
                                                placeholder="Por ejemplo: Revisar formularios web"
                                                className="w-full rounded border border-slate-300 p-2 text-sm"
                                            />
                                            <p className="text-xs text-slate-500 mt-1">
                                                Se crea como tarea puntual a tu nombre. Podrás completarla después.
                                            </p>
                                        </div>
                                    )}

                                    {/* La etiqueta pertenece a la tarea, no al bloque: cambiarla
                                        aquí se refleja en el tablero y en el proyecto. */}
                                    {isEditing && currentLabel && blockTask && (
                                        <div className="rounded-lg bg-slate-50 p-3">
                                            <span className="block text-sm font-bold text-slate-700">
                                                Etiqueta de la tarea
                                            </span>
                                            <p className="text-xs text-slate-500 mb-2">
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
                                                            className={`px-3 py-1.5 rounded text-sm font-bold transition-colors disabled:cursor-default ${
                                                                active
                                                                    ? labelPalette[label].button
                                                                    : 'bg-white border border-slate-300 text-slate-600 hover:border-slate-400 disabled:opacity-50'
                                                            }`}
                                                        >
                                                            {labelTranslations[label]}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                            {currentLabel === 'toValidate' && (
                                                <p className="text-xs text-indigo-700 mt-2">
                                                    Esperando aprobación. Solo la aprobadora puede pasarla a Listo.
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label htmlFor="date" className="block text-sm font-bold text-slate-700 mb-1">Día</label>
                                            <input
                                                id="date" type="date" value={dateValue}
                                                onChange={event => setDateValue(event.target.value)}
                                                className="w-full rounded border border-slate-300 p-2 text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="time" className="block text-sm font-bold text-slate-700 mb-1">Hora de inicio</label>
                                            <input
                                                id="time" type="time" step={900} value={timeValue}
                                                onChange={event => setTimeValue(event.target.value)}
                                                className="w-full rounded border border-slate-300 p-2 text-sm"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <span className="block text-sm font-bold text-slate-700 mb-1">Duración</span>
                                        <div className="flex flex-wrap gap-2">
                                            {DURATION_PRESETS.map(preset => (
                                                <button
                                                    key={preset}
                                                    type="button"
                                                    onClick={() => setMinutes(preset)}
                                                    className={`px-3 py-1.5 rounded text-sm font-bold ${
                                                        minutes === preset ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-700'
                                                    }`}
                                                >
                                                    {formatDuration(preset)}
                                                </button>
                                            ))}
                                            <input
                                                type="number" min={15} step={15} value={minutes}
                                                onChange={event => setMinutes(Number(event.target.value))}
                                                aria-label="Duración personalizada en minutos"
                                                className="w-24 rounded border border-slate-300 p-1.5 text-sm"
                                            />
                                            <span className="self-center text-sm text-slate-500">min</span>
                                        </div>
                                    </div>

                                    {preview && (
                                        <p className="text-sm text-slate-600 bg-slate-50 rounded p-2">
                                            Termina a las{' '}
                                            <strong>
                                                {String(getZonedParts(preview.end, timezone).hour).padStart(2, '0')}:
                                                {String(getZonedParts(preview.end, timezone).minute).padStart(2, '0')}
                                            </strong>{' '}
                                            ({formatDuration(minutes)}) · zona {timezone}
                                        </p>
                                    )}

                                    <div>
                                        <label htmlFor="note" className="block text-sm font-bold text-slate-700 mb-1">
                                            Nota <span className="font-normal text-slate-400">(opcional)</span>
                                        </label>
                                        <input
                                            id="note" type="text" value={note}
                                            onChange={event => setNote(event.target.value)}
                                            className="w-full rounded border border-slate-300 p-2 text-sm"
                                        />
                                    </div>

                                    {error && <p className="text-sm text-red-600 font-bold">{error}</p>}

                                    <div className="flex items-center justify-between pt-2">
                                        {isEditing ? (
                                            <button
                                                type="button"
                                                onClick={() => onDelete(block!._id)}
                                                className="text-sm font-bold text-red-600 hover:underline"
                                            >
                                                Quitar del calendario
                                            </button>
                                        ) : <span />}

                                        <div className="flex gap-2">
                                            <button
                                                type="button" onClick={onClose}
                                                className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded"
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                type="submit" disabled={isSaving}
                                                className="px-4 py-2 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 rounded disabled:opacity-50"
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
