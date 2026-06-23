'use client'

import { useState } from 'react'
import styles from './form.module.css'

interface FormState {
  name: string
  email: string
  business: string
  message: string
}

const INITIAL: FormState = { name: '', email: '', business: '', message: '' }

const FORMSPREE_URL = 'https://formspree.io/f/activopos-contact'

export default function ContactForm() {
  const [form, setForm]     = useState<FormState>(INITIAL)
  const [status, setStatus] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle')

  const set = (field: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm(prev => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setStatus('sending')
    try {
      const res = await fetch(FORMSPREE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('network')
      setStatus('ok')
      setForm(INITIAL)
    } catch {
      setStatus('error')
    }
  }

  if (status === 'ok') {
    return (
      <div className={styles.success}>
        <div className={styles.successIcon} aria-hidden="true">✓</div>
        <p className={styles.successTitle}>Mensaje enviado</p>
        <p className={styles.successDesc}>
          Te responderemos en menos de 24 horas por la misma dirección de correo.
        </p>
        <button className={styles.successBtn} onClick={() => setStatus('idle')}>
          Enviar otro mensaje
        </button>
      </div>
    )
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="cf-name">Nombre</label>
          <input
            id="cf-name"
            type="text"
            className={styles.input}
            placeholder="Tu nombre"
            value={form.name}
            onChange={set('name')}
            required
            autoComplete="name"
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="cf-email">Correo electrónico</label>
          <input
            id="cf-email"
            type="email"
            className={styles.input}
            placeholder="tu@correo.com"
            value={form.email}
            onChange={set('email')}
            required
            autoComplete="email"
          />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="cf-biz">
          Nombre del negocio <span className={styles.optional}>(opcional)</span>
        </label>
        <input
          id="cf-biz"
          type="text"
          className={styles.input}
          placeholder="Ej: Bodegón El Venezolano"
          value={form.business}
          onChange={set('business')}
          autoComplete="organization"
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="cf-msg">Mensaje</label>
        <textarea
          id="cf-msg"
          className={`${styles.input} ${styles.textarea}`}
          placeholder="¿En qué podemos ayudarte?"
          value={form.message}
          onChange={set('message')}
          required
          rows={5}
        />
      </div>

      {status === 'error' && (
        <p className={styles.errorMsg} role="alert">
          Hubo un problema al enviar. Intenta por WhatsApp o escríbenos a hola@activopos.com.
        </p>
      )}

      <button
        type="submit"
        className={styles.submitBtn}
        disabled={status === 'sending'}
      >
        {status === 'sending' ? 'Enviando…' : 'Enviar mensaje →'}
      </button>
    </form>
  )
}
