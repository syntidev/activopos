import { NextRequest, NextResponse } from 'next/server'
import { mkdir, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { PLAN_LIMITS, type PlanTier } from '@/lib/plan-limits'
import { uploadLimiter } from '@/lib/rate-limit'
import { revalidateCatalogCache } from '@/lib/catalog'
import { FAVICON_SIZES, brandDir, faviconFile, newBase, ogFile, readBase, settingsKey, type IdentityKind } from '@/lib/web-identity'
import { IdentityImageError, MAX_BYTES, buildFavicon, buildOg } from '@/lib/web-identity-image'

/**
 * Identidad web del negocio (favicon + imagen para compartir). Solo admin y plan con catálogo; business_id SIEMPRE de la sesión.
 * Guarda los archivos en storage/tenants/{id}/brand/ y la ruta base en business.settings (web_favicon / web_og_image).
 */

interface Auth { businessId: number }

async function requireAdminConCatalogo(): Promise<Auth | NextResponse> {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role !== 'admin' && session.role !== 'super_admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  const business = await prisma.business.findUnique({ where: { id: session.businessId }, select: { catalog_plan: true } })
  const plan = (business?.catalog_plan as PlanTier | null) ?? 'gratis'
  if (!(PLAN_LIMITS[plan]?.catalog ?? false)) return NextResponse.json({ error: 'Disponible en el plan con catálogo' }, { status: 403 })
  return { businessId: session.businessId }
}

const KINDS: readonly IdentityKind[] = ['favicon', 'og']
const asKind = (v: unknown): IdentityKind | null => KINDS.find(k => k === v) ?? null
const pct = (v: FormDataEntryValue | null): number => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 50
}

/** Archivos que componen una base (para borrarlos al reemplazar o quitar). */
const filesOf = (kind: IdentityKind, base: string): string[] =>
  kind === 'favicon' ? FAVICON_SIZES.map(s => faviconFile(base, s)) : [ogFile(base, 'jpg'), ogFile(base, 'webp')]

const removeFiles = (kind: IdentityKind, base: string | null): Promise<unknown> =>
  Promise.all((base ? filesOf(kind, base) : []).map(f => rm(join(process.cwd(), f.replace(/^\//, '')), { force: true })))

async function saveSettings(businessId: number, kind: IdentityKind, base: string | null): Promise<void> {
  const row = await prisma.business.findUnique({ where: { id: businessId }, select: { settings: true } })
  const next: Record<string, unknown> = { ...((row?.settings ?? {}) as Record<string, unknown>) }
  if (base) next[settingsKey(kind)] = base
  else delete next[settingsKey(kind)]
  await prisma.business.update({ where: { id: businessId }, data: { settings: next as object } })
  await revalidateCatalogCache(businessId)
}

export async function GET(): Promise<NextResponse> {
  const auth = await requireAdminConCatalogo()
  if (auth instanceof NextResponse) return auth
  const row = await prisma.business.findUnique({ where: { id: auth.businessId }, select: { settings: true } })
  const fav = readBase(row?.settings, auth.businessId, 'favicon')
  const og = readBase(row?.settings, auth.businessId, 'og')
  return NextResponse.json({ ok: true, favicon: fav ? faviconFile(fav, 192) : null, og: og ? ogFile(og, 'jpg') : null })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await requireAdminConCatalogo()
  if (auth instanceof NextResponse) return auth
  try {
    try {
      await uploadLimiter.consume(`identidad:${auth.businessId}`)
    } catch {
      return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 })
    }
    const form = await req.formData()
    const kind = asKind(form.get('kind'))
    const file = form.get('file')
    if (!kind) return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
    if (!(file instanceof Blob)) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'El archivo no puede superar 5 MB' }, { status: 400 })
    const buffer = Buffer.from(await file.arrayBuffer())

    const base = newBase(auth.businessId, kind)
    const out = kind === 'favicon'
      ? (await buildFavicon(buffer)).map(f => ({ path: faviconFile(base, f.size), data: f.data }))
      : await buildOg(buffer, pct(form.get('focus_x')), pct(form.get('focus_y'))).then(o => [{ path: ogFile(base, 'jpg'), data: o.jpg }, { path: ogFile(base, 'webp'), data: o.webp }])

    await mkdir(join(process.cwd(), brandDir(auth.businessId)), { recursive: true, mode: 0o755 })
    await Promise.all(out.map(f => writeFile(join(process.cwd(), f.path.replace(/^\//, '')), f.data)))

    const row = await prisma.business.findUnique({ where: { id: auth.businessId }, select: { settings: true } })
    const previous = readBase(row?.settings, auth.businessId, kind)
    await saveSettings(auth.businessId, kind, base)
    await removeFiles(kind, previous)
    return NextResponse.json({ ok: true, kind, url: kind === 'favicon' ? faviconFile(base, 192) : ogFile(base, 'jpg') }, { status: 201 })
  } catch (err) {
    if (err instanceof IdentityImageError) return NextResponse.json({ error: err.message }, { status: 400 })
    console.error('config/identidad-web POST', err)
    return NextResponse.json({ error: 'No se pudo guardar la imagen' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const auth = await requireAdminConCatalogo()
  if (auth instanceof NextResponse) return auth
  const kind = asKind(req.nextUrl.searchParams.get('kind'))
  if (!kind) return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
  const row = await prisma.business.findUnique({ where: { id: auth.businessId }, select: { settings: true } })
  const previous = readBase(row?.settings, auth.businessId, kind)
  await saveSettings(auth.businessId, kind, null)
  await removeFiles(kind, previous)
  return NextResponse.json({ ok: true })
}
