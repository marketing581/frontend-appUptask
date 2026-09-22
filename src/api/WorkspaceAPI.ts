import { isAxiosError } from 'axios'
import api from '@/lib/axios'
import { workspacesSchema, workspaceSchema } from '@/types'

const extractError = (error: unknown, fallback: string) => {
    if (isAxiosError(error) && error.response) {
        throw new Error(error.response.data.error ?? fallback)
    }
    throw new Error(fallback)
}

/** Solo para la cuenta administradora: el resto ni siquiera ve el selector. */
export async function getWorkspaces() {
    try {
        const { data } = await api.get('/workspaces')
        const result = workspacesSchema.safeParse(data)
        if (result.success) return result.data
        return []
    } catch (error) {
        extractError(error, 'No se pudieron cargar los equipos')
    }
}

export async function createWorkspace(name: string) {
    try {
        const { data } = await api.post('/workspaces', { name })
        const result = workspaceSchema.safeParse(data)
        if (result.success) return result.data
        throw new Error('La respuesta no tiene el formato esperado')
    } catch (error) {
        extractError(error, 'No se pudo crear el equipo')
    }
}
