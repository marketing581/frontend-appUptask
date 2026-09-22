import { useForm } from "react-hook-form"
import { User, UserProfileForm } from "@/types/index"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { updateProfile } from "@/api/ProfileAPI"
import { toast } from "react-toastify"
import { Button, PageHeader } from "@/components/ui"

type ProfileFormProps = {
    data: User
}

const INPUT_CLASS = `w-full h-9 rounded-lg border border-line-strong px-3 text-sm bg-surface
    focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500`

export default function ProfileForm({ data }: ProfileFormProps) {
    const { register, handleSubmit, formState: { errors } } = useForm<UserProfileForm>({ defaultValues: data })

    const queryClient = useQueryClient()
    const { mutate, isPending } = useMutation({
        mutationFn: updateProfile,
        onError: (error) => toast.error(error.message),
        onSuccess: (data) => {
            toast.success(data)
            queryClient.invalidateQueries({ queryKey: ['user'] })
        }
    })

    const handleEditProfile = (formData: UserProfileForm) => mutate(formData)

    return (
        <>
            <PageHeader title="Mi cuenta" subtitle="Tu nombre y correo" />

            <form onSubmit={handleSubmit(handleEditProfile)} noValidate className="card p-5 max-w-md space-y-4">
                <div>
                    <label htmlFor="name" className="text-sm font-semibold text-ink mb-1.5 block">
                        Nombre
                    </label>
                    <input
                        id="name"
                        type="text"
                        className={INPUT_CLASS}
                        {...register("name", { required: "El nombre no puede ir vacío" })}
                    />
                    {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>}
                </div>

                <div>
                    <label htmlFor="email" className="text-sm font-semibold text-ink mb-1.5 block">
                        Email
                    </label>
                    <input
                        id="email"
                        type="email"
                        className={INPUT_CLASS}
                        {...register("email", {
                            required: "El email no puede ir vacío",
                            pattern: { value: /\S+@\S+\.\S+/, message: "Email no válido" }
                        })}
                    />
                    {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>}
                </div>

                <Button type="submit" variant="primary" disabled={isPending}>
                    {isPending ? 'Guardando…' : 'Guardar cambios'}
                </Button>
            </form>
        </>
    )
}
