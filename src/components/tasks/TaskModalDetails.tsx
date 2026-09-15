import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify';
import { getTaskById } from '@/api/TaskAPI';
import { requestWorkTaskReview, resolveWorkTaskReview, updateWorkTaskStatus } from '@/api/WorkTaskAPI';
import { formatDate } from '@/utils/utils';
import { statusTranslations } from '@/locales/es';
import { LABEL_ORDER, TaskLabel, getTaskLabel, labelTranslations } from '@/utils/taskLabels';
import NotesPanel from '../notes/NotesPanel';

export default function TaskModalDetails() {
    const params = useParams()
    const projectId = params.projectId!
    const navigate = useNavigate()
    const location = useLocation()
    const queryParams = new URLSearchParams(location.search)
    const taskId = queryParams.get('viewTask')!

    const show = taskId ? true : false

    const { data, isError, error } = useQuery({
        queryKey: ['task', taskId],
        queryFn: () => getTaskById({ projectId, taskId }),
        enabled: !!taskId,
        retry: false
    })

    const queryClient = useQueryClient()

    const refresh = () => {
        queryClient.invalidateQueries({ queryKey: ['project', projectId] })
        queryClient.invalidateQueries({ queryKey: ['task', taskId] })
        queryClient.invalidateQueries({ queryKey: ['unscheduled'] })
        queryClient.invalidateQueries({ queryKey: ['week'] })
    }
    const onError = (error: Error) => toast.error(error.message)

    const { mutate: changeStatus } = useMutation({
        mutationFn: updateWorkTaskStatus,
        onError,
        onSuccess: (result) => {
            if (result?.awaitingApproval) {
                toast.info('Tiene aprobadora asignada: pasa a Por validar, no a Listo')
            } else {
                toast.success('Tarea actualizada')
            }
            refresh()
        }
    })

    const { mutate: sendToValidation } = useMutation({
        mutationFn: requestWorkTaskReview,
        onError,
        onSuccess: () => { toast.success('Enviada a validación'); refresh() }
    })

    const { mutate: approve } = useMutation({
        mutationFn: resolveWorkTaskReview,
        onError,
        onSuccess: () => { toast.success('Aprobada'); refresh() }
    })

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const target = e.target.value as TaskLabel
        const current = data ? getTaskLabel(data) : 'pending'
        if (target === current) return

        if (target === 'toValidate') {
            sendToValidation({ taskId })
        } else if (target === 'done' && current === 'toValidate') {
            approve({ taskId, approved: true })
        } else {
            changeStatus({ taskId, status: target })
        }
    }

    if (isError) {
        toast.error(error.message, { toastId: 'error' })
        return <Navigate to={`/projects/${projectId}`} />
    }

    if (data) return (
        <>
            <Transition appear show={show} as={Fragment}>
                <Dialog as="div" className="relative z-10" onClose={() => navigate(location.pathname, { replace: true })}>
                    <Transition.Child
                        as={Fragment}
                        enter="ease-out duration-300"
                        enterFrom="opacity-0"
                        enterTo="opacity-100"
                        leave="ease-in duration-200"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                    >
                        <div className="fixed inset-0 bg-black/60" />
                    </Transition.Child>

                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4 text-center">
                            <Transition.Child
                                as={Fragment}
                                enter="ease-out duration-300"
                                enterFrom="opacity-0 scale-95"
                                enterTo="opacity-100 scale-100"
                                leave="ease-in duration-200"
                                leaveFrom="opacity-100 scale-100"
                                leaveTo="opacity-0 scale-95"
                            >
                                <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white text-left align-middle shadow-xl transition-all p-16">
                                    {data.createdAt && <p className='text-sm text-slate-400'>Agregada el: {formatDate(data.createdAt)} </p>}
                                    {data.updatedAt && <p className='text-sm text-slate-400'>Última actualización: {formatDate(data.updatedAt)} </p>}

                                    <Dialog.Title
                                        as="h3"
                                        className="font-black text-4xl text-slate-600 my-5"
                                    >{data.name} </Dialog.Title>

                                    <p className='text-lg text-slate-500 mb-2'>Descripción: {data.description}</p>

                                    {/* "En espera" es ortogonal a la etiqueta: una tarea puede
                                        estar Pendiente y además esperando a un proveedor. */}
                                    {data.onHold?.active && (
                                        <p className='mb-4'>
                                            <span className='text-sm font-bold px-2 py-1 rounded bg-red-100 text-red-800'>
                                                En espera
                                                {data.onHold.waitingOn && ` · de ${data.onHold.waitingOn}`}
                                                {data.onHold.reason && `: ${data.onHold.reason}`}
                                            </span>
                                        </p>
                                    )}

                                    {data.statusHistory.length ? (
                                        <>
                                            <p className='font-bold text-2xl text-slate-600 my-5'>Historial de Cambios</p>

                                            <ul className=' list-decimal ml-5'>
                                                {data.statusHistory.map((entry, index) => {
                                                    const author = entry.changedBy && typeof entry.changedBy !== 'string'
                                                        ? entry.changedBy.name
                                                        : 'el sistema'
                                                    return (
                                                        <li key={entry._id ?? index} className='text-slate-600'>
                                                            <span className='font-bold'>
                                                                {entry.from ? `${statusTranslations[entry.from]} → ` : ''}
                                                                {statusTranslations[entry.to]}
                                                            </span>{' '}
                                                            por: {author}
                                                            {entry.note && <span className='text-slate-400'> · {entry.note}</span>}
                                                        </li>
                                                    )
                                                })}
                                            </ul>
                                        </>
                                    ) : null }


                                    <div className='my-5 space-y-3'>
                                        <label className='font-bold' htmlFor='taskLabel'>Etiqueta actual:</label>
                                        <select
                                            id='taskLabel'
                                            className='w-full p-3 bg-white border border-gray-300'
                                            value={getTaskLabel(data)}
                                            onChange={handleChange}
                                        >
                                            {LABEL_ORDER.map(label => (
                                                <option key={label} value={label}>{labelTranslations[label]}</option>
                                            ))}
                                        </select>
                                        <p className='text-sm text-slate-500'>
                                            "Por validar" mantiene la tarea En proceso esperando aprobación.
                                            Solo la aprobación la pasa a Listo.
                                        </p>
                                    </div>

                                    <NotesPanel 
                                        notes={data.notes}
                                    />
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition>
        </>
    )
}