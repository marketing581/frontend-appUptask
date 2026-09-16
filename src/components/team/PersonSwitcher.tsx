import { Avatar } from '@/components/ui'

/** Selector de persona, con cara.
 *
 *  Un desplegable obliga a abrirlo para saber a quién se está mirando; con
 *  tres personas caben todas a la vista y el cambio es un solo clic. La opción
 *  activa se marca con fondo y con `aria-pressed`, no solo con color. */

export type Person = { _id: string, name: string }

type Props = {
    members: Person[]
    value: string
    onChange: (value: string) => void
    currentUserId?: string
    /** Añade una opción que abarca a todo el equipo. */
    allOption?: string
    /** Cómo se llama una misma en la lista. */
    selfLabel?: string
    size?: 'sm' | 'md'
}

export default function PersonSwitcher({
    members, value, onChange, currentUserId, allOption, selfLabel = 'Yo', size = 'md'
}: Props) {
    if (members.length < 2) return null

    const height = size === 'sm' ? 'h-7' : 'h-8'
    const base = `${height} rounded text-xs font-semibold transition-colors flex items-center
        gap-1.5 whitespace-nowrap`

    const toneOf = (active: boolean) => active
        ? 'bg-surface text-ink shadow-card'
        : 'text-ink-muted hover:text-ink'

    return (
        <div
            role="group"
            aria-label="Ver el trabajo de"
            className="flex items-center gap-0.5 p-0.5 rounded-md bg-slate-100 w-fit"
        >
            {allOption && (
                <button
                    type="button"
                    onClick={() => onChange('all')}
                    aria-pressed={value === 'all'}
                    className={`${base} px-3 ${toneOf(value === 'all')}`}
                >
                    {allOption}
                </button>
            )}

            {members.map(member => {
                const active = value === member._id
                const isSelf = member._id === currentUserId
                return (
                    <button
                        key={member._id}
                        type="button"
                        onClick={() => onChange(member._id)}
                        aria-pressed={active}
                        className={`${base} pl-1 pr-2.5 ${toneOf(active)}`}
                    >
                        <Avatar name={member.name} size="xs" />
                        {isSelf ? selfLabel : member.name.split(' ')[0]}
                    </button>
                )
            })}
        </div>
    )
}
