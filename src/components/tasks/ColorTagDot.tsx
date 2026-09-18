import { TaskColorTag } from '@/types'

/** Naranja y verde son los únicos colores; sin marcar queda gris. Nada de
 *  texto ni de lista que mantener —de un vistazo, y solo eso—. Mismo
 *  `<select>` disfrazado de punto de color que ya resuelve el estado y el
 *  día: evita el recorte contra el `overflow-hidden` de la tarjeta y
 *  funciona igual con el dedo que con el mouse. El texto de la opción
 *  elegida se esconde (color transparente); solo queda el círculo de fondo. */
const COLORS: Record<'none' | 'orange' | 'green', string> = {
    none: '#cbd5e1',
    orange: '#E64F1B',
    green: '#418300'
}

type Props = {
    value: TaskColorTag
    disabled?: boolean
    onChange: (value: TaskColorTag) => void
}

export default function ColorTagDot({ value, disabled, onChange }: Props) {
    const label = value === 'orange' ? 'Naranja' : value === 'green' ? 'Verde' : 'Sin definir'

    return (
        <select
            value={value ?? ''}
            disabled={disabled}
            onChange={event => onChange(event.target.value === '' ? null : event.target.value as TaskColorTag)}
            title={label}
            aria-label={`Color: ${label}`}
            className="w-4 h-4 shrink-0 rounded-full border-0 p-0 appearance-none bg-none cursor-pointer
                ring-1 ring-inset ring-black/10 focus:outline-none focus:ring-2 focus:ring-brand-400
                disabled:cursor-not-allowed"
            style={{ backgroundColor: COLORS[value ?? 'none'], color: 'transparent' }}
        >
            <option value="" style={{ color: '#0f172a' }}>Sin definir</option>
            <option value="orange" style={{ color: '#0f172a' }}>Naranja</option>
            <option value="green" style={{ color: '#0f172a' }}>Verde</option>
        </select>
    )
}
