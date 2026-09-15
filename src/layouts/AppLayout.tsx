import { useState } from 'react'
import { Outlet, Navigate, NavLink, Link } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import { useQueryClient } from '@tanstack/react-query'
import 'react-toastify/dist/ReactToastify.css'
import {
    ArrowRightOnRectangleIcon,
    Bars3Icon,
    CalendarDaysIcon,
    Cog6ToothIcon,
    RectangleStackIcon,
    Squares2X2Icon,
    UsersIcon,
    WrenchScrewdriverIcon,
    XMarkIcon
} from '@heroicons/react/24/outline'
import { useAuth } from '@/hooks/useAuth'
import { Avatar } from '@/components/ui'

/** Las dos naturalezas del trabajo tienen su propio sitio en la navegación:
 *  lo operativo del día a día y los proyectos con seguimiento. */
const NAV_SECTIONS = [
    {
        heading: null,
        items: [
            { to: '/', label: 'Mi trabajo', icon: Squares2X2Icon, end: true },
            { to: '/semana', label: 'Calendario', icon: CalendarDaysIcon, end: false }
        ]
    },
    {
        heading: 'Trabajo',
        items: [
            { to: '/mantenimiento', label: 'Mantenimiento', icon: WrenchScrewdriverIcon, end: false },
            { to: '/proyectos', label: 'Proyectos', icon: RectangleStackIcon, end: false }
        ]
    }
]

const TEAM_SECTION = {
    heading: 'Equipo',
    items: [
        { to: '/equipo', label: 'Panel del equipo', icon: UsersIcon, end: false }
    ]
}

function SidebarContent({ onNavigate, name, role }: {
    onNavigate?: () => void
    name: string
    role?: string
}) {
    const queryClient = useQueryClient()
    const logout = () => {
        localStorage.removeItem('AUTH_TOKEN')
        queryClient.invalidateQueries({ queryKey: ['user'] })
    }

    const sections = [...NAV_SECTIONS, TEAM_SECTION]

    return (
        <div className="flex flex-col h-full">
            <Link
                to="/"
                onClick={onNavigate}
                className="flex items-center gap-2.5 px-3 h-14 shrink-0 border-b border-line"
            >
                <span className="w-7 h-7 rounded-md bg-brand-600 text-white grid place-content-center
                    font-bold text-sm shrink-0">U</span>
                <span className="min-w-0">
                    <span className="block text-sm font-bold text-ink leading-tight truncate">UpTask</span>
                    <span className="block text-2xs text-ink-subtle leading-tight truncate">Equipo de Marketing</span>
                </span>
            </Link>

            <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4" aria-label="Navegación principal">
                {sections.map((section, index) => (
                    <div key={section.heading ?? index}>
                        {section.heading && (
                            <p className="eyebrow px-2 mb-1">{section.heading}</p>
                        )}
                        <ul className="space-y-0.5">
                            {section.items.map(item => (
                                <li key={item.to}>
                                    <NavLink
                                        to={item.to}
                                        end={item.end}
                                        onClick={onNavigate}
                                        className={({ isActive }) =>
                                            `flex items-center gap-2.5 px-2 h-8 rounded text-sm font-medium
                                            transition-colors ${
                                                isActive
                                                    ? 'bg-brand-50 text-brand-700 font-semibold'
                                                    : 'text-ink-muted hover:bg-slate-100 hover:text-ink'
                                            }`
                                        }
                                    >
                                        <item.icon className="w-[18px] h-[18px] shrink-0" />
                                        {item.label}
                                    </NavLink>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </nav>

            <div className="border-t border-line p-2 shrink-0">
                <div className="flex items-center gap-2 px-1 py-1.5">
                    <Avatar name={name} size="md" />
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-ink truncate leading-tight">{name}</p>
                        <p className="text-2xs text-ink-subtle leading-tight">
                            {role === 'manager' ? 'Encargada' : 'Integrante'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1 mt-1">
                    <Link
                        to="/profile"
                        onClick={onNavigate}
                        className="flex-1 flex items-center gap-1.5 h-7 px-2 rounded
                            text-xs font-medium text-ink-muted hover:bg-slate-100 hover:text-ink"
                    >
                        <Cog6ToothIcon className="w-4 h-4 shrink-0" /> Mi perfil
                    </Link>
                    <button
                        type="button"
                        onClick={logout}
                        title="Cerrar sesión"
                        aria-label="Cerrar sesión"
                        className="w-7 h-7 shrink-0 grid place-content-center rounded
                            text-ink-muted hover:bg-slate-100 hover:text-ink"
                    >
                        <ArrowRightOnRectangleIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    )
}

export default function AppLayout() {
    const { data, isError, isLoading } = useAuth()
    const [drawerOpen, setDrawerOpen] = useState(false)

    if (isLoading) {
        return (
            <div className="min-h-screen grid place-content-center text-sm text-ink-muted">
                Cargando…
            </div>
        )
    }
    if (isError) return <Navigate to='/auth/login' />
    if (!data) return null

    return (
        <div className="min-h-screen lg:pl-sidebar">
            {/* Barra lateral fija en escritorio */}
            <aside className="hidden lg:flex fixed inset-y-0 left-0 w-sidebar bg-surface
                border-r border-line z-30">
                <SidebarContent name={data.name} role={data.role} />
            </aside>

            {/* Cabecera compacta en móvil */}
            <header className="lg:hidden sticky top-0 z-20 h-14 bg-surface border-b border-line
                flex items-center gap-2 px-3">
                <button
                    type="button"
                    onClick={() => setDrawerOpen(true)}
                    className="w-9 h-9 grid place-content-center rounded hover:bg-slate-100"
                    aria-label="Abrir navegación"
                >
                    <Bars3Icon className="w-5 h-5 text-ink-muted" />
                </button>
                <span className="font-bold text-ink">UpTask</span>
                <span className="ml-auto"><Avatar name={data.name} size="sm" /></span>
            </header>

            {/* Cajón de navegación en móvil */}
            {drawerOpen && (
                <div className="lg:hidden fixed inset-0 z-40">
                    <div
                        className="absolute inset-0 bg-ink/40"
                        onClick={() => setDrawerOpen(false)}
                        aria-hidden
                    />
                    <div className="absolute inset-y-0 left-0 w-sidebar bg-surface shadow-overlay">
                        <button
                            type="button"
                            onClick={() => setDrawerOpen(false)}
                            className="absolute top-3 right-2 w-8 h-8 grid place-content-center
                                rounded hover:bg-slate-100 z-10"
                            aria-label="Cerrar navegación"
                        >
                            <XMarkIcon className="w-5 h-5 text-ink-muted" />
                        </button>
                        <SidebarContent
                            name={data.name}
                            role={data.role}
                            onNavigate={() => setDrawerOpen(false)}
                        />
                    </div>
                </div>
            )}

            <main className="px-4 py-5 lg:px-7 lg:py-6 max-w-[1600px]">
                <Outlet />
            </main>

            <ToastContainer
                position="bottom-right"
                autoClose={3500}
                hideProgressBar
                pauseOnHover={false}
                pauseOnFocusLoss={false}
                toastClassName="!rounded-lg !text-sm !font-medium !shadow-overlay"
            />
        </div>
    )
}
