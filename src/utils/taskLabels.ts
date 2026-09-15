import { TaskPriority, TaskStatus } from '@/types'

/** Etiquetas visibles de una tarea.
 *
 *  "Por validar" no es un estado guardado: es una tarea En proceso con
 *  revisión solicitada (`review.needed`). Se deriva al mostrarla, de modo que
 *  la aprobación sigue siendo lo único que la pasa a Listo y el historial
 *  conserva el recorrido real. */
export type TaskLabel = 'pending' | 'inProgress' | 'toValidate' | 'done'

export const LABEL_ORDER: TaskLabel[] = ['pending', 'inProgress', 'toValidate', 'done']

export const labelTranslations: Record<TaskLabel, string> = {
    pending: 'Pendiente',
    inProgress: 'En proceso',
    toValidate: 'Por validar',
    done: 'Listo'
}

/** Paleta del avance: celeste → morado → ámbar → verde.
 *
 *  La progresión va de frío a cálido y cierra en verde, así que el avance se
 *  lee de un vistazo sin depender solo del color: toda etiqueta se acompaña
 *  siempre de su texto.
 *
 *  El rojo queda reservado para los avisos —en espera y vencida—, no para un
 *  paso normal del flujo. Si "Por validar" fuera rojo, todo lo que espera
 *  aprobación parecería un error en vez de trabajo avanzando. */
export interface LabelPalette {
    /** Color sólido, para el borde superior de la columna y bloques. */
    solid: string
    /** Clases de la insignia: fondo claro + texto oscuro legible. */
    badge: string
    /** Clases del botón activo. */
    button: string
    /** Fondo translúcido para los bloques del calendario. */
    tint: string
}

export const labelPalette: Record<TaskLabel, LabelPalette> = {
    pending: {
        solid: '#0ea5e9',
        badge: 'bg-sky-100 text-sky-800',
        button: 'bg-sky-600 text-white',
        tint: '#0ea5e91a'
    },
    inProgress: {
        solid: '#7c3aed',
        badge: 'bg-violet-100 text-violet-800',
        button: 'bg-violet-600 text-white',
        tint: '#7c3aed1a'
    },
    toValidate: {
        solid: '#f59e0b',
        badge: 'bg-amber-100 text-amber-900',
        button: 'bg-amber-500 text-white',
        tint: '#f59e0b1a'
    },
    done: {
        solid: '#059669',
        badge: 'bg-emerald-100 text-emerald-800',
        button: 'bg-emerald-600 text-white',
        tint: '#0596691a'
    }
}

/** Avisos: no son etapas del avance, son problemas que resolver. */
export const ALERT_COLOR = '#dc2626'
export const alertBadge = 'bg-red-100 text-red-800'

type LabelSource = {
    status: TaskStatus
    review?: { needed: boolean } | null
}

export function getTaskLabel(task: LabelSource): TaskLabel {
    if (task.review?.needed) return 'toValidate'
    return task.status
}

/** Cadencia del trabajo operativo.
 *
 *  Es metadato, no estado: por eso todas las frecuencias comparten un mismo
 *  estilo neutro en vez de tener color propio. Si compitieran con la paleta
 *  del avance, el color dejaría de significar una sola cosa. La estructura
 *  visual la da el agrupado de la lista, no el color. */
export type TaskFrequency =
    'none' | 'daily' | 'everyOtherDay' | 'weekly' | 'biweekly' | 'monthly' | 'onDemand'

export const FREQUENCY_ORDER: TaskFrequency[] =
    ['daily', 'everyOtherDay', 'weekly', 'biweekly', 'monthly', 'onDemand', 'none']

/** Cadencias que vuelven a hacer falta al completarlas. */
export const RECURRING_FREQUENCIES: TaskFrequency[] =
    ['daily', 'everyOtherDay', 'weekly', 'biweekly', 'monthly']

export const isRecurringFrequency = (frequency?: TaskFrequency) =>
    !!frequency && RECURRING_FREQUENCIES.includes(frequency)

export const frequencyTranslations: Record<TaskFrequency, string> = {
    daily: 'Diario',
    everyOtherDay: 'Interdiario',
    weekly: 'Semanal',
    biweekly: 'Quincenal',
    monthly: 'Mensual',
    onDemand: 'Según requerimiento',
    none: 'Sin frecuencia'
}

/** Versión corta, para cuando el espacio manda. */
export const frequencyShort: Record<TaskFrequency, string> = {
    daily: 'Diario',
    everyOtherDay: 'Interdiario',
    weekly: 'Semanal',
    biweekly: 'Quincenal',
    monthly: 'Mensual',
    onDemand: 'A pedido',
    none: '—'
}

export const frequencyBadge = 'bg-slate-100 text-slate-600'

export const priorityTranslations: Record<TaskPriority, string> = {
    low: 'Baja',
    medium: 'Media',
    high: 'Alta',
    urgent: 'Urgente'
}

/** La prioridad usa una escala neutra propia para no competir con la paleta
 *  del avance: solo "Urgente" toma el rojo de aviso. */
export const priorityBadgeStyles: Record<TaskPriority, string> = {
    low: 'bg-slate-100 text-slate-600',
    medium: 'bg-slate-100 text-slate-700',
    high: 'bg-orange-100 text-orange-800',
    urgent: 'bg-red-100 text-red-800'
}
