import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'

const toString = (v: unknown): string => String(v ?? '').trim()

interface RowValidation {
  row:            number
  dia:            Date
  tipo:           string
  segmento:       string
  objetivo:       string
  titulo:         string
  subtitulo:      string | null
  caption:        string | null
  hashtags:       string | null
  estado:         string
  buffer_post_id: string | null
  notas:          string | null
}

interface RowError { row: number; message: string }

function parseDia(raw: unknown, rowNum: number): { valid: Date } | { error: string } {
  if (raw instanceof Date) return { valid: raw }
  const s = toString(raw)
  const parsed = new Date(s)
  if (isNaN(parsed.getTime())) return { error: `"dia" inválido en fila ${rowNum}: "${s}"` }
  return { valid: parsed }
}

function validateRow(raw: Record<string, unknown>, rowNum: number): { valid: RowValidation } | { error: RowError } {
  const diaResult = parseDia(raw['dia'], rowNum)
  if ('error' in diaResult) return { error: { row: rowNum, message: diaResult.error } }

  const tipo = toString(raw['tipo'])
  if (!tipo) return { error: { row: rowNum, message: '"tipo" es requerido' } }

  // producto (nombre de columna del template real) = segmento (campo interno)
  const segmento = toString(raw['producto'] ?? raw['segmento'])
  if (!segmento) return { error: { row: rowNum, message: '"producto" es requerido' } }

  const objetivo = toString(raw['objetivo'])
  if (!objetivo) return { error: { row: rowNum, message: '"objetivo" es requerido' } }

  const titulo = toString(raw['titulo'])
  if (!titulo) return { error: { row: rowNum, message: '"titulo" es requerido' } }

  const subtitulo = toString(raw['subtitulo']) || null
  const caption    = toString(raw['caption']) || null
  const hashtags   = toString(raw['hashtags']) || null
  const estado     = toString(raw['estado']) || 'pendiente'
  const bufferPostId = toString(raw['buffer_id'] ?? raw['buffer_post_id']) || null

  // "slides" no es un campo del modelo (solo informa cuántas slides genera un
  // carrusel) — se preserva en notas en vez de descartarse silenciosamente.
  const slidesRaw = toString(raw['slides'])
  const notas = slidesRaw ? `Slides: ${slidesRaw}` : null

  return {
    valid: { row: rowNum, dia: diaResult.valid, tipo, segmento, objetivo, titulo, subtitulo, caption, hashtags, estado, buffer_post_id: bufferPostId, notas },
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role !== 'super_admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Se esperaba multipart/form-data con campo "file"' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Campo "file" requerido' }, { status: 400 })
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Archivo demasiado grande (máx 5 MB)' }, { status: 413 })
  }

  const businessIdRaw = formData.get('business_id')
  const businessId = businessIdRaw ? parseInt(String(businessIdRaw), 10) : NaN
  if (isNaN(businessId)) {
    return NextResponse.json({ error: 'Campo "business_id" requerido' }, { status: 400 })
  }

  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { id: true } })
  if (!business) return NextResponse.json({ error: 'business_id no existe' }, { status: 400 })

  const dryRun = formData.get('dry_run') === 'true'

  const buffer   = Buffer.from(await file.arrayBuffer())
  const workbook = XLSX.read(buffer, { cellDates: true })
  const sheet    = workbook.Sheets[workbook.SheetNames[0]]
  const rows     = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[]

  if (rows.length === 0) {
    return NextResponse.json({ error: 'El archivo está vacío' }, { status: 400 })
  }
  if (rows.length > 500) {
    return NextResponse.json({ error: 'Máximo 500 filas por importación' }, { status: 400 })
  }

  const validRows: RowValidation[] = []
  const errors: RowError[] = []

  for (let i = 0; i < rows.length; i++) {
    const result = validateRow(rows[i], i + 2)
    if ('error' in result) errors.push(result.error)
    else validRows.push(result.valid)
  }

  if (dryRun) {
    return NextResponse.json({ ok: true, dry_run: true, valid: validRows.length, errors })
  }

  // Dedup para round-trip: mismo business_id + dia + titulo ya existente → skip,
  // no duplica (criterio explícito: "reimportar sin duplicados").
  const existing = await prisma.socialCalendarEntry.findMany({
    where:  { business_id: businessId },
    select: { dia: true, titulo: true },
  })
  const existingKeys = new Set(existing.map(e => `${e.dia.toISOString().slice(0, 10)}|${e.titulo}`))

  let created = 0
  let skipped = 0
  const createErrors: RowError[] = [...errors]

  for (const row of validRows) {
    const key = `${row.dia.toISOString().slice(0, 10)}|${row.titulo}`
    if (existingKeys.has(key)) {
      skipped++
      continue
    }
    try {
      await prisma.socialCalendarEntry.create({
        data: {
          business_id:    businessId,
          dia:            row.dia,
          tipo:           row.tipo,
          segmento:       row.segmento,
          objetivo:       row.objetivo,
          titulo:         row.titulo,
          subtitulo:      row.subtitulo,
          caption:        row.caption,
          hashtags:       row.hashtags,
          estado:         row.estado,
          content_engine: 'manual',
          buffer_post_id: row.buffer_post_id,
          notas:          row.notas,
        },
      })
      existingKeys.add(key)
      created++
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      createErrors.push({ row: row.row, message: msg })
    }
  }

  return NextResponse.json({ ok: true, dry_run: false, created, skipped, errors: createErrors })
}
