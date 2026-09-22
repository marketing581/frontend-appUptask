import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { ArrowUpTrayIcon, DocumentTextIcon } from '@heroicons/react/24/outline'
import { useAuth } from '@/hooks/useAuth'
import { getScheduleMembers } from '@/api/ScheduleAPI'
import { importNotionCsv } from '@/api/ImportAPI'
import { NotionImportResult } from '@/types'
import { Button, EmptyState, PageHeader } from '@/components/ui'

/** Autoservicio del import de Notion: antes solo se podía correr por
 *  terminal, ahora es un CSV pegado o subido y dos clics. Siempre entra en
 *  el equipo activo de quien lo hace, así que Marketing y Desarrollo usan
 *  exactamente el mismo módulo sin mezclarse entre sí. */

const STATUS_LABEL: Record<string, string> = {
    pending: 'Pendiente',
    inProgress: 'En proceso',
    done: 'Listo'
}

export default function ImportNotionView() {
    const { data: currentUser } = useAuth()
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [content, setContent] = useState('')
    const [fileName, setFileName] = useState('')
    const [assigneeId, setAssigneeId] = useState('')
    const [day, setDay] = useState('')
    const [preview, setPreview] = useState<NotionImportResult | null>(null)
    const [isPreviewing, setIsPreviewing] = useState(false)
    const [isImporting, setIsImporting] = useState(false)

    const { data: members } = useQuery({
        queryKey: ['scheduleMembers'],
        queryFn: getScheduleMembers,
        retry: false
    })

    const onFile = async (file: File | undefined) => {
        if (!file) return
        setFileName(file.name)
        setContent(await file.text())
        setPreview(null)
    }

    const runImport = async (dryRun: boolean) => {
        if (!content.trim()) return toast.error('Pega o sube un CSV primero')
        if (!assigneeId) return toast.error('Elige a quién le pertenecen estos pendientes')

        dryRun ? setIsPreviewing(true) : setIsImporting(true)
        try {
            const result = await importNotionCsv({ content, assigneeId, day: day.trim() || undefined, dryRun })
            if (!result) return
            setPreview(result)
            if (!dryRun) {
                toast.success(`${result.created} pendientes creados, ${result.updated} actualizados`)
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudo importar el CSV')
        } finally {
            setIsPreviewing(false)
            setIsImporting(false)
        }
    }

    if (currentUser && currentUser.role !== 'manager') {
        return (
            <>
                <PageHeader title="Importar de Notion" subtitle="Solo la encargada del equipo" />
                <EmptyState title="No tienes acceso a esta sección" />
            </>
        )
    }

    return (
        <>
            <PageHeader
                title="Importar de Notion"
                subtitle="Pega el CSV exportado y crea los pendientes de un tirón, sin pasar por terminal"
            />

            <div className="card p-4 flex flex-col gap-4 max-w-2xl">
                <div>
                    <label className="text-sm font-semibold text-ink mb-1.5 block">
                        CSV exportado de Notion
                    </label>
                    <div className="flex items-center gap-2 mb-2">
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <ArrowUpTrayIcon className="w-4 h-4" /> Subir archivo
                        </Button>
                        {fileName && (
                            <span className="text-xs text-ink-subtle flex items-center gap-1">
                                <DocumentTextIcon className="w-4 h-4" /> {fileName}
                            </span>
                        )}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv,text/csv"
                            className="hidden"
                            onChange={event => onFile(event.target.files?.[0])}
                        />
                    </div>
                    <textarea
                        value={content}
                        onChange={event => { setContent(event.target.value); setFileName(''); setPreview(null) }}
                        placeholder="…o pega aquí el contenido del CSV"
                        rows={6}
                        className="w-full rounded-lg border border-line px-3 py-2 text-xs font-mono
                            focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm font-semibold text-ink mb-1.5 block">
                            Responsable
                        </label>
                        <select
                            value={assigneeId}
                            onChange={event => { setAssigneeId(event.target.value); setPreview(null) }}
                            className="w-full h-9 rounded-lg border border-line px-2.5 text-sm bg-surface
                                focus:outline-none focus:ring-1 focus:ring-brand-500"
                        >
                            <option value="">Elige…</option>
                            {members?.map(member => (
                                <option key={member._id} value={member._id}>
                                    {member._id === currentUser?._id ? `${member.name} (yo)` : member.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-sm font-semibold text-ink mb-1.5 block">
                            Columna "Día" a importar <span className="text-ink-subtle font-normal">(opcional)</span>
                        </label>
                        <input
                            value={day}
                            onChange={event => { setDay(event.target.value); setPreview(null) }}
                            placeholder="Vacío = todas las filas con Tarea"
                            className="w-full h-9 rounded-lg border border-line px-2.5 text-sm
                                focus:outline-none focus:ring-1 focus:ring-brand-500"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => runImport(true)}
                        disabled={isPreviewing || isImporting}
                    >
                        {isPreviewing ? 'Revisando…' : 'Vista previa'}
                    </Button>
                    <Button
                        type="button"
                        variant="primary"
                        onClick={() => runImport(false)}
                        disabled={!preview || isPreviewing || isImporting}
                    >
                        {isImporting ? 'Importando…' : 'Confirmar importación'}
                    </Button>
                </div>

                {preview && (
                    <div className="border-t border-line pt-3">
                        <p className="text-sm text-ink-muted mb-2">
                            <span className="font-semibold text-ink">{preview.total}</span> pendientes en total —{' '}
                            <span className="font-semibold text-ink">{preview.created}</span> nuevos,{' '}
                            <span className="font-semibold text-ink">{preview.updated}</span> ya existían
                        </p>
                        {preview.preview.length > 0 && (
                            <ul className="divide-y divide-line max-h-64 overflow-y-auto rounded-lg border border-line">
                                {preview.preview.map((row, index) => (
                                    <li key={index} className="px-3 py-1.5 text-xs flex items-center justify-between gap-2">
                                        <span className="text-ink truncate">{row.name}</span>
                                        <span className="text-ink-subtle shrink-0">
                                            {STATUS_LABEL[row.status]}{row.onHold ? ' · En espera' : ''}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {preview.total > preview.preview.length && (
                            <p className="text-2xs text-ink-subtle mt-1">
                                Mostrando los primeros {preview.preview.length} de {preview.total}.
                            </p>
                        )}
                    </div>
                )}
            </div>
        </>
    )
}
