import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { TaskColorTag } from '@/types'

/** Cuatro colores, sin nombre visible en ningún momento —ni cerrado ni al
 *  elegir—, solo el color: naranja y verde para las dos marcas, fucsia para
 *  lo interno del equipo, celeste como cuarta opción. Sin marcar queda gris.
 *
 *  Un `<select>` nativo no lo permite: sus opciones son siempre texto, con o
 *  sin estilo. Por eso este es un menú propio y no el mismo truco que usan
 *  `PlanDayPicker`/`TaskStatusControl` —ahí el texto sí se necesita, aquí
 *  no—. Para no toparse con el mismo recorte contra el `overflow-hidden` de
 *  la tarjeta que llevó a usar `<select>` en esos otros dos, el menú se monta
 *  en un portal directo a `<body>`, posicionado por coordenadas: nunca queda
 *  dentro de un contenedor que pueda recortarlo. Se abre con un clic, no con
 *  hover, así que funciona igual con el dedo. */
const COLORS: Record<'none' | 'orange' | 'green' | 'fuchsia' | 'celeste', string> = {
    none: '#cbd5e1',
    orange: '#E64F1B',
    green: '#418300',
    fuchsia: '#D6249F',
    celeste: '#60A2BF'
}

const OPTIONS: TaskColorTag[] = [null, 'orange', 'green', 'fuchsia', 'celeste']

/** Nombre del color, no de la marca: solo para el tooltip/lector de
 *  pantalla, nunca se muestra como texto en la tarjeta. */
const labelOf = (value: TaskColorTag) => {
    switch (value) {
        case 'orange': return 'Naranja'
        case 'green': return 'Verde'
        case 'fuchsia': return 'Fucsia'
        case 'celeste': return 'Celeste'
        default: return 'Sin definir'
    }
}

type Props = {
    value: TaskColorTag
    disabled?: boolean
    onChange: (value: TaskColorTag) => void
}

export default function ColorTagDot({ value, disabled, onChange }: Props) {
    const [open, setOpen] = useState(false)
    const [position, setPosition] = useState<{ top: number, left: number } | null>(null)
    const buttonRef = useRef<HTMLButtonElement>(null)
    const popoverRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!open) return

        const close = (event: Event) => {
            const target = event.target as Node
            if (popoverRef.current?.contains(target) || buttonRef.current?.contains(target)) return
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

    const toggle = () => {
        if (disabled) return
        if (!open && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect()
            setPosition({ top: rect.bottom + 6, left: rect.left })
        }
        setOpen(current => !current)
    }

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                disabled={disabled}
                onClick={toggle}
                title={labelOf(value)}
                aria-label={`Color: ${labelOf(value)}`}
                className="w-4 h-4 shrink-0 rounded-full ring-1 ring-inset ring-black/10 cursor-pointer
                    focus:outline-none focus:ring-2 focus:ring-brand-400 disabled:cursor-not-allowed"
                style={{ backgroundColor: COLORS[value ?? 'none'] }}
            />

            {open && position && createPortal(
                <div
                    ref={popoverRef}
                    style={{ position: 'fixed', top: position.top, left: position.left }}
                    className="z-50 flex items-center gap-2 p-2 rounded-full bg-surface shadow-overlay ring-1 ring-line-strong"
                >
                    {OPTIONS.map(option => (
                        <button
                            key={option ?? 'none'}
                            type="button"
                            onClick={() => { onChange(option); setOpen(false) }}
                            title={labelOf(option)}
                            aria-label={labelOf(option)}
                            aria-pressed={value === option}
                            className={`w-4 h-4 rounded-full ring-1 ring-inset ring-black/10 transition-transform
                                hover:scale-125 focus:outline-none focus:ring-2 focus:ring-brand-400 ${
                                value === option ? 'ring-2 ring-ink' : ''
                            }`}
                            style={{ backgroundColor: COLORS[option ?? 'none'] }}
                        />
                    ))}
                </div>,
                document.body
            )}
        </>
    )
}
