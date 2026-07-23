import { readFileSync } from 'fs'
import sharp from 'sharp'
import { prisma } from '@/lib/prisma'
import {
  ASSETS, buildNarrativeArc, CAROUSEL_PALETTES,
  type CarouselMode, type SlideGeometry, type SlideRole, type SlideSpec,
} from './brand'
import { generateCopy } from './gemini'
import { generateBackground } from './image'
import { generateBackgroundGemini, type SlideRole as ArtSlideRole } from './gemini-image'
import { composeSlide } from './compose'
import { renderSlideToPng, closeBrowser } from './render-slide'
import { uploadImage } from './cloudinary'
import { buildSlideHTML } from './slide-template'

/**
 * Generación del carrusel (Sprint 118) — extraído de generate/route.ts a su propio módulo.
 *
 * Reemplaza el HTML plano que producía el LLM (html-generator) por diseño determinista: el
 * LLM (generateCopy) solo escribe copy por slide; el diseño lo pone código.
 *
 * Tres modos:
 *  - geometric: buildSlideHTML (geometría de marca) → Puppeteer (render-slide) → WebP.
 *  - human:     pipeline de posts (generateBackgroundGemini → composeSlide) por slide.
 *  - hybrid:    slide 0 (portada) humano; resto geométrico (el CTA ya es radial ámbar en el arco).
 *
 * Carrusel fijo a 1:1 (1080×1080): el template geométrico está diseñado cuadrado y así los
 * modos no mezclan proporciones. Ignora el aspect del formulario a propósito.
 */

const ASPECT = '1:1' as const

// Isotipo negativo (blanco) sin el <rect> navy de fondo — igual criterio que compose.ts —
// para que quede transparente sobre el color del slide. Se lee una vez al cargar el módulo.
const LOGO_SVG = readFileSync(ASSETS.logoNegative, 'utf8')
  .replace(/<rect[^>]*fill="#0D1B2E"[^>]*\/>/, '')

export interface CarruselAsset {
  orden:      number
  imagen_url: string
  titulo:     string
  subtitulo:  string
}

export interface CarruselInput {
  nicho:           string
  gancho?:         string
  objetivo:        string
  count:           number
  segmentSlug?:    string
  mode:            CarouselMode
  geometryType?:   SlideGeometry   // override: fuerza una geometría en todas las slides geométricas
  carouselPreset?: string          // override de paleta (CAROUSEL_PALETTES)
}

// carrusel usa 'valor'; el motor de arte (gemini-image) usa 'beneficio' — mismo rol, otro nombre.
function toArtRole(role: SlideRole): ArtSlideRole {
  return role === 'valor' ? 'beneficio' : role
}

// El copy necesita un gancho. Si el usuario dio uno, se usa; si eligió un segmento, se
// reconstruye desde headline + dolores reales (la riqueza que resolvía html-generator).
async function resolveGancho(input: CarruselInput): Promise<string> {
  if (input.gancho?.trim()) return input.gancho.trim()
  if (input.segmentSlug) {
    const seg = await prisma.segment.findUnique({ where: { slug: input.segmentSlug } })
    if (seg) return `${seg.headline}. Dolores reales: ${seg.pain_1}, ${seg.pain_2}, ${seg.pain_3}`
  }
  return `Contenido de valor para una ${input.nicho} venezolana`
}

export async function generateCarrusel(
  input: CarruselInput,
): Promise<{ assets: CarruselAsset[]; caption: string; hashtags: string[] }> {
  const gancho = await resolveGancho(input)

  const copy   = await generateCopy({
    tipo: 'carrusel', nicho: input.nicho, gancho, objetivo: input.objetivo, slides: input.count,
  })
  const slides = copy.slides.slice(0, input.count)
  if (slides.length === 0) throw new Error('generateCopy no devolvió slides para el carrusel')

  const arc     = buildNarrativeArc(slides.length)
  const palette = input.carouselPreset ? CAROUSEL_PALETTES[input.carouselPreset] : undefined

  const specFor = (i: number): SlideSpec => {
    const base = arc[i] ?? arc[arc.length - 1]!
    return palette ? { ...base, bgColor: palette.bg, accentColor: palette.accent } : base
  }

  // hybrid: solo la portada (slide 0) va por el pipeline humano; el resto geométrico.
  const isHumanSlide = (i: number): boolean =>
    input.mode === 'human' ? true : input.mode === 'hybrid' ? i === 0 : false

  const renderGeometric = async (spec: SlideSpec, i: number): Promise<string> => {
    const html = buildSlideHTML({
      titulo:      slides[i].titulo,
      subtitulo:   slides[i].subtitulo,
      spec,
      slideNumber: i + 1,
      totalSlides: slides.length,
      brandName:   'ActivoPOS',
      logoSvg:     LOGO_SVG,
      geometryType: input.geometryType,
    })
    const png  = await renderSlideToPng(html, ASPECT)
    const webp = await sharp(png).webp({ quality: 92 }).toBuffer()
    return uploadImage(webp, 'image/webp')
  }

  const renderHuman = async (spec: SlideSpec, i: number): Promise<string> => {
    let background: Buffer
    try {
      background = await generateBackgroundGemini({
        escena: slides[i].escena, nicho: input.nicho, aspect: ASPECT,
        slideRole: toArtRole(spec.role), slideIndex: i,
      })
    } catch {
      background = await generateBackground(slides[i].escena, input.nicho, ASPECT)
    }
    const composed = await composeSlide({
      background, titulo: slides[i].titulo, subtitulo: slides[i].subtitulo,
      formato: 'post', aspect: ASPECT,
    })
    return uploadImage(composed, 'image/webp')
  }

  // Secuencial a propósito: renderSlideToPng comparte un pool de Puppeteer no concurrente y
  // generateBackgroundGemini pega contra rate limits — el paralelo (Promise.all) los rompe.
  const assets: CarruselAsset[] = []
  try {
    for (let i = 0; i < slides.length; i++) {
      const spec = specFor(i)
      const imagen_url = isHumanSlide(i)
        ? await renderHuman(spec, i)
        : await renderGeometric(spec, i)
      assets.push({ orden: i, imagen_url, titulo: slides[i].titulo, subtitulo: slides[i].subtitulo })
    }
  } finally {
    await closeBrowser()
  }

  return { assets, caption: copy.caption, hashtags: copy.hashtags }
}
