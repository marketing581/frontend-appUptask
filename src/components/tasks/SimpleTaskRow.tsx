import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowsPointingOutIcon } from '@heroicons/react/24/outline'
import { Task } from '@/types'
import { ALERT_COLOR, TaskLabel, frequencyShort, getTaskLabel } from '@/utils/taskLabels'
import { kindOf } from '@/utils/taskKind'
import { plainPreview } from '@/utils/markdown'
import { Avatar, Badge } from '@/components/ui'
import ColorTagDot from './ColorTagDot'
import DescriptionModal from './DescriptionModal'
import TaskActionsMenu from './TaskActionsMenu'
import TaskStatusControl from './TaskStatusControl'
import { PlanDay } from './PlanDayPicker'

/** Fila de la vista simplificada de "Mi trabajo": lo único que importa
 *  momento a momento. Cambiar el estado y jalar algo a hoy son gestos de un
 *  clic; el resto —renombrar, ocultar, borrar— sigue ahí pero no compite por
 *  atención. */

/** Tiñe toda la fila con el color, no solo el punto: de un vistazo, sin
 *  tener que leer cada etiqueta. Un tono bajo para no pelear con el texto
 *  ni con el resto de etiquetas de color. */
const COLOR_WASH: Record<'orange' | 'green' | 'fuchsia' | 'celeste', string> = {
    orange: 'rgba(230, 79, 27, 0.1)',
    green: 'rgba(65, 131, 0, 0.1)',
    fuchsia: 'rgba(214, 36, 159, 0.1)',
    celeste: 'rgba(96, 162, 191, 0.15)'
}

type Props = {
    task: Task
    /** Los cinco días de la semana en curso (lunes a viernes), para el
     *  selector de planificación y para saber si el vencimiento es hoy. */
    weekDays: PlanDay[]
    /** "YYYY-MM-DD" del día de hoy, en la zona de quien mira. */
    todayKey: string
    canEdit: boolean
    canHide: boolean
    busy: boolean
    /** Si se puede mover a un día de la semana desde el menú de opciones.
     *  En "Finalizados" no aplica —una tarea ya cerrada no se planifica—. */
    showDayOptions?: boolean
    /** Solo para tareas "Por validar": quién espera aprobarla y desde
     *  cuándo, ya formateado —no todas las filas la llevan, solo aparece en
     *  la columna "Por validar". */
    reviewInfo?: { approverName: string | null, elapsed: string }
    /** La aprobadora asignada o la encargada, no quien la hizo: aunque
     *  `canEdit` sea cierto para su dueña, resolver la revisión no le
     *  corresponde a ella. */
    canResolveReview?: boolean
    onApprove?: (taskId: string) => void
    onRequestChanges?: (taskId: string, note: string) => void
    /** Cambia el estado —incluido "Por validar", que no es un estado real
     *  sino su propio flujo de aprobación— por su nombre en cada transición. */
    onSetLabel: (taskId: string, label: TaskLabel) => void
    /** `null` quita el pendiente de la semana. */
    onSetDay: (taskId: string, dayKey: string | null) => void
    onPatch: (taskId: string, formData: Record<string, unknown>) => void
    onDelete: (taskId: string) => void
}

