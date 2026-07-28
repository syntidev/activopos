import { z } from 'zod'
import {
  ACTIVOPOS_CONTEXT, buildNarrativeArc, pickLayoutForRole,
  type SlideLayout, type SocialFormat,
} from './brand'
import { ProviderError, withRetry } from './retry'

/**
 * Cliente Gemini server-side para el COPY del generador de contenido social.
 *
 * Adaptado de C:\socialia\services\geminiService.ts (callProxy L53-73, withRetry L92-122,
 * generateCreativePost L659-748). Diferencias con el original:
 *  - Socialia era un SPA Vite y hablaba con su propio proxy Express (/api/socialia/gemini)
 *    para ocultar la key del navegador. Aquí ya estamos en el servidor: se llama a Google
 *    directo y la key nunca sale del proceso Node.
 *  - Sin marcas SYNTIweb/Studio/Food/Cat: el contexto es ActivoPOS.
 *  - La generación de IMAGEN ya no vive aquí: la cuenta de Google tiene cuota free-tier = 0
 *    en todos sus modelos de imagen. Ver src/lib/social/image.ts (NVIDIA NIM / FLUX.1-dev).
 */

const TEXT_MODEL = 'gemini-3-flash-preview'

interface GeminiPart {
  text?: string
}
interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] } }[]
}

async function call(model: string, body: unknown): Promise<GeminiResponse> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new ProviderError('GEMINI_API_KEY no configurada en el servidor', 500)

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    },
  )

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new ProviderError(`Gemini ${res.status}: ${detail.slice(0, 300)}`, res.status)
  }
  return res.json() as Promise<GeminiResponse>
}

// ── Copy ────────────────────────────────────────────────────────────────────

export interface SlideCopy {
  titulo:    string
  subtitulo: string
  escena:    string   // descripción visual del fondo — alimenta el prompt de imagen
  // Campos por layout (Sprint 144). Opcionales: solo se piden al modelo cuando el
  // rol de la slide cae en un layout que los consume, y se descartan si vienen mal.
  tituloHighlight?: string    // subcadena LITERAL de titulo — highlight-text
  items?:           string[]  // 3-6 ítems cortos — checklist
  clienteTexto?:    string    // chat-bubble
  clienteHora?:     string
  respuestaTexto?:  string
}

const slideCopySchema = z.object({
  titulo:    z.string(),
  subtitulo: z.string(),
  escena:    z.string(),
  tituloHighlight: z.string().optional(),
  items:           z.array(z.string()).optional(),
  clienteTexto:    z.string().optional(),
  clienteHora:     z.string().optional(),
  respuestaTexto:  z.string().optional(),
})

const ITEMS_MIN = 3
const ITEMS_MAX = 6

/**
 * Descarte silencioso de los campos nuevos cuando el modelo los devuelve mal.
 * Son cosméticos: una slide sin tituloHighlight se ve como hasta hoy, así que
 * NUNCA se lanza — tumbar una generación completa por esto sería peor.
 *
 * Los 3 campos base se dejan pasar aunque no validen: hoy se castean sin
 * validación y endurecerlo acá cambiaría el comportamiento de generaciones que
 * ya funcionan (el criterio de esta tarea es regresión cero).
 */
function sanitizeSlide(raw: SlideCopy): SlideCopy {
  const parsed = slideCopySchema.safeParse(raw)
  if (!parsed.success) return raw
  const s = parsed.data

  const out: SlideCopy = { titulo: s.titulo, subtitulo: s.subtitulo, escena: s.escena }
  // highlight-text parte el titulo en [antes, resaltado, después]. Si el resaltado
  // no aparece literal en el titulo el split no resalta nada, así que se descarta.
  if (s.tituloHighlight && s.titulo.includes(s.tituloHighlight)) out.tituloHighlight = s.tituloHighlight
  if (s.items && s.items.length >= ITEMS_MIN && s.items.length <= ITEMS_MAX) out.items = s.items
  if (s.clienteTexto)   out.clienteTexto   = s.clienteTexto
  if (s.clienteHora)    out.clienteHora    = s.clienteHora
  if (s.respuestaTexto) out.respuestaTexto = s.respuestaTexto
  return out
}

