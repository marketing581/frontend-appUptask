import { ChevronDownIcon } from '@heroicons/react/20/solid'

export type PlanDay = { key: string, label: string, isToday: boolean }

type Props = {
    days: PlanDay[]
    /** "YYYY-MM-DD" del día asignado, o null si no está en la semana. */
    activeKey: string | null
    onSelect: (dayKey: string | null) => void
}

/** Asigna un pendiente a un día de la semana (lunes a viernes), sin hora.
 *
 *  Es la versión sencilla de programar: decir "esto lo hago el martes" sin
 *  tener que abrir el calendario ni elegir una hora.
 *
 *  Es un `<select>` nativo disfrazado de etiqueta, no un menú propio: un menú
 *  flotante se recorta contra el borde de la tarjeta que lo contiene —hace
 *  falta ese `overflow-hidden` para que las esquinas de la cabecera se vean
 *  redondeadas— y en un teléfono no hay "hover" que lo revele. El
 *  desplegable del sistema no tiene ese problema: siempre se pinta por
 *  encima de todo y funciona igual con el dedo que con el mouse. La flecha
 *  nativa se apaga y se dibuja una propia, del mismo set de iconos que el
 *  resto de la app, para que no se note que por debajo es un `<select>`. */
export default function PlanDayPicker({ days, activeKey, onSelect }: Props) {
    const active = days.find(day => day.key === activeKey)

    return (
        <span className="relative inline-flex items-center shrink-0">
            <select
                value={activeKey ?? ''}
                onChange={event => onSelect(event.target.value || null)}
                title={active ? `Planificado: ${active.label}` : 'Planificar para un día de la semana'}
                aria-label={active ? `Planificado para ${active.label}` : 'Planificar para un día de la semana'}
                className={`h-[22px] min-w-[5.5rem] pl-2 pr-5 rounded-full text-2xs font-bold border-0 leading-[22px] py-0
                    appearance-none cursor-pointer transition-all hover:brightness-95 active:scale-95
                    focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-1 ${
                    active
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-slate-100 text-ink-subtle'
                }`}
            >
                <option value="">{active ? 'Quitar de la semana' : '+ Semana'}</option>
                {days.map(day => (
                    <option key={day.key} value={day.key}>
                        {day.label}{day.isToday ? ' (hoy)' : ''}
                    </option>
                ))}
            </select>
            <ChevronDownIcon className="w-3 h-3 absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
        </span>
    )
}
