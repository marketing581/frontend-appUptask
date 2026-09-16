import { ReactNode } from 'react'

/** Primitivas del sistema de diseño. Todo lo visual sale de aquí para que las
 *  vistas no inventen espaciados, radios ni colores por su cuenta. */

/* ---------------------------------------------------------------- Avatar */

const AVATAR_TONES = [
    'bg-violet-500', 'bg-sky-500', 'bg-emerald-500',
    'bg-amber-500', 'bg-rose-500', 'bg-indigo-500'
]

/** Color estable por persona: la misma inicial siempre con el mismo tono. */
function toneFor(seed: string) {
    let hash = 0
    for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
    return AVATAR_TONES[hash % AVATAR_TONES.length]
}

const initialsOf = (name: string) =>
    name.trim().split(/\s+/).slice(0, 2).map(word => word[0]?.toUpperCase() ?? '').join('')

const AVATAR_SIZES = {
    xs: 'w-5 h-5 text-[9px]',
    sm: 'w-6 h-6 text-[10px]',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm'
}

export function Avatar({ name, size = 'sm', title }: {
    name: string
    size?: keyof typeof AVATAR_SIZES
    title?: string
}) {
    return (
        <span
            title={title ?? name}
            aria-label={name}
            className={`${AVATAR_SIZES[size]} ${toneFor(name)} shrink-0 rounded-full
                text-white font-semibold grid place-content-center select-none`}
        >
            {initialsOf(name)}
        </span>
    )
}

/* ----------------------------------------------------------------- Badge */

const BADGE_VARIANTS = {
    neutral: 'bg-slate-100 text-slate-700',
    outline: 'bg-transparent border border-line-strong text-ink-muted',
    alert: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200'
}

export function Badge({ children, className, variant = 'neutral', dot, title }: {
    children: ReactNode
    className?: string
    variant?: keyof typeof BADGE_VARIANTS
    dot?: string
    /** Texto completo cuando la etiqueta va abreviada por falta de sitio. */
    title?: string
}) {
    return (
        <span title={title} className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5
            text-2xs font-semibold whitespace-nowrap ${className ?? BADGE_VARIANTS[variant]}`}>
            {dot && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: dot }} />}
            {children}
        </span>
    )
}

/* ---------------------------------------------------------------- Button */

const BUTTON_VARIANTS = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-card',
    secondary: 'bg-surface text-ink border border-line-strong hover:bg-surface-sunken',
    ghost: 'text-ink-muted hover:bg-slate-100 hover:text-ink',
    danger: 'text-red-600 hover:bg-red-50'
}

const BUTTON_SIZES = {
    sm: 'h-7 px-2.5 text-xs gap-1',
    md: 'h-9 px-3.5 text-sm gap-1.5',
    lg: 'h-10 px-4 text-base gap-2'
}

type ButtonProps = {
    children: ReactNode
    variant?: keyof typeof BUTTON_VARIANTS
    size?: keyof typeof BUTTON_SIZES
    className?: string
} & React.ButtonHTMLAttributes<HTMLButtonElement>

export function Button({
    children, variant = 'secondary', size = 'md', className = '', ...rest
}: ButtonProps) {
    return (
        <button
            {...rest}
            className={`inline-flex items-center justify-center rounded font-semibold
                transition-colors disabled:opacity-50 disabled:pointer-events-none
                ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${className}`}
        >
            {children}
        </button>
    )
}

/* ------------------------------------------------------------ PageHeader */

export function PageHeader({ title, subtitle, actions }: {
    title: string
    subtitle?: string
    actions?: ReactNode
}) {
    return (
        <header className="flex flex-wrap items-start justify-between gap-3 mb-5">
            <div className="min-w-0">
                <h1 className="text-2xl font-bold text-ink tracking-tight">{title}</h1>
                {subtitle && <p className="text-sm text-ink-muted mt-0.5">{subtitle}</p>}
            </div>
            {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </header>
    )
}

/* ------------------------------------------------------------ EmptyState */

export function EmptyState({ title, hint, action }: {
    title: string
    hint?: string
    action?: ReactNode
}) {
    return (
        <div className="text-center py-10 px-4">
            <p className="text-sm font-semibold text-ink-muted">{title}</p>
            {hint && <p className="text-xs text-ink-subtle mt-1 max-w-sm mx-auto">{hint}</p>}
            {action && <div className="mt-3">{action}</div>}
        </div>
    )
}

/* ----------------------------------------------------------------- Meter */

/** Barra de avance con su cifra al lado: el color nunca va solo. */
export function Meter({ value, max, tone = '#7c3aed', label }: {
    value: number
    max: number
    tone?: string
    label?: string
}) {
    const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
    return (
        <div className="flex items-center gap-2">
            <div
                className="h-1.5 flex-1 rounded-full bg-slate-200 overflow-hidden"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={label}
            >
                <div className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: tone }} />
            </div>
            <span className="text-2xs font-semibold text-ink-subtle tabular">{pct}%</span>
        </div>
    )
}

/* ------------------------------------------------------------- StatTile */

export function StatTile({ label, value, hint, tone }: {
    label: string
    value: string
    hint?: string
    tone?: string
}) {
    return (
        <div className="card p-3.5">
            <p className="eyebrow">{label}</p>
            <p className="text-2xl font-bold mt-1 tabular" style={tone ? { color: tone } : undefined}>
                {value}
            </p>
            {hint && <p className="text-2xs text-ink-subtle mt-1 leading-snug">{hint}</p>}
        </div>
    )
}
