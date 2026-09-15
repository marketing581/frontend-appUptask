import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { LockClosedIcon, PlusIcon, UsersIcon } from '@heroicons/react/24/outline'
import { createMemo, deleteMemo, getMemos, updateMemo } from '@/api/MemoAPI'
import { useAuth } from '@/hooks/useAuth'
import { Memo, MemoPriority } from '@/types'
import { checklistProgress, plainPreview } from '@/utils/markdown'
import { Avatar, Badge, Button, EmptyState, PageHeader } from '@/components/ui'
import MemoEditor from '@/components/memos/MemoEditor'

/** Bloc de notas del equipo: listas de pendientes, prompts, datos de
 *  facturación, acuerdos de reunión. Cada nota es personal o compartida. */

const FILTERS = [
    { key: 'all' as const, label: 'Todas' },
    { key: 'mine' as const, label: 'Mías' },
    { key: 'shared' as const, label: 'Compartidas' },
    { key: 'priority' as const, label: 'Por prioridad' },
    { key: 'archived' as const, label: 'Archivadas' }
]

const PRIORITY_RANK: Record<MemoPriority, number> = { high: 0, medium: 1, low: 2, none: 3 }

const PRIORITY_BADGE: Record<MemoPriority, string> = {
    high: 'bg-orange-100 text-orange-800',
    medium: 'bg-sky-100 text-sky-800',
    low: 'bg-slate-100 text-slate-600',
    none: ''
}

const PRIORITY_LABEL: Record<MemoPriority, string> = {
    high: 'Alta', medium: 'Media', low: 'Baja', none: ''
}

export default function MemosView() {
    const { data: currentUser } = useAuth()
    const queryClient = useQueryClient()
    const [filter, setFilter] = useState<typeof FILTERS[number]['key']>('all')
    const [openId, setOpenId] = useState<string | null>(null)

    const showingArchived = filter === 'archived'

    const { data: memos, isLoading } = useQuery({
        queryKey: ['memos', showingArchived],
        queryFn: () => getMemos(showingArchived),
        retry: false
    })

    const refresh = () => queryClient.invalidateQueries({ queryKey: ['memos'] })

    const { mutate: create, isPending: creating } = useMutation({
        mutationFn: createMemo,
        onError: (error: Error) => toast.error(error.message),
        onSuccess: memo => { refresh(); setOpenId(memo._id) }
    })

    const { mutate: save, isPending: saving } = useMutation({
        mutationFn: updateMemo,
        onError: (error: Error) => toast.error(error.message),
        onSuccess: () => refresh()
    })

    const { mutate: remove } = useMutation({
        mutationFn: deleteMemo,
        onError: (error: Error) => toast.error(error.message),
        onSuccess: () => { toast.success('Nota eliminada'); setOpenId(null); refresh() }
    })

    const ownerIdOf = (memo: Memo) =>
        typeof memo.owner === 'string' ? memo.owner : memo.owner._id

    const visible = useMemo(() => {
        const list = (memos ?? []).filter(memo => {
            if (filter === 'mine') return ownerIdOf(memo) === currentUser?._id
            if (filter === 'shared') return memo.visibility === 'team'
            return true
        })

        if (filter === 'priority') {
            return [...list].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])
        }
        return list
    }, [memos, filter, currentUser])

    const open = (memos ?? []).find(memo => memo._id === openId) ?? null

    return (
        <>
            <PageHeader
                title="Notas"
                subtitle="Listas, prompts, datos y acuerdos. Personales o compartidas con el equipo."
                actions={
                    <Button
                        variant="primary"
                        disabled={creating}
                        onClick={() => create({ title: 'Nota sin título', content: '' })}
                    >
                        <PlusIcon className="w-4 h-4" /> Nueva nota
                    </Button>
                }
            />

            <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-slate-100 w-fit mb-4">
                {FILTERS.map(item => (
                    <button
                        key={item.key}
                        type="button"
                        onClick={() => setFilter(item.key)}
                        aria-pressed={filter === item.key}
                        className={`h-7 px-3 rounded text-xs font-semibold transition-colors ${
                            filter === item.key
                                ? 'bg-surface text-ink shadow-card'
                                : 'text-ink-muted hover:text-ink'
                        }`}
                    >
                        {item.label}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <p className="text-center py-16 text-sm text-ink-muted">Cargando notas…</p>
            ) : visible.length === 0 ? (
                <div className="card">
                    <EmptyState
                        title={showingArchived ? 'No hay notas archivadas' : 'Todavía no hay notas'}
                        hint={showingArchived
                            ? undefined
                            : 'Una nota sirve para lo que se consulta: una lista de pendientes, un prompt que funciona, los RUC de las cuentas.'}
                    />
                </div>
            ) : (
                <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
                    {visible.map(memo => {
                        const owner = typeof memo.owner === 'string' ? null : memo.owner
                        const progress = checklistProgress(memo.content)
                        const preview = plainPreview(memo.content)

                        return (
                            <li key={memo._id}>
                                <button
                                    type="button"
                                    onClick={() => setOpenId(memo._id)}
                                    className="card w-full text-left p-3 h-full flex flex-col gap-2
                                        hover:shadow-raised transition-shadow"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <h3 className="text-sm font-bold text-ink leading-snug">{memo.title}</h3>
                                        {memo.visibility === 'private' && (
                                            <LockClosedIcon className="w-3.5 h-3.5 text-ink-subtle shrink-0 mt-0.5" />
                                        )}
                                    </div>

                                    {preview ? (
                                        <p className="text-xs text-ink-muted leading-relaxed whitespace-pre-line
                                            line-clamp-5 flex-1">
                                            {preview}
                                        </p>
                                    ) : (
                                        <p className="text-xs text-ink-subtle italic flex-1">Nota vacía</p>
                                    )}

                                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                        {progress.total > 0 && (
                                            <Badge className={progress.done === progress.total
                                                ? 'bg-emerald-100 text-emerald-800'
                                                : 'bg-slate-100 text-slate-600'}>
                                                {progress.done}/{progress.total}
                                            </Badge>
                                        )}
                                        {memo.priority !== 'none' && (
                                            <Badge className={PRIORITY_BADGE[memo.priority]}>
                                                {PRIORITY_LABEL[memo.priority]}
                                            </Badge>
                                        )}
                                        {memo.visibility === 'team' && (
                                            <span title="Compartida con el equipo">
                                                <UsersIcon className="w-3.5 h-3.5 text-ink-subtle" />
                                            </span>
                                        )}
                                        {owner && (
                                            <span className="ml-auto"><Avatar name={owner.name} size="xs" /></span>
                                        )}
                                    </div>
                                </button>
                            </li>
                        )
                    })}
                </ul>
            )}

            {/* Panel lateral: la nota se lee junto al tablero, sin perder el contexto */}
            {open && (
                <div className="fixed inset-0 z-40 flex">
                    <div
                        className="flex-1 bg-ink/30"
                        onClick={() => setOpenId(null)}
                        aria-hidden
                    />
                    <aside className="w-full max-w-xl bg-surface shadow-overlay border-l border-line">
                        <MemoEditor
                            memo={open}
                            canEdit={ownerIdOf(open) === currentUser?._id || open.visibility === 'team'}
                            canDelete={ownerIdOf(open) === currentUser?._id || currentUser?.role === 'manager'}
                            isOwner={ownerIdOf(open) === currentUser?._id}
                            saving={saving}
                            onSave={changes => save({ memoId: open._id, changes: changes as never })}
                            onDelete={() => remove(open._id)}
                            onClose={() => setOpenId(null)}
                        />
                    </aside>
                </div>
            )}
        </>
    )
}
