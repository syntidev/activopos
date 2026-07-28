import { readFileSync } from 'fs'
import sharp from 'sharp'
import { prisma } from '@/lib/prisma'
import { BILLING_CYCLES } from '@/lib/plan-limits'
import {
  ASSETS, buildNarrativeArc, CAROUSEL_PALETTES,
  pickLayoutForRole, pickBicolorLayoutForRole, pickPopLayoutForRole,
  type CarouselMode, type CarruselModoInput, type SlideGeometry, type SlideRole, type SlideSpec,
} from './brand'
import {
  buildSlideFrame, buildTituloSubtituloContent, buildCtaPrecioContent,
  buildChecklistContent, buildChatBubbleContent, splitTituloEnSegmentos,
  buildBicolorFrame, BICOLOR_ON_NAVY, BICOLOR_ON_ORANGE,
  buildBicolorMovimientoDecor, buildBicolorMovimientoContent,
  buildBicolorOfertaDecor, buildBicolorOfertaContent,
  buildBicolorChecklistDecor, buildBicolorChecklistContent,
  buildBicolorCtaDecor, buildBicolorCtaContent,
  buildPopFrame,
  buildPopGhostHeroDecor, buildPopGhostHeroContent,
  buildPopHighlightDecor, buildPopHighlightContent,
  buildPopChecklistDecor, buildPopChecklistContent,
  buildPopChatBubbleDecor, buildPopChatBubbleContent,
  buildPopCtaPrecioDecor, buildPopCtaPrecioContent,
  type TitleSegment,
} from './carousel-layouts'
import { generateCopy } from './gemini'
import { generateBackground } from './image'
import { generateBackgroundGemini, type SlideRole as ArtSlideRole } from './gemini-image'
import { composeSlide } from './compose'
import { renderSlideToPng, closeBrowser } from './render-slide'
import { uploadImage } from './cloudinary'

