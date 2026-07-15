import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'

// Mismo orden de columnas que template/route.ts — habilita round-trip real
// (exportar → editar → reimportar sin fricción).
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role !== 'super_admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const businessIdRaw = req.nextUrl.searchParams.get('business_id')
  const businessId = businessIdRaw ? parseInt(businessIdRaw, 10) : NaN
  if (isNaN(businessId)) {
    return NextResponse.json({ error: 'Query param "business_id" requerido' }, { status: 400 })
  }

  const entries = await prisma.socialCalendarEntry.findMany({
    where:   { business_id: businessId },
    orderBy: { dia: 'asc' },
  })

  const headers = ['dia', 'tipo', 'producto', 'objetivo', 'titulo', 'subtitulo', 'caption', 'hashtags', 'estado', 'buffer_id', 'slides']

  const rows = entries.map(e => [
    e.dia.toISOString().slice(0, 10),
    e.tipo,
    e.segmento,
    e.objetivo,
    e.titulo,
    e.subtitulo ?? '',
    e.caption ?? '',
    e.hashtags ?? '',
    e.estado,
    e.buffer_post_id ?? '',
    '', // slides no se persiste como campo propio — ver notas
  ])

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  ws['!cols'] = [
    { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 30 },
    { wch: 30 }, { wch: 40 }, { wch: 30 }, { wch: 12 }, { wch: 14 }, { wch: 8 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Calendario')

  const raw    = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as number[]
  const buffer = new Uint8Array(raw)

  return new NextResponse(buffer, {
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="calendario_social_business${businessId}.xlsx"`,
    },
  })
}
