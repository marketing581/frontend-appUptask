import { Task } from '@/types'

/** Qué puede hacer cada quien con un pendiente.
 *
 *  Es una copia en el cliente de las reglas que aplica el servidor: aquí solo
 *  sirve para no mostrar un botón que iba a fallar. La autoridad sigue siendo
 *  `middleware/authorization.ts`. */

type Viewer = { _id: string, role?: string }

const assigneeIdOf = (task: Task) => {
    const assignee = task.assignee
    return assignee && typeof assignee !== 'string' ? assignee._id : assignee
}

/** Ocultar al equipo es potestad de la encargada, y solo sobre lo suyo. */
export function canHideTask(task: Task, user?: Viewer) {
    if (!user || user.role !== 'manager') return false
    return assigneeIdOf(task) === user._id
}

export function canEditTask(task: Task, user?: Viewer) {
    if (!user) return false
    if (user.role === 'manager') return true
    return assigneeIdOf(task) === user._id
}
