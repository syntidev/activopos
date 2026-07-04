'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldAlert, X } from 'lucide-react'
import styles from './ImpersonationBanner.module.css'

interface Props {
  businessName: string
}

export function ImpersonationBannerClient({ businessName }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleExit() {
    setLoading(true)
    try {
      await fetch('/api/admin/impersonate', { method: 'DELETE' })
    } finally {
      router.push('/businesses')
      router.refresh()
    }
  }

  return (
    <div className={styles.banner} role="status">
      <span className={styles.text}>
        <ShieldAlert size={16} strokeWidth={2} aria-hidden="true" />
        Modo administrador — viendo como: <strong>{businessName}</strong>
      </span>
      <button type="button" className={styles.exitBtn} onClick={handleExit} disabled={loading}>
        <X size={14} strokeWidth={2} aria-hidden="true" />
        {loading ? 'Saliendo...' : 'Volver al panel'}
      </button>
    </div>
  )
}
