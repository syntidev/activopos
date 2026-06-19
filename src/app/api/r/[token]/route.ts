import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'

const tokenSchema = z.string().uuid()

// Descarga pública de reporte PDF — sin auth, validado por token + expiración
export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  if (!tokenSchema.safeParse(params.token).success) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 400 })
  }

  const report = await prisma.monthlyReport.findUnique({
    where: { download_token: params.token },
    select: {
      status:           true,
      file_path:        true,
      token_expires_at: true,
      period:           true,
      business: { select: { name: true } },
    },
  })

  if (!report || report.status !== 'ready') {
    return NextResponse.json({ error: 'Reporte no disponible' }, { status: 404 })
  }

  if (!report.token_expires_at || report.token_expires_at < new Date()) {
    return NextResponse.json({ error: 'Enlace expirado' }, { status: 410 })
  }

  if (!report.file_path || !existsSync(report.file_path)) {
    return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 })
  }

  const buffer   = await readFile(report.file_path)
  const filename = `reporte-${report.period}-${report.business.name.replace(/\s+/g, '-')}.pdf`

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control':       'no-store',
    },
  })
}
