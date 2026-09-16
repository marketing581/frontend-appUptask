import ProjectForm from './ProjectForm'
import { Link, useNavigate } from 'react-router-dom'
import { editProjectSchema, Project, ProjectFormData } from '@/types/index'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateProject } from '@/api/ProjectAPI'
import { toast } from 'react-toastify'
import { Button, PageHeader } from '@/components/ui'

type EditProjectFormProps = {
    data: z.infer<typeof editProjectSchema>
    projectId: Project['_id']
}

export default function EditProjectForm({data, projectId} : EditProjectFormProps) {

    const navigate = useNavigate()
    const {register, handleSubmit, formState: {errors}} = useForm<ProjectFormData>({defaultValues: {
        projectName: data.projectName,
        clientName: data.clientName,
        description: data.description,
        brand: (data.brand && typeof data.brand !== 'string' ? data.brand._id : data.brand) ?? ''
    }})
    
    const queryClient = useQueryClient()
    const { mutate, isPending } = useMutation({
        mutationFn: updateProject,
        onError: (error: Error) => {
           toast.error(error.message)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['projects']})
            queryClient.invalidateQueries({queryKey: ['editProject', projectId]})
            queryClient.invalidateQueries({queryKey: ['project', projectId]})
            toast.success('Proyecto actualizado')
            navigate(`/projects/${projectId}`)
        }
    })

    const handleForm = (formData: ProjectFormData) => mutate({ formData, projectId })

    return (
        <div className="max-w-xl">
            <nav className="mb-2">
                <Link
                    to={`/projects/${projectId}`}
                    className="text-xs font-semibold text-ink-subtle hover:text-brand-600"
                >
                    ← Volver al proyecto
                </Link>
            </nav>

            <PageHeader title="Editar proyecto" />

            <form
                className="card p-5"
                onSubmit={handleSubmit(handleForm)}
                noValidate
            >
                <ProjectForm register={register} errors={errors} />

                <div className="flex items-center gap-2 pt-5 mt-1 border-t border-line">
                    <Button type="submit" variant="primary" disabled={isPending}>
                        {isPending ? 'Guardando…' : 'Guardar cambios'}
                    </Button>
                    <Link to={`/projects/${projectId}`}>
                        <Button type="button" variant="ghost">Cancelar</Button>
                    </Link>
                </div>
            </form>
        </div>
    )
}
