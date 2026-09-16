import { Fragment, useEffect, useRef, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { Bars3BottomLeftIcon, TagIcon, UserGroupIcon } from '@heroicons/react/24/outline'
import { createProject } from '@/api/ProjectAPI'
import { getBrands } from '@/api/BrandAPI'
import { Button } from '@/components/ui'

/** Alta de un proyecto: lo único que hace falta es el nombre.
 *
 *  Un proyecto de verdad —con cliente, presupuesto, alcance— casi nunca nace
 *  ya definido: nace de una idea que hay que empezar a anotar antes de que se
 *  pierda, y el resto se completa mientras se trabaja. Pedir cuatro campos
 *  para eso es la razón por la que "crear proyecto" se posponía. El cliente,
 *  la descripción y el área quedan detrás de "Más detalles", igual que en el
 *  alta rápida de un pendiente.
 *
 *  Se abre con `?newProject=true`, como el resto de modales de la app. */
export default function CreateProjectModal() {
    const navigate = useNavigate()
    const location = useLocation()
    const queryClient = useQueryClient()
    const nameRef = useRef<HTMLInputElement>(null)

    const show = new URLSearchParams(location.search).get('newProject') === 'true'

    const [name, setName] = useState('')
    const [showDetail, setShowDetail] = useState(false)
    const [clientName, setClientName] = useState('')
    const [description, setDescription] = useState('')
    const [brand, setBrand] = useState('')

    const { data: brands } = useQuery({
        queryKey: ['brands'],
        queryFn: getBrands,
        enabled: show
    })

    const close = () => navigate(location.pathname, { replace: true })

    const reset = () => {
        setName('')
        setShowDetail(false)
        setClientName('')
        setDescription('')
        setBrand('')
    }

    useEffect(() => {
        if (show) setTimeout(() => nameRef.current?.focus(), 50)
        else reset()
    }, [show])

    const { mutate: create, isPending } = useMutation({
        mutationFn: createProject,
        onError: (error: Error) => toast.error(error.message),
        onSuccess: project => {
            toast.success('Proyecto creado')
            queryClient.invalidateQueries({ queryKey: ['projects'] })
            reset()
            if (project) navigate(`/projects/${project._id}`)
            else close()
        }
    })

    const submit = (event: React.FormEvent) => {
        event.preventDefault()
        const trimmed = name.trim()
        if (trimmed.length === 0 || isPending) return
        create({
            projectName: trimmed,
            clientName: clientName.trim() || undefined,
            description: description.trim() || undefined,
            brand: brand || undefined
        })
    }

    return (
        <Transition appear show={show} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={close}>
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
                            <Dialog.Panel className="w-full max-w-md rounded-xl bg-surface shadow-overlay overflow-hidden">
                                <form onSubmit={submit}>
                                    <div className="px-5 pt-4 pb-1">
                                        <Dialog.Title className="text-base font-bold text-ink">
                                            Nuevo proyecto
                                        </Dialog.Title>
                                        <p className="text-xs text-ink-muted mt-0.5">
                                            Ponle un nombre. Lo demás se completa cuando haga falta.
                                        </p>
                                    </div>

                                    <div className="px-5 py-3 space-y-3">
                                        <input
                                            ref={nameRef}
                                            value={name}
                                            onChange={event => setName(event.target.value)}
                                            placeholder="Por ejemplo: Campaña de verano"
                                            aria-label="Nombre del proyecto"
                                            className="w-full h-11 rounded-md border-line-strong text-base
                                                font-medium text-ink placeholder:text-ink-subtle placeholder:font-normal
                                                focus:border-brand-500 focus:ring-brand-500"
                                        />

                                        {showDetail ? (
                                            <div className="space-y-2.5 pt-1">
                                                <label className="flex items-center gap-2">
                                                    <UserGroupIcon className="w-4 h-4 text-ink-subtle shrink-0" />
                                                    <input
                                                        value={clientName}
                                                        onChange={event => setClientName(event.target.value)}
                                                        placeholder="Cliente (opcional)"
                                                        aria-label="Cliente"
                                                        className="flex-1 h-8 py-0 text-xs rounded border-line-strong
                                                            text-ink-muted placeholder:text-ink-subtle
                                                            focus:border-brand-500 focus:ring-brand-500"
                                                    />
                                                </label>

                                                <label className="flex items-start gap-2">
                                                    <Bars3BottomLeftIcon className="w-4 h-4 text-ink-subtle mt-1.5 shrink-0" />
                                                    <textarea
                                                        value={description}
                                                        onChange={event => setDescription(event.target.value)}
                                                        rows={2}
                                                        placeholder="Descripción (opcional)"
                                                        aria-label="Descripción"
                                                        className="flex-1 text-xs rounded border-line-strong
                                                            text-ink-muted placeholder:text-ink-subtle
                                                            focus:border-brand-500 focus:ring-brand-500"
                                                    />
                                                </label>

                                                {brands && brands.length > 0 && (
                                                    <label className="flex items-center gap-2">
                                                        <TagIcon className="w-4 h-4 text-ink-subtle shrink-0" />
                                                        <select
                                                            value={brand}
                                                            onChange={event => setBrand(event.target.value)}
                                                            aria-label="Área"
                                                            className="flex-1 h-8 py-0 pl-1.5 pr-6 text-xs rounded
                                                                border-line-strong text-ink-muted
                                                                focus:border-brand-500 focus:ring-brand-500"
                                                        >
                                                            <option value="">Sin área</option>
                                                            {brands.map(item => (
                                                                <option key={item._id} value={item._id}>{item.name}</option>
                                                            ))}
                                                        </select>
                                                    </label>
                                                )}
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => setShowDetail(true)}
                                                className="text-2xs font-semibold text-ink-muted hover:text-brand-600"
                                            >
                                                + Más detalles (cliente, descripción, área)
                                            </button>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-end gap-2 px-5 py-3
                                        border-t border-line bg-surface-sunken">
                                        <Button type="button" variant="ghost" size="sm" onClick={close}>
                                            Cancelar
                                        </Button>
                                        <Button
                                            type="submit"
                                            variant="primary"
                                            size="sm"
                                            disabled={isPending || name.trim().length === 0}
                                        >
                                            {isPending ? 'Creando…' : 'Crear proyecto'}
                                        </Button>
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
