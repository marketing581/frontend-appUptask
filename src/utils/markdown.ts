import { marked } from 'marked'
import DOMPurify from 'dompurify'

/** Notas en Markdown: títulos, negritas, listas y checklists.
 *
 *  El contenido lo escriben personas del equipo, pero igualmente se sanea
 *  antes de pintarlo: si alguna vez se pega texto copiado de fuera, no debe
 *  poder ejecutar nada en la página. */

marked.setOptions({ breaks: true, gfm: true })

/** Etiquetas permitidas. Nada de scripts, iframes ni formularios. */
const ALLOWED_TAGS = [
    'h1', 'h2', 'h3', 'h4', 'p', 'br', 'hr',
    'strong', 'em', 'del', 'code', 'pre', 'blockquote',
    'ul', 'ol', 'li', 'input',
    'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td'
]

export function renderMarkdown(source: string): string {
    const html = marked.parse(source ?? '', { async: false }) as string
    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS,
        // Sin `disabled`: marked deshabilita las casillas por defecto y así no
        // emitirían clics, que es justo como se marcan los pendientes.
        ALLOWED_ATTR: ['href', 'title', 'type', 'checked', 'class'],
        // Los enlaces externos nunca deben poder manipular la pestaña de origen.
        ADD_ATTR: ['target', 'rel']
    })
}

/** Texto plano para la vista previa de la tarjeta, sin marcas de Markdown. */
export function plainPreview(source: string, max = 180): string {
    const text = (source ?? '')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/^\s*[-*+]\s+\[[ xX]\]\s*/gm, '')
        .replace(/^\s*[-*+]\s+/gm, '')
        // Imagen: sin alt no aporta nada al texto, se quita entera.
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, (_match, alt) => alt || '')
        // Enlace: queda el texto visible, se pierde la URL.
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/[*_`>]/g, '')
        // Una imagen sin alt deja su línea vacía; se descarta en vez de
        // contarla como un salto de párrafo más.
        .replace(/^[ \t]*\n/gm, '')
        .replace(/\n{2,}/g, '\n')
        .trim()

    return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text
}

/** Cuántas casillas hay y cuántas están marcadas, para el avance de la nota. */
export function checklistProgress(source: string) {
    const items = (source ?? '').match(/^\s*[-*+]\s+\[[ xX]\]/gm) ?? []
    const done = items.filter(item => /\[[xX]\]/.test(item)).length
    return { total: items.length, done }
}

/** Marca o desmarca la casilla número `index` (contando desde 0) en el
 *  Markdown original, para que el clic en la nota se guarde de verdad. */
export function toggleChecklistItem(source: string, index: number): string {
    let seen = -1
    return (source ?? '').replace(/^(\s*[-*+]\s+)\[([ xX])\]/gm, (match, prefix, state) => {
        seen++
        if (seen !== index) return match
        return `${prefix}[${state.toLowerCase() === 'x' ? ' ' : 'x'}]`
    })
}

/** Inserta formato en la posición del cursor del área de texto. */
export function applyFormat(
    value: string,
    selectionStart: number,
    selectionEnd: number,
    format: 'bold' | 'h1' | 'h2' | 'bullet' | 'check' | 'number'
): { value: string, cursor: number } {
    const selected = value.slice(selectionStart, selectionEnd)

    if (format === 'bold') {
        const text = selected || 'texto'
        const next = `${value.slice(0, selectionStart)}**${text}**${value.slice(selectionEnd)}`
        return { value: next, cursor: selectionStart + 2 + text.length }
    }

    // El resto son prefijos de línea: se aplican a cada línea seleccionada.
    const prefixes = { h1: '# ', h2: '## ', bullet: '- ', check: '- [ ] ', number: '1. ' }
    const prefix = prefixes[format]

    const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1
    const lineEndIndex = value.indexOf('\n', selectionEnd)
    const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex

    const block = value.slice(lineStart, lineEnd)
    const updated = block
        .split('\n')
        .map(line => (line.startsWith(prefix) ? line.slice(prefix.length) : prefix + line))
        .join('\n')

    const next = value.slice(0, lineStart) + updated + value.slice(lineEnd)
    return { value: next, cursor: lineStart + updated.length }
}
