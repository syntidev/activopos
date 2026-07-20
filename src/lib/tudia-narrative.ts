import { unstable_cache } from 'next/cache'
import { callBlogLlm } from '@/lib/blog/llm'

/**
 * Narrativa de "Tu Día". El texto lo redacta el LLM (NVIDIA NIM, mismo modelo
 * que el blog); buildNarrative() queda como fallback por reglas.
 *
 * Tres decisiones que no son cosméticas:
 *
 * 1. Devuelve Paragraph[] y no string — la página aplica 3 clases CSS distintas
 *    según `style` y separa el cierre. Con un string plano el camino con IA y el
 *    fallback se verían distintos; así hay un solo render para ambos.
 * 2. unstable_cache por (negocio, día, bloque de 2 h): la página es un Server
 *    Component dinámico, así que sin cache CADA visita dispararía una llamada
 *    facturada para el mismo texto. Con 12 bloques al día, el gasto por negocio
 *    queda acotado a 12 llamadas diarias en el peor caso. Contrapartida
 *    aceptada: si vendes algo a mitad de bloque, el texto no se reescribe hasta
 *    el siguiente — la página no muestra las cifras aparte, solo la narrativa.
 * 3. Timeout duro: un fetch colgado bloquea el render del Server Component
 *    entero. Se aborta y se cae al fallback — la página nunca se rompe por IA.
 */

const LLM_TIMEOUT_MS = 6_000
const CACHE_TTL_S    = 7_200 // 2 h
const BLOCK_HOURS    = 2     // 12 bloques al día = tope de 12 llamadas por negocio

export interface TuDiaData {
  now:          Date
  salesCount:   number
  totalUsd:     number
  trend:        number
  topProduct:   string | null
  cxcUsd:       number
  cxcVenceUsd:  number
  productCount: number
}

export type ParaStyle = 'main' | 'secondary' | 'warning' | 'closing'

export interface Paragraph {
  text:  string
  style: ParaStyle
}

