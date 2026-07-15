import { z } from 'zod'
import { BRAND, PRODUCT_CONTEXT, type SocialFormat } from './brand'
import { ProviderError, withRetry } from './retry'

/**
 * Motor de texto → HTML estructurado para el generador de contenido social.
 *
 * Patrón de arco narrativo adaptado de TempSocialia/Referencia_OpenCarrusel/src/lib/
 * chat-system-prompt.ts. Diferencia clave: aquel es un AGENTE AUTÓNOMO (Claude CLI que
 * ejecuta curl contra su propia API). Aquí NO hay agente ni Claude: el LLM solo devuelve
 * JSON y este código lo orquesta, valida y reintenta. Motor: NVIDIA NIM (Nemotron) primario,
 * Gemini fallback — mismo patrón dual que image.ts/gemini.ts.
 *
 * El HTML se renderiza a PNG con Puppeteer+Sharp en Fase C; este módulo solo lo genera.
 */

const NVIDIA_MODEL = 'nvidia/llama-3.3-nemotron-super-49b-v1'
const GEMINI_MODEL = 'gemini-3-flash-preview'

// Mismo sistema tipográfico que la landing (src/app/(marketing)/layout.tsx): Fraunces display
// + DM Sans body. Se inyecta como primer <style> de cada slide porque el HTML es autocontenido
// (iframe aislado / Puppeteer standalone, no hereda el CSS del proyecto). El @import debe ir
// antes de cualquier otra regla CSS, por eso va prepend.
const FONT_IMPORT =
  `<style>@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700;9..144,800;9..144,900&family=DM+Sans:wght@300;400;500;600&display=swap');</style>`

// Fase B: 4:5 (1080×1350) es el default de feed — el más soportado por Buffer para
// programar (verificado 15 jul). No confundir con FORMATS de brand.ts (3:4), que es el
// lienzo del pipeline de difusión (image.ts), otro flujo.
const DIMENSIONS: Record<SocialFormat, { width: number; height: number }> = {
  post:     { width: 1080, height: 1350 },
  carrusel: { width: 1080, height: 1350 },
  story:    { width: 1080, height: 1920 },
}

const SLIDES_POR_FORMATO: Record<SocialFormat, string> = {
  post:     '1 slide único (hook + valor + CTA condensados en una sola imagen)',
  story:    '1 slide único vertical (hook + CTA, texto grande, poco cuerpo)',
  carrusel: '4 a 8 slides siguiendo el arco narrativo completo',
}

export const SEGMENTOS = [
  'bodega', 'abasto', 'boutique', 'cafetín', 'farmacia', 'carnicería', 'restaurante',
  'panadería', 'ferretería', 'joyería', 'frutería', 'veterinaria', 'papelería',
  'licorería', 'óptica', 'tienda de electrónica', 'centro de belleza', 'mueblería',
  'lavandería', 'distribuidora',
] as const

export type Objetivo = 'Vender' | 'Enseñar' | 'Dar a Conocer'

export interface HtmlGenInput {
  topic:    string
  segmento: string
  objetivo: Objetivo
  formato:  SocialFormat
}

const slideSchema = z.object({
  html:  z.string().min(1),
  notes: z.string(),
})
const resultSchema = z.object({
  slides:   z.array(slideSchema).min(1).max(8),
  caption:  z.string(),
  hashtags: z.array(z.string()),
})
export type HtmlContent = z.infer<typeof resultSchema>

// ── Prompt ────────────────────────────────────────────────────────────────

function buildSystemPrompt(input: HtmlGenInput): string {
  const { width, height } = DIMENSIONS[input.formato]

  return `${PRODUCT_CONTEXT}

Eres el motor de diseño de contenido de Instagram para ActivoPOS. Generas slides como HTML
listo para renderizar. Devuelves SOLO JSON válido, nada más — sin markdown, sin explicación.

FORMATO: ${input.formato} — ${SLIDES_POR_FORMATO[input.formato]}.

ARCO NARRATIVO (para carrusel; para post/story condensa en el único slide):
- Slide 1 — HOOK: pregunta o afirmación fuerte, máximo 8 palabras, tipografía enorme.
- Slides 2-3 — SETUP: plantea el problema real que vive una ${input.segmento} venezolana.
- Slides 4-6 — VALUE: un insight concreto por slide, texto punchy.
- Slide final — CTA: "Prueba gratis en activopos.com".

REGLAS DEL HTML DE CADA SLIDE (obligatorias):
1. Solo HTML de nivel body. NADA de <!DOCTYPE>, <html>, <head> ni <body>.
2. Estilos inline o en un <style> dentro del slide. CERO CSS externo, CERO <link>.
3. Contenedor raíz EXACTO, sin desbordes: un único <div> con
   "width:${width}px; height:${height}px; box-sizing:border-box; overflow:hidden;
   display:flex; flex-direction:column; justify-content:center; padding:80px".
   TODO elemento debe llevar box-sizing:border-box (usa <style>* {box-sizing:border-box}</style>).
   El contenido NUNCA debe exceder esas dimensiones — nada de scroll, nada cortado.
4. El fondo (color o gradiente de marca) va DIRECTO en el "background" del <div> raíz.
   PROHIBIDO crear una capa <div> de fondo con position:absolute: se pinta encima del texto
   y lo tapa. Nada de position:absolute; usa solo flexbox para colocar y centrar el contenido.
5. CERO JavaScript. Prohibido <script> de cualquier tipo (el render lo bloquea).
6. Colores de la marca ActivoPOS: primary ${BRAND.primary}, primaryDark ${BRAND.primaryDark},
   primaryLight ${BRAND.primaryLight}, soft ${BRAND.soft}, texto sobre marca ${BRAND.onBrand}.
   Fondos sólidos o gradientes de marca; contraste de texto siempre alto (AA).
7. Tipografía (las fuentes ya se cargan por un @import inyectado — tú solo usas font-family):
   títulos/hook → font-family:'Fraunces', serif; subtítulos/cuerpo → font-family:'DM Sans', sans-serif.
   Título del HOOK muy grande (100-130px); cuerpo 34-44px. line-height ceñido en títulos.
8. Un mensaje por slide. El texto largo se ajusta con word-wrap; nunca se corta ni se sale.
   PROHIBIDO markdown: nada de **negrita**, ## títulos, ni - listas. Es HTML puro — para
   énfasis usa <strong>, para listas <ul><li>. Un ** en el texto se ve literal y es un error.
9. PROHIBIDO mencionar SENIAT en cualquier slide o texto.

Además del array de slides, genera:
- caption: copy de Instagram (150-300 caracteres) con gancho, valor y CTA a activopos.com.
- hashtags: 8 a 15 hashtags relevantes al nicho, SIN el símbolo #.

Estructura EXACTA de salida (JSON, sin ningún texto fuera de él):
{"slides":[{"html":"<div style=...>...</div>","notes":"rol del slide"}],"caption":"","hashtags":[]}`
}

