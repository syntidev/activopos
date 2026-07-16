'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Eye, EyeOff, Loader2, RefreshCw, ScanBarcode, Images,
  MessageCircle, FileSpreadsheet, Wallet, Calculator, type LucideIcon,
} from 'lucide-react'
import styles from './login.module.css'

// ── Fotos reales de segmentos (public/segments/*-hero.webp) -- mismas que usa la home.
// Se rotan aleatorio por carga para reforzar "ActivoPOS sirve a todo tipo de negocio".
const SEGMENT_IMAGES = [
  'abastos', 'belleza', 'bisuteria', 'carniceria', 'comida-rapida', 'deportes',
  'electronica', 'farmacias', 'ferreterias', 'fruteria', 'jugueteria', 'lavanderia',
  'licoreria', 'mascotas', 'muebleria', 'optica', 'panaderia', 'papeleria',
  'repuestos', 'restaurante', 'servicios', 'tecnologia', 'tiendas-ropa',
] as const

// ── Tips reales -- cada uno verificado contra código antes de usar (ver reporte).
interface Tip { text: string; Icon: LucideIcon }
const TIPS: Tip[] = [
  { text: 'Escanea el código de barras desde el celular, sin lector aparte.', Icon: ScanBarcode },
  { text: 'Hasta 3 imágenes por producto — muéstralo desde todos los ángulos.', Icon: Images },
  { text: 'Tu catálogo digital recibe pedidos por WhatsApp, sin instalar nada.', Icon: MessageCircle },
  { text: 'La tasa BCV se actualiza sola en cada venta — o fija la tuya manual.', Icon: RefreshCw },
  { text: 'Exporta tus reportes a Excel con un clic.', Icon: FileSpreadsheet },
  { text: 'Cobra en Pago Móvil, Zelle, Binance y más — todo en un mismo ticket.', Icon: Wallet },
  { text: 'El cierre de caja te dice si cuadra, sin hacer la cuenta a mano.', Icon: Calculator },
]

// Colores de tip -- solo paleta sellada (Persian Blue / Sand / Navy acento), nunca Ámbar.
const TIP_VARIANTS = [styles.tipSand, styles.tipBlue, styles.tipNavy] as const

function pickRandom<T>(arr: readonly T[], n: number): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, n)
}

function fmtBs(rate: number): string {
  return rate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // Mosaico -- se elige en el cliente (useEffect) para no romper la hidratación con
  // Math.random() en el render del servidor.
  const [photos, setPhotos] = useState<string[]>([])
  const [tips, setTips] = useState<Tip[]>([])
  const [bcv, setBcv] = useState<number | null>(null)

  useEffect(() => {
    setPhotos(pickRandom(SEGMENT_IMAGES, 2))
    setTips(pickRandom(TIPS, 3))
  }, [])

  useEffect(() => {
    const ctrl = new AbortController()
    fetch('/api/rates/bcv', { signal: ctrl.signal })
      .then(r => r.ok ? r.json() : Promise.reject(new Error()))
      .then((d: { bcv?: number | null; bcv_rate?: number | null; rate?: number | null }) => {
        const value = d.bcv ?? d.bcv_rate ?? d.rate ?? null
        if (typeof value === 'number' && value > 0) setBcv(value)
      })
      .catch(() => {})
    return () => ctrl.abort()
  }, [])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Error al ingresar')
        return
      }
      router.push(data.user?.role === 'super_admin' ? '/businesses' : '/escritorio')
      router.refresh()
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>

        {/* ── Mosaico (oculto en mobile) ── */}
        <aside className={styles.mosaic} aria-hidden="true">
          {/* Celda prioritaria: BCV en vivo */}
          <div className={`${styles.cell} ${styles.bcvCell}`} style={{ animationDelay: '0.10s' }}>
            <span className={styles.bcvLabel}>
              <RefreshCw size={13} aria-hidden="true" />
              Hoy la tasa está en
            </span>
            <span className={styles.bcvValue}>
              {bcv ? `Bs ${fmtBs(bcv)}` : '—'}
            </span>
            <span className={styles.bcvSub}>por dólar · BCV en vivo</span>
          </div>

          {/* 2 fotos reales de segmentos */}
          {photos.map((slug, i) => (
            <div
              key={slug}
              className={`${styles.cell} ${styles.photoCell}`}
              style={{ animationDelay: `${0.2 + i * 0.1}s` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.photoImg} src={`/segments/${slug}-hero.webp`} alt="" loading="lazy" />
            </div>
          ))}

          {/* 3 tips reales */}
          {tips.map((tip, i) => (
            <div
              key={tip.text}
              className={`${styles.cell} ${styles.tipCell} ${TIP_VARIANTS[i % TIP_VARIANTS.length]}`}
              style={{ animationDelay: `${0.4 + i * 0.1}s` }}
            >
              <span className={styles.tipText}>{tip.text}</span>
              <span className={styles.tipGhost} aria-hidden="true">
                <tip.Icon size={64} />
              </span>
            </div>
          ))}
        </aside>

        {/* ── Panel de formulario ── */}
        <section className={styles.panel}>
          <p className={styles.signupRow}>
            ¿No tienes cuenta?{' '}
            <Link href="/registro" className={styles.signupLink}>Crea tu negocio</Link>
          </p>

          <div className={styles.brand}>
            <img src="/activopos-logo-icon.svg" alt="" aria-hidden="true" className={styles.brandIcon} />
            <span className={styles.brandName}>
              <span className={styles.brandActivo}>Activo</span>
              <span className={styles.brandPOS}>POS</span>
            </span>
          </div>

          <h1 className={styles.title}>Bienvenido de vuelta</h1>
          <p className={styles.subtitle}>Entra y sigue vendiendo. Tu negocio te está esperando.</p>

          <form onSubmit={handleSubmit} className={styles.form} noValidate>
            <div className={styles.field}>
              <label htmlFor="email" className={styles.label}>Correo electrónico</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={styles.input}
                placeholder="usuario@negocio.com"
                autoComplete="email"
                autoFocus
                required
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="password" className={styles.label}>Contraseña</label>
              <div className={styles.passwordWrapper}>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={styles.inputPassword}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className={styles.eyeButton}
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword
                    ? <EyeOff size={16} strokeWidth={1.75} aria-hidden="true" />
                    : <Eye size={16} strokeWidth={1.75} aria-hidden="true" />}
                </button>
              </div>
            </div>

            {error && <p role="alert" className={styles.errorMsg}>{error}</p>}

            <button
              type="submit"
              className={styles.submitButton}
              disabled={isLoading || !email || !password}
              aria-busy={isLoading}
            >
              {isLoading ? (
                <><Loader2 size={16} className={styles.spinner} aria-hidden="true" /> Iniciando sesión…</>
              ) : 'Ingresar'}
            </button>
          </form>

          <p className={styles.footer}>ActivoPOS &copy; 2026 &mdash; SYNTIdev</p>
        </section>
      </div>
    </div>
  )
}
