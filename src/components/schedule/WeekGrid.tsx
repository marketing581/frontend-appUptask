import { useMemo, useRef, useState } from 'react'
import { TimeBlock } from '@/types'
import {
    SLOT_MINUTES,
    dayKey,
    durationMinutes,
    formatDayHeader,
    formatDuration,
    formatTime,
    isSameDay,
    minutesFromWindowStart
} from '@/utils/datetime'
import { ALERT_COLOR, getTaskLabel, labelPalette, labelTranslations } from '@/utils/taskLabels'

/** Alto en píxeles de cada intervalo de 15 minutos. */
const SLOT_HEIGHT = 16

type DragState = {
    blockId: string
    mode: 'move' | 'resize'
    originStart: Date
    originEnd: Date
    pointerStartX: number
    pointerStartY: number
    previewStart: Date
    previewEnd: Date
}

type Props = {
    timezone: string
    windowStartHour: number
    windowEndHour: number
    days: Date[]
    blocks: TimeBlock[]
    onCreateAt: (start: Date) => void
    onCommit: (blockId: string, start: Date, end: Date) => void
    onSelect: (block: TimeBlock) => void
    /** Soltar una tarea arrastrada desde "Por programar" sobre una hora. */
    onDropTask: (taskId: string, start: Date, minutes: number) => void
}

/** Reparte en carriles los bloques que se superponen, para que ninguno tape a otro. */
function layoutLanes(blocks: TimeBlock[]) {
    const sorted = [...blocks].sort((a, b) => a.start.localeCompare(b.start))
    const laneEnds: number[] = []
    const placed = sorted.map(block => {
        const start = new Date(block.start).getTime()
        const end = new Date(block.end).getTime()
        let lane = laneEnds.findIndex(laneEnd => laneEnd <= start)
        if (lane === -1) {
            lane = laneEnds.length
            laneEnds.push(end)
        } else {
            laneEnds[lane] = end
        }
        return { block, lane, start, end }
    })

    return placed.map(item => {
        const overlapping = placed.filter(other => other.start < item.end && other.end > item.start)
        const lanes = Math.max(...overlapping.map(other => other.lane)) + 1
        return { ...item, lanes }
    })
}

const taskOf = (block: TimeBlock) => (typeof block.task === 'string' ? null : block.task)

/** El color del bloque indica el avance de su tarea, no a qué proyecto
 *  pertenece: el proyecto ya va escrito dentro. Una tarea en espera se pinta
 *  con el rojo de aviso, porque eso es un problema y no una etapa. */
function blockTone(block: TimeBlock) {
    const task = taskOf(block)
    if (!task?.status) {
        return { borderColor: '#94a3b8', background: '#94a3b81a' }
    }
    if (task.onHold?.active) {
        return { borderColor: ALERT_COLOR, background: `${ALERT_COLOR}1a` }
    }
    const palette = labelPalette[getTaskLabel(task as never)]
    return { borderColor: palette.solid, background: palette.tint }
}

