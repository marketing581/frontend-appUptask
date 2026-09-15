import { DndContext, DragEndEvent } from '@dnd-kit/core'
import { TaskProject } from "@/types/index"
import TaskCard from "./TaskCard"
import DropTask from "./DropTask"
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateWorkTaskStatus, requestWorkTaskReview, resolveWorkTaskReview } from '@/api/WorkTaskAPI'
import { toast } from 'react-toastify'
import { useParams } from 'react-router-dom'
import {
    LABEL_ORDER,
    TaskLabel,
    getTaskLabel,
    labelPalette,
    labelTranslations
} from '@/utils/taskLabels'

type TaskListProps = {
    tasks: TaskProject[]
    canEdit: boolean
}

type GroupedTasks = Record<TaskLabel, TaskProject[]>

const emptyGroups: GroupedTasks = {
    pending: [],
    inProgress: [],
    toValidate: [],
    done: [],
}

const columnHints: Record<TaskLabel, string> = {
    pending: 'Aún no empezada',
    inProgress: 'En ejecución',
    toValidate: 'Esperando aprobación',
    done: 'Terminada y aprobada'
}

export default function TaskList({ tasks, canEdit }: TaskListProps) {

    const params = useParams()
    const projectId = params.projectId!
    const queryClient = useQueryClient()

    const refresh = () => {
        queryClient.invalidateQueries({ queryKey: ['project', projectId] })
        queryClient.invalidateQueries({ queryKey: ['unscheduled'] })
        queryClient.invalidateQueries({ queryKey: ['week'] })
    }

    const onError = (error: Error) => {
        toast.error(error.message)
        refresh()
    }

    const { mutate: changeStatus } = useMutation({
        mutationFn: updateWorkTaskStatus,
        onError,
        onSuccess: data => {
            if (data?.awaitingApproval) {
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

    const groupedTasks = tasks.reduce((groups, task) => {
        const label = getTaskLabel(task)
        return { ...groups, [label]: [...groups[label], task] }
    }, emptyGroups)

    const handleDragEnd = (event: DragEndEvent) => {
        const { over, active } = event
        if (!over?.id) return

        const taskId = active.id.toString()
        const target = over.id as TaskLabel
        const task = tasks.find(item => item._id === taskId)
        if (!task) return

        const current = getTaskLabel(task)
        if (current === target) return

        // Cada columna significa una acción distinta sobre la tarea.
        if (target === 'toValidate') {
            sendToValidation({ taskId })
        } else if (target === 'done' && current === 'toValidate') {
            approve({ taskId, approved: true })
        } else {
            changeStatus({ taskId, status: target })
        }
    }

    return (
        <>
            <div className='flex gap-3 overflow-x-auto pb-6 -mx-1 px-1'>
                <DndContext onDragEnd={handleDragEnd} >
                    {LABEL_ORDER.map(label => {
                        const columnTasks = groupedTasks[label]
                        return (
                            <div key={label} className='min-w-[270px] flex-1 flex flex-col'>
                                <div className='flex items-center gap-2 px-1 pb-2'>
                                    <span className='w-2 h-2 rounded-full shrink-0'
                                        style={{ backgroundColor: labelPalette[label].solid }} />
                                    <h3 className='text-sm font-bold text-ink'>{labelTranslations[label]}</h3>
                                    <span className='text-xs font-semibold text-ink-subtle tabular'>
                                        {columnTasks.length}
                                    </span>
                                    <span className='ml-auto text-2xs text-ink-subtle truncate'>
                                        {columnHints[label]}
                                    </span>
                                </div>

                                <DropTask status={label} />

                                <ul className='mt-2 space-y-2'>
                                    {columnTasks.map(task => (
                                        <TaskCard key={task._id} task={task} canEdit={canEdit} />
                                    ))}
                                </ul>
                            </div>
                        )
                    })}
                </DndContext>
            </div>
        </>
    )
}
