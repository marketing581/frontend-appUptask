import { useEffect, useState } from 'react'
import { Outlet, Navigate, NavLink, Link, useLocation } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import { useQueryClient } from '@tanstack/react-query'
import 'react-toastify/dist/ReactToastify.css'
import {
    ArrowRightOnRectangleIcon,
    Bars3Icon,
    ChevronDoubleLeftIcon,
    ChevronDoubleRightIcon,
    Cog6ToothIcon,
    XMarkIcon
} from '@heroicons/react/24/outline'
import { useAuth } from '@/hooks/useAuth'
import { useNavBadges } from '@/hooks/useNavBadges'
import { NAV_SECTIONS, NavItem } from './navigation'
import { Avatar } from '@/components/ui'
import { REPORTS_OWNER_ID } from '@/utils/reportsAccess'

function NavRow({ item, count, collapsed, onNavigate }: {
    item: NavItem
    count: number
    collapsed?: boolean
    onNavigate?: () => void
}) {
    const isAlert = item.badge === 'overdue'

    return (
        <li>
            <NavLink
                to={item.to}
                end={item.end}
                onClick={onNavigate}
                // Con el nombre oculto, el título es la única forma de saber
                // qué ítem es sin volver a expandir el menú.
                title={collapsed ? item.label : item.hint}
                className={({ isActive }) =>
                    `group flex items-center h-9 rounded text-sm font-medium
                    transition-colors relative ${collapsed ? 'justify-center px-0' : 'gap-2.5 pl-3 pr-2'} ${
                        isActive
                            ? 'bg-brand-50 text-brand-700 font-semibold'
                            : 'text-ink-muted hover:bg-slate-100 hover:text-ink'
                    }`
                }
            >
                {({ isActive }) => (
                    <>
                        {/* Marca de sección activa: no depende solo del color */}
                        <span
                            aria-hidden
                            className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full
                                ${isActive ? 'bg-brand-600' : 'bg-transparent'}`}
                        />
                        <span className="relative shrink-0">
                            <item.icon className="w-[18px] h-[18px]" />
                            {collapsed && count > 0 && (
                                <span
                                    aria-hidden
                                    className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${
                                        isAlert ? 'bg-red-600' : 'bg-amber-500'
                                    }`}
                                />
                            )}
                        </span>

                        {!collapsed && <span className="truncate">{item.label}</span>}

                        {!collapsed && count > 0 && (
                            <span
                                title={isAlert
                                    ? `${count} vencido${count === 1 ? '' : 's'}`
                                    : `${count} espera${count === 1 ? '' : 'n'} tu validación`}
                                className={`ml-auto min-w-[1.25rem] h-5 px-1.5 grid place-content-center
                                    rounded-full text-2xs font-bold tabular ${
                                    isAlert
                                        ? 'bg-red-100 text-red-700'
                                        : 'bg-amber-100 text-amber-900'
                                }`}
                            >
                                {count}
                            </span>
                        )}
                    </>
                )}
            </NavLink>
        </li>
    )
}

