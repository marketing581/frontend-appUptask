import { useEffect, useRef, useState } from 'react'
import {
    CalendarDaysIcon, CheckIcon, EyeIcon, EyeSlashIcon, TrashIcon
} from '@heroicons/react/24/outline'
import { Task, TaskStatus } from '@/types'
import {
    ALERT_COLOR, FREQUENCY_ORDER,
    frequencyBadge, frequencyShort, frequencyTranslations,
    getTaskLabel, labelPalette, labelTranslations
} from '@/utils/taskLabels'
import { Avatar, Badge } from '@/components/ui'

/** Fila de un pendiente, con todo lo que se le puede hacer sin abrir nada:
 *  cerrarlo, renombrarlo, cambiarle la cadencia o la fecha, ocultarlo y
 *  borrarlo.
 *
 *  La usan por igual Mantenimiento y Pendientes: son dos naturalezas distintas
 *  de trabajo, pero se manipulan igual, y tener dos filas parecidas terminaría
 *  en dos comportamientos distintos para el mismo gesto.
 *
 *  Se presenta de dos formas. En una tarjeta estrecha los datos se apilan bajo
 *  el nombre. En una lista a pantalla completa se reparten en columnas de
 *  ancho fijo que coinciden de fila en fila: es lo que permite recorrer con la
 *  vista una sola columna —quién, o en qué estado— en vez de leer línea a
 *  línea. Las columnas se declaran una sola vez, aquí, y la cabecera de la
 *  tabla usa la misma plantilla. */

/** Plantilla de columnas: casilla · nombre · etiqueta · cadencia · área ·
 *  responsable · acciones. Debajo de `lg` no se aplica y todo se apila.
 *
 *  Las columnas de datos se dejan lo más estrechas que permite su contenido
 *  —de ahí las etiquetas cortas de cadencia— porque lo que necesita sitio es
 *  el nombre: es lo único que no se puede adivinar de un vistazo si se corta. */
export const TASK_COLUMNS = `lg:grid lg:items-center lg:gap-2
    lg:grid-cols-[1.125rem_minmax(0,1fr)_5.5rem_7.5rem_5.5rem_6.5rem_3.5rem]`

type Variant = 'stacked' | 'table'

type Props = {
    task: Task
    busy: boolean
    canEdit: boolean
    canHide: boolean
    variant?: Variant
    /** La cadencia solo tiene sentido donde el trabajo se repite. */
    showFrequency?: boolean
    /** La fecha límite, en cambio, solo importa en lo que ocurre una vez. */
    showDueDate?: boolean
    onSetStatus: (taskId: string, status: TaskStatus) => void
    onPatch: (taskId: string, formData: Record<string, unknown>) => void
    onDelete: (taskId: string) => void
}