function buildUserPrompt(input: HtmlGenInput): string {
  return `TEMA: "${input.topic}"
SEGMENTO: ${input.segmento}
OBJETIVO: ${input.objetivo}
Genera el contenido ahora. Responde SOLO con el JSON.`
}

// ── Proveedores ─────────────────────────────────────────────────────────────

async function callNvidia(system: string, user: string): Promise<string> {
  const key = process.env.NVIDIA_API_KEY
  if (!key) throw new ProviderError('NVIDIA_API_KEY no configurada', 500)

  const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method:  'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model:       NVIDIA_MODEL,
      messages:    [{ role: 'system', content: system }, { role: 'user', content: user }],
      temperature: 0.4,
      max_tokens:  4096,
    }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new ProviderError(`NVIDIA ${res.status}: ${detail.slice(0, 200)}`, res.status)
  }
  const data = await res.json() as { choices?: { message?: { content?: string } }[] }
  return data.choices?.[0]?.message?.content ?? ''
}

async function callGemini(system: string, user: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new ProviderError('GEMINI_API_KEY no configurada', 500)

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents:          [{ parts: [{ text: user }] }],
        generationConfig:  { responseMimeType: 'application/json', maxOutputTokens: 4096 },
      }),
    },
  )
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new ProviderError(`Gemini ${res.status}: ${detail.slice(0, 200)}`, res.status)
  }
  const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
  return data.candidates?.[0]?.content?.parts?.find(p => p.text)?.text ?? ''
}

// ── Parseo y validación ─────────────────────────────────────────────────────

/** Los modelos reasoning de Nemotron a veces anteponen <think>...</think> o fences. */
function extractJson(raw: string): unknown {
  let s = raw.trim()
  s = s.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  const start = s.indexOf('{')
  const end   = s.lastIndexOf('}')
  if (start === -1 || end === -1) throw new SyntaxError('sin objeto JSON en la respuesta')
  return JSON.parse(s.slice(start, end + 1))
}

function assertRenderable(content: HtmlContent, formato: SocialFormat): void {
  for (const slide of content.slides) {
    if (/<script[\s>]/i.test(slide.html)) {
      throw new ProviderError('el modelo devolvió HTML con <script> (prohibido)', 422)
    }
  }
  // El modelo es inconsistente en la cantidad (a veces 1 slide para un carrusel).
  // Se valida por formato; un conteo fuera de rango cuenta como intento fallido y reintenta.
  const n = content.slides.length
  const ok = formato === 'carrusel' ? n >= 3 && n <= 8 : n === 1
  if (!ok) throw new ProviderError(`${formato} espera otro número de slides, recibió ${n}`, 422)
}

/**
 * Intenta un proveedor hasta `maxAttempts` veces. Un JSON inválido, un fallo de Zod o un
 * <script> cuentan como intento fallido y se reintenta (no se acepta output sucio en
 * silencio). Devuelve null si el proveedor se agota — el llamador cae al siguiente.
 */
async function tryProvider(
  call: (s: string, u: string) => Promise<string>,
  input: HtmlGenInput,
  maxAttempts = 2,
): Promise<HtmlContent | null> {
  const system = buildSystemPrompt(input)
  const user   = buildUserPrompt(input)

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // withRetry cubre los fallos transitorios de red (429/503); este loop cubre los
      // fallos de contenido (JSON/HTML inválido).
      const raw     = await withRetry(() => call(system, user))
      const content = resultSchema.parse(extractJson(raw))
      assertRenderable(content, input.formato)
      // El font-load no se deja al criterio del modelo: se prepone el @import fijo a cada slide.
      content.slides = content.slides.map(s => ({ ...s, html: FONT_IMPORT + s.html }))
      return content
    } catch {
      // siguiente intento
    }
  }
  return null
}

export async function generateHtmlContent(input: HtmlGenInput): Promise<HtmlContent> {
  const viaNvidia = await tryProvider(callNvidia, input)
  if (viaNvidia) return viaNvidia

  const viaGemini = await tryProvider(callGemini, input)
  if (viaGemini) return viaGemini

  throw new ProviderError('Ni NVIDIA (Nemotron) ni Gemini devolvieron HTML válido', 502)
}
