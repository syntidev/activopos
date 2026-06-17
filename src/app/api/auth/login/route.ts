import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { signToken, setSessionCookie } from '@/lib/auth'
import { loginLimiter, getClientIp } from '@/lib/rate-limit'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

export async function POST(req: NextRequest) {
  try {
    await loginLimiter.consume(getClientIp(req))
  } catch {
    return NextResponse.json(
      { error: 'Demasiados intentos. Espera 15 minutos.' },
      { status: 429 }
    )
  }

  try {
    const body = await req.json()
    const { email, password } = loginSchema.parse(body)

    const user = await prisma.user.findFirst({
      where: { email, is_active: true },
      include: {
        business: {
          select: {
            id: true,
            name: true,
            active: true,
            subscription_active: true,
            onboarding_completed: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 })
    }

    if (!user.business.active || !user.business.subscription_active) {
      return NextResponse.json(
        { error: 'Cuenta suspendida. Contacta soporte.' },
        { status: 403 }
      )
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 })
    }

    const token = await signToken({
      userId: user.id,
      businessId: user.business_id,
      role: user.role,
      name: user.name,
      onboardingCompleted: user.business.onboarding_completed,
    })

    setSessionCookie(token)

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        businessId: user.business_id,
        businessName: user.business.name,
      },
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }
    console.error('Login error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