export default function WorkTaskRow({
    task, busy, canEdit, canHide, variant = 'stacked',
    showFrequency = true, showDueDate = false,
    onSetStatus, onPatch, onDelete
}: Props) {
    const label = getTaskLabel(task)
    const done = label === 'done' || !!task.doneForPeriod
    const assignee = task.assignee && typeof task.assignee !== 'string' ? task.assignee : null
    const area = task.brand && typeof task.brand !== 'string' ? task.brand : null
    const table = variant === 'table'

    const [name, setName] = useState(task.name)
    const [confirming, setConfirming] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => { setName(task.name) }, [task.name])

    /** El nombre se edita en la propia fila: renombrar un pendiente es
     *  frecuente y abrir un formulario para eso sobraría. */
    const commitName = () => {
        const next = name.trim()
        if (next.length === 0) { setName(task.name); return }
        if (next === task.name) return
        onPatch(task._id, { name: next })
    }

    const dueValue = task.dueDate ? task.dueDate.slice(0, 10) : ''

    /* ---- celdas, iguales en las dos presentaciones ---- */

    const check = (
        <button
            type="button"
            disabled={busy || !canEdit}
            onClick={() => onSetStatus(task._id, done ? 'pending' : 'done')}
            aria-label={done ? `Reabrir "${task.name}"` : `Marcar "${task.name}" como lista`}
            title={canEdit ? undefined : 'Solo su responsable o la encargada'}
            className={`w-[18px] h-[18px] shrink-0 rounded-full border-2 grid place-content-center
                transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                table ? '' : 'mt-0.5'
            } ${
                done
                    ? 'bg-stage-done border-stage-done text-white'
                    : 'border-line-strong text-transparent hover:border-stage-done hover:text-stage-done'
            }`}
        >
            <CheckIcon className="w-3 h-3" strokeWidth={3} />
        </button>
    )

    const title = canEdit ? (
        <input
            ref={inputRef}
            value={name}
            onChange={event => setName(event.target.value)}
            onBlur={commitName}
            onKeyDown={event => {
                if (event.key === 'Enter') { event.preventDefault(); inputRef.current?.blur() }
                if (event.key === 'Escape') { setName(task.name); inputRef.current?.blur() }
            }}
            aria-label={`Nombre de ${task.name}`}
            title={task.name}
            className={`w-full border-0 p-0 bg-transparent text-sm font-medium leading-snug
                focus:ring-0 rounded truncate ${done ? 'text-ink-subtle line-through' : 'text-ink'}`}
        />
    ) : (
        <p
            title={task.name}
            className={`text-sm font-medium leading-snug truncate ${
                done ? 'text-ink-subtle line-through' : 'text-ink'
            }`}
        >
            {task.name}
        </p>
    )

    const periodText = task.frequency === 'daily' ? 'hoy' : 'en este periodo'
    const stateBadge = task.doneForPeriod ? (
        <Badge className="bg-emerald-100 text-emerald-800" title={`Hecho ${periodText}`}>
            {table ? 'Hecho' : `Hecho ${periodText}`}
        </Badge>
    ) : (
        <Badge className={labelPalette[label].badge}>{labelTranslations[label]}</Badge>
    )

    const frequencyLabel = (frequency: typeof FREQUENCY_ORDER[number]) =>
        table && frequency !== 'none' ? frequencyShort[frequency] : frequencyTranslations[frequency]

    const frequencyCell = canEdit ? (
        <select
            value={task.frequency ?? 'none'}
            onChange={event => onPatch(task._id, { frequency: event.target.value })}
            aria-label={`Frecuencia de ${task.name}`}
            title={frequencyTranslations[task.frequency ?? 'none']}
            className={`h-[22px] py-0 pl-1.5 pr-5 text-2xs font-semibold rounded border-0
                max-w-full truncate ${frequencyBadge} focus:ring-1 focus:ring-brand-500`}
        >
            {FREQUENCY_ORDER.map(frequency => (
                <option key={frequency} value={frequency}>{frequencyLabel(frequency)}</option>
            ))}
        </select>
    ) : (
        <Badge className={frequencyBadge}>{frequencyLabel(task.frequency ?? 'none')}</Badge>
    )

    const dueCell = canEdit ? (
        <label
            className={`inline-flex items-center gap-1 h-[22px] px-1.5 rounded text-2xs
                font-semibold cursor-pointer ${
                dueValue ? frequencyBadge : 'text-ink-subtle hover:bg-slate-100'
            }`}
            title="Fecha límite"
        >
            <CalendarDaysIcon className="w-3 h-3 shrink-0" />
            <input
                type="date"
                value={dueValue}
                onChange={event => onPatch(task._id, { dueDate: event.target.value || null })}
                aria-label={`Fecha límite de ${task.name}`}
                className="border-0 p-0 bg-transparent text-2xs font-semibold
                    focus:ring-0 w-[6.5rem] cursor-pointer"
            />
        </label>
    ) : null

    const areaCell = area ? (
        <span className="inline-flex items-center gap-1 text-2xs text-ink-subtle min-w-0">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: area.color }} />
            <span className="truncate">{area.name}</span>
        </span>
    ) : null

    const assigneeCell = assignee ? (
        <span className="flex items-center gap-1.5 min-w-0">
            <Avatar name={assignee.name} size="xs" />
            <span className="text-2xs text-ink-subtle truncate">{assignee.name.split(' ')[0]}</span>
        </span>
    ) : null

    const flags = (
        <>
            {task.isPrivate && (
                <Badge className="bg-slate-200 text-slate-700 ring-1 ring-inset ring-slate-400">
                    <EyeSlashIcon className="w-3 h-3" /> {table ? 'Oculto' : 'Solo tú lo ves'}
                </Badge>
            )}
            {task.onHold?.active && (
                <span className="text-2xs font-semibold whitespace-nowrap" style={{ color: ALERT_COLOR }}>
                    En espera{task.onHold.waitingOn && ` de ${task.onHold.waitingOn}`}
                </span>
            )}
        </>
    )

    /** Acciones: ocultar solo sobre lo propio, eliminar con confirmación. */
    const actions = (
        <div className="flex items-center justify-end gap-0.5 shrink-0">
            {canHide && (
                <button
                    type="button"
                    onClick={() => onPatch(task._id, { isPrivate: !task.isPrivate })}
                    title={task.isPrivate ? 'Mostrarlo al equipo' : 'Ocultarlo: solo tú lo verás'}
                    aria-label={task.isPrivate ? 'Mostrar al equipo' : 'Ocultar al equipo'}
                    className={`w-7 h-7 grid place-content-center rounded transition-opacity
                        hover:bg-slate-200 ${
                        task.isPrivate
                            ? 'text-ink-muted'
                            : 'text-ink-subtle opacity-0 group-hover:opacity-100 focus:opacity-100'
                    }`}
                >
                    {task.isPrivate ? <EyeIcon className="w-4 h-4" /> : <EyeSlashIcon className="w-4 h-4" />}
                </button>
            )}

            {canEdit && (confirming ? (
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
                <button
                    type="button"
                    onClick={() => setConfirming(true)}
                    title="Eliminar pendiente"
                    aria-label={`Eliminar "${task.name}"`}
                    className="w-7 h-7 grid place-content-center rounded text-ink-subtle
                        opacity-0 group-hover:opacity-100 focus:opacity-100
                        hover:bg-red-50 hover:text-red-600 transition-opacity"
                >
                    <TrashIcon className="w-4 h-4" />
                </button>
            ))}
        </div>
    )

    /* ---- presentación en columnas, para listas a pantalla completa ---- */

    if (table) {
        const meta = showFrequency ? frequencyCell : (showDueDate ? dueCell : null)

        return (
            <li className={`group px-3 lg:px-4 py-2 lg:py-1.5 hover:bg-surface-sunken
                transition-colors flex items-start gap-2.5 ${TASK_COLUMNS}`}>
                {check}

                {/* Celda del nombre. Debajo de `lg` recoge además todo lo que
                    en ancho vive en columnas: así la fila sigue siendo
                    casilla + contenido + acciones, sin columnas que cuadrar. */}
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                        {title}
                        <span className="flex items-center gap-1.5 shrink-0 empty:hidden">{flags}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5 lg:hidden">
                        {stateBadge}
                        {meta}
                        {areaCell}
                        {assigneeCell}
                    </div>
                </div>

                <div className="hidden lg:block">{stateBadge}</div>
                <div className="hidden lg:block min-w-0">{meta}</div>
                <div className="hidden lg:block min-w-0">{areaCell}</div>
                <div className="hidden lg:block min-w-0">{assigneeCell}</div>

                {actions}
            </li>
        )
    }

    /* ---- presentación apilada, para tarjetas estrechas ---- */

    return (
        <li className="group flex items-start gap-2.5 px-3 py-2 hover:bg-surface-sunken transition-colors">
            {check}

            <div className="min-w-0 flex-1">
                {title}
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    {stateBadge}
                    {showFrequency && frequencyCell}
                    {showDueDate && dueCell}
                    {areaCell}
                    {flags}
                    {assigneeCell && <span className="ml-auto">{assigneeCell}</span>}
                </div>
            </div>

            {actions}
        </li>
    )
}
