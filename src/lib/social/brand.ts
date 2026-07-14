import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * Marca real de ActivoPOS para el generador de contenido social.
 * Los colores NO se hardcodean: se leen de src/styles/tokens.css al arrancar,
 * de modo que un cambio en el design system se refleja aquí sin tocar este archivo.
 */

const TOKENS_PATH = join(process.cwd(), 'src', 'styles', 'tokens.css')

// Primera coincidencia = bloque :root (light). Los overrides de [data-theme=dark]
// van después en el archivo y no aplican al contenido social (siempre light-on-brand).
function readToken(css: string, name: string): string {
  const match = css.match(new RegExp(`--${name}:\\s*([^;]+);`))
  if (!match) throw new Error(`Token --${name} no existe en tokens.css`)
  return match[1].trim()
}

const css = readFileSync(TOKENS_PATH, 'utf8')

export const BRAND = {
  name: 'ActivoPOS',
  url:  'activopos.com',
  primary:      readToken(css, 'brand'),        // #0038BD
  primaryDark:  readToken(css, 'brand-dark'),   // #002FA0
  primaryLight: readToken(css, 'brand-l'),      // #4D7AFF
  soft:         readToken(css, 'brand-soft'),   // #DCE6FF
  onBrand:      readToken(css, 'brand-on'),     // #FFFFFF
} as const

export const ASSETS = {
  logoNegative: join(process.cwd(), 'public', 'activopos-logo-negative.svg'),
  fontDisplay:  join(process.cwd(), 'public', 'fonts', 'social', 'Fraunces-Bold.ttf'),
  fontBody:     join(process.cwd(), 'public', 'fonts', 'social', 'Inter-SemiBold.ttf'),
} as const

export type SocialFormat = 'post' | 'story' | 'carrusel'

// Lienzo final al que compose.ts encuadra. Las dimensiones que acepta el generador de
// imagen son otras y viven en image.ts — no las mezcles.
export const FORMATS: Record<SocialFormat, { width: number; height: number }> = {
  post:     { width: 1080, height: 1440 },
  carrusel: { width: 1080, height: 1440 },
  story:    { width: 1080, height: 1920 },
}

/**
 * Contexto de producto inyectado en todos los prompts.
 * Misma base de verdad que el generador de blog (api/admin/blog/generate-ai).
 */
export const PRODUCT_CONTEXT = `ActivoPOS es un sistema POS SaaS para PYMES venezolanas (activopos.com).

FUNCIONES REALES:
- POS táctil para ventas en mostrador
- Tasa BCV automática — dual USD + Bs en todo valor monetario
- Catálogo digital con pedidos por WhatsApp
- Métodos de pago venezolanos: Pago Móvil, Zelle, Binance, USDT, Zinli
- Variantes de producto (tallas, colores), inventario en tiempo real
- Cierre de caja diario con reporte

SEGMENTOS: bodegas, abastos, boutiques, cafetines, farmacias, carnicerías, restaurantes,
panaderías, ferreterías, joyerías, fruterías, veterinarias, papelerías, licorerías, ópticas.

TONO: español venezolano neutro-comercial, tuteo directo ("tu negocio", "cobras", "vendes").
Sin jerga startup, sin anglicismos innecesarios, sin grandilocuencia.`
