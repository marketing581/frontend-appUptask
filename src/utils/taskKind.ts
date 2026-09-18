import { Task } from '@/types'

/** Naturaleza del trabajo. No es un campo nuevo en la base: se deduce de si
 *  la tarea cuelga de un proyecto y de si tiene cadencia. Compartido entre
 *  la vista y la tarjeta para que ambas clasifiquen igual.
 *   - `maintenance`: se repite (diario, semanal, a pedido…)
 *   - `oneOff`: ocurre una vez y se acaba
 *   - `project`: forma parte de un proyecto con seguimiento */
export type TaskKind = 'maintenance' | 'project' | 'oneOff'

export const kindOf = (task: Task): TaskKind => {
    if (task.project) return 'project'
    if ((task.frequency ?? 'none') !== 'none') return 'maintenance'
    return 'oneOff'
}
