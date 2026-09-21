import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckIcon, EllipsisVerticalIcon } from '@heroicons/react/24/outline'
import { PlanDay } from './PlanDayPicker'

/** Acciones secundarias de un pendiente: mover a un día, ocultar, eliminar.
 *  Igual que `ColorTagDot`, es un menú propio en un portal a `<body>` —las
 *  columnas de "Mi semana" tienen `overflow-hidden` (hace falta para que sus
 *  esquinas redondeadas se vean bien), así que un `Menu` de Headless UI
 *  posicionado con `absolute` dentro de la tarjeta queda recortado. El
 *  portal, posicionado por coordenadas, nunca queda dentro de un contenedor
 *  que pueda recortarlo. */

type Props = {
    taskName: string
    weekDays: PlanDay[]
    plannedKey: string | null
    showDayOptions: boolean
    canEdit: boolean
    canHide: boolean
    isPrivate: boolean
    onSetDay: (dayKey: string | null) => void
    onToggleHide: () => void
    onRequestDelete: () => void
}

export default function TaskActionsMenu({
    taskName, weekDays, plannedKey, showDayOptions, canEdit, canHide, isPrivate,
    onSetDay, onToggleHide, onRequestDelete
}: Props) {
    const [open, setOpen] = useState(false)
    const [position, setPosition] = useState<{ top: number, right: number } | null>(null)
    const buttonRef = useRef<HTMLButtonElement>(null)
    const menuRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!open) return

        const close = (event: Event) => {
            const target = event.target as Node
            if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return
            setOpen(false)
        }
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false)
        }
        const closeOnScroll = () => setOpen(false)

        document.addEventListener('mousedown', close)
        document.addEventListener('keydown', closeOnEscape)
        window.addEventListener('scroll', closeOnScroll, true)
        return () => {
            document.removeEventListener('mousedown', close)
            document.removeEventListener('keydown', closeOnEscape)
            window.removeEventListener('scroll', closeOnScroll, true)
        }
    }, [open])

    if (!canEdit && !canHide) return null

    const toggle = () => {
        if (!open && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect()
            setPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
        }
        setOpen(current => !current)
    }

    const runAndClose = (action: () => void) => () => { action(); setOpen(false) }

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                onClick={toggle}
                title="Más acciones"
                aria-label={`Opciones de ${taskName}`}
                className="w-7 h-7 grid place-content-center rounded-full text-ink-subtle
                    hover:bg-slate-200 transition-colors
                    focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
                <EllipsisVerticalIcon className="w-4 h-4" />
            </button>

            {open && position && createPortal(
                <div
                    ref={menuRef}
                    role="menu"
                    style={{ position: 'fixed', top: position.top, right: position.right }}
                    className="z-50 w-48 rounded-lg bg-surface py-1 shadow-overlay border border-line"
                >
                    {showDayOptions && canEdit && (
                        <>
                            {weekDays.map(day => (
                                <button
                                    key={day.key}
                                    type="button"
                                    role="menuitem"
                                    onClick={runAndClose(() => onSetDay(day.key))}
                                    className="flex items-center justify-between w-full text-left
                                        px-3 py-1.5 text-sm text-ink hover:bg-surface-sunken
                                        focus:outline-none focus:bg-surface-sunken"
                                >
                                    {day.label}{day.isToday ? ' (hoy)' : ''}
                                    {plannedKey === day.key && <CheckIcon className="w-3.5 h-3.5" />}
                                </button>
                            ))}
                            {plannedKey && (
                                <button
                                    type="button"
                                    role="menuitem"
                                    onClick={runAndClose(() => onSetDay(null))}
                                    className="block w-full text-left px-3 py-1.5 text-sm text-ink-subtle
                                        hover:bg-surface-sunken focus:outline-none focus:bg-surface-sunken"
                                >
                                    Quitar de la semana
                                </button>
                            )}
                            <div className="my-1 border-t border-line" />
                        </>
                    )}
                    {canHide && (
                        <button
                            type="button"
                            role="menuitem"
                            onClick={runAndClose(onToggleHide)}
                            className="block w-full text-left px-3 py-1.5 text-sm text-ink
                                hover:bg-surface-sunken focus:outline-none focus:bg-surface-sunken"
                        >
                            {isPrivate ? 'Mostrar al equipo' : 'Ocultar al equipo'}
                        </button>
                    )}
                    {canEdit && (
                        <button
                            type="button"
                            role="menuitem"
                            onClick={runAndClose(onRequestDelete)}
                            className="block w-full text-left px-3 py-1.5 text-sm text-red-600
                                hover:bg-red-50 focus:outline-none focus:bg-red-50"
                        >
                            Eliminar
                        </button>
                    )}
                </div>,
                document.body
            )}
        </>
    )
}
