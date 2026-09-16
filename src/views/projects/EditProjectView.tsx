import { Navigate, useParams } from "react-router-dom"
import { useQuery } from '@tanstack/react-query'
import { getProjectById } from "@/api/ProjectAPI"
import EditProjectForm from "@/components/projects/EditProjectForm"

export default function EditProjectView() {
    const params = useParams()
    const projectId = params.projectId!
    const { data, isLoading, isError } = useQuery({
        queryKey: ['editProject', projectId],
        queryFn: () => getProjectById(projectId),
        retry: false
    })
    if (isLoading) return <p className="text-center py-20 text-sm text-ink-muted">Cargando…</p>
    if (isError) return <Navigate to='/404' />
    if (data) return <EditProjectForm data={data} projectId={projectId} />
    return null
}
