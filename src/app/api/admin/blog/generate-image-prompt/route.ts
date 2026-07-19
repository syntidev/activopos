import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { z } from 'zod'
import { callBlogLlm, extractJson, ProviderError } from '@/lib/blog/llm'
import { uploadLimiter, getClientIp } from '@/lib/rate-limit'
import { PRODUCT_CONTEXT } from '@/lib/social/brand'

const bodySchema = z.object({
  titulo:    z.string().min(1).max(255),
  excerpt:   z.string().max(1000).optional().default(''),
  content:   z.string().max(60000).optional().default(''),
  categoria: z.string().max(80).optional().default(''),
})

// Mismo contrato de 3 campos que los presets de escena del módulo social
// (scripts/seed-scene-presets.ts: personaje/escena/accion). generateBackground()
// solo activa su rama buena — hasDirection() en lib/social/image.ts:43, la que
// arma "Subject: … Action: … Setting: …" — si recibe estos campos por separado.
// Un prompt libre cae al camino degradado y produce la foto genérica.
const promptResultSchema = z.object({
  personaje: z.string().min(1).max(300),
  lugar:     z.string().min(1).max(300),
  accion:    z.string().min(1).max(300),
  nicho:     z.string().min(1).max(80),
})

/**
 * Se le pide dirección de escena, NO un prompt libre: el mismo patrón curado que
 * los 26 presets de social (personaje con fenotipo/género explícito + lugar +
 * acción concreta). Un prompt libre producía la foto genérica de archivo.
 *
 * En POSITIVO, lección ya pagada en el módulo social (lib/social/image.ts): FLUX
 * ignora las negaciones — pedirle "no text" produce texto — así que las
 * restricciones se formulan como afirmaciones.
 */
function buildPromptRequest(titulo: string, excerpt: string, content: string, categoria: string): string {
  // El content llega en HTML; el modelo solo necesita el sentido, no el markup.
  const plain = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1800)

  return `${PRODUCT_CONTEXT}

Diriges la fotografía del artículo de blog de abajo. NO escribes un prompt libre:
devuelves 3 campos dirigidos (personaje / lugar / acción), igual que un director
de fotografía le indica a un fotógrafo qué montar.

TÍTULO: ${titulo}
CATEGORÍA: ${categoria}
RESUMEN: ${excerpt}
CUERPO: ${plain}

Primero decide, en silencio: ¿cuál es la ACCIÓN CONCRETA Y VISIBLE que ilustra el
punto de este artículo? No el tema general ("precios"), sino el gesto que se ve en
la foto ("ajustando la etiqueta de precio de un estante"). Si el artículo trata de
cobrar, la acción es cobrar. Si trata de inventario, es contar o reponer. Si trata
de precios, es cambiar o comparar precios. La foto debe poder "leerse" como el
artículo aunque no tenga texto.

Devuelve estos 4 campos:

"personaje": el/la dueño/a del negocio venezolano relevante. OBLIGATORIO incluir,
en este orden: rol + género explícito (hombre/mujer) + fenotipo + edad + tono de
piel + cabello + ropa de trabajo. Varía género y fenotipo entre artículos — Venezuela
es mestiza, afrodescendiente, de descendencia europea e indígena.
Ejemplo del estándar: "dueña de bodega, mujer, mestiza, 40 años, piel morena clara,
cabello negro liso recogido, delantal".

"lugar": dónde ocurre, con detalle físico del rubro y de la luz. El rubro sale del
artículo, no genérico.
Ejemplo: "detrás del mostrador, luz de mañana entrando por la puerta".

"accion": la acción concreta y visible que decidiste arriba, en gerundio, con el
objeto que la hace legible.
Ejemplo: "contando billetes con alivio".

"nicho": el rubro en minúsculas, una o dos palabras ("bodega", "ferretería",
"farmacia", "restaurante"). Si el artículo no trata de un rubro específico, usa
"pyme venezolana".

REGLAS DURAS:
- Todo en español, afirmativo. Nunca uses negaciones ("sin", "no", "evita"): los
  modelos de difusión las ignoran. Para una superficie limpia, escribe lo que SÍ
  hay ("paredes lisas", "empaques lisos").
- La acción debe ser física y fotografiable. "pensando en sus finanzas" no sirve;
  "revisando el cuaderno de cuentas con el lápiz en la mano" sí.
- Una sola persona en foco, salvo que el artículo trate explícitamente de atender
  a un cliente.
- Máximo 200 caracteres por campo.

Responde SOLO con JSON válido:
{
  "personaje": "...",
  "lugar": "...",
  "accion": "...",
  "nicho": "bodega"
}`
}

export async function POST(req: NextRequest) {
  // Llama a la API paga de NVIDIA — mismo throttle que las rutas hermanas.
  try {
    await uploadLimiter.consume(getClientIp(req))
  } catch {
    return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 })
  }

  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role !== 'super_admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  try {
    const { titulo, excerpt, content, categoria } = bodySchema.parse(await req.json())

    const raw    = await callBlogLlm(buildPromptRequest(titulo, excerpt, content, categoria))
    const parsed = promptResultSchema.parse(extractJson(raw))

    return NextResponse.json({ ok: true, ...parsed })
  } catch (err) {
    if (err instanceof ProviderError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: 'El modelo no devolvió JSON válido' }, { status: 502 })
    }
    console.error('Blog image-prompt error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
