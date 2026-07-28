/**
 * Certificación visual de los 6 layouts nuevos de carrusel (src/lib/social/carousel-layouts.ts).
 * Genera 6 PNG en .tmp/carousel-layouts/ para revisión de Carlos. NO toca carrusel.ts.
 *
 *   npx tsx scripts/carousel-layouts-check.ts
 */
import { writeFileSync, mkdirSync, readFileSync } from 'fs'
import assert from 'assert'
import type { SlideLayout, BicolorLayout } from '../src/lib/social/carousel-layouts'

// Los bicolor viven en su propio union, así que el nombre de archivo los prefija.
type CheckLayout = SlideLayout | `bicolor-${BicolorLayout}`

const OUT_DIR = '.tmp/carousel-layouts'

// foto-lateral recibe una URL de Cloudinary en producción. Acá se usa un data URI
// de una imagen del propio repo: el render no depende de red ni de credenciales.
function localPhotoDataUri(): string {
  const bytes = readFileSync('public/segments/abastos-hero.webp')
  return `data:image/webp;base64,${bytes.toString('base64')}`
}

async function main(): Promise<void> {
  const L = await import('../src/lib/social/carousel-layouts')
  const { renderSlideToPng, closeBrowser } = await import('../src/lib/social/render-slide')
  const { ASPECT_DIMENSIONS, ASSETS } = await import('../src/lib/social/brand')
  const { BILLING_CYCLES } = await import('../src/lib/plan-limits')
  const sharp = (await import('sharp')).default

  // Mismo isotipo y mismo strip del <rect> navy que carrusel.ts, para que el PNG
  // de certificación muestre el logo real y no una aproximación.
  const logoSvg = readFileSync(ASSETS.logoNegative, 'utf8')
    .replace(/<rect[^>]*fill="#0D1B2E"[^>]*\/>/, '')

  // Precio del plan: fuente canónica, nunca escrito a mano.
  const precioUsd = BILLING_CYCLES.negocio_activo.mensual.totalAmount

  // stripEmoji no es exportada: se verifica por su efecto en el HTML de chat-bubble.
  const conEmoji = L.buildChatBubbleContent({
    titulo: 'x', clienteTexto: 'Hola 👋 ¿tienes harina? 🙏🏽 ✅', clienteHora: '00:00', respuestaTexto: 'x',
  })
  assert.ok(conEmoji.includes('Hola  ¿tienes harina?'), 'stripEmoji: no limpió el texto del cliente')
  assert.ok(!/[\uD800-\uDBFF]/.test(conEmoji), 'stripEmoji: quedaron emojis de plano suplementario')
  assert.ok(!conEmoji.includes('✅'), 'stripEmoji: quedó un emoji del plano básico')

  // El frame 'light' solo lo usa testimonio, que no se renderiza a PNG todavía:
  // sin estos asserts la variante quedaría sin ejercitar (fachada).
  const frameArgs = { ghostNumber: 9, eyebrowText: 'x', accentColor: '#EF8E01', slideNumber: 9, totalSlides: 10, contentHtml: '', logoSvg }
  assert.ok(L.buildSlideFrame({ ...frameArgs, variant: 'light' }).includes('background:#DCE6FF'), 'frame light: fondo no invertido')
  assert.ok(L.buildSlideFrame({ ...frameArgs }).includes('linear-gradient(160deg, #0038BD'), 'frame default: dejó de ser dark')

  // Guarda de atribución: no se publica testimonio sin cliente real.
  assert.throws(
    () => L.buildTestimonioContent({ citaSegments: [{ text: 'x' }], autorNombre: '', autorNegocio: '' }),
    /autorNombre\/autorNegocio obligatorios/,
    'buildTestimonioContent: no lanzó sin atribución',
  )

  const slides: Array<{ layout: CheckLayout; html: string }> = [
    {
      layout: 'ghost-hero',
      html: L.buildSlideFrame({
        ghostNumber: 1, eyebrowText: 'Control de tu negocio', accentColor: '#EF8E01',
        slideNumber: 1, totalSlides: 6,
        logoSvg,
        contentHtml: L.buildTituloSubtituloContent(
          [{ text: 'Vendes todo el día y no sabes cuánto ganaste' }],
          'Si el cuaderno es tu sistema, tu utilidad es una corazonada.',
          '#EF8E01',
        ),
      }),
    },
    {
      layout: 'highlight-text',
      html: L.buildSlideFrame({
        ghostNumber: 2, eyebrowText: 'El problema real', accentColor: '#EF8E01',
        slideNumber: 2, totalSlides: 6,
        logoSvg,
        contentHtml: L.buildTituloSubtituloContent(
          [
            { text: 'El problema no es vender.' },
            { text: 'Es no saber', highlight: true },
            { text: 'qué te queda.' },
          ],
          'Cobras en Bs, compras en dólares y la tasa se mueve todos los días.',
          '#4D7AFF',
        ),
      }),
    },
    {
      layout: 'chat-bubble',
      html: L.buildSlideFrame({
        ghostNumber: 3, eyebrowText: 'Pedidos por WhatsApp', accentColor: '#EF8E01',
        slideNumber: 3, totalSlides: 6,
        logoSvg,
        contentHtml: L.buildChatBubbleContent({
          titulo: 'Tu catálogo trabaja mientras tú atiendes',
          clienteTexto: 'Buenas, ¿tienes harina pan y aceite? ¿A cómo el combo?',
          clienteHora: '10:42 a.m.',
          respuestaTexto: 'Pedido recibido desde el catálogo',
        }),
      }),
    },
    {
      layout: 'checklist',
      html: L.buildSlideFrame({
        ghostNumber: 4, eyebrowText: 'Lo que resuelve', accentColor: '#EF8E01',
        slideNumber: 4, totalSlides: 6,
        logoSvg,
        contentHtml: L.buildChecklistContent({
          titulo: 'Lo que ActivoPOS hace por ti',
          items: [
            'Tasa BCV automática, todos los días',
            'Pago Móvil, Zelle, Binance y USDT',
            'Inventario que se descuenta solo',
            'Cierre de caja en 2 minutos',
          ],
        }),
      }),
    },
    {
      layout: 'foto-lateral',
      html: L.buildSlideFrame({
        ghostNumber: 5, eyebrowText: 'Negocios reales', accentColor: '#EF8E01',
        slideNumber: 5, totalSlides: 6,
        ghostStyle: L.FOTO_LATERAL_GHOST_STYLE,
        logoSvg,
        contentHtml: L.buildFotoLateralContent({
          titulo: 'De la bodega de Catia a la ferretería de Maracay',
          subtitulo: 'El mismo sistema, adaptado a cómo vende cada negocio venezolano.',
          statLabel: 'Cierre de caja',
          statValor: '2 minutos',
          fotoUrl: localPhotoDataUri(),
        }),
      }),
    },
    {
      layout: 'cta-precio',
      html: L.buildSlideFrame({
        ghostNumber: 6, eyebrowText: 'Empieza hoy', accentColor: '#EF8E01', isCtaSlide: true,
        slideNumber: 6, totalSlides: 6,
        logoSvg,
        contentHtml: L.buildCtaPrecioContent({
          tituloPre: 'Deja de adivinar ',
          tituloAccent: 'cuánto ganas',
          tituloPost: ' cada mes.',
          subtitulo: 'Un solo plan, todo incluido. Sin comisión por venta, sin letra chiquita.',
          planNombre: 'Negocio Activo',
          precioUsd,
          ctaLabel: 'Pruébalo gratis',
        }),
      }),
    },
    {
      layout: 'curva-corte',
      html: L.buildSlideFrame({
        ghostNumber: 7, eyebrowText: 'Cierre de caja', accentColor: '#EF8E01',
        slideNumber: 7, totalSlides: 10,
        logoSvg,
        contentHtml: L.buildCurvaCorteContent({
          titulo: 'Cierras el día sabiendo exactamente qué entró',
          subtitulo: 'Sin cuadrar el cuaderno a las 9 de la noche.',
          statLabel: 'Tu día · hoy',
          statValor: '$0.00',   // ilustrativo -- pendiente decisión sobre dato real
          statValorBs: 'Bs. 0,00',
          statNota: '32 ventas registradas',
        }),
      }),
    },
    {
      layout: 'split-diagonal',
      html: L.buildSlideFrame({
        ghostNumber: 8, eyebrowText: 'Un solo plan', accentColor: '#EF8E01', isCtaSlide: true,
        slideNumber: 8, totalSlides: 10,
        logoSvg,
        contentHtml: L.buildSplitDiagonalContent({
          titulo: 'Todo el sistema por menos de lo que gastas en un almuerzo',
          planNombre: 'Negocio Activo',
          precioUsd,
          ctaLabel: 'Empezar ahora',
        }),
      }),
    },
    // testimonio (constelacion-puntos): pendiente testimonio real autorizado por Carlos.
    // buildTestimonioContent lanza si falta autorNombre/autorNegocio y no los tenemos.
    // Usa buildSlideFrame({ variant: 'light' }) -- fondo #DCE6FF, chrome oscuro.
    // {
    //   layout: 'testimonio',
    //   html: L.buildSlideFrame({
    //     ghostNumber: 9, eyebrowText: 'Lo dice un cliente', accentColor: '#EF8E01',
    //     slideNumber: 9, totalSlides: 10, variant: 'light',
    //     contentHtml: L.buildTestimonioContent({
    //       citaSegments: [{ text: '...' }, { text: '...', highlight: true }],
    //       autorNombre: '<nombre real>', autorNegocio: '<negocio real>',
    //     }),
    //   }),
    // },
    {
      layout: 'silueta-recibo',
      html: L.buildSlideFrame({
        ghostNumber: 10, eyebrowText: 'Lo que te llevas', accentColor: '#EF8E01',
        slideNumber: 10, totalSlides: 10,
        logoSvg,
        contentHtml: L.buildSiluetaReciboContent({
          titulo: 'Tres cosas que cambian desde el primer día',
          items: [
            'POS táctil sin tarjeta',
            'BCV automático en cada venta',
            'Catálogo digital 24/7',
          ],
        }),
      }),
    },
  ]

  // ── Familia bicolor ──
  // El bg no viene en las paletas (son solo colores de texto/chrome): cada layout
  // usa el fondo sobre el que sus clusters fueron calibrados — azul marca para los
  // que pintan cluster oscuro, ámbar para los que pintan cluster #B56700.
  const NAVY_BG   = '#0038BD'
  const ORANGE_BG = '#EF8E01'
  const bicolor: Array<{ layout: BicolorLayout; html: string }> = [
    {
      layout: 'movimiento',
      html: L.buildBicolorFrame({
        ...L.BICOLOR_ON_NAVY, bgColor: NAVY_BG, categoryLabel: 'Control diario',
        slideNumber: 1, totalSlides: 6, logoSvg,
        decorSvg: L.buildBicolorMovimientoDecor(),
        contentHtml: L.buildBicolorMovimientoContent({
          lineas: ['Tu negocio', 'se mueve'], highlight: 'todo el día',
          subtitulo: 'Y tú necesitas saber qué entró sin sacar cuentas a mano.',
        }),
      }),
    },
    {
      layout: 'oferta',
      html: L.buildBicolorFrame({
        ...L.BICOLOR_ON_ORANGE, bgColor: ORANGE_BG, categoryLabel: 'Precio',
        slideNumber: 2, totalSlides: 6, logoSvg,
        decorSvg: L.buildBicolorOfertaDecor(),
        contentHtml: L.buildBicolorOfertaContent({
          statPrefix: 'Un solo plan,', highlight: 'todo incluido',
          subtitulo: 'Sin comisión por venta y sin letra chiquita.',
        }),
      }),
    },
    {
      layout: 'stat',
      html: L.buildBicolorFrame({
        ...L.BICOLOR_ON_ORANGE, bgColor: ORANGE_BG, categoryLabel: 'Cierre de caja',
        slideNumber: 3, totalSlides: 6, logoSvg,
        decorSvg: L.buildBicolorStatDecor(),
        contentHtml: L.buildBicolorStatContent({
          // Dato de producto real (ACTIVOPOS_CONTEXT: "Caja y cierre de día en 2
          // minutos"), NO una cifra de ventas inventada -- ver incidente 3ae2e92.
          statNumero: '2', statUnidad: 'min', statLabel: 'Cierre de caja',
          subtitulo: 'Lo que antes te comía la noche entera.',
        }),
      }),
    },
    {
      layout: 'checklist',
      html: L.buildBicolorFrame({
        ...L.BICOLOR_ON_NAVY, bgColor: NAVY_BG, categoryLabel: 'Lo que resuelve',
        slideNumber: 4, totalSlides: 6, logoSvg,
        decorSvg: L.buildBicolorChecklistDecor(),
        contentHtml: L.buildBicolorChecklistContent({
          titulo: 'Todo lo que necesitas', highlight: 'en un solo sitio',
          items: [
            'Tasa BCV automática',
            'Pago Móvil, Zelle y USDT',
            'Inventario que se descuenta solo',
            'Catálogo digital 24/7',
          ],
        }),
      }),
    },
    {
      layout: 'cta',
      html: L.buildBicolorFrame({
        ...L.BICOLOR_ON_ORANGE, bgColor: ORANGE_BG, categoryLabel: 'Empieza hoy',
        slideNumber: 5, totalSlides: 6, logoSvg,
        decorSvg: L.buildBicolorCtaDecor(),
        contentHtml: L.buildBicolorCtaContent({
          tituloPre: 'Deja de', highlight: 'botar reales', tituloPost: 'cada mes',
          subtitulo: 'Pruébalo gratis y mira cuánto ganas de verdad.',
          ctaLabel: 'Empezar gratis',
        }),
      }),
    },
    // bicolor 'testimonio': mismo bloqueo que el testimonio navy. Sin cliente real
    // que autorizó, buildBicolorTestimonioContent lanza y no se genera PNG.
    // {
    //   layout: 'testimonio',
    //   html: L.buildBicolorFrame({
    //     ...L.BICOLOR_ON_NAVY, bgColor: NAVY_BG, categoryLabel: 'Lo dice un cliente',
    //     slideNumber: 6, totalSlides: 6, logoSvg,
    //     decorSvg: L.buildBicolorTestimonioDecor(),
    //     contentHtml: L.buildBicolorTestimonioContent({
    //       citaSegments: [{ text: '...' }, { text: '...', highlight: true }],
    //       autorNombre: '<nombre real>', autorNegocio: '<negocio real>',
    //     }),
    //   }),
    // },
  ]
  bicolor.forEach(b => slides.push({ layout: `bicolor-${b.layout}`, html: b.html }))

  // La guarda de atribución también aplica a la variante bicolor.
  assert.throws(
    () => L.buildBicolorTestimonioContent({ citaSegments: [{ text: 'x' }], autorNombre: '', autorNegocio: '' }),
    /autorNombre\/autorNegocio obligatorios/,
    'buildBicolorTestimonioContent: no lanzó sin atribución',
  )

  mkdirSync(OUT_DIR, { recursive: true })
  const { width, height } = ASPECT_DIMENSIONS['4:5']

  for (let i = 0; i < slides.length; i++) {
    const s = slides[i]!
    assert.ok(!/<script/i.test(s.html), `${s.layout}: HTML contiene <script>`)
    assert.ok(!/<!doctype|<html|<head|<body/i.test(s.html), `${s.layout}: HTML no es de nivel body`)

    const png = await renderSlideToPng(s.html, '4:5')
    const meta = await sharp(png).metadata()
    assert.strictEqual(meta.width, width, `${s.layout}: ancho ${meta.width} != ${width}`)
    assert.strictEqual(meta.height, height, `${s.layout}: alto ${meta.height} != ${height}`)

    const file = `${OUT_DIR}/${String(i + 1).padStart(2, '0')}-${s.layout}.png`
    writeFileSync(file, png)
    console.log(`OK ${s.layout.padEnd(15)} ${meta.width}x${meta.height}  ${file}`)
  }

  await closeBrowser()
  console.log(`\n${slides.length} layouts renderizados. Revisar en ${OUT_DIR}/`)
}

main().catch(err => { console.error('FALLO:', err.message); process.exit(1) })
