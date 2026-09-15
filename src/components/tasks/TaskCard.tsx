import { Fragment } from 'react'
import { Menu, Transition } from '@headlessui/react'
import { EllipsisHorizontalIcon } from '@heroicons/react/24/outline'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { TaskProject } from "@/types/index"
import { deleteTask } from '@/api/TaskAPI'
import { toast } from 'react-toastify'
import { useDraggable } from '@dnd-kit/core'
import { Avatar, Badge } from '@/components/ui'
import { getTaskLabel, labelPalette, priorityTranslations } from '@/utils/taskLabels'
import { formatDuration } from '@/utils/datetime'

type TaskCardProps = {
    task: TaskProject
    canEdit: boolean
}

const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export default function TaskCard({ task, canEdit }: TaskCardProps) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task._id })
    const navigate = useNavigate()
    const params = useParams()
    const projectId = params.projectId!

    const queryClient = useQueryClient()
    const { mutate } = useMutation({
        mutationFn: deleteTask,
        onError: (error) => toast.error(error.message),
        onSuccess: (data) => {
            toast.success(data)
            queryClient.invalidateQueries({ queryKey: ['project', projectId] })
        }
    })

    const label = getTaskLabel(task)
    const assignee = task.assignee && typeof task.assignee !== 'string' ? task.assignee : null
    const due = task.dueDate ? new Date(task.dueDate) : null
    const overdue = due ? due.getTime() < Date.now() && label !== 'done' : false

    const style = transform
        ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
        : undefined

    return (
        <li
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className={`card p-3 cursor-grab active:cursor-grabbing select-none
                hover:shadow-raised transition-shadow ${isDragging ? 'opacity-60 shadow-overlay z-50' : ''}`}
        >
            {/* Franja de la etiqueta: el avance se ve antes de leer */}
            <div className="flex items-start gap-2">
                <span className="w-1 self-stretch rounded-full shrink-0 min-h-[2rem]"
                    style={{ backgroundColor: labelPalette[label].solid }} />

                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink leading-snug">{task.name}</p>
                    {task.description && (
                        <p className="text-xs text-ink-muted mt-1 line-clamp-2 leading-relaxed">
                            {task.description}
                        </p>
                    )}
                </div>

                <Menu as="div" className="relative shrink-0">
                    <Menu.Button
                        onPointerDown={event => event.stopPropagation()}
                        className="w-6 h-6 grid place-content-center rounded text-ink-subtle hover:bg-slate-100"
                        aria-label={`Opciones de ${task.name}`}
                    >
                        <EllipsisHorizontalIcon className="w-4 h-4" />
                    </Menu.Button>
                    <Transition as={Fragment}
                        enter="transition ease-out duration-100"
                        enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100"
                        leave="transition ease-in duration-75"
                        leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                        <Menu.Items className="absolute right-0 z-20 mt-1 w-44 origin-top-right rounded-lg
                            bg-surface py-1 shadow-overlay border border-line focus:outline-none">
                            <Menu.Item>
                                <button type="button"
                                    className="block w-full text-left px-3 py-1.5 text-sm text-ink hover:bg-surface-sunken"
                                    onClick={() => navigate(location.pathname + `?viewTask=${task._id}`)}
                                >
                                    Ver tarea
                                </button>
                            </Menu.Item>
                            {canEdit && (
                                <>
                                    <Menu.Item>
                                        <button type="button"
                                            className="block w-full text-left px-3 py-1.5 text-sm text-ink hover:bg-surface-sunken"
                                            onClick={() => navigate(location.pathname + `?editTask=${task._id}`)}
                                        >
                                            Editar tarea
                                        </button>
                                    </Menu.Item>
                                    <Menu.Item>
                                        <button type="button"
                                            className="block w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                                            onClick={() => mutate({ projectId, taskId: task._id })}
                                        >
                                            Eliminar tarea
                                        </button>
                                    </Menu.Item>
                                </>
                            )}
                        </Menu.Items>
                    </Transition>
                </Menu>
            </div>

            {/* Pie: quién, cuándo, cuánto y avisos */}
            <div className="flex items-center gap-1.5 mt-2.5 pl-3">
                {assignee && <Avatar name={assignee.name} size="xs" />}

                {due && (
                    <span className={`text-2xs font-semibold tabular ${
                        overdue ? 'text-red-600' : 'text-ink-subtle'
                    }`}>
                        {due.getDate()} {MONTHS_SHORT[due.getMonth()]}
                    </span>
                )}

                {task.estimatedMinutes && (
                    <span className="text-2xs text-ink-subtle tabular">
                        {formatDuration(task.estimatedMinutes)}
                    </span>
                )}

                <span className="ml-auto flex items-center gap-1">
                    {task.onHold?.active && <Badge variant="alert">En espera</Badge>}
                    {task.priority === 'urgent' && <Badge variant="alert">Urgente</Badge>}
                    {task.priority === 'high' && (
                        <Badge className="bg-orange-100 text-orange-800">
                            {priorityTranslations.high}
                        </Badge>
                    )}
                </span>
            </div>
        </li>
    )
}
