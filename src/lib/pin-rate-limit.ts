import { prisma } from './prisma'

const MAX_ATTEMPTS = 5
const WINDOW_MS    = 5 * 60 * 1000

/**
 * Check rate limit and increment attempt counter.
 * Returns true if the caller is rate-limited (should be blocked).
 * Uses DB so limits survive PM2 restarts.
 */
export const checkAndIncrementPinAttempts = async (
  businessId: number,
  saleId: number
): Promise<boolean> => {
  const now     = new Date()
  const resetAt = new Date(now.getTime() + WINDOW_MS)

  // Lazy cleanup — non-blocking, runs after responding
  void prisma.pinRateLimit
    .deleteMany({ where: { reset_at: { lt: now } } })
    .catch(() => {})

  return prisma.$transaction(async (tx) => {
    const existing = await tx.pinRateLimit.findUnique({
      where: { business_id_sale_id: { business_id: businessId, sale_id: saleId } },
    })

    // No entry or window expired → reset to 1 attempt, allow
    if (!existing || existing.reset_at < now) {
      await tx.pinRateLimit.upsert({
        where:  { business_id_sale_id: { business_id: businessId, sale_id: saleId } },
        create: { business_id: businessId, sale_id: saleId, attempts: 1, reset_at: resetAt },
        update: { attempts: 1, reset_at: resetAt },
      })
      return false
    }

    if (existing.attempts >= MAX_ATTEMPTS) return true // blocked

    await tx.pinRateLimit.update({
      where: { id: existing.id },
      data:  { attempts: { increment: 1 } },
    })
    return false
  })
}

/** Remove rate limit entry on successful PIN match. */
export const clearPinAttempts = async (
  businessId: number,
  saleId: number
): Promise<void> => {
  await prisma.pinRateLimit.deleteMany({
    where: { business_id: businessId, sale_id: saleId },
  })
}
