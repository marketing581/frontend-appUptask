import api from "@/lib/axios";
import { Project, ProjectFormData, dashboardProjectSchema, editProjectSchema, projectSchema } from "../types";
import { isAxiosError } from "axios";

const extractError = (error: unknown, fallback: string) => {
    if (isAxiosError(error) && error.response) {
        throw new Error(error.response.data.error ?? fallback)
    }
    throw new Error(fallback)
}

export async function createProject(formData: ProjectFormData) {
    try {
        const { data } = await api.post('/projects', formData)
        const result = projectSchema.safeParse(data)
        return result.success ? result.data : (data as Project)
    } catch (error) {
        extractError(error, 'No se pudo crear el proyecto')
    }
}

export async function getProjects() {
    try {
        const { data } = await api('/projects')
        const response = dashboardProjectSchema.safeParse(data)
        if(response.success) {
            return response.data
        }
    } catch (error) {
        extractError(error, 'No se pudieron cargar los proyectos')
    }
}

export async function getProjectById(id: Project['_id']) {
    try {
        const { data } = await api(`/projects/${id}`)
        const response = editProjectSchema.safeParse(data)
        if(response.success) {
            return response.data
        }
    } catch (error) {
        extractError(error, 'No se pudo cargar el proyecto')
    }
}

export async function getFullProject(id: Project['_id']) {
    try {
        const { data } = await api(`/projects/${id}`)
        const response = projectSchema.safeParse(data)
        if(response.success) {
            return response.data
        }
    } catch (error) {
        extractError(error, 'No se pudo cargar el proyecto')
    }
}

type ProjectAPIType = {
    formData: ProjectFormData
    projectId: Project['_id']
}

export async function updateProject({formData, projectId} : ProjectAPIType ) {
    try {
        const { data } = await api.put(`/projects/${projectId}`, formData)
        return data
    } catch (error) {
        extractError(error, 'No se pudo actualizar el proyecto')
    }
}

export async function deleteProject(id: Project['_id']) {
    try {
        const url = `/projects/${id}`
        const { data } = await api.delete(url)
        return data
    } catch (error) {
        extractError(error, 'No se pudo eliminar el proyecto')
    }
}
