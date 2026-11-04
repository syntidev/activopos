import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireLabelCapture, toDTO } from '@/lib/label-capture'
import { DEFAULT_PROFILE, isProfileId } from '@/lib/label-profiles'

const CSV_COLUMNS = ['ean', 'ref', 'modelo', 'color_etiqueta', 'prenda', 'talla', 'genero', 'unidades', 'color_real', 'estado', 'notas'] as const

const ON_CSV_COLUMNS = ['estilo', 'modelo', 'genero', 'colorway', 'US', 'EU', 'UK', 'JP', 'EAN', 'cantidad', 'en_revision'] as const

/** Escapa una celda CSV y neutraliza fórmulas (=, +, -, @) para que Excel no las ejecute. */
function csvCell(value: string | number | null): string {
  const text = value === null ? '' : String(value)
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export async function GET(req: Request): Promise<NextResponse> {
  const session = await requireLabelCapture()
  if (session instanceof NextResponse) return session

  const params = new URL(req.url).searchParams
  const format = params.get('format') === 'json' ? 'json' : 'csv'
  const profile = params.get('profile') ?? DEFAULT_PROFILE
  if (!isProfileId(profile)) return NextResponse.json({ error: 'Perfil inválido' }, { status: 400 })
  const rows = await prisma.labelCapture.findMany({
    where: { business_id: session.businessId, profile },
    orderBy: { id: 'asc' },
  })
  const items = rows.map(toDTO)
  const stamp = new Date().toISOString().slice(0, 10)

  if (format === 'json') {
    return new NextResponse(JSON.stringify(items, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="etiquetas_${stamp}.json"`,
      },
    })
  }

  // Una fila por EAN. On: columnas para la fase C (estilo, tallas y si quedó en revisión).
  const columns: readonly string[] = profile === 'on' ? ON_CSV_COLUMNS : CSV_COLUMNS
  const lines = items.map(i =>
    (profile === 'on'
      ? [i.style, i.model_name, i.gender, i.label_color, i.size_us, i.size_eu, i.size_uk, i.size_jp, i.ean, i.units, i.status === 'review' ? 'si' : 'no']
      : [i.ean, i.ref, i.model_name, i.label_color, i.garment, i.size, i.gender, i.units, i.color_actual, i.status, i.notes]
    )
      .map(csvCell)
      .join(','),
  )
  const csv = `﻿${[columns.join(','), ...lines].join('\r\n')}\r\n`
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="etiquetas${profile === 'on' ? '_on' : ''}_${stamp}.csv"`,
    },
  })
}
