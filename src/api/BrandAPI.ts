import { isAxiosError } from 'axios'
import api from '@/lib/axios'
import { Brand, brandSchema } from '@/types'
import { z } from 'zod'

export async function getBrands() {
    try {
        const { data } = await api.get('/brands')
        const result = z.array(brandSchema).safeParse(data)
        return result.success ? result.data : ([] as Brand[])
    } catch (error) {
        if (isAxiosError(error) && error.response) {
            throw new Error(error.response.data.error ?? 'No se pudieron cargar las áreas')
        }
        throw new Error('No se pudieron cargar las áreas')
    }
}
