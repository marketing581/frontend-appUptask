import { isAxiosError } from 'axios'
import api from '@/lib/axios'
import { QuickTaskFormData, Task, TaskStatus, taskSchema } from '@/types'

/** Tareas fuera del contexto de un proyecto: puntuales, operativas y las de
 *  proyecto vistas desde el calendario. Comparten colección con las de
 *  proyecto, así que todas las vistas leen los mismos registros. */

const extractError = (error: unknown, fallback: string) => {
    if (isAxiosError(error) && error.response) {
        throw new Error(error.response.data.error ?? fallback)
    }
    throw new Error(fallback)
}

export async function getMyTasks(params?: { assignee?: string, includeDone?: boolean }) {
    try {
        const search = new URLSearchParams()
        if (params?.assignee) search.set('assignee', params.assignee)
        if (params?.includeDone) search.set('includeDone', 'true')

        const { data } = await api.get(`/tasks?${search.toString()}`)
        return data as Task[]
    } catch (error) {
        extractError(error, 'No se pudieron cargar las tareas')
    }
}

export async function createWorkTask(formData: QuickTaskFormData) {
    try {
        const { data } = await api.post('/tasks', formData)
        const result = taskSchema.safeParse(data)
        return result.success ? result.data : (data as Task)
    } catch (error) {
        extractError(error, 'No se pudo crear la tarea')
    }
}

export async function getWorkTask(taskId: string) {
    try {
        const { data } = await api.get(`/tasks/${taskId}`)
        return data as { task: Task, blocks: unknown[] }
    } catch (error) {
        extractError(error, 'No se pudo cargar la tarea')
    }
}

export async function updateWorkTask({ taskId, formData }: {
    taskId: string, formData: Partial<Task> & Record<string, unknown>
}) {
    try {
        const { data } = await api.put(`/tasks/${taskId}`, formData)
        return data as Task
    } catch (error) {
        extractError(error, 'No se pudo actualizar la tarea')
    }
}

export async function updateWorkTaskStatus({ taskId, status, note }: {
    taskId: string, status: TaskStatus, note?: string
}) {
    try {
        const { data } = await api.post(`/tasks/${taskId}/status`, { status, note })
        return data as { task: Task, status: TaskStatus, awaitingApproval: boolean }
    } catch (error) {
        extractError(error, 'No se pudo cambiar el estado')
    }
}

/** Marca la tarea como "Por validar": sigue En proceso, esperando aprobación. */
export async function requestWorkTaskReview({ taskId, approver, note }: {
    taskId: string, approver?: string, note?: string
}) {
    try {
        const { data } = await api.post(`/tasks/${taskId}/review/request`, { approver, note })
        return data as Task
    } catch (error) {
        extractError(error, 'No se pudo enviar a validación')
    }
}

export async function resolveWorkTaskReview({ taskId, approved, note }: {
    taskId: string, approved: boolean, note?: string
}) {
    try {
        const { data } = await api.post(`/tasks/${taskId}/review`, { approved, note })
        return data as Task
    } catch (error) {
        extractError(error, 'No se pudo resolver la revisión')
    }
}

export async function convertTaskToProject({ taskId, project }: {
    taskId: string, project: string
}) {
    try {
        const { data } = await api.post(`/tasks/${taskId}/convert`, { project })
        return data as Task
    } catch (error) {
        extractError(error, 'No se pudo convertir la tarea')
    }
}

export async function deleteWorkTask(taskId: string) {
    try {
        const { data } = await api.delete(`/tasks/${taskId}`)
        return data
    } catch (error) {
        extractError(error, 'No se pudo eliminar la tarea')
    }
}
