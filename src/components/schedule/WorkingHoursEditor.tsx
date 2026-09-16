import { Fragment, useEffect, useState } from 'react'
import { Popover, Transition } from '@headlessui/react'
import { ClockIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui'

type Prefs = { dayStartHour: number, dayEndHour: number, showWeekends: boolean }

type Props = {
    personName: string
    prefs: Prefs
    onSave: (prefs: Prefs) => void
    saving: boolean
}

/** El horario de trabajo real de otra persona —no cómo yo quiero verlo, sino
 *  cuándo trabaja de verdad— solo lo edita la encargada, y solo mientras mira
 *  su calendario. Es distinto de "Franja": esa es una preferencia mía de
 *  pantalla y se aplica siempre, sobre cualquier calendario; esto cambia el
 *  dato real de Nicole o de Sofianne, así que va aparte y pide confirmarlo. */
export default function WorkingHoursEditor({ personName, prefs, onSave, saving }: Props) {
    const [start, setStart] = useState(prefs.dayStartHour)
    const [end, setEnd] = useState(prefs.dayEndHour)
    const [weekends, setWeekends] = useState(prefs.showWeekends)
    const [error, setError] = useState('')

    useEffect(() => {
        setStart(prefs.dayStartHour)
        setEnd(prefs.dayEndHour)
        setWeekends(prefs.showWeekends)
        setError('')
    }, [prefs.dayStartHour, prefs.dayEndHour, prefs.showWeekends])

    const submit = (close: () => void) => {
        if (end <= start) {
            setError('La hora de fin debe ser posterior a la de inicio')
            return
        }
        onSave({ dayStartHour: start, dayEndHour: end, showWeekends: weekends })
        close()
    }

    return (
        <Popover className="relative">
            <Popover.Button
                title={`Horario de trabajo de ${personName}`}
                className="h-7 pl-2 pr-2.5 rounded-md border border-line-strong bg-surface
                    flex items-center gap-1.5 text-xs font-semibold text-ink-muted
                    hover:border-ink-subtle hover:text-ink transition-colors"
            >
                <ClockIcon className="w-3.5 h-3.5 text-ink-subtle" />
                {String(prefs.dayStartHour).padStart(2, '0')}–{String(prefs.dayEndHour).padStart(2, '0')} h
            </Popover.Button>

            <Transition
                as={Fragment}
                enter="transition ease-out duration-100" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100"
                leave="transition ease-in duration-75" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95"
            >
                <Popover.Panel className="absolute z-30 mt-1.5 w-64 rounded-lg bg-surface
                    shadow-overlay border border-line p-3">
                    {({ close }) => (
                        <>
                            <p className="text-xs font-bold text-ink mb-0.5">
                                Horario de trabajo de {personName}
                            </p>
                            <p className="text-2xs text-ink-subtle mb-3">
                                Es su horario real, no solo cómo lo ves tú. Se aplica a su
                                calendario y a cuánto trabajo se espera de ella cada semana.
                            </p>

                            <div className="flex items-center gap-2 mb-2">
                                <label className="flex items-center gap-1 text-xs text-ink-muted">
                                    De
                                    <input
                                        type="number" min={0} max={23} value={start}
                                        onChange={event => setStart(Number(event.target.value))}
                                        aria-label="Hora de inicio"
                                        className="w-12 h-7 py-0 px-1.5 text-xs text-center
                                            border-line-strong rounded tabular"
                                    />
                                </label>
                                <label className="flex items-center gap-1 text-xs text-ink-muted">
                                    a
                                    <input
                                        type="number" min={1} max={24} value={end}
                                        onChange={event => setEnd(Number(event.target.value))}
                                        aria-label="Hora de fin"
                                        className="w-12 h-7 py-0 px-1.5 text-xs text-center
                                            border-line-strong rounded tabular"
                                    />
                                </label>
                            </div>

                            <label className="flex items-center gap-1.5 text-xs text-ink-muted mb-3">
                                <input
                                    type="checkbox"
                                    checked={weekends}
                                    onChange={event => setWeekends(event.target.checked)}
                                    className="w-3.5 h-3.5 rounded border-line-strong text-brand-600 focus:ring-brand-500"
                                />
                                Trabaja fines de semana
                            </label>

                            {error && <p className="text-2xs text-red-600 font-semibold mb-2">{error}</p>}

                            <div className="flex items-center justify-end gap-2">
                                <Button type="button" variant="ghost" size="sm" onClick={() => close()}>
                                    Cancelar
                                </Button>
                                <Button
                                    type="button" variant="primary" size="sm"
                                    disabled={saving}
                                    onClick={() => submit(close)}
                                >
                                    {saving ? 'Guardando…' : 'Guardar'}
                                </Button>
                            </div>
                        </>
                    )}
                </Popover.Panel>
            </Transition>
        </Popover>
    )
}
