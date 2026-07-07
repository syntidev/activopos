'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import styles from './SegmentsMenu.module.css'

interface Segment {
  slug: string
  name: string
  tag_line: string
}

export default function SegmentsMenu({ segments }: { segments: Segment[] }) {
  const [open, setOpen] = useState(false)
  const half = Math.ceil(segments.length / 2)
  const col1 = segments.slice(0, half)
  const col2 = segments.slice(half)

  return (
    <div
      className={styles.wrap}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button className={styles.trigger} aria-expanded={open} type="button">
        Segmentos
        <ChevronDown size={14} className={open ? styles.chevronOpen : styles.chevron} aria-hidden="true" />
      </button>

      {open && (
        <div className={styles.dropdown}>
          <div className={styles.grid}>
            <div className={styles.col}>
              {col1.map(seg => (
                <Link key={seg.slug} href={`/para-${seg.slug}`} className={styles.item}>
                  <span className={styles.itemName}>{seg.name}</span>
                  <span className={styles.itemTag}>{seg.tag_line}</span>
                </Link>
              ))}
            </div>
            <div className={styles.col}>
              {col2.map(seg => (
                <Link key={seg.slug} href={`/para-${seg.slug}`} className={styles.item}>
                  <span className={styles.itemName}>{seg.name}</span>
                  <span className={styles.itemTag}>{seg.tag_line}</span>
                </Link>
              ))}
            </div>
          </div>
          <div className={styles.footer}>
            <Link href="/#segmentos" className={styles.verTodos}>
              Ver todos los segmentos →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
