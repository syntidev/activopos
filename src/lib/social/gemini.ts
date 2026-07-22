import { PRODUCT_CONTEXT, type SocialFormat } from './brand'
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

  const prompt = `${PRODUCT_CONTEXT}

Actúa como un equipo de marketing digital experto para ActivoPOS, interpretando 4 roles simultáneos:
1. Estratega de contenido — define el hook y el objetivo
2. Copywriter — escribe cuerpo y CTA persuasivos
3. Community Manager — arma la pregunta de interacción
4. Especialista SEO/Ads — sugiere keywords y tipo de campaña

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

Responde SOLO JSON válido con esta estructura exacta:
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
    slides:   rc.slides,
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
