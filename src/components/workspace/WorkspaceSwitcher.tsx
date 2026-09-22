import { useState } from 'react'
import { PlusIcon } from '@heroicons/react/24/outline'
import { Workspace } from '@/types'

/** Selector de equipo, solo para la cuenta administradora: mismo patrón de
 *  pastillas que `PersonSwitcher`, pero de equipos, no de personas — y con
 *  un alta rápida al final para crear el próximo sin salir de aquí. */

type Props = {
    workspaces: Workspace[]
    value: string
    onChange: (workspaceId: string) => void
    onCreate: (name: string) => Promise<void>
}

export default function WorkspaceSwitcher({ workspaces, value, onChange, onCreate }: Props) {
    const [adding, setAdding] = useState(false)
    const [name, setName] = useState('')
    const [saving, setSaving] = useState(false)

    const submit = async () => {
        const trimmed = name.trim()
        if (!trimmed || saving) return
        setSaving(true)
        try {
            await onCreate(trimmed)
            setName('')
            setAdding(false)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div
            role="group"
            aria-label="Cambiar de equipo"
            className="flex items-center gap-0.5 p-0.5 rounded-md bg-slate-100 flex-wrap"
        >
            {workspaces.map(workspace => {
                const active = value === workspace._id
                return (
                    <button
                        key={workspace._id}
                        type="button"
                        onClick={() => onChange(workspace._id)}
                        aria-pressed={active}
                        className={`h-7 px-2.5 rounded text-xs font-semibold transition-colors whitespace-nowrap ${
                            active ? 'bg-surface text-ink shadow-card' : 'text-ink-muted hover:text-ink'
                        }`}
                    >
                        {workspace.name}
                    </button>
                )
            })}

            {adding ? (
                <input
                    autoFocus
                    value={name}
                    onChange={event => setName(event.target.value)}
                    onKeyDown={event => {
                        if (event.key === 'Enter') submit()
                        if (event.key === 'Escape') { setAdding(false); setName('') }
                    }}
                    onBlur={() => { if (!name.trim()) setAdding(false) }}
                    placeholder="Nombre del equipo"
                    disabled={saving}
                    className="h-7 px-2 rounded text-xs bg-surface border border-line
                        focus:outline-none focus:ring-1 focus:ring-brand-500 w-36"
                />
            ) : (
                <button
                    type="button"
                    onClick={() => setAdding(true)}
                    title="Crear un equipo nuevo"
                    aria-label="Crear un equipo nuevo"
                    className="w-7 h-7 grid place-content-center rounded text-ink-muted hover:bg-surface hover:text-ink"
                >
                    <PlusIcon className="w-3.5 h-3.5" />
                </button>
            )}
        </div>
    )
}
