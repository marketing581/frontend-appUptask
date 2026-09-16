import { Fragment, useMemo, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { LockClosedIcon, PlusIcon, UsersIcon } from '@heroicons/react/24/outline'
import { createMemo, deleteMemo, getMemos, updateMemo } from '@/api/MemoAPI'
import { getScheduleMembers } from '@/api/ScheduleAPI'
import { useAuth } from '@/hooks/useAuth'
import { Memo, MemoPriority } from '@/types'
import { checklistProgress, plainPreview } from '@/utils/markdown'
import { Avatar, Badge, Button, EmptyState, PageHeader } from '@/components/ui'
import MemoEditor from '@/components/memos/MemoEditor'

/** Bloc de notas del equipo: listas de pendientes, prompts, datos de
 *  facturación, acuerdos de reunión. Cada nota es personal o compartida. */

const FILTERS = [
    { key: 'all' as const, label: 'Todas' },
    { key: 'shared' as const, label: 'Compartidas' },
    { key: 'private' as const, label: 'Ocultas' },
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
    const [personFilter, setPersonFilter] = useState<string>('all')
    const [openId, setOpenId] = useState<string | null>(null)

    const showingArchived = filter === 'archived'

    const { data: memos, isLoading } = useQuery({
        queryKey: ['memos', showingArchived],
        queryFn: () => getMemos(showingArchived),
        retry: false
    })

    const { data: members } = useQuery({
        queryKey: ['scheduleMembers'],
        queryFn: getScheduleMembers,
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
            if (personFilter !== 'all' && ownerIdOf(memo) !== personFilter) return false
            if (filter === 'shared') return memo.visibility === 'team'
            if (filter === 'private') return memo.visibility === 'private'
            return true
        })

        if (filter === 'priority') {
            return [...list].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])
        }
        return list
    }, [memos, filter, personFilter, currentUser])

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

            <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-slate-100 w-fit">
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

            {/* Filtro por autora: cada una ve de un vistazo qué es suyo y qué
                del resto, sin tener que abrir nota por nota. */}
            {members && members.length > 1 && (
                <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-slate-100 w-fit">
                    <button
                        type="button"
                        onClick={() => setPersonFilter('all')}
                        aria-pressed={personFilter === 'all'}
                        className={`h-7 px-3 rounded text-xs font-semibold transition-colors ${
                            personFilter === 'all'
                                ? 'bg-surface text-ink shadow-card'
                                : 'text-ink-muted hover:text-ink'
                        }`}
                    >
                        Todo el equipo
                    </button>
                    {members.map(member => {
                        const active = personFilter === member._id
                        const isSelf = member._id === currentUser?._id
                        return (
                            <button
                                key={member._id}
                                type="button"
                                onClick={() => setPersonFilter(member._id)}
                                aria-pressed={active}
                                className={`h-7 pl-1 pr-2.5 rounded flex items-center gap-1.5 text-xs
                                    font-semibold transition-colors ${
                                    active ? 'bg-surface text-ink shadow-card' : 'text-ink-muted hover:text-ink'
                                }`}
                            >
                                <Avatar name={member.name} size="xs" />
                                {isSelf ? 'Mías' : member.name.split(' ')[0]}
                            </button>
                        )
                    })}
                </div>
            )}
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
                                            <span className="shrink-0 inline-flex items-center gap-1 text-2xs
                                                font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                                                <LockClosedIcon className="w-3 h-3" /> Solo tú
                                            </span>
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

            {/* La nota se abre como una ventana propia, no pegada al costado:
                así queda igual de enfocada estando dos notas o veinte tarjetas
                detrás. En el teléfono, sin margen alrededor: ahí una nota
                ocupa la pantalla entera, como el resto de la app en ese
                tamaño. */}
            <Transition appear show={!!open} as={Fragment}>
                <Dialog as="div" className="relative z-40" onClose={() => setOpenId(null)}>
                    <Transition.Child
                        as={Fragment}
                        enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100"
                        leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0"
                    >
                        <div className="fixed inset-0 bg-ink/40" />
                    </Transition.Child>

                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center sm:p-4">
                            <Transition.Child
                                as={Fragment}
                                enter="ease-out duration-200"
                                enterFrom="opacity-0 scale-95 sm:scale-100 sm:translate-y-2"
                                enterTo="opacity-100 scale-100 sm:translate-y-0"
                                leave="ease-in duration-150"
                                leaveFrom="opacity-100 scale-100 sm:translate-y-0"
                                leaveTo="opacity-0 scale-95 sm:scale-100 sm:translate-y-2"
                            >
                                <Dialog.Panel className="w-full h-full sm:h-[85vh] sm:max-w-2xl
                                    sm:rounded-xl bg-surface shadow-overlay overflow-hidden">
                                    {open && (
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
                                    )}
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition>
        </>
    )
}
