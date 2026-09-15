import { Link, Navigate, useNavigate, useParams } from "react-router-dom"
import { useQuery } from '@tanstack/react-query'
import { useMemo } from "react"
import { PlusIcon, UsersIcon } from "@heroicons/react/24/outline"
import { getFullProject } from "@/api/ProjectAPI"
import AddTaskModal from "@/components/tasks/AddTaskModal"
import TaskList from "@/components/tasks/TaskList"
import EditTaskData from "@/components/tasks/EditTaskData"
import TaskModalDetails from "@/components/tasks/TaskModalDetails"
import { useAuth } from "@/hooks/useAuth"
import { isManager } from "@/utils/policies"
import { Button, PageHeader } from "@/components/ui"

export default function ProjectDetailsView() {
    const { data: user } = useAuth()
    const navigate = useNavigate()

    const params = useParams()
    const projectId = params.projectId!
    const { data, isLoading, isError } = useQuery({
        queryKey: ['project', projectId],
        queryFn: () => getFullProject(projectId),
        retry: false
    })

    /** Mismo alcance que el servidor: pertenecer al proyecto habilita trabajar
     *  en sus tareas; ser su responsable habilita cambiar el proyecto. */
    const belongsToProject = useMemo(() => {
        if (!data || !user) return false
        return data.manager === user._id
            || data.team?.some(memberId => memberId === user._id)
            || user.role === 'manager'
    }, [data, user])

    const isProjectOwner = useMemo(
        () => !!data && !!user && (isManager(data.manager, user._id) || user.role === 'manager'),
        [data, user]
    )

    if (isLoading) return <p className="text-center py-20 text-sm text-ink-muted">Cargando…</p>
    if (isError) return <Navigate to='/404' />
    if (!data || !user) return null

    return (
        <>
            <nav className="mb-2">
                <Link to="/proyectos" className="text-xs font-semibold text-ink-subtle hover:text-brand-600">
                    ← Proyectos
                </Link>
            </nav>

            <PageHeader
                title={data.projectName}
                subtitle={data.description}
                actions={belongsToProject ? (
                    <>
                        <Button
                            variant="primary"
                            onClick={() => navigate(location.pathname + '?newTask=true')}
                        >
                            <PlusIcon className="w-4 h-4" /> Nueva tarea
                        </Button>
                        {isProjectOwner && (
                            <Link to="team">
                                <Button variant="secondary">
                                    <UsersIcon className="w-4 h-4" /> Colaboradoras
                                </Button>
                            </Link>
                        )}
                    </>
                ) : undefined}
            />

            <TaskList tasks={data.tasks} canEdit={belongsToProject} />

            <AddTaskModal />
            <EditTaskData />
            <TaskModalDetails />
        </>
    )
}
