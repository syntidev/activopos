'use client'

import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

// Wrapper cliente para animar de entrada secciones que son Server Components
// async (SegmentsSection/BCVSection hacen fetch/Prisma — no pueden llevar
// 'use client' en el archivo completo).
export default function RevealSection({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}
