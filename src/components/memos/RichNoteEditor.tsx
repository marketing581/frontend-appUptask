import { useEffect, useRef } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import { Markdown } from 'tiptap-markdown'
import { CheckCircleIcon, LinkIcon, ListBulletIcon, PhotoIcon } from '@heroicons/react/24/outline'

/** Editor visual de una nota.
 *
 *  Lo que se escribe se ve tal cual quedará: las casillas son casillas, no el
 *  texto `- [ ]`. Por debajo sigue guardándose Markdown, así que una nota se
 *  puede llevar a Notion o a cualquier otra herramienta sin perder nada. */

/** `tiptap-markdown` añade este almacenamiento en tiempo de ejecución, pero no
 *  lo declara en los tipos del editor. */
type MarkdownStorage = { markdown: { getMarkdown: () => string } }

type Props = {
    value: string
    onChange: (markdown: string) => void
    editable?: boolean
    placeholder?: string
}

const BUTTON = `w-7 h-7 shrink-0 grid place-content-center rounded text-ink-muted
    hover:bg-slate-100 hover:text-ink transition-colors`
const ACTIVE = 'bg-brand-50 text-brand-700 hover:bg-brand-50'

export default function RichNoteEditor({
    value, onChange, editable = true, placeholder
}: Props) {
    /** El editor emite `onUpdate` también al cargar y normalizar el contenido.
     *  Avisar de esos cambios haría que la nota se guardara re-serializada por
     *  el propio editor —y una serialización a medias borraría contenido—, así
     *  que solo se propaga lo que escribe una persona. */
    const ready = useRef(false)

    const editor = useEditor({
        editable,
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] }
            }),
            TaskList,
            // Las casillas se pueden marcar incluso en modo lectura: es el
            // gesto más frecuente en una lista de pendientes.
            TaskItem.configure({ nested: true, onReadOnlyChecked: () => true }),
            Link.configure({
                openOnClick: false,
                autolink: true,
                HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' }
            }),
            // Por URL, no por archivo subido: esta app todavía no tiene dónde
            // guardar imágenes propias, así que se enlaza una ya alojada en
            // otro lado (Drive, Canva, etc.), no se sube nada nuevo.
            Image.configure({ inline: false }),
            Placeholder.configure({
                placeholder: placeholder ?? 'Escribe aquí…'
            }),
            Markdown.configure({
                html: false,
                tightLists: true,
                bulletListMarker: '-',
                linkify: true,
                breaks: true
            })
        ],
        content: value,
        onCreate: () => { ready.current = true },
        onUpdate: ({ editor }) => {
            if (!ready.current) return
            onChange((editor.storage as unknown as MarkdownStorage).markdown.getMarkdown())
        },
        editorProps: {
            attributes: {
                class: 'memo-body focus:outline-none min-h-[16rem]'
            }
        }
    })

    // Al abrir otra nota hay que recargar el contenido del editor. Se apaga la
    // bandera durante el reemplazo para que no se tome por una edición.
    useEffect(() => {
        if (!editor) return
        const current = (editor.storage as unknown as MarkdownStorage).markdown.getMarkdown()
        if (current === value) return

        ready.current = false
        editor.commands.setContent(value, { emitUpdate: false })
        ready.current = true
    }, [value, editor])

    useEffect(() => {
        editor?.setEditable(editable)
    }, [editable, editor])

    if (!editor) return null

    const setLink = () => {
        const current = editor.getAttributes('link').href as string | undefined
        const url = window.prompt('Enlace (URL)', current ?? 'https://')
        if (url === null) return
        if (url.trim() === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run()
            return
        }
        editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
    }

    const addImage = () => {
        const url = window.prompt('URL de la imagen (ya alojada en algún lado, no se sube archivo)')
        if (!url || url.trim() === '') return
        editor.chain().focus().setImage({ src: url.trim() }).run()
    }

    return (
        <div className="flex flex-col h-full">
            {editable && (
                <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-line
                    shrink-0 overflow-x-auto">
                    <button
                        type="button" title="Título" aria-label="Título"
                        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                        className={`${BUTTON} ${editor.isActive('heading', { level: 1 }) ? ACTIVE : ''}`}
                    ><span className="text-xs font-bold">H1</span></button>

                    <button
                        type="button" title="Subtítulo" aria-label="Subtítulo"
                        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                        className={`${BUTTON} ${editor.isActive('heading', { level: 2 }) ? ACTIVE : ''}`}
                    ><span className="text-xs font-bold">H2</span></button>

                    <span className="w-px h-5 bg-line mx-1 shrink-0" />

                    <button
                        type="button" title="Negrita" aria-label="Negrita"
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        className={`${BUTTON} ${editor.isActive('bold') ? ACTIVE : ''}`}
                    ><span className="text-sm font-bold">B</span></button>

                    <button
                        type="button" title="Cursiva" aria-label="Cursiva"
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        className={`${BUTTON} ${editor.isActive('italic') ? ACTIVE : ''}`}
                    ><span className="text-sm italic font-serif">I</span></button>

                    <span className="w-px h-5 bg-line mx-1 shrink-0" />

                    <button
                        type="button" title="Lista con viñetas" aria-label="Lista con viñetas"
                        onClick={() => editor.chain().focus().toggleBulletList().run()}
                        className={`${BUTTON} ${editor.isActive('bulletList') ? ACTIVE : ''}`}
                    ><ListBulletIcon className="w-4 h-4" /></button>

                    <button
                        type="button" title="Lista numerada" aria-label="Lista numerada"
                        onClick={() => editor.chain().focus().toggleOrderedList().run()}
                        className={`${BUTTON} ${editor.isActive('orderedList') ? ACTIVE : ''}`}
                    ><span className="text-xs font-bold">1.</span></button>

                    <button
                        type="button" title="Lista de tareas" aria-label="Lista de tareas"
                        onClick={() => editor.chain().focus().toggleTaskList().run()}
                        className={`${BUTTON} ${editor.isActive('taskList') ? ACTIVE : ''}`}
                    ><CheckCircleIcon className="w-4 h-4" /></button>

                    <span className="w-px h-5 bg-line mx-1 shrink-0" />

                    <button
                        type="button" title="Enlace" aria-label="Enlace"
                        onClick={setLink}
                        className={`${BUTTON} ${editor.isActive('link') ? ACTIVE : ''}`}
                    ><LinkIcon className="w-4 h-4" /></button>

                    <button
                        type="button" title="Imagen (por URL)" aria-label="Imagen por URL"
                        onClick={addImage}
                        className={BUTTON}
                    ><PhotoIcon className="w-4 h-4" /></button>

                    <span className="ml-2 text-2xs text-ink-subtle whitespace-nowrap hidden sm:block">
                        Escribe <code className="font-mono">[]</code> y un espacio para una casilla
                    </span>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-4">
                <EditorContent editor={editor} />
            </div>
        </div>
    )
}
