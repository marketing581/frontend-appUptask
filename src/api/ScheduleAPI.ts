import { isAxiosError } from 'axios'
import api from '@/lib/axios'
import {
    teamBoardSchema,
    dayScheduleSchema,
    teamMembersSchema,
    unscheduledListSchema,
    weekScheduleSchema,
    SchedulePrefs,
    TimeBlock
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
}

export async function createTimeBlock(payload: BlockPayload) {
    try {
        const { data } = await api.post<{ block: TimeBlock, conflicts: TimeBlock[] }>(
            '/schedule/blocks',
            { ...payload, user: payload.userId }
        )
        return data
    } catch (error) {
        extractError(error, 'No se pudo crear el bloque')
    }
}

export async function updateTimeBlock({ blockId, start, end, note }: {
    blockId: string, start?: string, end?: string, note?: string
}) {
    try {
        const { data } = await api.put<{ block: TimeBlock, conflicts: TimeBlock[] }>(
            `/schedule/blocks/${blockId}`,
            { start, end, note }
        )
        return data
    } catch (error) {
        extractError(error, 'No se pudo mover el bloque')
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
}) {
    try {
        const { data } = await api.put('/schedule/preferences', payload)
        return data
    } catch (error) {
        extractError(error, 'No se pudieron guardar las preferencias')
    }
}
