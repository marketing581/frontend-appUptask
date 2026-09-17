import { useState } from 'react'
import { Brand } from '@/types'
import CreateBrandModal from './CreateBrandModal'

const NEW_BRAND = '__new__'

type Props = {
    brands: Brand[]
    brandId: string | null
    disabled?: boolean
    onSelect: (brandId: string | null) => void
}

/** De qué marca es un pendiente, con solo un color: nada de texto ni de
 *  etiqueta que compita por atención en la tarjeta. Es el mismo `<select>`
 *  disfrazado que ya resuelve el estado y el día —evita el recorte contra el
 *  `overflow-hidden` de la tarjeta y funciona igual con el dedo—, aquí
 *  reducido a un punto: el texto de la opción elegida se esconde (color
 *  transparente) y solo queda el círculo de fondo. */
export default function BrandDot({ brands, brandId, disabled, onSelect }: Props) {
    const [creating, setCreating] = useState(false)
    const active = brands.find(brand => brand._id === brandId)

    return (
        <>
            <select
                value={brandId ?? ''}
                disabled={disabled}
                onChange={event => {
                    const value = event.target.value
                    if (value === NEW_BRAND) { setCreating(true); return }
                    onSelect(value || null)
                }}
                title={active ? `Marca: ${active.name}` : 'Elegir marca'}
                aria-label={active ? `Marca: ${active.name}` : 'Elegir marca'}
                className="w-4 h-4 shrink-0 rounded-full border-0 p-0 appearance-none bg-none cursor-pointer
                    ring-1 ring-inset ring-black/10 focus:outline-none focus:ring-2 focus:ring-brand-400
                    disabled:cursor-not-allowed"
                style={{ backgroundColor: active?.color ?? '#e2e8f0', color: 'transparent' }}
            >
                <option value="" style={{ color: '#0f172a' }}>Sin marca</option>
                {brands.map(brand => (
                    <option key={brand._id} value={brand._id} style={{ color: '#0f172a' }}>
                        {brand.name}
                    </option>
                ))}
                <option value={NEW_BRAND} style={{ color: '#0f172a' }}>+ Nueva marca…</option>
            </select>

            <CreateBrandModal
                isOpen={creating}
                onClose={() => setCreating(false)}
                onCreated={brand => { onSelect(brand._id); setCreating(false) }}
            />
        </>
    )
}
