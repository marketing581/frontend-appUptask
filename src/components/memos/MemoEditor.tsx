import { useEffect, useRef, useState } from 'react'
import {
    ArchiveBoxIcon, EyeIcon, EyeSlashIcon,
    LockClosedIcon, TrashIcon, UsersIcon
} from '@heroicons/react/24/outline'
import { Memo, MemoPriority } from '@/types'
import { Avatar, Button } from '@/components/ui'
import RichNoteEditor from './RichNoteEditor'

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
    const [confirmingDelete, setConfirmingDelete] = useState(false)
    const [savedAt, setSavedAt] = useState<number | null>(null)
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [title, setTitle] = useState(memo.title)
    const [content, setContent] = useState(memo.content)

    useEffect(() => {
        setTitle(memo.title)
        setContent(memo.content)
        setConfirmingDelete(false)
        setSavedAt(null)
    }, [memo._id])

    const owner = typeof memo.owner === 'string' ? null : memo.owner

    /** Marcar una casilla se guarda al instante, también fuera de edición: es
     *  el gesto más frecuente en una lista de pendientes.
     *
     *  Fuera de edición no se guarda nada más. El editor reformatea el texto al
     *  cargarlo, y guardar eso automáticamente reescribiría la nota sin que
     *  nadie la haya tocado.
     *
     *  La comparación se hace contra lo último que emitió el propio editor, no
     *  contra lo guardado: ambos textos vienen del mismo serializador y solo
     *  así se distingue una casilla marcada de un simple reformateo. */
    /** Guardado automático con una pausa: se escribe y se guarda solo, como en
     *  un bloc de notas. Evita el botón «Guardar» y, sobre todo, evita
     *  reglas frágiles para adivinar si un cambio fue intencionado. */
    const handleContentChange = (markdown: string) => {
        setContent(markdown)

        if (saveTimer.current) clearTimeout(saveTimer.current)
        saveTimer.current = setTimeout(() => {
            onSave({ content: markdown })
            setSavedAt(Date.now())
        }, 900)
    }

    const handleTitleChange = (next: string) => {
        setTitle(next)
        if (titleTimer.current) clearTimeout(titleTimer.current)
        titleTimer.current = setTimeout(() => {
            onSave({ title: next.trim() || 'Sin título' })
        }, 900)
    }

    // Al cerrar o cambiar de nota se guarda lo que quede pendiente.
    useEffect(() => () => {
        if (saveTimer.current) clearTimeout(saveTimer.current)
        if (titleTimer.current) clearTimeout(titleTimer.current)
    }, [])

    return (
        <div className="flex flex-col h-full">
            <header className="flex items-start gap-2 px-4 py-3 border-b border-line shrink-0">
                <div className="min-w-0 flex-1">
                    {canEdit ? (
                        <input
                            value={title}
                            onChange={event => handleTitleChange(event.target.value)}
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
                        <span>
                            {saving ? 'Guardando…'
                                : savedAt ? 'Guardado'
                                : memo.updatedAt
                                    ? `Editada ${new Date(memo.updatedAt).toLocaleDateString('es-PE')}`
                                    : ''}
                        </span>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={onClose}
                    className="w-7 h-7 grid place-content-center rounded text-ink-subtle hover:bg-slate-100"
                    aria-label="Cerrar nota"
                >✕</button>
            </header>

            <div className="flex-1 overflow-hidden">
                <RichNoteEditor
                    value={content}
                    onChange={handleContentChange}
                    editable={canEdit}
                    placeholder={'Escribe aquí. Prueba con [] y un espacio para una casilla.'}
                />
            </div>

            <footer className="flex flex-wrap items-center gap-2 px-3 py-2.5 border-t border-line shrink-0">
                {canEdit && (
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
                            <button
                                type="button"
                                onClick={() => onSave({
                                    visibility: memo.visibility === 'private' ? 'team' : 'private'
                                })}
                                title={memo.visibility === 'private'
                                    ? 'Mostrarla al equipo'
                                    : 'Ocultarla: solo tú la verás'}
                                className={`h-7 px-2.5 rounded text-xs font-semibold inline-flex
                                    items-center gap-1.5 transition-colors ${
                                    memo.visibility === 'private'
                                        ? 'bg-slate-200 text-slate-700 ring-1 ring-inset ring-slate-400'
                                        : 'text-ink-muted hover:bg-slate-100'
                                }`}
                            >
                                {memo.visibility === 'private'
                                    ? <><EyeSlashIcon className="w-4 h-4" /> Oculta — solo tú</>
                                    : <><EyeIcon className="w-4 h-4" /> Visible para el equipo</>}
                            </button>
                        )}
                    </>
                )}

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
                        {canDelete && (confirmingDelete ? (
                            <span className="flex items-center gap-1">
                                <span className="text-2xs text-ink-muted">¿Eliminar?</span>
                                <Button variant="danger" size="sm" onClick={onDelete}>Sí, eliminar</Button>
                                <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)}>
                                    No
                                </Button>
                            </span>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setConfirmingDelete(true)}
                                title="Eliminar nota"
                                aria-label="Eliminar nota"
                                className="h-7 px-2 rounded text-red-600 hover:bg-red-50
                                    inline-flex items-center gap-1 text-xs font-semibold"
                            >
                                <TrashIcon className="w-4 h-4" /> Eliminar
                            </button>
                        ))}
                    </div>
            </footer>
        </div>
    )
}
