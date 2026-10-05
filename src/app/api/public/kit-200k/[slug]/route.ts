import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { catalogLimiter, getClientIp } from '@/lib/rate-limit'
import { KitConfigSchema, EMPTY_KIT_CONFIG } from '@/lib/kit-config'

// GET público (sin sesión) — componentes reales del Kit 200K + config editable.
// Reemplaza los paths estáticos hardcodeados de Kit200KForm.tsx: el consumidor
// (CLI-B) lee esto en vez de /kit-200k/*.png fijos.
//
// Resolución del kit SIN hardcodear nombre: product_type='combo' + active=true
// -- invariante ya sellado del negocio (ver comentario KIT_NAME en
// src/app/kit-200k/page.tsx): nunca hay 2 combos activos a la vez para un
// negocio. "Componentes" = filas ProductComponent reales del combo (Maillot/
// Medalla/Media hoy) -- la franela de showroom NO es ProductComponent del
// combo, queda fuera de este endpoint (hardcode aparte, fuera de este scope).
const slugSchema = z.string().regex(/^[a-z0-9-]{3,50}$/)

// Mismo criterio que imagePath() (landing-sections.ts) / logo_path: solo
// assets propios hacia afuera, nunca una URL externa (Product.images hoy no
// tiene esa restricción a nivel de escritura -- este endpoint la aplica al
// exponer, para no reexponer hotlinks de terceros en una landing pública).
const INTERNAL_IMAGE_RE = /^\/(uploads|storage\/tenants)\//

function parseImages(raw: string | null): string[] {
  if (!raw) return []
  try { return JSON.parse(raw) as string[] } catch { return [] }
}

function firstInternalImage(raw: string | null): string | null {
  return parseImages(raw).find(src => INTERNAL_IMAGE_RE.test(src)) ?? null
}

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const parsedSlug = slugSchema.safeParse(params.slug)
  if (!parsedSlug.success) return NextResponse.json({ error: 'Slug inválido' }, { status: 400 })

  try {
    await catalogLimiter.consume(getClientIp(req) ?? 'unknown')
  } catch {
    return NextResponse.json({ error: 'Demasiadas solicitudes, intenta más tarde' }, { status: 429 })
  }

  const business = await prisma.business.findFirst({
    where:  { catalog_slug: parsedSlug.data, active: true },
    select: { id: true, reservas_enabled: true, kit200k_config: true },
  })
  if (!business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

  const kit = await prisma.product.findFirst({
    where:  { business_id: business.id, product_type: 'combo', active: true },
    select: { id: true, name: true, price_per_unit_usd: true, images: true },
  })
  if (!kit) return NextResponse.json({ error: 'Kit no configurado' }, { status: 404 })

  const links = await prisma.productComponent.findMany({
    where:   { parent_id: kit.id },
    include: { component: { select: { id: true, name: true, active: true, price_per_unit_usd: true, images: true } } },
  })

  const componentes = links
    .filter(l => l.component.active)
    .map(l => ({
      id:         l.component.id,
      nombre:     l.component.name,
      precio_usd: l.component.price_per_unit_usd?.toNumber() ?? null,
      imagen:     firstInternalImage(l.component.images),
    }))

  const stored = business.kit200k_config
  const config = stored !== null && typeof stored === 'object' && !Array.isArray(stored) &&
    KitConfigSchema.safeParse(stored).success
    ? stored
    : EMPTY_KIT_CONFIG

  return NextResponse.json({
    ok: true,
    reservas_enabled: business.reservas_enabled,
    config,
    kit: {
      id:         kit.id,
      nombre:     kit.name,
      precio_usd: kit.price_per_unit_usd?.toNumber() ?? null,
      imagen:     firstInternalImage(kit.images),
    },
    componentes,
  })
}
