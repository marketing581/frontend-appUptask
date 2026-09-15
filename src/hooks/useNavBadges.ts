import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getDaySchedule } from '@/api/ScheduleAPI'
import { getMyTasks } from '@/api/WorkTaskAPI'
import { useAuth } from '@/hooks/useAuth'
import { NavBadge } from '@/layouts/navigation'

/** Cifras que la barra lateral muestra junto a cada sección.
 *
 *  Solo se avisa de lo que pide una decisión hoy: lo vencido y lo que espera
 *  una aprobación tuya. Poner un número en cada apartado convertiría los
 *  avisos en ruido y dejarían de mirarse. */
export function useNavBadges(): Record<Exclude<NavBadge, null>, number> {
    const { data: currentUser } = useAuth()
    const today = useMemo(() => new Date(), [])

    // Comparten caché con «Mi trabajo»: no añaden peticiones extra.
    const { data: day } = useQuery({
        queryKey: ['day', today.toISOString().slice(0, 10)],
        queryFn: () => getDaySchedule({ date: today }),
        retry: false
    })

    const { data: tasks } = useQuery({
        queryKey: ['myTasks'],
        queryFn: () => getMyTasks(),
        retry: false
    })

    const toValidate = useMemo(() => {
        if (!currentUser) return 0
        return (tasks ?? []).filter(task => {
            if (!task.review?.needed) return false
            const approver = task.review.approver
            const approverId = approver && typeof approver !== 'string' ? approver._id : approver
            // Sin aprobadora designada, la validación recae en la encargada.
            return approverId
                ? approverId === currentUser._id
                : currentUser.role === 'manager'
        }).length
    }, [tasks, currentUser])

    return {
        overdue: day?.overdue.length ?? 0,
        toValidate
    }
}
