import { isAxiosError } from 'axios'
import api from '@/lib/axios'
import { Memo, MemoPriority, memoListSchema, memoSchema } from '@/types'

const fail = (error: unknown, fallback: string): never => {
    if (isAxiosError(error) && error.response) {
        throw new Error(error.response.data.error ?? fallback)
    }
    throw new Error(fallback)
}

export type MemoDraft = {
    title: string
    content?: string
    visibility?: 'private' | 'team'
    priority?: MemoPriority
    date?: string | null
}

export async function getMemos(archived = false) {
    try {
        const { data } = await api.get(`/notas?archived=${archived}`)
        const result = memoListSchema.safeParse(data)
        if (result.success) return result.data
        throw new Error('Las notas no tienen el formato esperado')
    } catch (error) {
        return fail(error, 'No se pudieron cargar las notas')
    }
}

export async function createMemo(draft: MemoDraft) {
    try {
        const { data } = await api.post('/notas', draft)
        const result = memoSchema.safeParse(data)
        return result.success ? result.data : (data as Memo)
    } catch (error) {
        return fail(error, 'No se pudo crear la nota')
    }
}

export async function updateMemo({ memoId, changes }: {
    memoId: string
    changes: Partial<MemoDraft> & { archived?: boolean }
}) {
    try {
        const { data } = await api.put(`/notas/${memoId}`, changes)
        const result = memoSchema.safeParse(data)
        return result.success ? result.data : (data as Memo)
    } catch (error) {
        return fail(error, 'No se pudo guardar la nota')
    }
}

export async function deleteMemo(memoId: string) {
    try {
        const { data } = await api.delete(`/notas/${memoId}`)
        return data
    } catch (error) {
        return fail(error, 'No se pudo eliminar la nota')
    }
}
