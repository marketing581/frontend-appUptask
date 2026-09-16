import { RefObject, useEffect } from 'react'

/** Avisa cuando se hace clic fuera del elemento.
 *
 *  Se escucha en `mousedown` y no en `click`: si el clic cae sobre un botón
 *  que va a desaparecer, el `click` nunca llega a completarse y el aviso se
 *  perdería. También se atiende `focusin`, para que tabular fuera cierre igual
 *  que hacerlo con el ratón: quien navega con teclado espera lo mismo. */
export function useClickOutside<T extends HTMLElement>(
    ref: RefObject<T>,
    onOutside: () => void,
    active = true
) {
    useEffect(() => {
        if (!active) return

        const handler = (event: Event) => {
            const target = event.target as Node | null
            if (!target || !ref.current) return
            // Un nodo que ya salió del documento —una opción de `select` que se
            // cierra, por ejemplo— no está «fuera»: está en ningún sitio.
            if (!target.isConnected) return
            if (ref.current.contains(target)) return
            onOutside()
        }

        document.addEventListener('mousedown', handler)
        document.addEventListener('focusin', handler)
        return () => {
            document.removeEventListener('mousedown', handler)
            document.removeEventListener('focusin', handler)
        }
    }, [ref, onOutside, active])
}
