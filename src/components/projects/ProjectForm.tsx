import { UseFormRegister, FieldErrors } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { getBrands } from '@/api/BrandAPI'
import { ProjectFormData } from '@/types/index'

type ProjectFormProps = {
    register: UseFormRegister<ProjectFormData>
    errors: FieldErrors<ProjectFormData>
}

const fieldClass = `w-full rounded-md border-line-strong text-sm text-ink
    placeholder:text-ink-subtle focus:border-brand-500 focus:ring-brand-500`

/** Solo el nombre es obligatorio. El resto —cliente, descripción, área— se
 *  completa cuando haga falta, así que van marcados como opcionales en vez
 *  de fingir que son requisitos para poder trabajar. */
export default function ProjectForm({ errors, register }: ProjectFormProps) {
    const { data: brands } = useQuery({ queryKey: ['brands'], queryFn: getBrands })

    return (
        <div className="space-y-4">
            <div>
                <label htmlFor="projectName" className="block text-xs font-semibold text-ink-muted mb-1">
                    Nombre del proyecto
                </label>
                <input
                    id="projectName"
                    className={`${fieldClass} h-10`}
                    type="text"
                    placeholder="Nombre del proyecto"
                    {...register("projectName", {
                        required: "El nombre del proyecto es obligatorio",
                    })}
                />
                {errors.projectName && (
                    <p className="text-xs text-red-600 font-semibold mt-1">{errors.projectName.message}</p>
                )}
            </div>

            <div>
                <label htmlFor="clientName" className="block text-xs font-semibold text-ink-muted mb-1">
                    Cliente <span className="font-normal text-ink-subtle">(opcional)</span>
                </label>
                <input
                    id="clientName"
                    className={`${fieldClass} h-10`}
                    type="text"
                    placeholder="Nombre del cliente"
                    {...register("clientName")}
                />
            </div>

            {brands && brands.length > 0 && (
                <div>
                    <label htmlFor="brand" className="block text-xs font-semibold text-ink-muted mb-1">
                        Área <span className="font-normal text-ink-subtle">(opcional)</span>
                    </label>
                    <select id="brand" className={`${fieldClass} h-10`} {...register("brand")}>
                        <option value="">Sin área</option>
                        {brands.map(item => (
                            <option key={item._id} value={item._id}>{item.name}</option>
                        ))}
                    </select>
                </div>
            )}

            <div>
                <label htmlFor="description" className="block text-xs font-semibold text-ink-muted mb-1">
                    Descripción <span className="font-normal text-ink-subtle">(opcional)</span>
                </label>
                <textarea
                    id="description"
                    rows={3}
                    className={fieldClass}
                    placeholder="De qué se trata este proyecto"
                    {...register("description")}
                />
            </div>
        </div>
    )
}
