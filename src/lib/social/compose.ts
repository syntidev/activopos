import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import sharp from 'sharp'
import { ASSETS, ASPECT_DIMENSIONS, BRAND, type Aspect, type SocialFormat } from './brand'

/**
 * Composición del overlay de marca sobre el fondo generado por Gemini.
 *
 * Reemplaza la composición html2canvas de C:\socialia\App.tsx (L456-529). html2canvas
 * solo corre en el navegador (necesita DOM + getComputedStyle), así que no sirve dentro
 * de un route handler. sharp — ya instalado en el proyecto — hace lo mismo server-side:
 * el endpoint entrega la imagen terminada en una sola llamada, sin round-trip al cliente.
 *
 * Las fuentes se cargan por fontfile desde el repo, no del sistema: el VPS no necesita
 * tener Fraunces ni Inter instaladas y el render es idéntico en Windows y Linux.
 */

const MARGIN     = 72   // margen de seguridad de Instagram
const LOGO_SIZE  = 84
const TEXT_WIDTH = 936  // 1080 - 2*72
const ACCENT_W   = 88
const ACCENT_H   = 5

// El SVG negativo trae un <rect> navy opaco de fondo (L22) porque está pensado como icono
// de app. Sobre una foto eso dibuja un cuadro. Se retira para dejar el isotipo transparente.
const logoSvg = Buffer.from(
  readFileSync(ASSETS.logoNegative, 'utf8').replace(/<rect[^>]*fill="#0D1B2E"[^>]*\/>/, ''),
)

// Variante positiva (isotipo oscuro) para fondos claros — el editor la ofrece
// como logoType 'positive'. Se le quita el <rect> de fondo (navy o blanco) para
// dejar el isotipo transparente sobre la foto, igual que a la negativa.
const logoPositiveSvg = Buffer.from(
  readFileSync(join(process.cwd(), 'public', 'activopos-logo-positive.svg'), 'utf8')
    .replace(/<rect[^>]*(fill="#0D1B2E"|fill="#FFFFFF")[^>]*\/>/i, ''),
)

// Mockups de dispositivos (PNG transparentes) compuestos centrados como protagonista
// de la escena (Sprint 134, reemplaza el overlay de pantalla del 133). Se leen UNA vez
// al cargar el módulo; un asset ausente → skip silencioso.
function loadAsset(filename: string): Buffer | null {
  const p = join(process.cwd(), 'public', 'assets', filename)
  return existsSync(p) ? readFileSync(p) : null
}

type DeviceVariant = 'front' | 'left' | 'right' | 'pos_black' | 'pos_white' | 'none'

const DEVICE_ASSETS: Record<Exclude<DeviceVariant, 'none'>, Buffer | null> = {
  front:     loadAsset('front_movil_asset.png'),
  left:      loadAsset('left_movil_asset.png'),
  right:     loadAsset('right_movil_asset.png'),
  pos_black: loadAsset('pos_black.png'),
  pos_white: loadAsset('pos_white.png'),
}

// Nichos con terminal POS en mostrador; el resto usa teléfono.
const POS_NICHOS = ['abastos', 'carniceria', 'farmacia', 'ferreteria', 'panaderia']

// Si el caller/editor fija una variante (incluida 'none'), gana; si no, auto por nicho.
function selectDevice(nicho: string, variant?: DeviceVariant): DeviceVariant {
  if (variant) return variant
  if (POS_NICHOS.includes(nicho.toLowerCase())) {
    return Math.random() > 0.5 ? 'pos_black' : 'pos_white'
  }
  const phones: DeviceVariant[] = ['front', 'left', 'right']
  return phones[Math.floor(Math.random() * phones.length)]
}

