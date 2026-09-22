import { useForm } from "react-hook-form"
import { UpdateCurrentUserPasswordForm } from "@/types/index"
import { useMutation } from "@tanstack/react-query"
import { toast } from "react-toastify"
import { changePassword } from "@/api/ProfileAPI"
import { Button, PageHeader } from "@/components/ui"

const INPUT_CLASS = `w-full h-9 rounded-lg border border-line-strong px-3 text-sm bg-surface
    focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500`

export default function ChangePasswordView() {
    const initialValues: UpdateCurrentUserPasswordForm = {
        current_password: '',
        password: '',
        password_confirmation: ''
    }

    const { register, handleSubmit, watch, reset, formState: { errors } } = useForm({ defaultValues: initialValues })

    const { mutate, isPending } = useMutation({
        mutationFn: changePassword,
        onError: (error) => toast.error(error.message),
        onSuccess: (data) => {
            toast.success(data)
            reset()
        }
    })

    const password = watch('password')
    const handleChangePassword = (formData: UpdateCurrentUserPasswordForm) => mutate(formData)

    return (
        <>
            <PageHeader title="Cambiar contraseña" subtitle="Usa al menos 8 caracteres" />

            <form onSubmit={handleSubmit(handleChangePassword)} noValidate className="card p-5 max-w-md space-y-4">
                <div>
                    <label htmlFor="current_password" className="text-sm font-semibold text-ink mb-1.5 block">
                        Contraseña actual
                    </label>
                    <input
                        id="current_password"
                        type="password"
                        autoComplete="current-password"
                        className={INPUT_CLASS}
                        {...register("current_password", { required: "La contraseña actual es obligatoria" })}
                    />
                    {errors.current_password && (
                        <p className="text-xs text-red-600 mt-1">{errors.current_password.message}</p>
                    )}
                </div>

                <div>
                    <label htmlFor="password" className="text-sm font-semibold text-ink mb-1.5 block">
                        Nueva contraseña
                    </label>
                    <input
                        id="password"
                        type="password"
                        autoComplete="new-password"
                        className={INPUT_CLASS}
                        {...register("password", {
                            required: "La nueva contraseña es obligatoria",
                            minLength: { value: 8, message: 'Debe tener al menos 8 caracteres' }
                        })}
                    />
                    {errors.password && <p className="text-xs text-red-600 mt-1">{errors.password.message}</p>}
                </div>

                <div>
                    <label htmlFor="password_confirmation" className="text-sm font-semibold text-ink mb-1.5 block">
                        Repetir contraseña
                    </label>
                    <input
                        id="password_confirmation"
                        type="password"
                        autoComplete="new-password"
                        className={INPUT_CLASS}
                        {...register("password_confirmation", {
                            required: "Repite la nueva contraseña",
                            validate: value => value === password || 'Las contraseñas no coinciden'
                        })}
                    />
                    {errors.password_confirmation && (
                        <p className="text-xs text-red-600 mt-1">{errors.password_confirmation.message}</p>
                    )}
                </div>

                <Button type="submit" variant="primary" disabled={isPending}>
                    {isPending ? 'Guardando…' : 'Cambiar contraseña'}
                </Button>
            </form>
        </>
    )
}
