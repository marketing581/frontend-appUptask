import { useEffect, useRef, useState } from 'react'
import {
    ArchiveBoxIcon, Bars3BottomLeftIcon, CheckCircleIcon,
    ListBulletIcon, LockClosedIcon, TrashIcon, UsersIcon
} from '@heroicons/react/24/outline'
import { Memo, MemoPriority } from '@/types'
import { applyFormat, renderMarkdown, toggleChecklistItem } from '@/utils/markdown'
import { Avatar, Button } from '@/components/ui'

/** Editor de una nota.
 *
 *  Se lee por defecto y se edita al pulsar «Editar»: la mayor parte del tiempo
 *  una nota se consulta, no se escribe. Las casillas sí se marcan sin entrar
 *  en edición, que es el gesto más frecuente en una lista de pendientes. */

const PRIORITIES: { key: MemoPriority, label: string }[] = [
    { key: 'none', label: 'Sin prioridad' },
    { key: 'low', label: 'Baja' },
    { key: 'medium', label: 'Media' },
    { key: 'high', label: 'Alta' }
]

const TOOLBAR = [
    { format: 'h1' as const, label: 'Título', icon: <span className="text-xs font-bold">H1</span> },
    { format: 'h2' as const, label: 'Subtítulo', icon: <span className="text-xs font-bold">H2</span> },
    { format: 'bold' as const, label: 'Negrita', icon: <span className="text-sm font-bold">B</span> },
    { format: 'bullet' as const, label: 'Lista', icon: <ListBulletIcon className="w-4 h-4" /> },
    { format: 'number' as const, label: 'Lista numerada', icon: <span className="text-xs font-bold">1.</span> },
    { format: 'check' as const, label: 'Checklist', icon: <CheckCircleIcon className="w-4 h-4" /> }
]

type Props = {
    memo: Memo
    canEdit: boolean
    canDelete: boolean
    isOwner: boolean
    saving: boolean
    onSave: (changes: Partial<Memo>) => void
    onDelete: () => void
    onClose: () => void
}