// Pango interpreta markup: un &, < o > del copy rompería el render.
function escapeMarkup(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

async function renderText(
  text: string,
  opts: {
    fontfile: string; font: string; size: number; color: string; weight: string
    align?: 'left' | 'center' | 'right'
  },
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const buffer = await sharp({
    text: {
      // dpi 72 → 1pt equivale a 1px, así los tamaños se razonan en píxeles del lienzo.
      dpi:      72,
      text:     `<span foreground="${opts.color}" size="${opts.size}pt" weight="${opts.weight}">${escapeMarkup(text)}</span>`,
      font:     opts.font,
      fontfile: opts.fontfile,
      width:    TEXT_WIDTH,
      align:    opts.align ?? 'left',
      rgba:     true,
    },
  }).png().toBuffer()

  const meta = await sharp(buffer).metadata()
  return { buffer, width: meta.width ?? 0, height: meta.height ?? 0 }
}

export interface ComposeInput {
  background: Buffer
  titulo:     string
  subtitulo:  string
  formato:    SocialFormat   // solo determina tamaño de fuente (story = letras más grandes)
  aspect:     Aspect         // determina el lienzo final -- selector del formulario
  nicho?:     string         // segmento — decide el dispositivo automático (POS vs teléfono)
  deviceVariant?: DeviceVariant  // fuerza un dispositivo; ausente = auto por nicho
  override?:  LayerOverride  // ajustes del editor; ausente = posiciones/estilos fijos de siempre
}

/**
 * Ajustes por capa desde el editor interactivo (Fase B). Cada campo es opcional:
 * el que no venga usa el default de la composición fija actual, así componer sin
 * override reproduce exactamente el resultado anterior (cero regresión).
 *
 * Posiciones (x, y): esquina superior-izquierda de la capa en píxeles del lienzo
 * final (mismo sistema que sharp: 0,0 arriba-izquierda).
 */
export interface LayerOverride {
  titlePos?:       { x: number; y: number }
  subtitlePos?:    { x: number; y: number }
  logoPos?:        { x: number; y: number }
  titleSize?:      number
  subtitleSize?:   number
  logoSize?:       number
  titleColor?:     string
  subtitleColor?:  string
  logoType?:       'negative' | 'positive'
  showLogo?:       boolean
  showTitle?:      boolean
  showSubtitle?:   boolean
  titleAlign?:     'left' | 'center' | 'right'
  subtitleAlign?:  'left' | 'center' | 'right'
  titleShadow?:    boolean
  subtitleShadow?: boolean
  deviceVariant?:  DeviceVariant   // override del dispositivo desde el editor; ausente = auto
}

// Sombra: Pango no tiene text-shadow (ni feGaussianBlur sobre su render), así que se
// compone un duplicado negro detrás del texto. Doble capa (Sprint 115): una exterior
// difuminada con sharp .blur() y una interior nítida, para que el título sea legible
// sobre CUALQUIER fondo — claro u oscuro — sin perder nunca el arte generado.
const SHADOW_OFFSET_OUTER = 3
const SHADOW_OFFSET_INNER = 1
const SHADOW_BLUR         = 4
const SHADOW_COLOR        = '#000000E6'   // negro ~0.9

export async function composeSlide(input: ComposeInput): Promise<Buffer> {
  const { width, height } = ASPECT_DIMENSIONS[input.aspect]
  const ov = input.override ?? {}

  const showTitle    = ov.showTitle    ?? true
  const showSubtitle = ov.showSubtitle ?? true
  const showLogo     = ov.showLogo     ?? true

  // Sombra siempre activa salvo que el editor la apague explícitamente (default: true).
  const titleShadow    = ov.titleShadow    ?? true
  const subtitleShadow = ov.subtitleShadow ?? true

  // Tamaño por aspect (lienzo), no por formato: el ratio manda el espacio real disponible.
  const TITLE_BY_ASPECT:    Record<Aspect, number> = { '9:16': 80, '4:5': 64, '3:4': 60, '1:1': 56 }
  const SUBTITLE_BY_ASPECT: Record<Aspect, number> = { '9:16': 36, '4:5': 34, '3:4': 32, '1:1': 30 }
  const titleSize    = ov.titleSize    ?? TITLE_BY_ASPECT[input.aspect]
  const subtitleSize = ov.subtitleSize ?? SUBTITLE_BY_ASPECT[input.aspect]

  const [title, subtitle] = await Promise.all([
    renderText(input.titulo, {
      fontfile: ASSETS.fontDisplay, font: 'Fraunces',
      size: titleSize, color: ov.titleColor ?? BRAND.onBrand, weight: 'bold',
      align: ov.titleAlign ?? 'left',
    }),
    renderText(input.subtitulo, {
      fontfile: ASSETS.fontBody, font: 'Inter',
      size: subtitleSize, color: ov.subtitleColor ?? BRAND.onBrand, weight: '600',
      align: ov.subtitleAlign ?? 'left',
    }),
  ])

  // Posiciones default (Sprint 115): bloque de texto en el TERCIO SUPERIOR — acento,
  // título, subtítulo apilados desde arriba. El fondo se genera con la zona superior
  // despejada (ver gemini-image.ts/image.ts). El override pisa la esquina de cada capa.
  const titleTop     = ov.titlePos?.y    ?? Math.floor(height * 0.15)
  const titleLeft    = ov.titlePos?.x    ?? MARGIN
  const subtitleTop  = ov.subtitlePos?.y ?? (titleTop + title.height + 16)
  const subtitleLeft = ov.subtitlePos?.x ?? MARGIN
  const accentTop    = titleTop - 32 - ACCENT_H

  // Scrim de protección para el bloque de texto, ahora en el tercio SUPERIOR: oscurece
  // desde arriba y se desvanece antes de la mitad, dejando el fondo inferior limpio
  // (criterio del brief). La sombra doble del texto cubre el resto sobre fondos claros.
  const textBottom = subtitleTop + subtitle.height
  const scrimEnd   = Math.min(0.55, (textBottom + 80) / height)

  const scrim = Buffer.from(`<svg width="${width}" height="${height}">
    <defs>
      <linearGradient id="s" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${BRAND.primaryDark}" stop-opacity="0.88"/>
        <stop offset="${(scrimEnd * 0.5).toFixed(3)}" stop-color="${BRAND.primaryDark}" stop-opacity="0.55"/>
        <stop offset="${scrimEnd.toFixed(3)}" stop-color="${BRAND.primaryDark}" stop-opacity="0"/>
        <stop offset="1" stop-color="${BRAND.primaryDark}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#s)"/>
  </svg>`)

  const accent = Buffer.from(
    `<svg width="${ACCENT_W}" height="${ACCENT_H}">
      <rect width="${ACCENT_W}" height="${ACCENT_H}" rx="${ACCENT_H / 2}" fill="${BRAND.primaryLight}"/>
    </svg>`,
  )

  const logoSize = ov.logoSize ?? LOGO_SIZE
  const logoSrc  = (ov.logoType ?? 'negative') === 'positive' ? logoPositiveSvg : logoSvg
  const logo     = await sharp(logoSrc).resize({ width: logoSize }).png().toBuffer()
  // Logo default en la esquina INFERIOR-izquierda (Sprint 115): el tercio superior
  // queda libre para el texto. El editor lo reposiciona con logoPos si hace falta.
  const logoTop  = ov.logoPos?.y ?? (height - MARGIN - logoSize)
  const logoLeft = ov.logoPos?.x ?? MARGIN

  // La marca no tiene asset de wordmark, solo el isotipo (brackets + círculo).
  // El lockup se arma aquí: isotipo + nombre en Inter.
  const wordmark = await renderText(BRAND.name, {
    fontfile: ASSETS.fontBody, font: 'Inter', size: 34, color: BRAND.onBrand, weight: 'bold',
  })

  const base = await sharp(input.background)
    .resize(width, height, { fit: 'cover', position: 'centre' })
    .toBuffer()

  // Sombra opcional por capa: duplicado negro renderizado aparte, compuesto
  // detrás y desplazado. Solo se genera cuando la capa la pide.
  const shadowOf = async (text: string, size: number, align: 'left' | 'center' | 'right', font: string, fontfile: string, weight: string) =>
    (await renderText(text, { fontfile, font, size, color: SHADOW_COLOR, weight, align })).buffer

  const layers: sharp.OverlayOptions[] = [{ input: scrim, top: 0, left: 0 }]

  // Dispositivo protagonista (mockup PNG) centrado en el tercio inferior — solo post/story
  // (el carrusel geométrico no lo lleva). Va ANTES del logo y el texto para que estos
  // queden por encima si se solapan. Skip silencioso si el asset no existe.
  if (input.formato !== 'carrusel') {
    const variant      = selectDevice(input.nicho ?? 'general', ov.deviceVariant ?? input.deviceVariant)
    const deviceBuffer = variant !== 'none' ? DEVICE_ASSETS[variant] : null
    if (deviceBuffer) {
      const deviceW = Math.floor(width * 0.55)   // ~55% del ancho, centrado horizontalmente
      const meta    = await sharp(deviceBuffer).metadata()
      const deviceH = Math.floor(deviceW * (meta.height ?? 800) / (meta.width ?? 400))
      const deviceResized = await sharp(deviceBuffer)
        .resize(deviceW, deviceH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer()
      layers.push({
        input: deviceResized,
        top:   Math.floor(height * 0.38),
        left:  Math.floor((width - deviceW) / 2),
      })
    }
  }

  if (showLogo) {
    layers.push({ input: logo, top: logoTop, left: logoLeft })
    layers.push({
      input: wordmark.buffer,
      top:  logoTop + Math.round((logoSize - wordmark.height) / 2),
      left: logoLeft + logoSize + 20,
    })
  }
  if (showTitle) {
    layers.push({ input: accent, top: accentTop, left: titleLeft })
    if (titleShadow) {
      const sh = await shadowOf(input.titulo, titleSize, ov.titleAlign ?? 'left', 'Fraunces', ASSETS.fontDisplay, 'bold')
      layers.push({ input: await sharp(sh).blur(SHADOW_BLUR).toBuffer(), top: titleTop + SHADOW_OFFSET_OUTER, left: titleLeft + SHADOW_OFFSET_OUTER })
      layers.push({ input: sh, top: titleTop + SHADOW_OFFSET_INNER, left: titleLeft + SHADOW_OFFSET_INNER })
    }
    layers.push({ input: title.buffer, top: titleTop, left: titleLeft })
  }
  if (showSubtitle) {
    if (subtitleShadow) {
      const sh = await shadowOf(input.subtitulo, subtitleSize, ov.subtitleAlign ?? 'left', 'Inter', ASSETS.fontBody, '600')
      layers.push({ input: await sharp(sh).blur(SHADOW_BLUR).toBuffer(), top: subtitleTop + SHADOW_OFFSET_OUTER, left: subtitleLeft + SHADOW_OFFSET_OUTER })
      layers.push({ input: sh, top: subtitleTop + SHADOW_OFFSET_INNER, left: subtitleLeft + SHADOW_OFFSET_INNER })
    }
    layers.push({ input: subtitle.buffer, top: subtitleTop, left: subtitleLeft })
  }

  return sharp(base).composite(layers).webp({ quality: 92 }).toBuffer()
}
