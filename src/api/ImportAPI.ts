import { isAxiosError } from 'axios'
import api from '@/lib/axios'
import { notionImportResultSchema } from '@/types'

const extractError = (error: unknown, fallback: string) => {
    if (isAxiosError(error) && error.response) {
        throw new Error(error.response.data.error ?? fallback)
    }
    throw new Error(fallback)
}

/** Sube lo exportado de Notion como pendientes puntuales del equipo activo.
 *  Con `dryRun` solo cuenta lo que haría, sin escribir nada. */
export async function importNotionCsv({ content, assigneeId, day, dryRun }: {
    content: string
    assigneeId: string
    day?: string
    dryRun: boolean
}) {
    try {
        const { data } = await api.post('/imports/notion', { content, assigneeId, day, dryRun })
        const result = notionImportResultSchema.safeParse(data)
        if (result.success) return result.data
        throw new Error('La respuesta de la importación no tiene el formato esperado')
    } catch (error) {
        extractError(error, 'No se pudo importar el CSV')
    }
}