// Campos extra que pide cada layout. Un layout ausente acá no necesita nada más
// que titulo/subtitulo/escena, y no se le pide nada al modelo (ahorra tokens).
const LAYOUT_EXTRA_FIELDS: Partial<Record<SlideLayout, string>> = {
  'highlight-text':
    '  - tituloHighlight: subcadena LITERAL y EXACTA de tu propio "titulo", la parte que\n' +
    '    debe ir resaltada. Copiala caracter por caracter del titulo, sin reformular ni\n' +
    '    conjugar. Ej: titulo "El BCV te tiene loco" -> "loco" o "BCV te tiene loco" sirven;\n' +
    '    "enloquecido" NO sirve porque no aparece tal cual en el titulo.',
  'checklist':
    `  - items: entre ${ITEMS_MIN} y ${ITEMS_MAX} ítems cortos (máximo 6 palabras cada uno), en español venezolano.`,
  'chat-bubble':
    '  - clienteTexto: mensaje simulado de un cliente por WhatsApp, natural, sin emojis.\n' +
    '  - clienteHora: hora del mensaje, formato "H:MM a.m." o "H:MM p.m.".\n' +
    '  - respuestaTexto: confirmación corta del sistema al recibir el pedido.',
}

// El arco narrativo depende solo de la cantidad de slides, así que se puede
// calcular acá igual que en carrusel.ts y decirle al modelo qué necesita cada una.
function buildLayoutBlock(tipo: SocialFormat, slides: number): string {
  if (tipo !== 'carrusel') return ''
  const arc = buildNarrativeArc(slides).slice(0, slides)
  const lines = arc
    .map((spec, i) => {
      const extra = LAYOUT_EXTRA_FIELDS[pickLayoutForRole(spec.role)]
      return extra ? `Slide ${i + 1} (${spec.role}) — además de titulo/subtitulo/escena:\n${extra}` : ''
    })
    .filter(Boolean)
  if (lines.length === 0) return ''
  return `\nCAMPOS ADICIONALES POR SLIDE (solo los listados; las demás slides no los llevan):\n${lines.join('\n')}\n`
}

export interface SocialCopy {
  slides:   SlideCopy[]
  hook:     string        // frase de apertura, máx 15 palabras
  cuerpo:   string        // desarrollo del beneficio, máx 40 palabras
  cta:      string        // llamado a la acción directo
  pregunta: string        // pregunta para generar comentarios
  hashtags: string[]
  caption:  string        // hook+cuerpo+cta+pregunta+hashtags, listo para copiar
  metadata: {
    horarioSugerido: string   // ej. "10:30 AM — antes del almuerzo"
    objetivo:        string   // ej. "Conversión y captación de leads"
    seoKeywords:     string[]
    tipoAds:         string   // ej. "Ventas / Conversiones de catálogo"
  }
  notaCreador: string     // 1-2 oraciones: la intención de diseño de la pieza
}

// Estructura cruda que responde el modelo (snake_case). Se mapea a SocialCopy.
interface RawCopy {
  slides:               SlideCopy[]
  hook:                 string
  cuerpo:               string
  cta:                  string
  pregunta:             string
  hashtags:             string[]
  horario_sugerido:     string
  objetivo_clasificado: string
  seo_keywords:         string[]
  tipo_ads:             string
  nota_creador:         string
}

// Caption final: une las secciones en un solo texto listo para pegar en Instagram.
export function buildCaption(c: {
  hook: string; cuerpo: string; cta: string; pregunta: string; hashtags: string[]
}): string {
  return [c.hook, c.cuerpo, c.cta, c.pregunta, c.hashtags.map(h => `#${h}`).join(' ')]
    .filter(Boolean)
    .join('\n\n')
}

export interface CopyInput {
  tipo:       SocialFormat
  nicho:      string
  gancho:     string
  beneficio?: string
  objetivo:   string
  slides:     number
}

function extractText(res: GeminiResponse): string {
  return res.candidates?.[0]?.content?.parts?.find(p => p.text)?.text ?? ''
}

