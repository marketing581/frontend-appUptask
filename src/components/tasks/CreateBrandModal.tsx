import { Fragment, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { createBrand } from '@/api/BrandAPI'
import { Brand } from '@/types'

/** Los dos colores que pidió el equipo. El selector de color nativo, al
 *  lado, cubre cualquier otro caso sin tener que mantener una paleta más
 *  grande aquí. */
const PRESET_COLORS = ['#E64F1B', '#418300']

type Props = {
    isOpen: boolean
    onClose: () => void
    onCreated: (brand: Brand) => void
}

export default function CreateBrandModal({ isOpen, onClose, onCreated }: Props) {
    const [name, setName] = useState('')
    const [color, setColor] = useState(PRESET_COLORS[0])
    const queryClient = useQueryClient()

    const { mutate, isPending } = useMutation({
        mutationFn: createBrand,
        onError: (error: Error) => toast.error(error.message),
        onSuccess: brand => {
            queryClient.invalidateQueries({ queryKey: ['brands'] })
            toast.success('Marca creada')
            onCreated(brand)
            setName('')
            setColor(PRESET_COLORS[0])
        }
    })

    const submit = (event: React.FormEvent) => {
        event.preventDefault()
        if (name.trim().length === 0) return
        mutate({ name: name.trim(), color })
    }

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100"
                    leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-ink/40" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100"
                            leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-sm rounded-xl bg-surface shadow-overlay overflow-hidden">
                                <div className="px-5 pt-4 pb-3 border-b border-line">
                                    <Dialog.Title className="text-base font-bold text-ink">Nueva marca</Dialog.Title>
                                    <p className="text-xs text-ink-muted mt-0.5">
                                        Para etiquetar de qué marca es cada pendiente, de un vistazo.
                                    </p>
                                </div>

                                <form onSubmit={submit} className="px-5 py-4 space-y-4">
                                    <div>
                                        <label htmlFor="brandName" className="block text-xs font-semibold text-ink-muted mb-1">
                                            Nombre
                                        </label>
                                        <input
                                            id="brandName"
                                            type="text"
                                            autoFocus
                                            value={name}
                                            onChange={event => setName(event.target.value)}
                                            placeholder="Por ejemplo: El Resort"
                                            className="w-full h-9 rounded-md border-line-strong text-sm text-ink
                                                focus:border-brand-500 focus:ring-brand-500"
                                        />
                                    </div>

                                    <div>
                                        <span className="block text-xs font-semibold text-ink-muted mb-1.5">Color</span>
                                        <div className="flex flex-wrap items-center gap-2">
                                            {PRESET_COLORS.map(preset => (
                                                <button
                                                    key={preset}
                                                    type="button"
                                                    onClick={() => setColor(preset)}
                                                    aria-label={`Usar este color`}
                                                    aria-pressed={color === preset}
                                                    className={`w-7 h-7 rounded-full transition-transform ${
                                                        color === preset ? 'ring-2 ring-offset-2 ring-ink scale-105' : ''
                                                    }`}
                                                    style={{ backgroundColor: preset }}
                                                />
                                            ))}
                                            <label
                                                title="Elegir otro color"
                                                className="w-7 h-7 rounded-full overflow-hidden cursor-pointer
                                                    ring-1 ring-inset ring-line-strong grid place-content-center"
                                            >
                                                <input
                                                    type="color"
                                                    value={color}
                                                    onChange={event => setColor(event.target.value)}
                                                    aria-label="Elegir otro color"
                                                    className="w-9 h-9 -m-1 cursor-pointer"
                                                />
                                            </label>
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-2 pt-1">
                                        <button
                                            type="button"
                                            onClick={onClose}
                                            className="h-9 px-3.5 text-xs font-semibold text-ink-muted
                                                hover:bg-slate-100 rounded-md transition-colors"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isPending || name.trim().length === 0}
                                            className="h-9 px-4 text-xs font-semibold text-white bg-brand-600
                                                hover:bg-brand-700 rounded-md shadow-card
                                                disabled:opacity-50 transition-colors"
                                        >
                                            {isPending ? 'Creando…' : 'Crear marca'}
                                        </button>
                                    </div>
                                </form>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    )
}
