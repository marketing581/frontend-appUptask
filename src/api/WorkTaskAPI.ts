import { isAxiosError } from 'axios'
import api from '@/lib/axios'
import { QuickTaskFormData, Task, TaskStatus, finishedReportSchema, taskSchema } from '@/types'

/** Tareas fuera del contexto de un proyecto: puntuales, operativas y las de
 *  proyecto vistas desde el calendario. Comparten colección con las de
 *  proyecto, así que todas las vistas leen los mismos registros. */

const extractError = (error: unknown, fallback: string) => {
    if (isAxiosError(error) && error.response) {
        throw new Error(error.response.data.error ?? fallback)
    }
    throw new Error(fallback)
}

/** Naturaleza del trabajo. No es un campo nuevo en la base: se deduce de si
 *  la tarea cuelga de un proyecto y de si tiene cadencia. Son tres cosas que
 *  se gestionan distinto y por eso se piden por separado.
 *   - `maintenance`: se repite (diario, semanal, a pedido…)
 *   - `oneOff`: ocurre una vez y se acaba
 *   - `project`: forma parte de un proyecto con seguimiento */
export type TaskKind = 'maintenance' | 'oneOff' | 'project'

type TaskQuery = {
    assignee?: string
    includeDone?: boolean
    status?: TaskStatus
    kind?: TaskKind
    limit?: number
    /** Busca por nombre, en toda la colección y no solo en la página. */
    q?: string
}

const taskSearch = (params?: TaskQuery) => {
    const search = new URLSearchParams()
    if (params?.assignee) search.set('assignee', params.assignee)
    if (params?.includeDone) search.set('includeDone', 'true')
    if (params?.status) search.set('status', params.status)
    if (params?.kind) search.set('kind', params.kind)
    if (params?.limit) search.set('limit', String(params.limit))
    if (params?.q) search.set('q', params.q)
    return search.toString()
}

export async function getMyTasks(params?: TaskQuery) {
    try {
        const { data } = await api.get(`/tasks?${taskSearch(params)}`)
        return data as Task[]
    } catch (error) {
        extractError(error, 'No se pudieron cargar las tareas')
    }
}

/** Igual que `getMyTasks`, pero devolviendo además cuántas hay en total.
 *  El histórico puede ser de cientos: se trae una página y se dice el resto,
 *  en vez de descargarlo entero para mostrar veinte líneas. */
export async function getTaskPage(params: TaskQuery) {
    try {
        const response = await api.get(`/tasks?${taskSearch(params)}`)
        const total = Number(response.headers['x-total-count'])
        const tasks = response.data as Task[]
        return {
            tasks,
            total: Number.isFinite(total) ? total : tasks.length
        }
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
        return data as {
            task: Task, status: TaskStatus, awaitingApproval: boolean
            /** Una tarea recurrente vuelve a Pendiente al cerrar la ocurrencia
             *  de hoy: esto es lo que dice que sí se cerró, aunque el estado
             *  final no sea "done". */
            occurrenceCompleted: boolean
        }
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

/** Lo cerrado en un rango de fechas, por la fecha real de cierre —para la
 *  vista "Finalizados"—. `assignee` puede ser un id, o "all" para todo el
 *  equipo visible. */
export async function getFinishedTasks({ assignee, from, to }: {
    assignee?: string, from: Date, to: Date
}) {
    try {
        const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() })
        if (assignee) params.set('assignee', assignee)
        const { data } = await api.get(`/tasks/finished?${params.toString()}`)
        const result = finishedReportSchema.safeParse(data)
        if (result.success) return result.data
        throw new Error('La respuesta de finalizados no tiene el formato esperado')
    } catch (error) {
        extractError(error, 'No se pudieron cargar los pendientes finalizados')
    }
}
