/**
 * Textos legales POR DEFECTO de cada catálogo (privacidad y términos), generados con los datos del negocio.
 * Genéricos a propósito: no citan leyes ni artículos. Si falta un dato (RIF, dirección, teléfono, correo) se omite la frase.
 */

export const LEGAL_DOCS = ['privacidad', 'terminos'] as const
export type LegalDoc = (typeof LEGAL_DOCS)[number]

export const isLegalDoc = (v: string): v is LegalDoc => (LEGAL_DOCS as readonly string[]).includes(v)

export interface LegalBusiness {
  name:       string
  legal_name: string | null
  rif:        string | null
  address:    string | null
  city:       string | null
  state:      string | null
  phone:      string | null
  email:      string | null
}

export interface LegalSection { heading: string; paragraphs: string[] }
export interface LegalContent { title: string; intro: string; sections: LegalSection[] }

const clean = (v: string | null | undefined): string => (v ?? '').trim()

/** "Razón social, RIF J-123, Dirección, Ciudad, Estado" con solo las piezas que existen. */
function identity(b: LegalBusiness): string {
  const place = [clean(b.address), clean(b.city), clean(b.state)].filter(Boolean).join(', ')
  const parts = [clean(b.legal_name) || clean(b.name), clean(b.rif) ? `RIF ${clean(b.rif)}` : '', place].filter(Boolean)
  return parts.join(', ')
}

/** Cómo escribirle a la tienda: WhatsApp y/o correo, o la indicación genérica si no hay ninguno. */
function contact(b: LegalBusiness): string {
  const ways = [clean(b.phone) ? `por WhatsApp al ${clean(b.phone)}` : '', clean(b.email) ? `al correo ${clean(b.email)}` : ''].filter(Boolean)
  return ways.length ? `escríbenos ${ways.join(' o ')}` : 'contáctanos directamente en la tienda'
}

function privacidad(b: LegalBusiness): LegalContent {
  return {
    title: 'Política de privacidad',
    intro: `Esta página explica cómo ${b.name} cuida los datos que compartes al hacer un pedido en este catálogo.`,
    sections: [
      { heading: 'Quiénes somos', paragraphs: [`Este catálogo es de ${identity(b)}.`] },
      {
        heading:    'Qué datos pedimos',
        paragraphs: ['Al hacer un pedido te pedimos tu nombre, cédula, teléfono y, si necesitas entrega, tu dirección. Solo pedimos lo necesario para atender tu compra.'],
      },
      {
        heading:    'Para qué los usamos',
        paragraphs: ['Usamos tus datos para procesar y entregar tu pedido y para comunicarnos contigo sobre él. No los usamos para otra cosa.'],
      },
      {
        heading:    'Con quién los compartimos',
        paragraphs: [
          'No vendemos tus datos ni los entregamos a terceros.',
          'Los pedidos se registran en ActivoPOS.com, el sistema de gestión que usa esta tienda.',
        ],
      },
      {
        heading:    'Corregir o eliminar tus datos',
        paragraphs: [`Si quieres corregir o eliminar tus datos, ${contact(b)} y dinos qué necesitas.`],
      },
    ],
  }
}

function terminos(b: LegalBusiness): LegalContent {
  const phone = clean(b.phone)
  return {
    title: 'Términos y condiciones',
    intro: `Al usar este catálogo y hacer un pedido aceptas estas condiciones de ${b.name}.`,
    sections: [
      { heading: 'Quiénes somos', paragraphs: [`Este catálogo es de ${identity(b)}.`] },
      {
        heading:    'Precios',
        paragraphs: ['Los precios se muestran en dólares (USD) y en bolívares (Bs) a la tasa BCV del día. El monto en Bs puede cambiar si cambia la tasa.'],
      },
      {
        heading:    'Disponibilidad',
        paragraphs: ['La disponibilidad de los productos está sujeta al stock de la tienda.'],
      },
      {
        heading:    'Pedidos',
        paragraphs: ['Tu pedido se envía a la tienda, que lo confirma contigo y coordina el pago y la entrega.'],
      },
      {
        heading:    'Cambios y devoluciones',
        paragraphs: [`Se manejan según la política de la tienda: consulta por WhatsApp${phone ? ` al ${phone}` : ''}.`],
      },
      { heading: 'Privacidad', paragraphs: ['Cómo tratamos tus datos está en la política de privacidad de este catálogo.'] },
    ],
  }
}

export function legalContent(doc: LegalDoc, b: LegalBusiness): LegalContent {
  return doc === 'privacidad' ? privacidad(b) : terminos(b)
}