/**
 * Generación del carrusel (Sprint 118) — extraído de generate/route.ts a su propio módulo.
 *
 * Reemplaza el HTML plano que producía el LLM (html-generator) por diseño determinista: el
 * LLM (generateCopy) solo escribe copy por slide; el diseño lo pone código.
 *
 * Tres modos:
 *  - geometric: carousel-layouts (layout por rol) → Puppeteer (render-slide) → WebP.
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
  // Selector permutable. Cuando viene, manda sobre `mode`; `mode` queda como
  // compatibilidad para los productores que todavía no migraron.
  modoInput?:      CarruselModoInput
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

  // Familia de layouts que va a consumir el copy. Con modoInput sale de ahí;
  // sin él, del enum viejo. 'humano_puro' no consume ninguna familia (renderHuman
  // solo usa titulo/subtitulo/escena), así que mapea a 'human' igual que antes.
  const familiaEfectiva: CarouselMode = input.modoInput
    ? (input.modoInput.tipo === 'humano_puro' ? 'human' : (input.modoInput.familia ?? 'geometric'))
    : input.mode

  const copy   = await generateCopy({
    tipo: 'carrusel', nicho: input.nicho, gancho, objetivo: input.objetivo, slides: input.count,
    // generateCopy solo necesita saber QUÉ familia de layouts va a consumir el copy.
    // Se le pasa la familia derivada por el param carouselMode que ya tiene, en vez
    // de darle también el shape nuevo: no le hace falta el eje de escena humana.
    carouselMode: familiaEfectiva,
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
  // Sin default: si CarouselMode gana un 6to valor, assertNever rompe la compilación
  // acá en vez de que el modo nuevo caiga en silencio a 'geometric'.
  type RenderPath = 'human' | 'geometric' | 'bicolor' | 'pop'
  const assertNever = (x: never): never => {
    throw new Error(`CarouselMode sin rama en renderPathFor: ${String(x)}`)
  }
  const renderPathFor = (i: number): RenderPath => {
    // CarouselFamilia ('geometric'|'bicolor'|'pop') es subconjunto exacto de
    // RenderPath, verificado contra los dos unions: se devuelve sin mapear.
    // `familia` es opcional en el tipo aunque el shape la exija con tipo:'familia',
    // así que el ?? cubre el body malformado sin tumbar la generación.
    if (input.modoInput) {
      const m = input.modoInput
      if (m.tipo === 'humano_puro') return 'human'
      if (i === 0 && m.incluirEscenaHumana) return 'human'
      return m.familia ?? 'geometric'
    }
    // Sin modoInput se conserva el comportamiento viejo, tal cual.
    switch (input.mode) {
      case 'human':     return 'human'
      case 'hybrid':    return i === 0 ? 'human' : 'geometric'
      case 'bicolor':   return 'bicolor'
      case 'pop':       return 'pop'
      case 'geometric': return 'geometric'
      default:          return assertNever(input.mode)
    }
  }

  // Los 4 layouts bicolor en uso parten el título en [antes] + [resaltado]. Se
  // reusa el tituloHighlight que ya valida sanitizeSlide; si no vino, se resalta
  // la última palabra para que el marcador nunca quede vacío.
  const partirTitulo = (titulo: string, highlight?: string): { pre: string; hl: string } => {
    if (highlight && titulo.includes(highlight)) {
      const idx = titulo.indexOf(highlight)
      return { pre: titulo.slice(0, idx).trim(), hl: highlight }
    }
    const palabras = titulo.trim().split(/\s+/)
    if (palabras.length < 2) return { pre: '', hl: titulo.trim() }
    return { pre: palabras.slice(0, -1).join(' '), hl: palabras[palabras.length - 1]! }
  }

  const renderGeometric = async (spec: SlideSpec, i: number): Promise<string> => {
    const layout = pickLayoutForRole(spec.role)
    const copy   = slides[i]

    let contentHtml: string
    switch (layout) {
      case 'ghost-hero':
        contentHtml = buildTituloSubtituloContent(
          [{ text: copy.titulo }], copy.subtitulo, spec.accentColor,
        )
        break
      case 'highlight-text': {
        // sanitizeSlide ya descarta el highlight que no es substring; el includes
        // vuelve a chequear porque este switch no depende de esa garantía.
        const segments: TitleSegment[] = copy.tituloHighlight && copy.titulo.includes(copy.tituloHighlight)
          ? splitTituloEnSegmentos(copy.titulo, copy.tituloHighlight)
          : [{ text: copy.titulo }]   // fallback sin resaltado
        contentHtml = buildTituloSubtituloContent(segments, copy.subtitulo, spec.accentColor)
        break
      }
      case 'checklist':
        contentHtml = buildChecklistContent({
          titulo: copy.titulo,
          items: (copy.items && copy.items.length >= 3) ? copy.items : [copy.subtitulo],
        })
        break
      case 'chat-bubble':
        contentHtml = buildChatBubbleContent({
          titulo: copy.titulo,
          clienteTexto:   copy.clienteTexto ?? copy.subtitulo,
          clienteHora:    copy.clienteHora ?? '6:42 p.m.',
          respuestaTexto: copy.respuestaTexto ?? 'Listo, ya quedó registrada tu venta',
        })
        break
      case 'curva-corte':
        throw new Error('curva-corte: statValor no tiene fuente de dato real -- no reasignar a ningún rol sin resolver esto primero')
      case 'cta-precio': {
        const plan = BILLING_CYCLES.negocio_activo.mensual
        contentHtml = buildCtaPrecioContent({
          tituloPre: '', tituloAccent: copy.titulo, tituloPost: '',
          subtitulo: copy.subtitulo, planNombre: 'Plan Negocio Activo',
          precioUsd: plan.totalAmount, ctaLabel: 'Empezar gratis',
        })
        break
      }
      default:
        // pickLayoutForRole solo devuelve los 4 de arriba. Los otros 6 layouts
        // necesitan campos que SlideCopy no tiene (items[], clienteTexto...) --
        // si esta rama corre, cambió pickLayoutForRole sin cambiar SlideCopy.
        throw new Error(`layout '${layout}' sin implementación en renderGeometric -- sin rol asignado aún`)
    }

    const html = buildSlideFrame({
      ghostNumber: i + 1, eyebrowText: 'Serie Activo · Ventas del día',
      accentColor: spec.accentColor, isCtaSlide: layout === 'cta-precio',
      slideNumber: i + 1, totalSlides: slides.length,
      contentHtml, logoSvg: LOGO_SVG,
    })
    // Override local: los layouts de carousel-layouts miden 1080x1350 fijo. Con el
    // ASPECT del módulo ('1:1') el screenshot recorta los 270px de abajo y se pierden
    // el lockup y el badge 'N / total'. renderHuman sigue en ASPECT sin cambios.
    const png  = await renderSlideToPng(html, '4:5')
    const webp = await sharp(png).webp({ quality: 92 }).toBuffer()
    return uploadImage(webp, 'image/webp')
  }

  // Fondo por layout bicolor: las paletas solo traen colores de texto/chrome. Cada
  // decor está calibrado sobre uno de los dos fondos (mismo pairing que certificó
  // scripts/carousel-layouts-check.ts).
  const NAVY_BG   = '#0038BD'
  const ORANGE_BG = '#EF8E01'

  const renderBicolor = async (spec: SlideSpec, i: number): Promise<string> => {
    const layout = pickBicolorLayoutForRole(spec.role) ?? 'movimiento'
    const copy   = slides[i]
    const { pre, hl } = partirTitulo(copy.titulo, copy.tituloHighlight)

    let contentHtml: string
    let decorSvg:    string
    let bgColor:     string
    let palette:     typeof BICOLOR_ON_NAVY | typeof BICOLOR_ON_ORANGE

    switch (layout) {
      case 'movimiento':
        contentHtml = buildBicolorMovimientoContent({
          lineas: pre ? [pre] : [], highlight: hl, subtitulo: copy.subtitulo,
        })
        decorSvg = buildBicolorMovimientoDecor(); bgColor = NAVY_BG; palette = BICOLOR_ON_NAVY
        break
      case 'oferta':
        contentHtml = buildBicolorOfertaContent({
          statPrefix: pre, highlight: hl, subtitulo: copy.subtitulo,
        })
        decorSvg = buildBicolorOfertaDecor(); bgColor = ORANGE_BG; palette = BICOLOR_ON_ORANGE
        break
      case 'checklist':
        contentHtml = buildBicolorChecklistContent({
          titulo: pre, highlight: hl,
          items: (copy.items && copy.items.length >= 3) ? copy.items : [copy.subtitulo],
        })
        decorSvg = buildBicolorChecklistDecor(); bgColor = NAVY_BG; palette = BICOLOR_ON_NAVY
        break
      case 'cta':
        contentHtml = buildBicolorCtaContent({
          tituloPre: pre, highlight: hl, tituloPost: '',
          subtitulo: copy.subtitulo, ctaLabel: 'Empezar gratis',
        })
        decorSvg = buildBicolorCtaDecor(); bgColor = ORANGE_BG; palette = BICOLOR_ON_ORANGE
        break
      case 'testimonio':
      case 'stat':
        // pickBicolorLayoutForRole no los devuelve. Si llegan acá alguien cambió el
        // mapeo sin resolver la atribución del testimonio ni la fuente del stat.
        throw new Error(`bicolor '${layout}' sin fuente de dato real -- no reasignar a ningún rol sin resolver esto primero`)
    }

    const html = buildBicolorFrame({
      ...palette, bgColor, categoryLabel: spec.label,
      slideNumber: i + 1, totalSlides: slides.length,
      contentHtml, decorSvg, logoSvg: LOGO_SVG,
    })
    const png  = await renderSlideToPng(html, '4:5')
    const webp = await sharp(png).webp({ quality: 92 }).toBuffer()
    return uploadImage(webp, 'image/webp')
  }

  const renderPop = async (spec: SlideSpec, i: number): Promise<string> => {
    const layout = pickPopLayoutForRole(spec.role) ?? 'ghost-hero'
    const copy   = slides[i]

    let contentHtml: string
    let decorSvg:    string

    switch (layout) {
      case 'ghost-hero':
        contentHtml = buildPopGhostHeroContent({ titulo: copy.titulo, subtitulo: copy.subtitulo })
        decorSvg = buildPopGhostHeroDecor(i + 1)
        break
      case 'highlight-text': {
        const segments: TitleSegment[] = copy.tituloHighlight && copy.titulo.includes(copy.tituloHighlight)
          ? splitTituloEnSegmentos(copy.titulo, copy.tituloHighlight)
          : [{ text: copy.titulo }]
        contentHtml = buildPopHighlightContent(segments, copy.subtitulo)
        decorSvg = buildPopHighlightDecor()
        break
      }
      case 'checklist':
        contentHtml = buildPopChecklistContent({
          titulo: copy.titulo,
          items: (copy.items && copy.items.length >= 3) ? copy.items : [copy.subtitulo],
        })
        decorSvg = buildPopChecklistDecor()
        break
      case 'chat-bubble':
        contentHtml = buildPopChatBubbleContent({
          titulo: copy.titulo,
          clienteTexto:   copy.clienteTexto ?? copy.subtitulo,
          clienteHora:    copy.clienteHora ?? '6:42 p.m.',
          respuestaTexto: copy.respuestaTexto ?? 'Listo, ya quedó registrada tu venta',
        })
        decorSvg = buildPopChatBubbleDecor()
        break
      case 'cta-precio': {
        const plan = BILLING_CYCLES.negocio_activo.mensual
        contentHtml = buildPopCtaPrecioContent({
          tituloPre: '', tituloAccent: copy.titulo, tituloPost: '',
          subtitulo: copy.subtitulo, planNombre: 'Plan Negocio Activo',
          precioUsd: plan.totalAmount, ctaLabel: 'Empezar gratis',
        })
        decorSvg = buildPopCtaPrecioDecor()
        break
      }
      case 'foto-lateral':
        // pickPopLayoutForRole no lo devuelve: no hay fuente de foto real por slide.
        throw new Error("pop 'foto-lateral' sin fuente de foto real -- no reasignar a ningún rol sin resolver esto primero")
    }

    const html = buildPopFrame({
      slideNumber: i + 1, totalSlides: slides.length, contentHtml, decorSvg,
    })
    const png  = await renderSlideToPng(html, '4:5')
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
      formato: 'post', aspect: ASPECT, nicho: input.nicho,
    })
    return uploadImage(composed, 'image/webp')
  }

  // Secuencial a propósito: renderSlideToPng comparte un pool de Puppeteer no concurrente y
  // generateBackgroundGemini pega contra rate limits — el paralelo (Promise.all) los rompe.
  const assets: CarruselAsset[] = []
  try {
    for (let i = 0; i < slides.length; i++) {
      const spec = specFor(i)
      const path = renderPathFor(i)
      const imagen_url =
        path === 'human'   ? await renderHuman(spec, i)   :
        path === 'bicolor' ? await renderBicolor(spec, i) :
        path === 'pop'     ? await renderPop(spec, i)     :
                             await renderGeometric(spec, i)
      assets.push({ orden: i, imagen_url, titulo: slides[i].titulo, subtitulo: slides[i].subtitulo })
    }
  } finally {
    await closeBrowser()
  }

  return { assets, caption: copy.caption, hashtags: copy.hashtags }
}
