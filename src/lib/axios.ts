import axios from 'axios'

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL
})

api.interceptors.request.use( config => {
    const token = localStorage.getItem('AUTH_TOKEN')
    if(token) {
        config.headers.Authorization = `Bearer ${token}`
    }

    // Solo tiene efecto si la cuenta es super-admin: el servidor ignora esta
    // cabecera para cualquier otra, así que enviarla de más es inocuo.
    const activeWorkspace = localStorage.getItem('ACTIVE_WORKSPACE_ID')
    if (activeWorkspace) {
        config.headers['X-Workspace-Id'] = activeWorkspace
    }

    return config
})

export default api