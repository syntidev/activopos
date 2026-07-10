'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import SegmentIcon from './SegmentIcon'
import styles from './SegmentPill.module.css'

interface Props {
  slug:    string
  name:    string
  tagLine: string
  delay?:  number
}

export default function SegmentPill({ slug, name, tagLine, delay = 0 }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, ease: 'easeOut', delay }}
      whileHover={{ scale: 1.02 }}
    >
      <Link href={`/para-${slug}`} className={styles.pill}>
        <span className={styles.iconCircle}>
          <SegmentIcon slug={slug} size={16} />
        </span>
        <span className={styles.text}>
          <span className={styles.name}>{name}</span>
          <span className={styles.tagLine}>{tagLine}</span>
        </span>
      </Link>
    </motion.div>
  )
}
