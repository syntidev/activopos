/**
 * Certificación visual de los 6 layouts nuevos de carrusel (src/lib/social/carousel-layouts.ts).
 * Genera 6 PNG en .tmp/carousel-layouts/ para revisión de Carlos. NO toca carrusel.ts.
 *
 *   npx tsx scripts/carousel-layouts-check.ts
 */
import { writeFileSync, mkdirSync, readFileSync } from 'fs'
import assert from 'assert'
import type { SlideLayout } from '../src/lib/social/carousel-layouts'

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
  const { ASPECT_DIMENSIONS } = await import('../src/lib/social/brand')
  const { BILLING_CYCLES } = await import('../src/lib/plan-limits')
  const sharp = (await import('sharp')).default

  // Precio del plan: fuente canónica, nunca escrito a mano.
  const precioUsd = BILLING_CYCLES.negocio_activo.mensual.totalAmount

  // stripEmoji no es exportada: se verifica por su efecto en el HTML de chat-bubble.
  const conEmoji = L.buildChatBubbleContent({
    titulo: 'x', clienteTexto: 'Hola 👋 ¿tienes harina? 🙏🏽 ✅', clienteHora: '00:00', respuestaTexto: 'x',
  })
  assert.ok(conEmoji.includes('Hola  ¿tienes harina?'), 'stripEmoji: no limpió el texto del cliente')
  assert.ok(!/[\uD800-\uDBFF]/.test(conEmoji), 'stripEmoji: quedaron emojis de plano suplementario')
  assert.ok(!conEmoji.includes('✅'), 'stripEmoji: quedó un emoji del plano básico')

  const slides: Array<{ layout: SlideLayout; html: string }> = [
    {
      layout: 'ghost-hero',
      html: L.buildSlideFrame({
        ghostNumber: 1, eyebrowText: 'Control de tu negocio', accentColor: '#EF8E01',
        slideNumber: 1, totalSlides: 6,
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
  ]

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
  console.log(`\n6/6 layouts renderizados. Revisar en ${OUT_DIR}/`)
}

main().catch(err => { console.error('FALLO:', err.message); process.exit(1) })
