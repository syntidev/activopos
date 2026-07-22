import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const patchSchema = z.object({
  title:            z.string().min(1).max(255).optional(),
  slug:             z.string().min(1).max(255).optional(),
  excerpt:          z.string().nullable().optional(),
  content:          z.string().min(1).optional(),
  featured_image:   z.string().max(500).nullable().optional(),
  category:         z.string().max(80).nullable().optional(),
  tags:             z.array(z.string()).nullable().optional(),
  author:           z.string().max(100).optional(),
  status:           z.enum(['draft', 'published']).optional(),
  published_at:     z.string().datetime().nullable().optional(),
  is_featured:      z.boolean().optional(),
  meta_title:       z.string().max(255).nullable().optional(),
  meta_description: z.string().max(255).nullable().optional(),
  // read_time es string ("5 min"), no número (columna VarChar(20)). El update usa
  // ...data, así que con incluirlo en el schema ya se persiste.
  read_time:        z.string().max(20).nullable().optional(),
})

type Context = { params: { id: string } }

const parseId = (raw: string) => {
  const id = parseInt(raw, 10)
  return isNaN(id) ? null : id
}

async function requireSuperAdmin() {
  const session = await getSession()
  if (!session) return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
  if (session.role !== 'super_admin') return { error: NextResponse.json({ error: 'Sin permiso' }, { status: 403 }) }
  return { session }
}

export async function GET(_req: NextRequest, { params }: Context) {
  const auth = await requireSuperAdmin()
  if (auth.error) return auth.error

  const id = parseId(params.id)
  if (id === null) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const post = await prisma.blogPost.findUnique({ where: { id } })
  if (!post) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  return NextResponse.json({ ok: true, post })
}

export async function PATCH(req: NextRequest, { params }: Context) {
  const auth = await requireSuperAdmin()
  if (auth.error) return auth.error

  const id = parseId(params.id)
  if (id === null) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const body = await req.json()
    const data = patchSchema.parse(body)

    const existing = await prisma.blogPost.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    const updateData = {
      ...data,
      tags:         data.tags === undefined ? undefined : (data.tags === null ? Prisma.JsonNull : data.tags),
      published_at: data.published_at === undefined ? undefined : (data.published_at ? new Date(data.published_at) : null),
    }

    // Destacado exclusivo: solo un post puede estar is_featured a la vez. Si este
    // se marca, se desmarcan los demás en la misma transacción. .find() en el
    // front tomaba el primero de varios featured, así que el destacado nunca
    // cambiaba aunque el usuario marcara otro.
    const post = data.is_featured === true
      ? await prisma.$transaction(async (tx) => {
          await tx.blogPost.updateMany({ where: { id: { not: id }, is_featured: true }, data: { is_featured: false } })
          return tx.blogPost.update({ where: { id }, data: updateData })
        })
      : await prisma.blogPost.update({ where: { id }, data: updateData })

    return NextResponse.json({ ok: true, post })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    if ((err as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe un post con ese slug' }, { status: 409 })
    }
    console.error('Blog post patch error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Context) {
  const auth = await requireSuperAdmin()
  if (auth.error) return auth.error

  const id = parseId(params.id)
  if (id === null) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const existing = await prisma.blogPost.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  await prisma.blogPost.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
