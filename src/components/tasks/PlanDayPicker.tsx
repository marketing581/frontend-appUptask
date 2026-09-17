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
 *  encima de todo y funciona igual con el dedo que con el mouse. */
export default function PlanDayPicker({ days, activeKey, onSelect }: Props) {
    const active = days.find(day => day.key === activeKey)

    return (
        <select
            value={activeKey ?? ''}
            onChange={event => onSelect(event.target.value || null)}
            title={active ? `Planificado: ${active.label}` : 'Planificar para un día de la semana'}
            aria-label={active ? `Planificado para ${active.label}` : 'Planificar para un día de la semana'}
            className={`h-[22px] pl-2 pr-5 rounded-full text-2xs font-bold border-0 cursor-pointer
                transition-colors focus:ring-1 focus:ring-brand-500 ${
                active
                    ? 'bg-amber-100 text-amber-900'
                    : 'bg-slate-100 text-ink-subtle hover:bg-slate-200'
            }`}
        >
            <option value="">{active ? 'Quitar de la semana' : '+ Semana'}</option>
            {days.map(day => (
                <option key={day.key} value={day.key}>
                    {day.label}{day.isToday ? ' (hoy)' : ''}
                </option>
            ))}
        </select>
    )
}