export default function MemoEditor({
    memo, canEdit, canDelete, isOwner, saving, onSave, onDelete, onClose
}: Props) {
    const textRef = useRef<HTMLTextAreaElement>(null)
    const [editing, setEditing] = useState(false)
    const [title, setTitle] = useState(memo.title)
    const [content, setContent] = useState(memo.content)

    useEffect(() => {
        setTitle(memo.title)
        setContent(memo.content)
        setEditing(false)
    }, [memo._id, memo.title, memo.content])

    const owner = typeof memo.owner === 'string' ? null : memo.owner

    const format = (kind: Parameters<typeof applyFormat>[3]) => {
        const area = textRef.current
        if (!area) return
        const result = applyFormat(content, area.selectionStart, area.selectionEnd, kind)
        setContent(result.value)
        requestAnimationFrame(() => {
            area.focus()
            area.setSelectionRange(result.cursor, result.cursor)
        })
    }

    /** Marcar una casilla se guarda al instante, sin entrar en edición. */
    const handlePreviewClick = (event: React.MouseEvent<HTMLDivElement>) => {
        const target = event.target as HTMLElement
        if (target.tagName !== 'INPUT' || !canEdit) return

        const boxes = Array.from(event.currentTarget.querySelectorAll('input[type="checkbox"]'))
        const index = boxes.indexOf(target as HTMLInputElement)
        if (index === -1) return

        const next = toggleChecklistItem(content, index)
        setContent(next)
        onSave({ content: next })
    }

    const save = () => {
        onSave({ title: title.trim() || 'Sin título', content })
        setEditing(false)
    }

    return (
        <div className="flex flex-col h-full">
            <header className="flex items-start gap-2 px-4 py-3 border-b border-line shrink-0">
                <div className="min-w-0 flex-1">
                    {editing ? (
                        <input
                            value={title}
                            onChange={event => setTitle(event.target.value)}
                            aria-label="Título de la nota"
                            className="w-full border-0 p-0 text-lg font-bold text-ink
                                focus:ring-0 placeholder:text-ink-subtle"
                            placeholder="Título de la nota"
                        />
                    ) : (
                        <h2 className="text-lg font-bold text-ink leading-tight">{memo.title}</h2>
                    )}

                    <div className="flex flex-wrap items-center gap-2 mt-1.5 text-2xs text-ink-subtle">
                        {owner && (
                            <span className="flex items-center gap-1">
                                <Avatar name={owner.name} size="xs" /> {owner.name}
                            </span>
                        )}
                        <span className="flex items-center gap-1">
                            {memo.visibility === 'private'
                                ? <><LockClosedIcon className="w-3 h-3" /> Personal</>
                                : <><UsersIcon className="w-3 h-3" /> Compartida</>}
                        </span>
                        {memo.updatedAt && (
                            <span>Editada {new Date(memo.updatedAt).toLocaleDateString('es-PE')}</span>
                        )}
                    </div>
                </div>

                <button
                    type="button"
                    onClick={onClose}
                    className="w-7 h-7 grid place-content-center rounded text-ink-subtle hover:bg-slate-100"
                    aria-label="Cerrar nota"
                >✕</button>
            </header>

            {editing && (
                <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-line shrink-0 overflow-x-auto">
                    {TOOLBAR.map(item => (
                        <button
                            key={item.format}
                            type="button"
                            onClick={() => format(item.format)}
                            title={item.label}
                            aria-label={item.label}
                            className="w-7 h-7 shrink-0 grid place-content-center rounded
                                text-ink-muted hover:bg-slate-100 hover:text-ink"
                        >
                            {item.icon}
                        </button>
                    ))}
                    <span className="ml-2 text-2xs text-ink-subtle whitespace-nowrap hidden sm:block">
                        Se escribe en Markdown
                    </span>
                </div>
            )}

            <div className="flex-1 overflow-y-auto">
                {editing ? (
                    <textarea
                        ref={textRef}
                        value={content}
                        onChange={event => setContent(event.target.value)}
                        aria-label="Contenido de la nota"
                        placeholder={'# Un título\n\n- [ ] Algo por hacer\n- [x] Algo ya hecho\n\nTexto con **negrita**.'}
                        className="w-full h-full min-h-[18rem] border-0 p-4 text-sm leading-relaxed
                            font-mono resize-none focus:ring-0 placeholder:text-ink-subtle"
                    />
                ) : (
                    <div
                        onClick={handlePreviewClick}
                        className="memo-body p-4"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
                    />
                )}
            </div>

            <footer className="flex flex-wrap items-center gap-2 px-3 py-2.5 border-t border-line shrink-0">
                {canEdit && (editing ? (
                    <>
                        <Button variant="primary" size="sm" onClick={save} disabled={saving}>
                            {saving ? 'Guardando…' : 'Guardar'}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => {
                            setTitle(memo.title)
                            setContent(memo.content)
                            setEditing(false)
                        }}>
                            Cancelar
                        </Button>
                    </>
                ) : (
                    <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                        <Bars3BottomLeftIcon className="w-4 h-4" /> Editar
                    </Button>
                ))}

                {canEdit && !editing && (
                    <>
                        <select
                            value={memo.priority}
                            onChange={event => onSave({ priority: event.target.value as MemoPriority })}
                            aria-label="Prioridad de la nota"
                            className="h-7 py-0 pl-2 pr-7 text-xs font-medium border-line-strong rounded text-ink-muted"
                        >
                            {PRIORITIES.map(item => (
                                <option key={item.key} value={item.key}>{item.label}</option>
                            ))}
                        </select>

                        {isOwner && (
                            <select
                                value={memo.visibility}
                                onChange={event => onSave({ visibility: event.target.value as Memo['visibility'] })}
                                aria-label="Con quién se comparte"
                                className="h-7 py-0 pl-2 pr-7 text-xs font-medium border-line-strong rounded text-ink-muted"
                            >
                                <option value="team">Compartida con el equipo</option>
                                <option value="private">Personal</option>
                            </select>
                        )}
                    </>
                )}

                {!editing && (
                    <div className="ml-auto flex items-center gap-1">
                        {canEdit && (
                            <button
                                type="button"
                                onClick={() => onSave({ archived: !memo.archived })}
                                title={memo.archived ? 'Devolver al tablero' : 'Archivar'}
                                aria-label={memo.archived ? 'Devolver al tablero' : 'Archivar'}
                                className="w-7 h-7 grid place-content-center rounded text-ink-subtle hover:bg-slate-100"
                            >
                                <ArchiveBoxIcon className="w-4 h-4" />
                            </button>
                        )}
                        {canDelete && (
                            <button
                                type="button"
                                onClick={onDelete}
                                title="Eliminar nota"
                                aria-label="Eliminar nota"
                                className="w-7 h-7 grid place-content-center rounded text-red-600 hover:bg-red-50"
                            >
                                <TrashIcon className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                )}
            </footer>
        </div>
    )
}