export async function generateCopy(input: CopyInput): Promise<SocialCopy> {
  const { tipo, nicho, gancho, beneficio, objetivo, slides } = input

  const prompt = `${ACTIVOPOS_CONTEXT}

Eres un equipo experto de marketing digital para Instagram (2026) trabajando para ActivoPOS,
el POS venezolano para PYMES. Interpretas simultáneamente estos roles:
1. Copywriter Senior venezolano: hooks que paran el scroll, lenguaje criollo auténtico
2. Social Media Strategist: KPIs de watch time, shares, saves
3. Community Manager: cercanía, preguntas que generan comentarios reales
4. Ads Specialist: copy optimizado para conversión
5. Conocedor del venezolano: sabes cómo habla el dueño de una bodega en Catia

REGLAS DE COPY (irrompibles):
- El HOOK es lo más importante. Debe doler o provocar en menos de 5 palabras.
- Usa lenguaje venezolano REAL: "chamo", "pana", "botar reales", "arrecho", "bacano"
  cuando sea apropiado al segmento. No fuerces el slang — que fluya natural.
- NUNCA uses: "optimizar", "solución integral", "gestión eficiente", "plataforma robusta".
- Habla de lo que el dueño SIENTE, no de lo que el sistema HACE:
  "saber cuánto vendiste" no "ver reportes en tiempo real"
  "no perder plata" no "control financiero"
  "que el BCV no te sorprenda" no "actualización automática de tasas".
- El CTA siempre termina en activopos.com.

FORMATO: ${tipo} (${slides} ${slides === 1 ? 'imagen' : 'slides'}).
NICHO: ${nicho}.
OBJETIVO: ${objetivo}.
GANCHO DE ENTRADA: "${gancho}".${beneficio ? `\nBENEFICIO A DESTACAR: "${beneficio}".` : ''}

Para CADA slide genera:
- titulo: frase de impacto, máximo 6 palabras, en español venezolano
- subtitulo: beneficio concreto, máximo 12 palabras, en español venezolano
- escena: descripción EN INGLÉS de la escena fotográfica de fondo. Ambiente venezolano real
  del nicho "${nicho}". Menciona iluminación, encuadre y objetos. NUNCA menciones carteles,
  letreros, afiches, etiquetas, pantallas ni marcas: el modelo de imagen los dibuja con texto
  ilegible. Describe superficies limpias y envases sin marca.
${slides > 1 ? 'Los slides deben contar una progresión: problema → tensión → solución → cierre con CTA.' : ''}
${buildLayoutBlock(tipo, slides)}

Genera además, todo en español venezolano con tuteo (excepto seo_keywords que pueden ir en el término que busca la gente):
- hook: frase de apertura de máximo 15 palabras
- cuerpo: desarrollo del beneficio, máximo 40 palabras
- cta: llamado a la acción directo
- pregunta: pregunta que invite a comentar
- hashtags: 8 hashtags relevantes al nicho, sin el símbolo #
- horario_sugerido: mejor hora para publicar según objetivo y nicho (formato: 'HH:MM AM/PM — razón breve')
- objetivo_clasificado: qué logra este post (ej. 'Conversión', 'Awareness', 'Captación de leads')
- seo_keywords: 3-4 palabras clave relevantes al nicho
- tipo_ads: qué tipo de campaña publicitaria complementaría este post
- nota_creador: 1-2 oraciones explicando la intención de diseño de la pieza (qué se buscó
  comunicar visualmente y por qué)

Responde SOLO JSON válido con esta estructura exacta. Agrega a cada slide los campos
adicionales que se le hayan pedido arriba, y SOLO a esa slide:
{"slides":[{"titulo":"","subtitulo":"","escena":""}],"hook":"","cuerpo":"","cta":"","pregunta":"","hashtags":[],"horario_sugerido":"","objetivo_clasificado":"","seo_keywords":[],"tipo_ads":"","nota_creador":""}`

  const res = await withRetry(() => call(TEXT_MODEL, {
    contents:         [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json' },
  }))

  const raw = extractText(res)
  if (!raw) throw new ProviderError('Gemini devolvió copy vacío', 502)

  // Pese a responseMimeType el modelo a veces envuelve el JSON en fences de markdown.
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  const rc = JSON.parse(cleaned) as RawCopy

  // El caption no lo escribe el modelo: se arma acá con las secciones, así siempre
  // queda consistente con hook/cuerpo/cta/pregunta/hashtags aunque el modelo divague.
  return {
    slides:   rc.slides.map(sanitizeSlide),
    hook:     rc.hook,
    cuerpo:   rc.cuerpo,
    cta:      rc.cta,
    pregunta: rc.pregunta,
    hashtags: rc.hashtags,
    caption:  buildCaption(rc),
    metadata: {
      horarioSugerido: rc.horario_sugerido,
      objetivo:        rc.objetivo_clasificado,
      seoKeywords:     rc.seo_keywords,
      tipoAds:         rc.tipo_ads,
    },
    notaCreador: rc.nota_creador,
  }
}
