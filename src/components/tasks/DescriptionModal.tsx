import { Fragment, useEffect, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import RichNoteEditor from '@/components/memos/RichNoteEditor'

/** Ventana para leer o escribir una descripción larga sin apretar la
 *  tarjeta: se abre desde "Ver más" (solo lectura, si no se puede editar) o
 *  "Ampliar editor" (con lo que ya se llevaba escrito ahí mismo).
 *
 *  En desktop es un modal centrado de ancho moderado; en mobile ocupa toda
 *  la pantalla —los mismos "Guardar"/"Cancelar" quedan igual de alcanzables
 *  con el pulgar—. Cerrar con cambios sin guardar pregunta antes de
 *  descartarlos, en vez de perderlos en silencio. */

type Props = {
    isOpen: boolean
    taskName: string
    initialValue: string
    canEdit: boolean
    onSave: (value: string) => void
    onClose: () => void
}

export default function DescriptionModal({ isOpen, taskName, initialValue, canEdit, onSave, onClose }: Props) {
    const [value, setValue] = useState(initialValue)
    const [confirmingDiscard, setConfirmingDiscard] = useState(false)

    useEffect(() => {
        if (isOpen) {
            setValue(initialValue)
            setConfirmingDiscard(false)
        }
    }, [isOpen, initialValue])

    const dirty = canEdit && value !== initialValue

    const requestClose = () => {
        if (dirty) { setConfirmingDiscard(true); return }
        onClose()
    }

    const save = () => {
        onSave(value)
        onClose()
    }

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={requestClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100"
                    leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-ink/40" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-stretch sm:items-center justify-center sm:p-4">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-200" enterFrom="opacity-0 sm:scale-95" enterTo="opacity-100 sm:scale-100"
                            leave="ease-in duration-150" leaveFrom="opacity-100 sm:scale-100" leaveTo="opacity-0 sm:scale-95"
                        >
                            <Dialog.Panel className="relative flex flex-col w-full h-full sm:h-auto sm:max-w-lg
                                rounded-none sm:rounded-xl bg-surface shadow-overlay overflow-hidden">
                                <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-3 border-b border-line shrink-0">
                                    <Dialog.Title className="text-base font-bold text-ink truncate">
                                        {taskName}
                                    </Dialog.Title>
                                    <button
                                        type="button"
                                        onClick={requestClose}
                                        aria-label="Cerrar"
                                        className="w-7 h-7 shrink-0 grid place-content-center rounded-full text-ink-subtle
                                            hover:bg-slate-100 transition-colors
                                            focus:outline-none focus:ring-2 focus:ring-brand-400"
                                    >
                                        <XMarkIcon className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="flex-1 min-h-0 h-[60vh] sm:h-[26rem]">
                                    <RichNoteEditor
                                        value={value}
                                        onChange={setValue}
                                        editable={canEdit}
                                        placeholder="Descripción"
                                    />
                                </div>

                                <div className="flex justify-end gap-2 px-5 py-3 border-t border-line shrink-0">
                                    <button
                                        type="button"
                                        onClick={requestClose}
                                        className="h-9 px-3.5 text-xs font-semibold text-ink-muted
                                            hover:bg-slate-100 rounded-md transition-colors"
                                    >
                                        {canEdit ? 'Cancelar' : 'Cerrar'}
                                    </button>
                                    {canEdit && (
                                        <button
                                            type="button"
                                            onClick={save}
                                            className="h-9 px-4 text-xs font-semibold text-white bg-brand-600
                                                hover:bg-brand-700 rounded-md shadow-card transition-colors"
                                        >
                                            Guardar
                                        </button>
                                    )}
                                </div>

                                {confirmingDiscard && (
                                    <div className="absolute inset-0 bg-ink/30 flex items-center justify-center p-4">
                                        <div className="bg-surface rounded-lg shadow-overlay border border-line p-4 max-w-xs w-full">
                                            <p className="text-sm font-semibold text-ink mb-1">¿Descartar los cambios?</p>
                                            <p className="text-xs text-ink-subtle mb-3">Lo que escribiste no se guardó.</p>
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setConfirmingDiscard(false)}
                                                    className="h-8 px-3 text-xs font-semibold text-ink-muted
                                                        hover:bg-slate-100 rounded-md"
                                                >
                                                    Seguir editando
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={onClose}
                                                    className="h-8 px-3 text-xs font-semibold text-white
                                                        bg-red-600 hover:bg-red-700 rounded-md"
                                                >
                                                    Descartar
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    )
}
