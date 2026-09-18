import { isAxiosError } from 'axios'
import api from '@/lib/axios'
import { taskDurationReportSchema } from '@/types'

const extractError = (error: unknown, fallback: string) => {
    if (isAxiosError(error) && error.response) {
        throw new Error(error.response.data.error ?? fallback)
    }
    throw new Error(fallback)
}

export type ReportPeriod = 'weekly' | 'biweekly' | 'monthly'

export async function getTaskDurationReport({ period, anchor, personId }: {
    period: ReportPeriod, anchor: Date, personId?: string
}) {
    try {
        const params = new URLSearchParams({ period, anchor: anchor.toISOString() })
        if (personId) params.set('personId', personId)

        const { data } = await api.get(`/reports/task-duration?${params.toString()}`)
        const result = taskDurationReportSchema.safeParse(data)
        if (result.success) return result.data
        throw new Error('La respuesta del informe no tiene el formato esperado')
    } catch (error) {
        extractError(error, 'No se pudo cargar el informe')
    }
}
