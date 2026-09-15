import { useDroppable } from '@dnd-kit/core'

type DropTaskProps = {
    status: string
}

export default function DropTask({ status }: DropTaskProps) {
    const { isOver, setNodeRef } = useDroppable({ id: status })

    return (
        <div
            ref={setNodeRef}
            className={`h-9 rounded-md border border-dashed grid place-content-center
                text-2xs font-semibold uppercase tracking-wide transition-colors ${
                isOver
                    ? 'border-brand-400 bg-brand-50 text-brand-600'
                    : 'border-line-strong text-ink-subtle'
            }`}
        >
            Soltar aquí
        </div>
    )
}
