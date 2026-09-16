import { isAxiosError } from 'axios'
import api from '@/lib/axios'
import {
    teamBoardSchema,
    dayScheduleSchema,
    teamMembersSchema,
    rangeScheduleSchema,
    unscheduledListSchema,
    weekScheduleSchema,
    SchedulePrefs,
    TimeBlock,
    GuestConflict
} from '@/types'

const extractError = (error: unknown, fallback: string) => {
    if (isAxiosError(error) && error.response) {
        throw new Error(error.response.data.error ?? fallback)
    }
    throw new Error(fallback)
}

export async function getWeekSchedule({ date, userId }: { date: Date, userId?: string }) {
    try {
        const params = new URLSearchParams({ date: date.toISOString() })
        if (userId) params.set('userId', userId)

        const { data } = await api.get(`/schedule/week?${params.toString()}`)
        const result = weekScheduleSchema.safeParse(data)
        if (result.success) return result.data
        throw new Error('La respuesta del calendario no tiene el formato esperado')
    } catch (error) {
        extractError(error, 'No se pudo cargar la semana')
    }
}

export async function getDaySchedule({ date, userId }: { date: Date, userId?: string }) {
    try {
        const params = new URLSearchParams({ date: date.toISOString() })
        if (userId) params.set('userId', userId)

        const { data } = await api.get(`/schedule/day?${params.toString()}`)
        const result = dayScheduleSchema.safeParse(data)
        if (result.success) return result.data
        throw new Error('La respuesta del día no tiene el formato esperado')
    } catch (error) {
        extractError(error, 'No se pudo cargar el día')
    }
}

/** Bloques entre dos fechas, para las vistas de mes y de trimestre. */
export async function getRangeSchedule({ from, to, userId }: {
    from: Date, to: Date, userId?: string
}) {
    try {
        const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() })
        if (userId) params.set('userId', userId)

        const { data } = await api.get(`/schedule/range?${params.toString()}`)
        const result = rangeScheduleSchema.safeParse(data)
        if (result.success) return result.data
        throw new Error('La respuesta del calendario no tiene el formato esperado')
    } catch (error) {
        extractError(error, 'No se pudo cargar el calendario')
    }
}

export async function getUnscheduledTasks(userId?: string, date?: Date) {
    try {
        const params = new URLSearchParams()
        if (userId) params.set('userId', userId)
        if (date) params.set('date', date.toISOString())
        const { data } = await api.get(`/schedule/unscheduled?${params.toString()}`)
        const result = unscheduledListSchema.safeParse(data)
        if (result.success) return result.data
        throw new Error('La lista por programar no tiene el formato esperado')
    } catch (error) {
        extractError(error, 'No se pudo cargar lo que falta programar')
    }
}

export async function getTeamBoard(date: Date) {
    try {
        const { data } = await api.get(`/schedule/team?date=${date.toISOString()}`)
        const result = teamBoardSchema.safeParse(data)
        if (result.success) return result.data
        throw new Error('El panel del equipo no tiene el formato esperado')
    } catch (error) {
        extractError(error, 'No se pudo cargar el panel del equipo')
    }
}

export async function getScheduleMembers() {
    try {
        const { data } = await api.get('/schedule/members')
        const result = teamMembersSchema.safeParse(data)
        if (result.success) return result.data
        return []
    } catch (error) {
        extractError(error, 'No se pudo cargar el equipo')
    }
}

export type BlockPayload = {
    task: string
    start: string
    end: string
    note?: string
    userId?: string
    /** Personas etiquetadas en un pendiente compartido. */
    guests?: string[]
}

/** Respuesta de crear o mover un bloque: además del bloque, con qué se cruza
 *  —lo propio y lo de cada persona etiquetada—. */
type BlockResult = {
    block: TimeBlock
    conflicts: TimeBlock[]
    guestConflicts: GuestConflict[]
}

export async function createTimeBlock(payload: BlockPayload) {
    try {
        const { data } = await api.post<BlockResult>(
            '/schedule/blocks',
            { ...payload, user: payload.userId }
        )
        return data
    } catch (error) {
        extractError(error, 'No se pudo crear el bloque')
    }
}

export async function updateTimeBlock({ blockId, start, end, note, guests }: {
    blockId: string, start?: string, end?: string, note?: string, guests?: string[]
}) {
    try {
        const { data } = await api.put<BlockResult>(
            `/schedule/blocks/${blockId}`,
            // `guests` solo viaja si se tocó: enviarlo siempre borraría las
            // etiquetas al arrastrar un bloque para moverlo.
            guests ? { start, end, note, guests } : { start, end, note }
        )
        return data
    } catch (error) {
        extractError(error, 'No se pudo mover el bloque')
    }
}

/** Dejar de aparecer en un bloque compartido en el que te etiquetaron. */
export async function leaveTimeBlock(blockId: string) {
    try {
        const { data } = await api.post(`/schedule/blocks/${blockId}/leave`)
        return data
    } catch (error) {
        extractError(error, 'No se pudo quitar la etiqueta')
    }
}

export async function deleteTimeBlock(blockId: string) {
    try {
        const { data } = await api.delete(`/schedule/blocks/${blockId}`)
        return data
    } catch (error) {
        extractError(error, 'No se pudo eliminar el bloque')
    }
}

export async function updateSchedulePreferences(payload: {
    timezone?: string
    schedulePrefs?: Partial<SchedulePrefs>
    /** Presente solo cuando la encargada edita el horario de otra persona:
     *  sin esto, el servidor siempre guarda en la cuenta de quien pide. */
    userId?: string
}) {
    try {
        const { data } = await api.put('/schedule/preferences', payload)
        return data
    } catch (error) {
        extractError(error, 'No se pudieron guardar las preferencias')
    }
}
