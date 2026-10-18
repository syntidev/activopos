import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireLabelCapture, toDTO } from '@/lib/label-capture'

const CSV_COLUMNS = ['ean', 'ref', 'modelo', 'color_etiqueta', 'prenda', 'talla', 'genero', 'unidades', 'color_real', 'estado', 'notas'] as const

/** Escapa una celda CSV y neutraliza fórmulas (=, +, -, @) para que Excel no las ejecute. */
function csvCell(value: string | number | null): string {
  const text = value === null ? '' : String(value)
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export async function GET(req: Request): Promise<NextResponse> {
  const session = await requireLabelCapture()
  if (session instanceof NextResponse) return session

  const format = new URL(req.url).searchParams.get('format') === 'json' ? 'json' : 'csv'
  const rows = await prisma.labelCapture.findMany({
    where: { business_id: session.businessId },
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

  const lines = items.map(i =>
    [i.ean, i.ref, i.model_name, i.label_color, i.garment, i.size, i.gender, i.units, i.color_actual, i.status, i.notes]
      .map(csvCell)
      .join(','),
  )
  const csv = `﻿${[CSV_COLUMNS.join(','), ...lines].join('\r\n')}\r\n`
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="etiquetas_${stamp}.csv"`,
    },
  })
}
