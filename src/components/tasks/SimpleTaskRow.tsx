import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Task } from '@/types'
import { ALERT_COLOR, TaskLabel, frequencyShort, getTaskLabel } from '@/utils/taskLabels'
import { kindOf } from '@/utils/taskKind'
import { plainPreview } from '@/utils/markdown'
import { Avatar, Badge } from '@/components/ui'
import ColorTagDot from './ColorTagDot'
import DescriptionModal from './DescriptionModal'
import TaskActionsMenu from './TaskActionsMenu'
import TaskStatusControl from './TaskStatusControl'

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
    /** "YYYY-MM-DD" del día de hoy, en la zona de quien mira. */
    todayKey: string
    canEdit: boolean
    canHide: boolean
    busy: boolean
    /** Marca que la tarea está en revisión: solo la traen las filas de la
     *  columna "Por validar" —la etiqueta ya lo dice, esto solo habilita el
     *  bloque de Aprobar / Solicitar ajustes. */
    reviewInfo?: boolean
    /** La aprobadora asignada o la encargada, no quien la hizo: aunque
     *  `canEdit` sea cierto para su dueña, resolver la revisión no le
     *  corresponde a ella. */
    canResolveReview?: boolean
    onApprove?: (taskId: string) => void
    onRequestChanges?: (taskId: string, note: string) => void
    /** Cambia el estado —incluido "Por validar", que no es un estado real
     *  sino su propio flujo de aprobación— por su nombre en cada transición. */
    onSetLabel: (taskId: string, label: TaskLabel) => void
    onPatch: (taskId: string, formData: Record<string, unknown>) => void
    onDelete: (taskId: string) => void
    /** Selección múltiple con el mouse, como en el Finder: Cmd/Ctrl+clic
     *  suma o quita esta fila; Shift+clic selecciona el rango desde la
     *  última elegida. Sirve para mover de un tirón dos o más pendientes al
     *  mismo sitio, no solo de a uno. */
    selected?: boolean
    onSelectClick?: (mode: 'toggle' | 'range') => void
    /** Todo lo seleccionado ahora mismo, con la etiqueta que tenía cada una
     *  al elegirla —hace falta para decidir si hay que reabrirla al soltar,
     *  sin ir a buscarla otra vez—. Si esta fila está seleccionada y hay más
     *  de una, arrastrar cualquiera de las seleccionadas mueve a todas. */
    selection?: Map<string, TaskLabel>
    /** Qué lista es esta fila (Pendientes, un día, Por validar) —Finalizados
     *  no trae esto, ahí el orden lo manda la fecha real de cierre, no la
     *  mano—. Sirve para reordenar arrastrando una fila sobre otra de la
     *  misma lista, sin confundirlo con moverla a otra columna. */
    listKey?: string
    onReorder?: (draggedIds: string[], targetTaskId: string, position: 'before' | 'after') => void
}

