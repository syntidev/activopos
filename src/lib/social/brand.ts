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

// Dimensión de salida elegida en el formulario -- independiente de SocialFormat (tipo de
// pieza). Única fuente de verdad para el lienzo final: compose.ts (difusión) y
// render-slide.ts (HTML/carrusel) leen de acá, image.ts mapea a la lista discreta que
// acepta FLUX (GEN_SIZE en image.ts).
export type Aspect = '1:1' | '4:5' | '3:4' | '9:16'

export const ASPECT_DIMENSIONS: Record<Aspect, { width: number; height: number }> = {
  '1:1':  { width: 1080, height: 1080 }, // post cuadrado
  '4:5':  { width: 1080, height: 1350 }, // post vertical clásico
  '3:4':  { width: 1080, height: 1440 }, // post vertical nuevo (grid Instagram)
  '9:16': { width: 1080, height: 1920 }, // story / reel
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

/**
 * Contexto expandido (Sprint 115) — port del patrón de Socialia. Sustituye a
 * PRODUCT_CONTEXT SOLO para el copy (gemini.ts). PRODUCT_CONTEXT se conserva
 * intacto porque html-generator.ts (carrusel) y el generador de blog lo
 * importan y están fuera de este scope.
 */
export const ACTIVOPOS_CONTEXT = `
ActivoPOS es un sistema SaaS de control de ventas e inventario para PYMES venezolanas.
No es una app de facturación SENIAT — es el sistema operativo del negocio.

FEATURES REALES:
- BCV automático: precio en USD → bolívares se actualiza solo con la tasa del día
- Pago Móvil nativo como método de cobro principal
- Catálogo digital con QR — el cliente escanea y ve precios actualizados al BCV
- Pedidos por WhatsApp directo desde el catálogo
- Caja y cierre de día en 2 minutos
- Reportes de ventas en tiempo real
- Inventario con descuento automático al vender
- Variantes: tallas, colores, kilos, litros, metros
- Multi-método de pago: Pago Móvil + Zelle + Binance + USDT + Zinli

SEGMENTOS REALES (en orden de prioridad):
Bodega/Abasto, Carnicería, Restaurante, Café, Boutique/Ropa,
Farmacia, Ferretería, Panadería, Pescadería, Heladería,
Peluquería/Barbería, Floristería, Repuestos/Taller, Tecnología

TONO: venezolano criollo auténtico. B2H (Business to Human).
"lo que de verdad ganaste" no "utilidad neta".
Habla como habla el dueño de la bodega de Catia, no como un ejecutivo de Caracas.
`

// ── Firma visual del producto (port de Socialia, adaptado a ActivoPOS) ──
export const ACTIVOPOS_SIGNATURE = {
  mustHaveElements: [
    'A modern smartphone with the GLASS SCREEN facing the camera, showing a clean POS dashboard UI in Persian Blue (#0038BD) with sales numbers and inventory data.',
    'A subtle price badge showing dual currency: "$12.50 / Bs. 456.00" — the BCV indicator that is the core of ActivoPOS.',
    'A WhatsApp message bubble overlay showing an incoming order from a customer — representing the catalog-to-WhatsApp flow.',
  ],
  forbiddenElements: [
    'No SENIAT fiscal machines or fiscal receipts.',
    'No generic office stock photos with white people in suits.',
    'No empty abstract backgrounds with no Venezuelan context.',
    'No text rendered in the image — text is added in compose.ts post-production.',
  ],
  environmentHint: 'Venezuelan small business environment — bodega counter, restaurant kitchen, boutique interior, pharmacy shelf. Real, warm, recognizable to the Venezuelan entrepreneur.',
} as const

// ── Variación humana venezolana por segmento (port de buildLifestyleAuthenticPrompt) ──
// Edad tope 40 y cabello oscuro explícito (Sprint 115b): con rangos 35-50 el modelo
// generaba cabello blanco/gris en casi todos los posts. Cada variante fija rasgos
// venezolanos diversos y un tipo de cabello oscuro distinto para romper la repetición.
export const HUMAN_SCENE_VARIANTS: Record<string, string[]> = {
  'abastos': [
    'Venezuelan bodega owner, man 28-40, casual shirt, short dark hair, authentic diverse Venezuelan features, confident smile, standing behind a counter with products visible on shelves behind',
    'Venezuelan woman entrepreneur, 25-38, natural wavy dark hair, authentic Venezuelan features, managing a modern minimarket with a smartphone in hand',
    'Young Venezuelan man, 25-35, straight dark brown hair, authentic Venezuelan features, behind a bodega counter, looking at phone screen with satisfied expression',
  ],
  'carniceria': [
    'Venezuelan butcher, man 28-40, clean white apron, dark curly hair, authentic Venezuelan features, modern carnicería interior with refrigerated display cases behind',
    'Venezuelan woman, 25-38, owner of a carnicería, straight dark brown hair, authentic Venezuelan features, holding a smartphone showing inventory data, modern clean setting',
  ],
  'restaurante': [
    'Venezuelan chef, 28-40, clean white chef coat, short dark hair, authentic Venezuelan features, modern restaurant kitchen background, holding a tablet',
    'Venezuelan restaurant owner, 28-40, natural wavy dark hair, authentic Venezuelan features, in a clean well-lit dining room, using a smartphone for order management',
  ],
  'cafe': [
    'Venezuelan barista or café owner, 25-38, dark curly hair, authentic Venezuelan features, in a warm modern café with visible coffee equipment behind',
    'Young Venezuelan woman, 22-35, natural wavy dark hair, authentic Venezuelan features, behind a café counter, smiling while using a POS on her phone',
  ],
  'boutique': [
    'Venezuelan boutique owner, woman 25-38, straight dark brown hair, authentic Venezuelan features, in a well-organized modern clothing store, holding smartphone',
    'Venezuelan entrepreneur, 28-40, short dark hair, authentic Venezuelan features, in a clean modern fashion store, showing a digital catalog on phone',
  ],
  'general': [
    'Venezuelan entrepreneur, 28-40, dark curly hair, authentic Venezuelan features, confident expression, modern small business interior, holding smartphone with screen facing camera',
    'Venezuelan business owner, 25-38, natural wavy dark hair, authentic Venezuelan features, looking directly at camera with satisfied expression, phone showing a POS dashboard',
    'Young Venezuelan professional, 25-35, short dark hair, authentic Venezuelan features, in a bright modern small office, smiling at camera with smartphone',
  ],
}

export const ILUMINACION_VARIANTS = [
  'golden morning light from window',
  'bright noon natural light, warm Venezuelan sunlight',
  'soft professional studio lighting',
  'warm evening indoor light typical of a Venezuelan business',
]

export const ANGULO_VARIANTS = [
  'frontal portrait, person looking directly at camera',
  'three-quarter view, slight angle, engaged expression',
  'confident slight low-angle, person looking at camera',
]

// El nicho es texto libre del formulario ("bodega", "panadería"...); las claves de
// HUMAN_SCENE_VARIANTS son acotadas. Sin este normalizador casi todo caía a 'general'.
export function normalizeNicho(nicho: string): string {
  const map: Record<string, string> = {
    'bodega': 'abastos', 'abasto': 'abastos', 'minimarket': 'abastos',
    'carnicería': 'carniceria', 'carnicerias': 'carniceria',
    'café': 'cafe', 'cafetería': 'cafe', 'panadería': 'cafe',
    'boutique': 'boutique', 'ropa': 'boutique', 'tienda': 'boutique',
    'restaurante': 'restaurante', 'comida': 'restaurante',
  }
  return map[nicho.toLowerCase().trim()] ?? 'general'
}

/* ── Carrusel generativo (Sprint 118) ──────────────────────────────────────────
   El carrusel deja de ser HTML plano del LLM: el LLM (generateCopy) solo escribe
   copy (titulo/subtitulo por slide) y el diseño lo pone código determinista —
   arco narrativo con geometría y paleta de marca por rol. Paleta SELLADA. */

export type CarouselMode  = 'geometric' | 'human' | 'hybrid'
export type SlideGeometry = 'diagonal' | 'circles' | 'bars' | 'grid' | 'radial' | 'split'
export type SlideRole     = 'portada' | 'problema' | 'valor' | 'comparacion' | 'cta'

export interface SlideSpec {
  role:        SlideRole
  bgColor:     string    // color de fondo dominante
  accentColor: string    // color de acento geométrico
  geometry:    SlideGeometry
  label:       string
}

// Paleta sellada — literales a propósito (dato de diseño, no CSS de componente).
const P = {
  blue:    '#0038BD',
  amber:   '#EF8E01',
  navy:    '#0D1B2E',
  white:   '#FFFFFF',
  success: '#16A34A',
  lblue:   '#4D7AFF',
} as const

// Override de paleta por nombre (carouselPreset). Reemplaza bg/accent de TODAS las
// slides manteniendo la geometría del arco. Nombre desconocido → se ignora (cae al arco).
export const CAROUSEL_PALETTES: Record<string, { bg: string; accent: string }> = {
  navy:  { bg: P.navy, accent: P.lblue },
  blue:  { bg: P.blue, accent: P.white },
  amber: { bg: P.navy, accent: P.amber },
}

export function buildNarrativeArc(slideCount: number): SlideSpec[] {
  const arcs: Record<number, SlideSpec[]> = {
    3: [
      { role: 'portada', bgColor: P.blue, accentColor: P.white, geometry: 'diagonal', label: 'Hook' },
      { role: 'valor',   bgColor: P.navy, accentColor: P.lblue, geometry: 'circles',  label: 'Beneficio' },
      { role: 'cta',     bgColor: P.blue, accentColor: P.amber, geometry: 'radial',   label: 'CTA' },
    ],
    4: [
      { role: 'portada',  bgColor: P.blue, accentColor: P.white, geometry: 'diagonal', label: 'Hook' },
      { role: 'problema', bgColor: P.navy, accentColor: P.lblue, geometry: 'grid',     label: 'Problema' },
      { role: 'valor',    bgColor: P.blue, accentColor: P.white, geometry: 'bars',     label: 'Beneficio' },
      { role: 'cta',      bgColor: P.navy, accentColor: P.amber, geometry: 'radial',   label: 'CTA' },
    ],
    5: [
      { role: 'portada',     bgColor: P.blue, accentColor: P.white,   geometry: 'diagonal', label: 'Hook' },
      { role: 'problema',    bgColor: P.navy, accentColor: P.lblue,   geometry: 'grid',     label: 'Problema' },
      { role: 'valor',       bgColor: P.blue, accentColor: P.white,   geometry: 'circles',  label: 'Beneficio' },
      { role: 'comparacion', bgColor: P.navy, accentColor: P.success, geometry: 'split',    label: 'Antes/Después' },
      { role: 'cta',         bgColor: P.blue, accentColor: P.amber,   geometry: 'radial',   label: 'CTA' },
    ],
  }
  if (slideCount > 5) {
    const base = arcs[5]!
    const extras: SlideSpec[] = Array.from({ length: slideCount - 5 }, (_, i) => ({
      role:        'valor' as SlideRole,
      bgColor:     i % 2 === 0 ? P.navy : P.blue,
      accentColor: i % 2 === 0 ? P.lblue : P.white,
      geometry:    (['bars', 'circles', 'grid'] as const)[i % 3],
      label:       `Beneficio ${i + 2}`,
    }))
    return [base[0]!, base[1]!, ...extras, base[3]!, base[4]!]
  }
  return arcs[slideCount] ?? arcs[3]!
}