export default function WeekGrid({
    timezone, windowStartHour, windowEndHour, days, blocks,
    onCreateAt, onCommit, onSelect, onDropTask
}: Props) {
    const bodyRef = useRef<HTMLDivElement>(null)
    const [drag, setDrag] = useState<DragState | null>(null)
    // Guía de dónde caería la tarea que se está arrastrando.
    const [dropHint, setDropHint] = useState<{ dayKey: string, offsetMinutes: number } | null>(null)

    const totalMinutes = (windowEndHour - windowStartHour) * 60
    const totalSlots = totalMinutes / SLOT_MINUTES
    const gridHeight = totalSlots * SLOT_HEIGHT

    const hourMarks = useMemo(
        () => Array.from({ length: windowEndHour - windowStartHour + 1 }, (_, i) => windowStartHour + i),
        [windowStartHour, windowEndHour]
    )

    const blocksByDay = useMemo(() => {
        const map = new Map<string, TimeBlock[]>()
        for (const block of blocks) {
            const key = dayKey(new Date(block.start), timezone)
            if (!map.has(key)) map.set(key, [])
            map.get(key)!.push(block)
        }
        return map
    }, [blocks, timezone])

    /** Convierte un desplazamiento del puntero en minutos, redondeando a 15. */
    const snapMinutes = (deltaY: number) =>
        Math.round(deltaY / SLOT_HEIGHT) * SLOT_MINUTES

    const columnWidth = () => {
        const body = bodyRef.current
        if (!body) return 1
        return body.getBoundingClientRect().width / days.length
    }

    const beginDrag = (
        event: React.PointerEvent,
        block: TimeBlock,
        mode: 'move' | 'resize'
    ) => {
        event.preventDefault()
        event.stopPropagation()
        ;(event.target as HTMLElement).setPointerCapture?.(event.pointerId)

        const originStart = new Date(block.start)
        const originEnd = new Date(block.end)
        setDrag({
            blockId: block._id,
            mode,
            originStart,
            originEnd,
            pointerStartX: event.clientX,
            pointerStartY: event.clientY,
            previewStart: originStart,
            previewEnd: originEnd
        })
    }

    const onPointerMove = (event: React.PointerEvent) => {
        if (!drag) return

        const deltaMinutes = snapMinutes(event.clientY - drag.pointerStartY)

        if (drag.mode === 'resize') {
            const nextEnd = new Date(drag.originEnd.getTime() + deltaMinutes * 60000)
            // Un bloque nunca puede durar menos de un intervalo.
            if (nextEnd.getTime() - drag.previewStart.getTime() < SLOT_MINUTES * 60000) return
            setDrag({ ...drag, previewEnd: nextEnd })
            return
        }

        const deltaDays = Math.round((event.clientX - drag.pointerStartX) / columnWidth())
        const shiftMs = deltaMinutes * 60000 + deltaDays * 86400000
        setDrag({
            ...drag,
            previewStart: new Date(drag.originStart.getTime() + shiftMs),
            previewEnd: new Date(drag.originEnd.getTime() + shiftMs)
        })
    }

    const endDrag = () => {
        if (!drag) return
        const moved = drag.previewStart.getTime() !== drag.originStart.getTime() ||
            drag.previewEnd.getTime() !== drag.originEnd.getTime()

        if (moved) onCommit(drag.blockId, drag.previewStart, drag.previewEnd)
        setDrag(null)
    }

    /** Minutos desde medianoche local correspondientes a una posición vertical. */
    const minutesAt = (clientY: number, rect: DOMRect) => {
        const slotIndex = Math.floor((clientY - rect.top) / SLOT_HEIGHT)
        return windowStartHour * 60 + Math.max(0, slotIndex) * SLOT_MINUTES
    }

    /** Clic en un hueco: crea una tarea o programa una existente a esa hora. */
    const handleEmptyClick = (event: React.MouseEvent, day: Date) => {
        if (drag) return
        const minutes = minutesAt(event.clientY, event.currentTarget.getBoundingClientRect())
        // `day` es medianoche local, así que basta sumar los minutos de la franja.
        onCreateAt(new Date(day.getTime() + minutes * 60000))
    }

    const handleDragOver = (event: React.DragEvent, key: string) => {
        // Sin `preventDefault` el navegador rechaza el drop, así que se acepta
        // cualquier arrastre: `handleDrop` no hace nada si no trae tarea.
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
        const minutes = minutesAt(event.clientY, event.currentTarget.getBoundingClientRect())
        setDropHint({ dayKey: key, offsetMinutes: minutes - windowStartHour * 60 })
    }

    const handleDrop = (event: React.DragEvent, day: Date) => {
        const raw = event.dataTransfer.getData('application/x-uptask-task')
        setDropHint(null)
        if (!raw) return
        event.preventDefault()

        const payload = JSON.parse(raw) as { taskId: string, minutes: number }
        const minutes = minutesAt(event.clientY, event.currentTarget.getBoundingClientRect())
        onDropTask(payload.taskId, new Date(day.getTime() + minutes * 60000), payload.minutes)
    }

    const now = new Date()

    return (
        <div className="overflow-x-auto">
            <div className="min-w-[720px]">
                {/* Encabezado de días */}
                <div className="flex border-b border-slate-200 sticky top-0 bg-white z-10">
                    <div className="w-14 shrink-0" aria-hidden />
                    {days.map(day => {
                        const header = formatDayHeader(day, timezone)
                        const today = isSameDay(day, now, timezone)
                        return (
                            <div
                                key={day.toISOString()}
                                className={`flex-1 px-2 py-2 text-center border-l border-slate-200 ${today ? 'bg-purple-50' : ''}`}
                            >
                                <p className={`text-xs uppercase tracking-wide ${today ? 'text-purple-700 font-bold' : 'text-slate-500'}`}>
                                    {header.weekday}
                                </p>
                                <p className={`text-lg leading-tight ${today ? 'text-purple-700 font-bold' : 'text-slate-800'}`}>
                                    {header.dayNumber}
                                </p>
                            </div>
                        )
                    })}
                </div>

                {/* Cuerpo */}
                <div
                    className="flex relative select-none"
                    onPointerMove={onPointerMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                >
                    {/* Regla de horas */}
                    <div className="w-14 shrink-0 relative" style={{ height: gridHeight }}>
                        {hourMarks.map((hour, index) => (
                            <div
                                key={hour}
                                // La primera etiqueta no se centra en su línea:
                                // quedaría cortada por el borde superior.
                                className={`absolute right-1 text-[11px] text-slate-400 ${index === 0 ? '' : '-translate-y-1/2'}`}
                                style={{ top: index * 4 * SLOT_HEIGHT }}
                            >
                                {String(hour).padStart(2, '0')}:00
                            </div>
                        ))}
                    </div>

                    <div ref={bodyRef} className="flex flex-1">
                        {days.map(day => {
                            const key = dayKey(day, timezone)
                            const dayBlocks = blocksByDay.get(key) ?? []
                            const laid = layoutLanes(dayBlocks)
                            const today = isSameDay(day, now, timezone)

                            return (
                                <div
                                    key={key}
                                    className={`flex-1 relative border-l border-slate-200 cursor-pointer ${today ? 'bg-purple-50/40' : ''}`}
                                    style={{ height: gridHeight }}
                                    onClick={event => handleEmptyClick(event, day)}
                                    onDragOver={event => handleDragOver(event, key)}
                                    onDragLeave={() => setDropHint(null)}
                                    onDrop={event => handleDrop(event, day)}
                                >
                                    {dropHint?.dayKey === key && (
                                        <div
                                            className="absolute left-0 right-0 z-30 pointer-events-none
                                                border-t-2 border-brand-500"
                                            style={{ top: (dropHint.offsetMinutes / SLOT_MINUTES) * SLOT_HEIGHT }}
                                        >
                                            <span className="absolute -top-2 left-1 text-[9px] font-bold
                                                text-white bg-brand-500 rounded px-1">
                                                Soltar aquí
                                            </span>
                                        </div>
                                    )}
                                    {/* Líneas de hora */}
                                    {hourMarks.slice(0, -1).map((hour, index) => (
                                        <div
                                            key={hour}
                                            className="absolute left-0 right-0 border-t border-slate-100"
                                            style={{ top: index * 4 * SLOT_HEIGHT }}
                                        />
                                    ))}

                                    {laid.map(({ block, lane, lanes }) => {
                                        const isDragging = drag?.blockId === block._id
                                        const start = isDragging ? drag.previewStart : new Date(block.start)
                                        const end = isDragging ? drag.previewEnd : new Date(block.end)

                                        // Durante el arrastre el bloque puede pasar a otro día.
                                        if (isDragging && dayKey(start, timezone) !== key) return null

                                        const offset = minutesFromWindowStart(start, timezone, windowStartHour)
                                        const length = durationMinutes(start, end)
                                        const task = taskOf(block)
                                        const tone = blockTone(block)
                                        const height = (length / SLOT_MINUTES) * SLOT_HEIGHT
                                        const compact = height < 34

                                        return (
                                            <div
                                                key={block._id}
                                                role="button"
                                                tabIndex={0}
                                                className={`absolute rounded border-l-4 px-1.5 py-0.5 overflow-hidden text-left
                                                    ${isDragging ? 'opacity-80 shadow-lg z-20' : 'z-10 hover:shadow'}`}
                                                style={{
                                                    top: (offset / SLOT_MINUTES) * SLOT_HEIGHT,
                                                    height,
                                                    left: `calc(${(lane * 100) / lanes}% + 2px)`,
                                                    width: `calc(${100 / lanes}% - 4px)`,
                                                    borderLeftColor: tone.borderColor,
                                                    backgroundColor: tone.background
                                                }}
                                                onPointerDown={event => beginDrag(event, block, 'move')}
                                                onClick={event => {
                                                    event.stopPropagation()
                                                    if (!drag) onSelect(block)
                                                }}
                                                onKeyDown={event => {
                                                    if (event.key === 'Enter' || event.key === ' ') {
                                                        event.preventDefault()
                                                        onSelect(block)
                                                    }
                                                }}
                                            >
                                                <p className="text-[11px] font-bold text-slate-800 truncate leading-tight">
                                                    {task?.name ?? 'Tarea'}
                                                </p>
                                                {!compact && (
                                                    <>
                                                        <p className="text-[10px] text-slate-600 leading-tight">
                                                            {formatTime(start, timezone)}–{formatTime(end, timezone)} · {formatDuration(length)}
                                                        </p>
                                                        {height > 60 && (
                                                            <p className="text-[10px] text-slate-500 truncate leading-tight">
                                                                {task?.status ? labelTranslations[getTaskLabel(task as never)] : ''}
                                                                {task?.onHold?.active ? ' · En espera' : ''}
                                                                {task?.project && typeof task.project !== 'string'
                                                                    ? ` · ${task.project.projectName}`
                                                                    : task?.brand && typeof task.brand !== 'string'
                                                                        ? ` · ${task.brand.name}`
                                                                        : ' · Operativo'}
                                                            </p>
                                                        )}
                                                    </>
                                                )}

                                                {/* Asa de redimensionado. En bloques cortos ocuparía casi
                                                    toda la altura e impediría moverlos, así que ahí la
                                                    duración se cambia desde el formulario. */}
                                                {height >= 32 && (
                                                    <div
                                                        className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize"
                                                        onPointerDown={event => beginDrag(event, block, 'resize')}
                                                        title="Arrastra para cambiar la duración"
                                                    />
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
    )
}
