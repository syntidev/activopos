'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import styles from './login.module.css'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

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

      router.push('/escritorio')
      router.refresh()
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <motion.div
        className={styles.card}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
      >
        <div className={styles.logoRow} aria-label="ActivoPOS">
          <img src="/activopos-3d.svg" alt="ActivoPOS" className={styles.logoImg} />
          <span className={styles.logoName}>
            <span className={styles.logoActivo}>Activo</span>
            <span className={styles.logoPOS}>POS</span>
          </span>
        </div>

        <p className={styles.tagline}>
          El POS para negocios que andan activos
        </p>

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <div className={styles.field}>
            <label htmlFor="email" className={styles.label}>
              Correo electrónico
            </label>
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
            <label htmlFor="password" className={styles.label}>
              Contraseña
            </label>
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

          {error && (
            <motion.p
              role="alert"
              className={styles.errorMsg}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
            >
              {error}
            </motion.p>
          )}

          <button
            type="submit"
            className={styles.submitButton}
            disabled={isLoading || !email || !password}
            aria-busy={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className={styles.spinner} aria-hidden="true" />
                Ingresando…
              </>
            ) : (
              'Ingresar'
            )}
          </button>
        </form>

        <p className={styles.footer}>
          ActivoPOS &copy; 2026 &mdash; SYNTIdev
        </p>
      </motion.div>
    </div>
  )
}
