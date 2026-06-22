import { prisma } from '@/lib/prisma'

export async function createNotification(
  businessId:  number,
  type:        string,
  title:       string,
  body:        string,
  entityType?: string,
  entityId?:   number
): Promise<void> {
  await prisma.notification.create({
    data: {
      business_id:  businessId,
      type,
      title,
      body,
      entity_type:  entityType ?? null,
      entity_id:    entityId ?? null,
    },
  })
}
