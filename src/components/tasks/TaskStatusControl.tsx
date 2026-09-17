import { ChevronDownIcon } from '@heroicons/react/20/solid'
import { TaskLabel } from '@/utils/taskLabels'
import { labelPalette, labelTranslations } from '@/utils/taskLabels'

/** Cambiar el estado en un solo gesto: pendiente, en proceso, por validar o
 *  listo. Antes eran tres botones siempre a la vista —y "por validar" ni
 *  siquiera se podía elegir, solo aparecía sola cuando alguien pedía
 *  revisión—; tres etiquetas repitiendo lo mismo que ya dice el color no
 *  aportaba nada. Ahora es una sola etiqueta, la del estado actual, que se
 *  abre para elegir cualquiera de las cuatro: el mismo `<select>` vestido de
 *  color que ya resuelve "a qué día de la semana" en `PlanDayPicker`, aquí
 *  para "en qué punto va" —agrupado igual que el selector de estado de
 *  Notion: lo pendiente, lo que está en curso, lo completado.
 *
 *  La flecha nativa del navegador no combina con una etiqueta redondeada de
 *  color; se apaga con `appearance-none` y se dibuja una propia del mismo
 *  set de iconos que usa el resto de la app, para que se sienta hecho a
 *  medida y no un `<select>` sin vestir.
 *
 *  Pasar a "Por validar" o resolverla desde ahí no es un simple cambio de
 *  `status` —tiene su propio flujo de aprobación—, así que quien use este
 *  control decide qué endpoint llamar según la transición; aquí solo se
 *  anuncia la etiqueta que se eligió. */

const GROUPS: { heading: string, labels: TaskLabel[] }[] = [
    { heading: 'Pendiente', labels: ['pending'] },
    { heading: 'En curso', labels: ['inProgress', 'toValidate'] },
    { heading: 'Completado', labels: ['done'] }
]

type Props = {
    label: TaskLabel
    disabled?: boolean
    onChange: (label: TaskLabel) => void
}

export default function TaskStatusControl({ label, disabled, onChange }: Props) {
    return (
        <span className="relative inline-flex items-center shrink-0">
            <select
                value={label}
                disabled={disabled}
                onChange={event => onChange(event.target.value as TaskLabel)}
                aria-label="Estado del pendiente"
                className={`h-[22px] min-w-[6.5rem] pl-2 pr-5 rounded-full text-2xs font-bold border-0 leading-[22px] py-0
                    appearance-none cursor-pointer transition-all hover:brightness-95 active:scale-95
                    disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100
                    focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-1
                    ${labelPalette[label].badge}`}
            >
                {GROUPS.map(group => (
                    <optgroup key={group.heading} label={group.heading}>
                        {group.labels.map(item => (
                            <option key={item} value={item}>● {labelTranslations[item]}</option>
                        ))}
                    </optgroup>
                ))}
            </select>
            <ChevronDownIcon className="w-3 h-3 absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
        </span>
    )
}
