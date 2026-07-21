import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateCopy } from '@/lib/social/gemini'
import { generateBackground } from '@/lib/social/image'
import { generateBackgroundGemini } from '@/lib/social/gemini-image'
import { composeSlide } from '@/lib/social/compose'
import { uploadImage } from '@/lib/social/cloudinary'
import { generateHtmlContent } from '@/lib/social/html-generator'
import { renderSlideToPng, closeBrowser } from '@/lib/social/render-slide'
import type { Aspect } from '@/lib/social/brand'
import type { SceneDirection } from '@/lib/social/image'

type Asset = { orden: number; imagen_url: string; titulo: string; subtitulo: string }

// Carrusel (Fase B+C): copy+HTML por html-generator, cada slide renderizado a PNG por
// Puppeteer y subido a Cloudinary. Reemplaza el pipeline de imagen única (difusión) solo
// para carrusel; post/story siguen con difusión (imagen fotográfica de fondo).
async function generateCarrusel(
  nicho: string, gancho: string | undefined, objetivo: string, count: number,
  segmentSlug: string | undefined, stylePresetId: number | undefined, aspect: Aspect,
): Promise<{ assets: Asset[]; caption: string; hashtags: string[] }> {
  const content = await generateHtmlContent({
    topic: gancho, segment_slug: segmentSlug, segmento: nicho, objetivo,
    formato: 'carrusel', style_preset_id: stylePresetId,
  })
  const slides = content.slides.slice(0, count)
  if (slides.length === 0) throw new Error('El motor de contenido no devolvió slides')

  const assets: Asset[] = []
  try {
    for (let i = 0; i < slides.length; i++) {
      const png = await renderSlideToPng(slides[i].html, aspect)
      assets.push({
        orden:      i,
        imagen_url: await uploadImage(png, 'image/png'),
        titulo:     slides[i].notes || `Slide ${i + 1}`,
        subtitulo:  '',
      })
    }
  } finally {
    await closeBrowser()
  }
  return { assets, caption: content.caption, hashtags: content.hashtags }
}

// El copy sale de Gemini; la imagen de NVIDIA NIM (~9s por slide). Un carrusel de 6
// slides pasa de largo el default de Next.js.
export const runtime     = 'nodejs'
export const maxDuration = 300

const bodySchema = z.object({
  tipo:             z.enum(['post', 'story', 'carrusel']),
  nicho:            z.string().min(1).max(80),
  gancho:           z.string().max(300).optional(),
  segment_slug:     z.string().max(80).optional(),
  beneficio:        z.string().max(300).optional(),
  objetivo:         z.string().min(1).max(120),
  slides:           z.number().int().min(1).max(8).optional(),
  style_preset_id:  z.number().int().positive().optional(),
  aspect:           z.enum(['1:1', '4:5', '3:4', '9:16']).default('4:5'),
  // Preset de color forzado desde el formulario. Si no viene, el motor elige
  // automático por rol de slide. Solo aplica a difusión (post/story).
  preset:           z.enum(['NAVY_TECH', 'SKY_LIGHT', 'WARM_SAND', 'VIBRANT_AMBER', 'CLEAN_WHITE']).optional(),
  // Dirección de escena real (PIEZA 1) -- solo aplica al motor de difusión (post/story).
  personaje:        z.string().max(200).optional(),
  lugar:            z.string().max(200).optional(),
  accion:           z.string().max(200).optional(),
}).refine(
  b => b.tipo === 'carrusel' ? (!!b.gancho?.trim() || !!b.segment_slug) : !!b.gancho?.trim(),
  { message: 'Debes dar un gancho (o, en carrusel, elegir un segmento)', path: ['gancho'] },
)