function fmtUsd(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ── Fallback por reglas ───────────────────────────────────────────

export function buildNarrative(data: TuDiaData): Paragraph[] {
  const { salesCount, totalUsd, trend, topProduct, cxcUsd, cxcVenceUsd, productCount } = data

  if (salesCount === 0) {
    return [
      { text: 'El día va tranquilo.', style: 'main' },
      {
        text:  `Tu inventario tiene ${productCount} producto${productCount !== 1 ? 's' : ''} listo${productCount !== 1 ? 's' : ''}.`,
        style: 'secondary',
      },
      { text: 'Lo importante es que tu sistema está listo.', style: 'secondary' },
    ]
  }

  const ps: Paragraph[] = []

  ps.push({
    text:  `Llevas ${salesCount} ${salesCount === 1 ? 'cliente atendido' : 'clientes atendidos'}.`,
    style: 'main',
  })

  const assessment =
    trend > 25  ? 'mejor día de la semana'
    : trend > 5  ? 'por encima del promedio'
    : trend < -15 ? 'día más tranquilo que ayer'
    : 'día normal'

  ps.push({
    text:  `Las ventas van en ${fmtUsd(totalUsd)} — ${assessment}.`,
    style: 'main',
  })

  if (topProduct) {
    ps.push({ text: `Tu producto estrella es ${topProduct}.`, style: 'secondary' })
  }

  if (cxcUsd > 0) {
    ps.push({ text: `Tienes ${fmtUsd(cxcUsd)} pendientes por cobrar.`, style: 'secondary' })
  }

  if (cxcVenceUsd > 0) {
    ps.push({ text: `Mañana vence un compromiso por ${fmtUsd(cxcVenceUsd)}.`, style: 'warning' })
  }

  ps.push({ text: 'Tu negocio sigue adelante.', style: 'closing' })

  return ps
}

// ── Camino con IA ─────────────────────────────────────────────────

// El formato es explicito a proposito: toParagraphs() parte por linea en blanco
// y asigna main / secondary / closing por posicion, asi que los 3 parrafos no
// son estetica — son el contrato del que depende el render.
const SYSTEM_PROMPT = [
  'Eres el asistente de un negocio venezolano. Generas el resumen diario del',
  'negocio en español venezolano (tuteo), tono cálido y directo. Sin listas,',
  'solo prosa natural. Menciona: ventas del día vs ayer, producto estrella si',
  'hay, cobros pendientes si los hay. Si el día va flojo, di algo motivador',
  'pero honesto.',
  '',
  'Genera exactamente 3 párrafos separados por línea en blanco.',
  'Párrafo 1: UNA sola frase corta e impactante. Máximo 12 palabras.',
  'Párrafo 2: 2-3 oraciones con los datos del día. Tono informativo.',
  'Párrafo 3: UNA sola frase de cierre motivadora. Máximo 10 palabras.',
  '',
  'NUNCA uses más de 3 párrafos.',
  'NUNCA hagas preguntas al usuario.',
  "NUNCA uses 'nosotros' — usa 'tú' y 'tu negocio'.",
  '',
  "NUNCA uses frases de cierre de jornada como 'mañana es un nuevo día',",
  "'cerraste bien' o 'hasta mañana' — el usuario puede estar leyendo esto a",
  'las 8am. El párrafo de cierre debe ser motivador pero atemporal. Ejemplos',
  "correctos: 'Cada venta cuenta.', 'Tu negocio sigue adelante.', 'Lo",
  "importante es que tu sistema está listo.'",
  '',
  "NUNCA repitas los números crudos de forma literal ('atendimos a 0",
  "clientes', 'ventas en USD de 0.00'). Interprétalos: si hay 0 ventas, di",
  "'el día arrancó tranquilo' en vez de 'se generaron 0 ventas'.",
  '',
  'Si hay CxC pendiente, menciónalo como oportunidad de cobro, no como deuda.',
  '',
  'TIEMPO VERBAL — OBLIGATORIO:',
  'Usa siempre tiempo presente, nunca pasado.',
  "CORRECTO: 'El día va tranquilo', 'Las ventas van en $8.58',",
  "'Tienes pendiente cobrar $555', 'El mes lleva...'",
  "INCORRECTO: 'Hoy fue', 'atendimos', 'sumamos', 'tuvimos'",
  'El dueño lee esto en medio de su jornada, no al cierre del día.',
].join('\n')

/** Solo los datos del negocio — `now` queda fuera a propósito (ver dayKey). */
function promptPayload(data: TuDiaData) {
  return {
    ventas_hoy_usd:            Number(data.totalUsd.toFixed(2)),
    clientes_atendidos_hoy:    data.salesCount,
    variacion_vs_ayer_pct:     Number(data.trend.toFixed(1)),
    producto_estrella_del_mes: data.topProduct,
    por_cobrar_total_usd:      Number(data.cxcUsd.toFixed(2)),
    vence_manana_usd:          Number(data.cxcVenceUsd.toFixed(2)),
    productos_activos:         data.productCount,
  }
}

/**
 * Parte la prosa del modelo en párrafos con el mismo vocabulario de estilos que
 * el fallback: el primero abre, el último cierra, lo del medio es secundario.
 */
function toParagraphs(raw: string): Paragraph[] {
  const chunks = raw
    .trim()
    .split(/\n\s*\n+/)
    .map(t => t.replace(/^\s*[-*•]\s*/, '').trim())
    .filter(Boolean)

  if (chunks.length === 0) throw new Error('Narrativa vacía del modelo')

  return chunks.map((text, i) => ({
    text,
    style: i === 0 ? 'main' : i === chunks.length - 1 ? 'closing' : 'secondary',
  }))
}

async function callLlmForNarrative(data: TuDiaData): Promise<Paragraph[]> {
  const raw = await callBlogLlm(JSON.stringify(promptPayload(data)), {
    system: SYSTEM_PROMPT,
    signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
  })
  return toParagraphs(raw)
}

export async function generateTuDiaNarrative(
  data: TuDiaData,
  businessId: number,
): Promise<Paragraph[]> {
  const dayKey   = `${data.now.getFullYear()}-${data.now.getMonth() + 1}-${data.now.getDate()}`
  const blockKey = String(Math.floor(data.now.getHours() / BLOCK_HOURS))

  try {
    // Si callLlmForNarrative lanza, unstable_cache no guarda nada: un fallo
    // puntual cae al fallback sin dejar el error congelado dos horas.
    const cached = unstable_cache(
      () => callLlmForNarrative(data),
      ['tudia-narrative', String(businessId), dayKey, blockKey],
      { revalidate: CACHE_TTL_S },
    )
    return await cached()
  } catch (err: unknown) {
    console.error('tu-dia: narrativa IA falló, usando fallback por reglas:', err)
    return buildNarrative(data)
  }
}
