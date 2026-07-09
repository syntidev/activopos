import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { z } from 'zod'

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
- Tuteo directo ("tu negocio", "vendés", "cobrás")
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

// El modelo a veces envuelve el JSON en fences de markdown pese a la instrucción — se despoja antes de parsear.
function extractJson(raw: string): unknown {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  return JSON.parse(cleaned)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role !== 'super_admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const apiKey = process.env.NVIDIA_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'NVIDIA_API_KEY no configurada en el servidor' }, { status: 500 })
  }

  try {
    const { tema, categoria } = bodySchema.parse(await req.json())

    const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        Authorization:   `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:    'meta/llama-3.1-8b-instruct',
        messages: [{ role: 'user', content: buildPrompt(tema, categoria) }],
      }),
    })

    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      console.error('NVIDIA NIM error:', res.status, errBody)
      return NextResponse.json({ error: 'Fallo el servicio de generación IA' }, { status: 502 })
    }

    const completion = await res.json() as { choices?: { message?: { content?: string } }[] }
    const raw = completion.choices?.[0]?.message?.content
    if (!raw) return NextResponse.json({ error: 'Respuesta vacía del modelo' }, { status: 502 })

    const parsed = aiResultSchema.parse(extractJson(raw))

    return NextResponse.json({ ok: true, article: parsed })
  } catch (err) {
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
