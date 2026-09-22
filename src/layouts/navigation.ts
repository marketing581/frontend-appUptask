import {
    ChartBarIcon,
    CheckCircleIcon,
    DocumentTextIcon,
    RectangleStackIcon,
    Squares2X2Icon,
    UsersIcon,
    WrenchScrewdriverIcon
} from '@heroicons/react/24/outline'


/** Estructura de la navegación.
 *
 *  Se agrupa por **alcance**, no por tipo de contenido: primero lo que una
 *  hace hoy, después lo que hace el equipo. Es la pregunta que se responde al
 *  mirar la barra («¿qué me toca?» / «¿cómo va el equipo?»), y mezclar ambas
 *  obligaba a leerlas todas para encontrar la que importaba. */

export type NavBadge = 'overdue' | 'toValidate' | null

export interface NavItem {
    to: string
    label: string
    hint: string
    /** Los iconos de heroicons son componentes con `forwardRef`; se toma su
     *  tipo del propio paquete en vez de reescribirlo a mano. */
    icon: typeof Squares2X2Icon
    end: boolean
    badge: NavBadge
    /** Solo visible para la cuenta administradora (`User.isSuperAdmin`). */
    ownerOnly?: boolean
}

export interface NavSection {
    heading: string
    items: NavItem[]
}

export const NAV_SECTIONS: NavSection[] = [
    {
        heading: 'Lo mío',
        items: [
            {
                to: '/',
                label: 'Mi trabajo',
                hint: 'Qué me toca hoy',
                icon: Squares2X2Icon,
                end: true,
                badge: 'overdue'
            },
            {
                to: '/finalizados',
                label: 'Finalizados',
                hint: 'Lo que se ha logrado, día a día',
                icon: CheckCircleIcon,
                end: false,
                badge: null
            }
        ]
    },
    {
        heading: 'El equipo',
        items: [
            {
                to: '/equipo',
                label: 'Panel del equipo',
                hint: 'Qué lleva cada una',
                icon: UsersIcon,
                end: false,
                badge: 'toValidate'
            },
            {
                to: '/mantenimiento',
                label: 'Mantenimiento',
                hint: 'Lo operativo que se repite',
                icon: WrenchScrewdriverIcon,
                end: false,
                badge: null
            },
            {
                to: '/proyectos',
                label: 'Proyectos',
                hint: 'Con entregables y cierre',
                icon: RectangleStackIcon,
                end: false,
                badge: null
            },
            {
                to: '/notas',
                label: 'Notas',
                hint: 'Listas, datos y acuerdos',
                icon: DocumentTextIcon,
                end: false,
                badge: null
            },
            {
                to: '/informes',
                label: 'Informes',
                hint: 'Tiempo de resolución del equipo',
                icon: ChartBarIcon,
                end: false,
                badge: null,
                ownerOnly: true
            }
        ]
    }
]
