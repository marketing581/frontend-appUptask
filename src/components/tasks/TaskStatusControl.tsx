import { TaskStatus } from '@/types'
import { labelPalette, labelTranslations } from '@/utils/taskLabels'

/** Cambiar el estado en un solo clic: pendiente, en proceso o listo, sin
 *  menús ni confirmaciones. Es el gesto que más se repite en el día —marcar
 *  algo, avanzarlo, cerrarlo— así que las tres opciones están siempre a la
 *  vista en vez de detrás de una casilla que solo sabe abrir y cerrar.
 *
 *  Son tags de texto, con el color de la etiqueta activa: un símbolo pelado
 *  no decía nada por sí solo, y el texto es lo que de verdad se lee de un
 *  vistazo. Solo la opción activa lleva color; las otras dos, en gris, para
 *  no competir con lo que sí importa saber ahora mismo. */

const STEPS: TaskStatus[] = ['pending', 'inProgress', 'done']

type Props = {
    status: TaskStatus
    /** Verde fijo aunque el estado real sea otro: una tarea recurrente vuelve
     *  a Pendiente al cerrarla, pero hoy ya está hecha. */
    doneOverride?: boolean
    disabled?: boolean
    onChange: (status: TaskStatus) => void
}

export default function TaskStatusControl({ status, doneOverride, disabled, onChange }: Props) {
    const effective: TaskStatus = doneOverride ? 'done' : status

    return (
        <div className="flex items-center gap-1 shrink-0" role="group" aria-label="Estado del pendiente">
            {STEPS.map(step => {
                const active = effective === step
                return (
                    <button
                        key={step}
                        type="button"
                        disabled={disabled}
                        aria-pressed={active}
                        onClick={() => !active && onChange(step)}
                        className={`h-[22px] px-2 rounded-full text-2xs font-bold whitespace-nowrap
                            transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                            active
                                ? labelPalette[step].badge
                                : 'text-ink-subtle hover:bg-slate-100 hover:text-ink-muted'
                        }`}
                    >
                        {labelTranslations[step]}
                    </button>
                )
            })}
        </div>
    )
}
