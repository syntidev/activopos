import { NextRequest, NextResponse } from 'next/server'
import { listAccounts, loadAccount, openAccount, openAccountSchema } from '@/lib/restaurante-cuenta'
import { badRequest, handleRestauranteError, parseSearchParam, readJson, requireRestauranteAccess } from '@/lib/restaurante-server'
import type { AccountStatus } from '@/types/restaurante'

const STATUS_GROUPS: Record<string, readonly AccountStatus[]> = {
  abiertas: ['open', 'bill_requested'],
  cerradas: ['closed', 'void'],
  open: ['open'], bill_requested: ['bill_requested'], closed: ['closed'], void: ['void'],
}

// GET /api/restaurante/cuentas?q=juan 5&status=abiertas — búsqueda híbrida (AND entre palabras, OR entre campos)
export async function GET(req: NextRequest) {
  try {
    const access = await requireRestauranteAccess()
    if (access instanceof NextResponse) return access

    const rawQ = req.nextUrl.searchParams.get('q')
    let tokens: readonly string[] = []
    if (rawQ !== null) {
      const search = parseSearchParam(rawQ)
      if (!search.ok) return NextResponse.json({ error: search.error }, { status: 400 })
      tokens = search.tokens
    }
    const statuses = STATUS_GROUPS[req.nextUrl.searchParams.get('status') ?? 'abiertas']
    if (!statuses) return NextResponse.json({ error: 'status inválido' }, { status: 400 })

    return NextResponse.json({ ok: true, cuentas: await listAccounts(access.db, { tokens, statuses }) })
  } catch (err) {
    return handleRestauranteError(err, 'GET /api/restaurante/cuentas')
  }
}

// POST /api/restaurante/cuentas — abre la cuenta de una mesa. El mesonero siempre abre a su nombre.
export async function POST(req: NextRequest) {
  try {
    const access = await requireRestauranteAccess()
    if (access instanceof NextResponse) return access
    const { db, session } = access

    const parsed = openAccountSchema.safeParse(await readJson(req))
    if (!parsed.success) return badRequest(parsed.error)
    const body = parsed.data

    const waiterId = session.role === 'waiter' ? session.userId : (body.waiter_id ?? session.userId)
    const id = await openAccount(db, session.businessId, session.userId, {
      tableId: body.table_id, guests: body.guests, waiterId, clientName: body.client_name || null, confirmClean: body.confirm_clean === true,
    })
    return NextResponse.json({ ok: true, account: await loadAccount(db, id) }, { status: 201 })
  } catch (err) {
    return handleRestauranteError(err, 'POST /api/restaurante/cuentas')
  }
}
