import { Fragment } from 'react'
import { Menu, Transition } from '@headlessui/react'
import { EllipsisHorizontalIcon, PlusIcon } from '@heroicons/react/24/outline'
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useQuery } from '@tanstack/react-query'
import { getProjects } from "@/api/ProjectAPI"
import { useAuth } from '@/hooks/useAuth'
import { isManager } from '@/utils/policies'
import { DashboardProject } from '@/types'
import DeleteProjectModal from '@/components/projects/DeleteProjectModal'
import { Badge, Button, EmptyState, PageHeader } from '@/components/ui'
import { LABEL_ORDER, labelPalette, labelTranslations } from '@/utils/taskLabels'

/** Barra de avance partida por etiqueta: se ve de un vistazo cuánto queda
 *  pendiente, en proceso, por validar y listo sin abrir el proyecto. */
function StageBar({ stats }: { stats: DashboardProject['stats'] }) {
    if (stats.total === 0) {
        return <div className="h-1.5 rounded-full bg-slate-200" />
    }
    return (
        <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden flex">
            {LABEL_ORDER.map(label => {
                const count = stats[label]
                if (count === 0) return null
                return (
                    <span
                        key={label}
                        title={`${labelTranslations[label]}: ${count}`}
                        style={{
                            width: `${(count / stats.total) * 100}%`,
                            backgroundColor: labelPalette[label].solid
                        }}
                    />
                )
            })}
        </div>
    )
}

function ProjectCard({ project, isOwner, onDelete }: {
    project: DashboardProject
    isOwner: boolean
    onDelete: () => void
}) {
    const { stats } = project
    const pct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0

    return (
        <li className="card p-4 flex flex-col gap-3 hover:shadow-raised transition-shadow">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <Link
                        to={`/projects/${project._id}`}
                        className="block text-base font-bold text-ink hover:text-brand-600 truncate"
                    >
                        {project.projectName}
                    </Link>
                    <p className="text-xs text-ink-subtle truncate mt-0.5">{project.clientName}</p>
                </div>

                <Menu as="div" className="relative shrink-0">
                    <Menu.Button
                        className="w-7 h-7 grid place-content-center rounded text-ink-subtle hover:bg-slate-100"
                        aria-label={`Opciones de ${project.projectName}`}
                    >
                        <EllipsisHorizontalIcon className="w-5 h-5" />
                    </Menu.Button>
                    <Transition as={Fragment}
                        enter="transition ease-out duration-100"
                        enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100"
                        leave="transition ease-in duration-75"
                        leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                        <Menu.Items className="absolute right-0 z-10 mt-1 w-48 origin-top-right rounded-lg
                            bg-surface py-1 shadow-overlay border border-line focus:outline-none">
                            <Menu.Item>
                                <Link to={`/projects/${project._id}`}
                                    className="block px-3 py-1.5 text-sm text-ink hover:bg-surface-sunken">
                                    Abrir proyecto
                                </Link>
                            </Menu.Item>
                            {isOwner && (
                                <>
                                    <Menu.Item>
                                        <Link to={`/projects/${project._id}/edit`}
                                            className="block px-3 py-1.5 text-sm text-ink hover:bg-surface-sunken">
                                            Editar proyecto
                                        </Link>
                                    </Menu.Item>
                                    <Menu.Item>
                                        <button type="button" onClick={onDelete}
                                            className="block w-full text-left px-3 py-1.5 text-sm
                                                text-red-600 hover:bg-red-50">
                                            Eliminar proyecto
                                        </button>
                                    </Menu.Item>
                                </>
                            )}
                        </Menu.Items>
                    </Transition>
                </Menu>
            </div>

            {project.description && (
                <p className="text-xs text-ink-muted line-clamp-2 leading-relaxed">
                    {project.description}
                </p>
            )}

            <div className="mt-auto space-y-2">
                <div className="flex items-center justify-between text-2xs font-semibold">
                    <span className="text-ink-subtle">
                        {stats.total === 0
                            ? 'Sin tareas todavía'
                            : `${stats.done} de ${stats.total} listas`}
                    </span>
                    <span className="text-ink tabular">{pct}%</span>
                </div>
                <StageBar stats={stats} />

                <div className="flex flex-wrap items-center gap-1 pt-0.5">
                    {LABEL_ORDER.filter(label => stats[label] > 0).map(label => (
                        <Badge key={label} className={labelPalette[label].badge}>
                            {stats[label]} {labelTranslations[label].toLowerCase()}
                        </Badge>
                    ))}
                    <Badge variant="outline" className="ml-auto bg-transparent border border-line-strong text-ink-subtle">
                        {isOwner ? 'Responsable' : 'Colaboradora'}
                    </Badge>
                </div>
            </div>
        </li>
    )
}

export default function DashboardView() {
    const location = useLocation()
    const navigate = useNavigate()
    const { data: user } = useAuth()
    const { data, isLoading } = useQuery({
        queryKey: ['projects'],
        queryFn: getProjects
    })

    if (isLoading) return <p className="text-center py-20 text-sm text-ink-muted">Cargando…</p>
    if (!data || !user) return null

    return (
        <>
            <PageHeader
                title="Proyectos"
                subtitle="Trabajos con objetivo, entregables y cierre."
                actions={
                    <Link to="/projects/create">
                        <Button variant="primary">
                            <PlusIcon className="w-4 h-4" /> Nuevo proyecto
                        </Button>
                    </Link>
                }
            />

            {data.length === 0 ? (
                <div className="card">
                    <EmptyState
                        title="Todavía no hay proyectos"
                        hint="Un proyecto agrupa etapas, entregables y validaciones. Para el trabajo rápido del día a día usa Mantenimiento."
                        action={
                            <Link to="/projects/create">
                                <Button variant="primary" size="sm">Crear el primero</Button>
                            </Link>
                        }
                    />
                </div>
            ) : (
                <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {data.map(project => (
                        <ProjectCard
                            key={project._id}
                            project={project}
                            isOwner={isManager(project.manager, user._id)}
                            onDelete={() => navigate(location.pathname + `?deleteProject=${project._id}`)}
                        />
                    ))}
                </ul>
            )}

            <DeleteProjectModal />
        </>
    )
}