export default function SimpleTaskRow({
    task, weekDays, todayKey, canEdit, canHide, busy, showDayOptions = true,
    reviewInfo, canResolveReview, onApprove, onRequestChanges,
    onSetLabel, onSetDay, onPatch, onDelete
}: Props) {
    const [adjusting, setAdjusting] = useState(false)
    const [adjustNote, setAdjustNote] = useState('')
    const label = getTaskLabel(task)
    const done = label === 'done' || !!task.doneForPeriod
    // Una recurrente hecha hoy se ve como "Listo" aunque el estado real siga
    // en Pendiente —vuelve a hacer falta mañana—; el control muestra ese
    // avance visible, no el dato interno.
    const effectiveLabel: TaskLabel = task.doneForPeriod ? 'done' : label
    const [name, setName] = useState(task.name)
    const [confirming, setConfirming] = useState(false)
    const inputRef = useRef<HTMLTextAreaElement>(null)

    useEffect(() => { setName(task.name) }, [task.name])

    const commitName = () => {
        const next = name.trim()
        if (next.length === 0) { setName(task.name); return }
        if (next === task.name) return
        onPatch(task._id, { name: next })
    }

    // Corta, se escribe ahí mismo y se guarda sola al salir, igual que el
    // nombre —pero solo hasta cierta altura: pasado eso, "Ampliar editor"
    // lleva al modal en vez de seguir agrandando la tarjeta.
    const [description, setDescription] = useState(task.description ?? '')
    const [descFocused, setDescFocused] = useState(false)
    const [showExpandEditor, setShowExpandEditor] = useState(false)
    const [showViewMore, setShowViewMore] = useState(false)
    const [descModalOpen, setDescModalOpen] = useState(false)
    const descriptionRef = useRef<HTMLTextAreaElement>(null)
    const descPreviewRef = useRef<HTMLParagraphElement>(null)

    const INLINE_DESCRIPTION_MAX_PX = 48 // unas tres líneas a este tamaño de texto

    useEffect(() => { setDescription(task.description ?? '') }, [task.description])

    const resizeDescription = () => {
        const el = descriptionRef.current
        if (!el) return
        el.style.height = 'auto'
        const natural = el.scrollHeight
        el.style.height = `${Math.min(natural, INLINE_DESCRIPTION_MAX_PX)}px`
        setShowExpandEditor(natural > INLINE_DESCRIPTION_MAX_PX)
    }

    useEffect(resizeDescription, [description, descFocused])

    // Se mide en vez de adivinar por caracteres: exacto sin importar cuánto
    // ocupe cada línea según el ancho de la tarjeta.
    useEffect(() => {
        if (descFocused) return
        const el = descPreviewRef.current
        setShowViewMore(!!el && el.scrollHeight > el.clientHeight + 1)
    }, [description, descFocused])

    const commitDescription = () => {
        const next = description.trim()
        if (next === (task.description ?? '')) return
        onPatch(task._id, { description: next })
    }

    const saveDescriptionFromModal = (value: string) => {
        setDescription(value)
        const next = value.trim()
        if (next === (task.description ?? '')) return
        onPatch(task._id, { description: next })
    }

    const project = task.project && typeof task.project !== 'string' ? task.project : null
    const kind = kindOf(task)
    const participants = project?.team ?? []

    // La fecha límite se guarda como fecha simple ("YYYY-MM-DD"), sin hora:
    // se compara igual, tomando esos mismos diez caracteres, para no
    // reinterpretarla por zona horaria y correrla un día en el camino. Y solo
    // se anuncia cuando ya toca hacer algo con ella: hoy o vencida. Una fecha
    // futura no aporta nada en una vista para el momento.
    const dueKey = task.dueDate ? task.dueDate.slice(0, 10) : null
    const overdue = !done && !!dueKey && dueKey < todayKey
    const dueToday = !done && dueKey === todayKey

    const plannedKey = task.plannedDate ? task.plannedDate.slice(0, 10) : null
    const colorTag = task.colorTag ?? null

    return (
        <li
            draggable={canEdit}
            onDragStart={event => {
                event.dataTransfer.setData('application/x-uptask-plan-task', task._id)
                event.dataTransfer.effectAllowed = 'move'
            }}
            style={colorTag ? { backgroundColor: COLOR_WASH[colorTag] } : undefined}
            className={`group flex items-start gap-2 px-3 py-2 transition-all ${
                colorTag ? 'hover:brightness-[0.97]' : 'hover:bg-surface-sunken'
            } ${canEdit ? 'cursor-grab active:cursor-grabbing' : ''}`}
        >
            <div className="min-w-0 flex-1">
                <div className="flex items-start gap-1.5">
                    <ColorTagDot
                        value={colorTag}
                        disabled={!canEdit}
                        onChange={next => onPatch(task._id, { colorTag: next })}
                    />
                    {canEdit ? (
                        <textarea
                            ref={inputRef}
                            value={name}
                            onChange={event => setName(event.target.value)}
                            onBlur={commitName}
                            onKeyDown={event => {
                                if (event.key === 'Enter') { event.preventDefault(); inputRef.current?.blur() }
                                if (event.key === 'Escape') { setName(task.name); inputRef.current?.blur() }
                            }}
                            rows={1}
                            aria-label={`Nombre de ${task.name}`}
                            title={task.name}
                            className={`min-w-0 flex-1 border-0 p-0 bg-transparent text-sm font-medium
                                leading-snug focus:ring-0 rounded resize-none overflow-y-auto
                                max-h-[2.6em] ${
                                done ? 'text-ink-subtle line-through' : 'text-ink'
                            }`}
                        />
                    ) : (
                        <p title={task.name} className={`min-w-0 flex-1 line-clamp-2 text-sm font-medium leading-snug ${
                            done ? 'text-ink-subtle line-through' : 'text-ink'
                        }`}>
                            {task.name}
                        </p>
                    )}
                </div>

                <div className="flex items-start gap-1 mt-0.5">
                    {canEdit && descFocused ? (
                        <div className="min-w-0 flex-1">
                            <textarea
                                ref={descriptionRef}
                                value={description}
                                onChange={event => setDescription(event.target.value)}
                                onBlur={() => { commitDescription(); setDescFocused(false) }}
                                onMouseDown={event => event.stopPropagation()}
                                onKeyDown={event => {
                                    if (event.key === 'Escape') {
                                        setDescription(task.description ?? '')
                                        descriptionRef.current?.blur()
                                    }
                                }}
                                placeholder="Descripción"
                                autoFocus
                                aria-label={`Descripción de ${task.name}`}
                                className="block w-full resize-none overflow-y-auto border-0 p-0 bg-transparent
                                    text-2xs leading-snug text-ink-subtle placeholder:text-ink-subtle/60
                                    focus:ring-0"
                            />
                            {showExpandEditor && (
                                <button
                                    type="button"
                                    onMouseDown={event => event.stopPropagation()}
                                    onClick={() => {
                                        commitDescription()
                                        setDescFocused(false)
                                        setDescModalOpen(true)
                                    }}
                                    className="block text-2xs font-semibold text-brand-600 hover:underline"
                                >
                                    Ampliar editor
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="min-w-0 flex-1">
                            {description ? (
                                <>
                                    <p
                                        ref={descPreviewRef}
                                        onClick={() => canEdit && setDescFocused(true)}
                                        onMouseDown={event => event.stopPropagation()}
                                        className={`text-2xs leading-snug text-ink-subtle whitespace-pre-line line-clamp-2 ${
                                            canEdit ? 'cursor-text' : ''
                                        }`}
                                    >
                                        {plainPreview(description, 240)}
                                    </p>
                                    {showViewMore && (
                                        <button
                                            type="button"
                                            onMouseDown={event => event.stopPropagation()}
                                            onClick={() => setDescModalOpen(true)}
                                            className="block text-2xs font-semibold text-brand-600 hover:underline"
                                        >
                                            Ver más
                                        </button>
                                    )}
                                </>
                            ) : canEdit ? (
                                <button
                                    type="button"
                                    onMouseDown={event => event.stopPropagation()}
                                    onClick={() => setDescFocused(true)}
                                    className="text-2xs text-ink-subtle/60 hover:text-ink-subtle"
                                >
                                    Añadir descripción
                                </button>
                            ) : null}
                        </div>
                    )}

                    {/* Siempre a la vista, tenga o no ya texto: sin esto, la
                        única forma de llegar al editor completo era escribir
                        tanto que desbordara el campo corto —invisible si la
                        tarjeta estaba vacía o con poco texto—. */}
                    {(canEdit || description) && (
                        <button
                            type="button"
                            onMouseDown={event => event.stopPropagation()}
                            onClick={() => setDescModalOpen(true)}
                            title="Descripción completa"
                            aria-label={`Descripción completa de ${task.name}`}
                            className="w-5 h-5 shrink-0 grid place-content-center rounded text-ink-subtle/70
                                hover:bg-slate-200 hover:text-ink transition-colors"
                        >
                            <ArrowsPointingOutIcon className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                <DescriptionModal
                    isOpen={descModalOpen}
                    taskName={task.name}
                    initialValue={description}
                    canEdit={canEdit}
                    onSave={saveDescriptionFromModal}
                    onClose={() => setDescModalOpen(false)}
                />

                {/* El estado va primero, como un tag más: se cambia con el
                    mismo gesto con que se lee el resto —de qué tipo es, si
                    espera validación o respuesta, si está vencida. */}
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <TaskStatusControl
                        label={effectiveLabel}
                        disabled={busy || !canEdit}
                        onChange={next => onSetLabel(task._id, next)}
                    />
                    {task.onHold?.active && (
                        <span className="text-2xs font-semibold" style={{ color: ALERT_COLOR }}>
                            En espera{task.onHold.waitingOn && ` de ${task.onHold.waitingOn}`}
                        </span>
                    )}
                    {overdue && <Badge variant="alert">Vencido</Badge>}
                    {dueToday && !overdue && (
                        <Badge className="bg-amber-100 text-amber-900">Vence hoy</Badge>
                    )}
                    {kind === 'maintenance' && (
                        <span className="text-2xs text-ink-subtle">
                            {frequencyShort[task.frequency]}
                        </span>
                    )}
                    {kind === 'oneOff' && (
                        <span className="text-2xs text-ink-subtle">Puntual</span>
                    )}
                    {kind === 'project' && project && (
                        <span className="flex items-center gap-1 min-w-0">
                            <Link
                                to={`/projects/${project._id}`}
                                onClick={event => event.stopPropagation()}
                                className="text-2xs text-ink-subtle hover:text-brand-600 hover:underline truncate"
                            >
                                {project.projectName}
                            </Link>
                            {participants.length > 0 && (
                                <span className="flex items-center -space-x-1 shrink-0">
                                    {participants.slice(0, 3).map(person => (
                                        <Avatar key={person._id} name={person.name} size="xs" />
                                    ))}
                                    {participants.length > 3 && (
                                        <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-600
                                            text-[9px] font-semibold grid place-content-center shrink-0">
                                            +{participants.length - 3}
                                        </span>
                                    )}
                                </span>
                            )}
                        </span>
                    )}
                    {task.isPrivate && (
                        <Badge className="bg-slate-200 text-slate-700 ring-1 ring-inset ring-slate-400">
                            Solo tú lo ves
                        </Badge>
                    )}
                </div>

                {label === 'toValidate' && reviewInfo && (
                    <div className="mt-2 pt-2 border-t border-line/70">
                        <p className="text-2xs text-ink-subtle">
                            {reviewInfo.approverName ? `Espera de ${reviewInfo.approverName}` : 'Espera aprobación'}
                            {' · '}{reviewInfo.elapsed}
                        </p>
                        {canResolveReview && (
                            adjusting ? (
                                <div className="flex items-center gap-1.5 mt-1.5">
                                    <input
                                        value={adjustNote}
                                        onChange={event => setAdjustNote(event.target.value)}
                                        onMouseDown={event => event.stopPropagation()}
                                        placeholder="¿Qué hay que ajustar?"
                                        autoFocus
                                        className="flex-1 h-7 min-w-0 rounded-md border-line-strong text-2xs
                                            focus:border-brand-500 focus:ring-brand-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onRequestChanges?.(task._id, adjustNote)
                                            setAdjusting(false)
                                            setAdjustNote('')
                                        }}
                                        className="h-7 px-2.5 rounded text-2xs font-semibold text-white
                                            bg-brand-600 hover:bg-brand-700 shrink-0"
                                    >
                                        Enviar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setAdjusting(false); setAdjustNote('') }}
                                        className="h-7 px-2 rounded text-2xs font-semibold text-ink-muted
                                            hover:bg-slate-100 shrink-0"
                                    >
                                        No
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1.5 mt-1.5">
                                    <button
                                        type="button"
                                        onClick={() => onApprove?.(task._id)}
                                        className="h-7 px-2.5 rounded text-2xs font-semibold text-white
                                            bg-emerald-600 hover:bg-emerald-700"
                                    >
                                        Aprobar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAdjusting(true)}
                                        className="h-7 px-2.5 rounded text-2xs font-semibold text-ink-muted
                                            hover:bg-slate-100"
                                    >
                                        Solicitar ajustes
                                    </button>
                                </div>
                            )
                        )}
                    </div>
                )}
            </div>

            <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
                {confirming ? (
                    <span className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => onDelete(task._id)}
                            className="h-7 px-2 rounded text-2xs font-bold text-white bg-red-600 hover:bg-red-700"
                        >
                            Eliminar
                        </button>
                        <button
                            type="button"
                            onClick={() => setConfirming(false)}
                            className="h-7 px-2 rounded text-2xs font-semibold text-ink-muted hover:bg-slate-100"
                        >
                            No
                        </button>
                    </span>
                ) : (
                    <TaskActionsMenu
                        taskName={task.name}
                        weekDays={weekDays}
                        plannedKey={plannedKey}
                        showDayOptions={showDayOptions}
                        canEdit={canEdit}
                        canHide={canHide}
                        isPrivate={!!task.isPrivate}
                        onSetDay={dayKey => onSetDay(task._id, dayKey)}
                        onToggleHide={() => onPatch(task._id, { isPrivate: !task.isPrivate })}
                        onRequestDelete={() => setConfirming(true)}
                    />
                )}
            </div>
        </li>
    )
}
