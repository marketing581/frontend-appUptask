import { NavLink } from 'react-router-dom'
import { KeyIcon, UserIcon } from '@heroicons/react/24/outline'

/** Mismo patrón de pastillas que el resto de selectores de la app
 *  (PersonSwitcher, el período de Informes, etc.), en vez de las pestañas
 *  con borde inferior de la maqueta original. */
const TABS = [
    { to: '/profile', label: 'Mi cuenta', icon: UserIcon, end: true },
    { to: '/profile/password', label: 'Contraseña', icon: KeyIcon, end: false }
]

export default function Tabs() {
    return (
        <div
            role="tablist"
            aria-label="Perfil"
            className="flex items-center gap-0.5 p-0.5 rounded-md bg-slate-100 w-fit mb-5"
        >
            {TABS.map(tab => (
                <NavLink
                    key={tab.to}
                    to={tab.to}
                    end={tab.end}
                    className={({ isActive }) => `h-8 px-3 rounded text-xs font-semibold transition-colors
                        flex items-center gap-1.5 ${
                        isActive ? 'bg-surface text-ink shadow-card' : 'text-ink-muted hover:text-ink'
                    }`}
                >
                    <tab.icon className="w-3.5 h-3.5" />
                    {tab.label}
                </NavLink>
            ))}
        </div>
    )
}
