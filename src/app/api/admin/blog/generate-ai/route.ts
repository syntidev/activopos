import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { z } from 'zod'
import { callBlogLlm, extractJson, ProviderError } from '@/lib/blog/llm'
import { uploadLimiter, getClientIp } from '@/lib/rate-limit'

const bodySchema = z.object({
  tema:      z.string().min(1).max(200),
  categoria: z.string().min(1).max(80),
})

const aiResultSchema = z.object({
  titulo:            z.string(),
  slug:               z.string(),
  excerpt:           z.string(),
  content:           z.string(),
  meta_title:        z.string(),
  meta_description:  z.string(),
  tags:              z.array(z.string()),
  read_time:         z.string(),
})

function buildPrompt(tema: string, categoria: string): string {
  return `Eres el redactor oficial de ActivoPOS, un sistema POS SaaS diseñado específicamente para PYMES venezolanas.

CONTEXTO DEL PRODUCTO:
- POS táctil para ventas en mostrador
- BCV automático — tasa oficial en tiempo real
- Catálogo digital con pedidos por WhatsApp
- Métodos de pago venezolanos: Pago Móvil, Zelle, Binance, USDT, Zinli
- Variantes de producto: tallas, colores, combinaciones
- Cierre de caja diario con reporte
- Inventario en tiempo real
- Planes disponibles: desde básico hasta avanzado con funciones ilimitadas (no menciones precios específicos en el artículo)
- Segmentos atendidos: bodegas, abastos, boutiques, cafetines, farmacias, carnicerías, restaurantes, panaderías, ferreterías, joyerías, fruterías, veterinarias, papelerías, tiendas de electrónica, centros de belleza, mueblerías, lavanderías, tiendas deportivas, distribuidoras, licorerías, repuesterías, ópticas, jugueterías

TONO:
- Español venezolano neutro-comercial
- Tuteo directo ("tu negocio", "vendes", "cobras")
- Sin jerga startup ni anglicismos innecesarios
- Cercano, práctico, sin grandilocuencia

OBJETIVO SEO:
- Posicionar en Google Venezuela para búsquedas de PYMES
- Keywords naturales: POS Venezuela, sistema de ventas Venezuela, cobrar en bolívares y dólares, tasa BCV, catálogo digital WhatsApp

El artículo debe:
- Mencionar funciones reales de ActivoPOS cuando sea relevante
- Incluir un CTA al final hacia activopos.com
- Hablar de la realidad venezolana — economía dual, WhatsApp, Pago Móvil

Escribe un artículo de blog sobre: ${tema}
Categoría: ${categoria}

Menciona funciones específicas de ActivoPOS cuando sea natural.
Usa ejemplos venezolanos reales: bodegas, abastos, boutiques, cafetines.
El artículo debe sonar como escrito por alguien que conoce el negocio venezolano.

Responde SOLO en JSON válido:
{
  "titulo": "título SEO optimizado",
  "slug": "slug-url-amigable",
  "excerpt": "resumen de 2 oraciones",
  "content": "contenido en HTML con h2, h3, p, ul — mínimo 400 palabras",
  "meta_title": "meta título SEO máximo 60 caracteres",
  "meta_description": "meta descripción SEO máximo 155 caracteres",
  "tags": ["tag1", "tag2", "tag3"],
  "read_time": "5 min"
}`
}

export async function POST(req: NextRequest) {
  // Llama a la API paga de NVIDIA — mismo throttle que las rutas hermanas.
  try {
    await uploadLimiter.consume(getClientIp(req))
  } catch {
    return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 })
  }

  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role !== 'super_admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  try {
    const { tema, categoria } = bodySchema.parse(await req.json())

    const raw    = await callBlogLlm(buildPrompt(tema, categoria))
    const parsed = aiResultSchema.parse(extractJson(raw))

    return NextResponse.json({ ok: true, article: parsed })
  } catch (err) {
    if (err instanceof ProviderError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: 'El modelo no devolvió JSON válido' }, { status: 502 })
    }
    console.error('Blog AI generate error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
