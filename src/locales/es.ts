import { TaskStatus } from '@/types'

/** Estados guardados. Para las etiquetas que ve la usuaria —incluida
 *  "Por validar", que se deriva— usar `labelTranslations` de utils/taskLabels. */
export const statusTranslations: Record<TaskStatus, string> = {
    pending: 'Pendiente',
    inProgress: 'En proceso',
    done: 'Listo'
}

export { labelTranslations, priorityTranslations } from '@/utils/taskLabels'

/** Indicador ortogonal a la etiqueta: una tarea puede estar Pendiente y,
 *  además, esperando a un proveedor. */
export const indicatorTranslations = {
    onHold: 'En espera',
    overdue: 'Vencida'
} as const