function SidebarContent({ onNavigate, name, role, userId, collapsed, onToggleCollapse }: {
    onNavigate?: () => void
    name: string
    role?: string
    userId: string
    collapsed?: boolean
    /** Solo la tiene el sidebar fijo de desktop: el cajón de mobile no
     *  colapsa, ya se cierra solo. */
    onToggleCollapse?: () => void
}) {
    const queryClient = useQueryClient()
    const badges = useNavBadges()
    const sections = NAV_SECTIONS.map(section => ({
        ...section,
        items: section.items.filter(item => !item.ownerOnly || userId === REPORTS_OWNER_ID)
    }))

    const logout = () => {
        localStorage.removeItem('AUTH_TOKEN')
        queryClient.invalidateQueries({ queryKey: ['user'] })
    }

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center h-14 shrink-0 border-b border-line">
                <Link
                    to="/"
                    onClick={onNavigate}
                    className={`flex items-center gap-2.5 min-w-0 flex-1 h-full ${collapsed ? 'justify-center' : 'px-3'}`}
                >
                    <span className="w-7 h-7 rounded-md bg-brand-600 text-white grid place-content-center
                        font-bold text-sm shrink-0">U</span>
                    {!collapsed && (
                        <span className="min-w-0">
                            <span className="block text-sm font-bold text-ink leading-tight truncate">UpTask</span>
                            <span className="block text-2xs text-ink-subtle leading-tight truncate">
                                Equipo de Marketing
                            </span>
                        </span>
                    )}
                </Link>

                {onToggleCollapse && !collapsed && (
                    <button
                        type="button"
                        onClick={onToggleCollapse}
                        title="Contraer menú"
                        aria-label="Contraer menú"
                        className="w-8 h-8 mr-1.5 shrink-0 grid place-content-center rounded
                            text-ink-muted hover:bg-slate-100 hover:text-ink"
                    >
                        <ChevronDoubleLeftIcon className="w-4 h-4" />
                    </button>
                )}
            </div>

            {onToggleCollapse && collapsed && (
                <button
                    type="button"
                    onClick={onToggleCollapse}
                    title="Expandir menú"
                    aria-label="Expandir menú"
                    className="w-8 h-8 mx-auto mt-1.5 shrink-0 grid place-content-center rounded
                        text-ink-muted hover:bg-slate-100 hover:text-ink"
                >
                    <ChevronDoubleRightIcon className="w-4 h-4" />
                </button>
            )}

            <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-5" aria-label="Navegación principal">
                {sections.map(section => (
                    <div key={section.heading}>
                        {!collapsed && <p className="eyebrow px-2 mb-1.5">{section.heading}</p>}
                        <ul className="space-y-0.5">
                            {section.items.map(item => (
                                <NavRow
                                    key={item.to}
                                    item={item}
                                    count={item.badge ? badges[item.badge] : 0}
                                    collapsed={collapsed}
                                    onNavigate={onNavigate}
                                />
                            ))}
                        </ul>
                    </div>
                ))}
            </nav>

            <div className="border-t border-line p-2 shrink-0">
                <div className={`flex items-center gap-2 px-1 py-1.5 ${collapsed ? 'justify-center' : ''}`}>
                    <Avatar name={name} size="md" title={collapsed ? name : undefined} />
                    {!collapsed && (
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-ink truncate leading-tight">{name}</p>
                            <p className="text-2xs text-ink-subtle leading-tight">
                                {role === 'manager' ? 'Encargada' : 'Integrante'}
                            </p>
                        </div>
                    )}
                </div>
                <div className={`flex items-center gap-1 mt-1 ${collapsed ? 'flex-col' : ''}`}>
                    <Link
                        to="/profile"
                        onClick={onNavigate}
                        title="Mi perfil"
                        className={`flex items-center gap-1.5 h-7 rounded
                            text-xs font-medium text-ink-muted hover:bg-slate-100 hover:text-ink ${
                            collapsed ? 'w-7 justify-center' : 'flex-1 px-2'
                        }`}
                    >
                        <Cog6ToothIcon className="w-4 h-4 shrink-0" /> {!collapsed && 'Mi perfil'}
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

/** Nombre de la sección actual: en móvil la barra no está a la vista y hay que
 *  poder saber dónde se está sin abrirla. */
function useCurrentSection() {
    const { pathname } = useLocation()
    for (const section of NAV_SECTIONS) {
        // ownerOnly no importa aquí: si alguien llega a /informes por URL
        // directa sin ser la dueña, la vista igual se encarga de bloquearla.
        for (const item of section.items) {
            if (item.end ? pathname === item.to : pathname.startsWith(item.to)) return item.label
        }
    }
    return 'UpTask'
}

export default function AppLayout() {
    const { data, isError, isLoading } = useAuth()
    const [drawerOpen, setDrawerOpen] = useState(false)
    // Preferencia de esta pantalla, no del perfil: se guarda localmente para
    // que no vuelva a expandirse sola en cada recarga.
    const [collapsed, setCollapsed] = useState(() => localStorage.getItem('SIDEBAR_COLLAPSED') === '1')
    const currentSection = useCurrentSection()
    const { pathname } = useLocation()

    const toggleCollapsed = () => {
        setCollapsed(current => {
            const next = !current
            localStorage.setItem('SIDEBAR_COLLAPSED', next ? '1' : '0')
            return next
        })
    }

    // Navegar cierra el cajón: dejarlo abierto tapando la vista es un clásico.
    useEffect(() => { setDrawerOpen(false) }, [pathname])

    // Escape lo cierra, como cualquier capa superpuesta.
    useEffect(() => {
        if (!drawerOpen) return
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setDrawerOpen(false)
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [drawerOpen])

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
        <div className={`min-h-screen transition-[padding] ${collapsed ? 'lg:pl-sidebar-collapsed' : 'lg:pl-sidebar'}`}>
            <aside className={`hidden lg:flex fixed inset-y-0 left-0 bg-surface
                border-r border-line z-30 transition-[width] ${collapsed ? 'w-sidebar-collapsed' : 'w-sidebar'}`}>
                <SidebarContent
                    name={data.name}
                    role={data.role}
                    userId={data._id}
                    collapsed={collapsed}
                    onToggleCollapse={toggleCollapsed}
                />
            </aside>

            <header className="lg:hidden sticky top-0 z-20 h-14 bg-surface border-b border-line
                flex items-center gap-2 px-3">
                <button
                    type="button"
                    onClick={() => setDrawerOpen(true)}
                    className="w-9 h-9 grid place-content-center rounded hover:bg-slate-100"
                    aria-label="Abrir navegación"
                    aria-expanded={drawerOpen}
                >
                    <Bars3Icon className="w-5 h-5 text-ink-muted" />
                </button>
                <span className="font-bold text-ink truncate">{currentSection}</span>
                <Link to="/profile" className="ml-auto shrink-0" aria-label="Mi perfil">
                    <Avatar name={data.name} size="sm" />
                </Link>
            </header>

            {drawerOpen && (
                <div className="lg:hidden fixed inset-0 z-40" role="dialog" aria-modal="true">
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
                            userId={data._id}
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
