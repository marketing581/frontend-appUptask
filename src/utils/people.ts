/** Referencias a personas dentro de los datos del calendario.
 *
 *  Un mismo campo llega unas veces como identificador y otras ya poblado con
 *  el nombre, según la consulta. Estas dos funciones evitan repetir la
 *  comprobación en cada componente. */

type PersonRef = { _id: string, name?: string } | string | null | undefined

export const personId = (person: PersonRef): string =>
    !person ? '' : typeof person === 'string' ? person : person._id

export const personName = (person: PersonRef): string =>
    !person || typeof person === 'string' ? '' : person.name ?? ''

/** Nombre de pila, que es como se llaman entre ellas. */
export const firstNameOf = (person: PersonRef): string =>
    personName(person).split(' ')[0] ?? ''