export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role !== 'super_admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await req.json())
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const slideCount = body.tipo === 'carrusel' ? (body.slides ?? 4) : 1

  // Se crea en 'pendiente' antes de llamar a Gemini: si la generación muere a mitad de un
  // carrusel queda rastro en DB con el error, en vez de desaparecer sin dejar huella.
  // Con segment_slug (sin gancho) el título real sale del contenido generado -- se
  // sobreescribe abajo con assets[0].titulo; este es solo el placeholder de la fila 'pendiente'.
  const tituloPlaceholder = body.gancho?.trim()
    ? body.gancho.slice(0, 200)
    : `Segmento: ${body.segment_slug}`

  const post = await prisma.socialPost.create({
    data: {
      tipo:        body.tipo,
      nicho:       body.nicho,
      titulo:      tituloPlaceholder,
      descripcion: body.beneficio ?? null,
      estado:      'pendiente',
    },
  })

  try {
    let assets: Asset[]
    let caption: string
    let hashtags: string[]
    let contentEngine: string
    // Fondos crudos para el editor (post/story). Vacío en carrusel (HTML, no edita).
    let backgroundUrls: string[] = []

    if (body.tipo === 'carrusel') {
      // Fase B+C: HTML renderizado a PNG.
      const r = await generateCarrusel(
        body.nicho, body.gancho, body.objetivo, slideCount,
        body.segment_slug, body.style_preset_id, body.aspect,
      )
      assets = r.assets; caption = r.caption; hashtags = r.hashtags; contentEngine = 'html_render'
    } else {
      // post/story: imagen fotográfica de fondo (difusión NVIDIA) + overlay sharp.
      // El refine de bodySchema ya garantiza gancho presente aquí (solo carrusel admite
      // segment_slug como sustituto); este guard solo estrecha el tipo para TS.
      if (!body.gancho) throw new Error('gancho requerido para post/story')
      const copy = await generateCopy({
        tipo: body.tipo, nicho: body.nicho, gancho: body.gancho,
        beneficio: body.beneficio, objetivo: body.objetivo, slides: slideCount,
      })
      const slides = copy.slides.slice(0, slideCount)
      if (slides.length === 0) throw new Error('Gemini no devolvió slides')

      const direction: SceneDirection = {
        personaje: body.personaje, lugar: body.lugar, accion: body.accion,
      }
      assets = []
      // Fondos crudos (sin overlay) por slide. NO se persisten — SocialAsset no
      // tiene columna para esto; viajan en la respuesta para que el editor
      // re-selle en la misma sesión. Recargar la página pierde la edición (Fase B v1).
      const bgUrls: string[] = []
      for (let index = 0; index < slides.length; index++) {
        const slide = slides[index]
        // Gemini (dirección de arte) como motor principal; NVIDIA FLUX como
        // fallback automático si Gemini falla — sin perder lo que ya funcionaba.
        // slideRole queda undefined en post/story (1 imagen) → preset aleatorio.
        let background: Buffer
        try {
          background = await generateBackgroundGemini({
            escena: slide.escena, nicho: body.nicho, aspect: body.aspect, direction,
            slideIndex: index, presetKey: body.preset,
          })
        } catch (err) {
          console.error('Gemini imagen falló, fallback a NVIDIA:', err)
          background = await generateBackground(slide.escena, body.nicho, body.aspect, direction)
        }
        // Opción A: se sella con posiciones default (comportamiento de siempre) Y
        // se sube el fondo crudo aparte, para que el editor pueda re-sellar con
        // override sin regenerar la imagen con IA. bgUrl viaja en la respuesta.
        const [composed, bgUrl] = await Promise.all([
          composeSlide({
            background, titulo: slide.titulo, subtitulo: slide.subtitulo,
            formato: body.tipo, aspect: body.aspect,
          }).then(uploadImage),
          uploadImage(background, 'image/png'),
        ])
        bgUrls.push(bgUrl)
        assets.push({
          orden: index, imagen_url: composed,
          titulo: slide.titulo, subtitulo: slide.subtitulo,
        })
      }
      caption = copy.caption; hashtags = copy.hashtags; contentEngine = 'diffusion'
      backgroundUrls = bgUrls
    }

    const updated = await prisma.socialPost.update({
      where: { id: post.id },
      data:  {
        titulo:         assets[0].titulo,
        caption,
        hashtags,
        content_engine: contentEngine,
        estado:         'generado',
        imagen_url:     assets[0].imagen_url,
        assets:         { create: assets },
      },
      include: { assets: { orderBy: { orden: 'asc' } } },
    })

    return NextResponse.json({ ok: true, post: updated, background_urls: backgroundUrls }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    console.error('Social generate error:', err)

    await prisma.socialPost.update({
      where: { id: post.id },
      data:  { estado: 'error', error_msg: message.slice(0, 500) },
    })

    return NextResponse.json({ error: message, postId: post.id }, { status: 502 })
  }
}