export default function SimpleTaskRow({
    task, todayKey, canEdit, canHide, busy,
    reviewInfo, canResolveReview, onApprove, onRequestChanges,
    onSetLabel, onPatch, onDelete,
    selected, onSelectClick, selection, listKey, onReorder
}: Props) {
    const [adjusting, setAdjusting] = useState(false)
    const [adjustNote, setAdjustNote] = useState('')
    // Dónde quedaría si se soltara ahora mismo: arriba o abajo de esta fila.
    // Solo pinta la raya guía; el drop de verdad ocurre en `onDrop`.
    const [dropPos, setDropPos] = useState<'before' | 'after' | null>(null)
    const rowRef = useRef<HTMLLIElement>(null)
    // El drag que viene de esta misma lista se marca con un tipo de MIME
    // propio (no con su valor): durante `dragover` los navegadores solo
    // dejan leer qué tipos hay, no el contenido, así que el nombre del tipo
    // es la única forma de saber "es de aquí" antes de soltar.
    const LIST_MARKER = listKey ? `application/x-uptask-list-${listKey}` : null
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

    // Sin tope: un nombre largo hace crecer la tarjeta entera en vez de
    // esconderse detrás de un scroll propio.
    const resizeName = () => {
        const el = inputRef.current
        if (!el) return
        el.style.height = 'auto'
        const natural = el.scrollHeight
        // Oculta (columna del día que no toca en mobile, por ejemplo) mide 0:
        // no hay que grabar esa medida, o se queda en 0 para siempre aunque
        // luego se vea. Cuando vuelva a estar visible, el observer de abajo
        // la recalcula sola.
        if (natural > 0) el.style.height = `${natural}px`
    }

    useEffect(resizeName, [name])

    // Cambiar de mobile a desktop —o de día seleccionado— no cambia `name`,
    // así que el efecto de arriba no se repite solo; esto detecta cuando la
    // fila pasa de oculta a visible (o cambia de ancho) y mide de nuevo.
    useEffect(() => {
        const el = inputRef.current
        if (!el) return
        const observer = new ResizeObserver(resizeName)
        observer.observe(el)
        return () => observer.disconnect()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

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

    const colorTag = task.colorTag ?? null

    return (
        <li
            ref={rowRef}
            draggable={canEdit}
            onDragStart={event => {
                // Arrastrar una fila seleccionada, habiendo más de una
                // elegida, mueve a todas juntas; cualquier otro caso arrastra
                // solo esta, como siempre.
                const items = selected && selection && selection.size > 1
                    ? Array.from(selection, ([id, itemLabel]) => ({ id, label: itemLabel }))
                    : [{ id: task._id, label }]
                event.dataTransfer.setData('application/x-uptask-plan-items', JSON.stringify(items))
                if (LIST_MARKER) event.dataTransfer.setData(LIST_MARKER, '1')
                event.dataTransfer.effectAllowed = 'move'
            }}
            // Reordenar dentro de la misma lista: si lo que se arrastra trae
            // el marcador de esta lista, se pinta la raya guía y se corta la
            // propagación para que la columna no lo tome también como un
            // cambio de etapa.
            onDragOver={event => {
                if (!LIST_MARKER || !onReorder) return
                if (!event.dataTransfer.types.includes(LIST_MARKER)) return
                event.preventDefault()
                event.stopPropagation()
                const rect = rowRef.current?.getBoundingClientRect()
                if (!rect) return
                setDropPos(event.clientY > rect.top + rect.height / 2 ? 'after' : 'before')
            }}
            onDragLeave={() => setDropPos(null)}
            onDrop={event => {
                setDropPos(null)
                if (!LIST_MARKER || !onReorder) return
                if (!event.dataTransfer.types.includes(LIST_MARKER)) return
                event.preventDefault()
                event.stopPropagation()
                const raw = event.dataTransfer.getData('application/x-uptask-plan-items')
                const items: { id: string }[] = raw ? JSON.parse(raw) : []
                const draggedIds = items.map(item => item.id)
                if (draggedIds.includes(task._id)) return
                onReorder(draggedIds, task._id, dropPos === 'after' ? 'after' : 'before')
            }}
            // Cmd/Ctrl+clic o Shift+clic seleccionan en vez de hacer lo que
            // haría un clic normal en lo que se tocó —abrir el detalle,
            // cambiar el estado, etc.—; por eso se intercepta antes de que
            // el clic llegue a esos controles, no después.
            onMouseDownCapture={event => {
                if (event.metaKey || event.ctrlKey || event.shiftKey) event.preventDefault()
            }}
            onClickCapture={event => {
                if (!onSelectClick) return
                if (event.metaKey || event.ctrlKey) {
                    event.preventDefault()
                    event.stopPropagation()
                    onSelectClick('toggle')
                } else if (event.shiftKey) {
                    event.preventDefault()
                    event.stopPropagation()
                    onSelectClick('range')
                }
            }}
            style={colorTag ? { backgroundColor: COLOR_WASH[colorTag] } : undefined}
            className={`group flex items-start gap-2 px-3 py-2 transition-all ${
                colorTag ? 'hover:brightness-[0.97]' : 'hover:bg-surface-sunken'
            } ${canEdit ? 'cursor-grab active:cursor-grabbing' : ''} ${
                selected ? 'ring-2 ring-inset ring-brand-500' : ''
            } ${dropPos === 'before' ? 'shadow-[inset_0_2px_0_0_theme(colors.brand.500)]' : ''} ${
                dropPos === 'after' ? 'shadow-[inset_0_-2px_0_0_theme(colors.brand.500)]' : ''
            }`}
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
                            className={`min-w-0 flex-1 border-0 px-1 -mx-1 py-0.5 -my-0.5 bg-transparent
                                text-sm font-medium leading-snug rounded resize-none overflow-hidden
                                focus:ring-0 focus:bg-brand-50 ${
                                done ? 'text-ink-subtle line-through' : 'text-ink'
                            }`}
                        />
                    ) : (
                        <p title={task.name} className={`min-w-0 flex-1 text-sm font-medium leading-snug ${
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
                        tarjeta estaba vacía o con poco texto—. Como texto, no
                        como ícono: un ícono aparte para "ábrelo más grande"
                        no se entendía; la palabra no deja duda. */}
                    {(canEdit || description) && (
                        <button
                            type="button"
                            onMouseDown={event => event.stopPropagation()}
                            onClick={() => setDescModalOpen(true)}
                            aria-label={`Descripción completa de ${task.name}`}
                            className="shrink-0 text-2xs text-ink-subtle/60 hover:text-brand-600
                                hover:underline transition-colors"
                        >
                            Ampliar
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

                {label === 'toValidate' && reviewInfo && canResolveReview && (
                    <div className="mt-2 pt-2 border-t border-line/70">
                        {adjusting ? (
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
                        canEdit={canEdit}
                        canHide={canHide}
                        isPrivate={!!task.isPrivate}
                        onToggleHide={() => onPatch(task._id, { isPrivate: !task.isPrivate })}
                        onRequestDelete={() => setConfirming(true)}
                    />
                )}
            </div>
        </li>
    )
}
