'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { CARTA_PRESET_OPTIONS, CARTA_STYLES, TEMPLATES, TEMPLATE_LABELS, SLUG_RE, type CartaPresetKey, type CartaStyleKey, type PlantillaKey } from '@/lib/plantillas'
import type { CollectIn } from '@/lib/cobro-precios'
import styles from '../../admin.module.css'
import own from './nuevo.module.css'

interface Created { business_id: number; slug: string; public_url: string; admin_email: string; admin_password: string }

const COLLECT_LABELS: Record<CollectIn, string> = { both: 'Bs y $', bs: 'Solo Bs', usd: 'Solo $' }
const STYLE_LABELS: Record<CartaStyleKey, string> = { casual: 'Casual', fine: 'Fine dining' }

const slugify = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50)

/** Asistente "Nuevo negocio" del superadmin: crea el tenant por la única vía (createTenant) y muestra enlace y credenciales UNA vez. */
export default function NuevoNegocioPage() {
  const [name, setName]         = useState('')
  const [slug, setSlug]         = useState('')
  const [slugTouched, setTouched] = useState(false)
  const [rubro, setRubro]       = useState('')
  const [template, setTemplate] = useState<PlantillaKey>('premium')
  const [preset, setPreset]     = useState<CartaPresetKey>('brasa')
  const [style, setStyle]       = useState<CartaStyleKey>('casual')
  const [collect, setCollect]   = useState<CollectIn>('both')
  const [cashea, setCashea]     = useState(false)
  const [divisa, setDivisa]     = useState(true)
  const [adminName, setAdminName]   = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [password, setPassword]     = useState('')
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<Created | null>(null)

  const slugOk = SLUG_RE.test(slug)

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/tenants', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_name: name, slug, rubro, template,
          ...(template === 'carta' ? { carta_preset: preset, carta_style: style } : {}),
          collect_in: collect, cashea, divisa,
          admin_name: adminName, admin_email: adminEmail,
          ...(password ? { admin_password: password } : {}),
        }),
      })
      const j = await res.json().catch(() => ({})) as Partial<Created> & { error?: string }
      if (!res.ok) { setError(j.error ?? 'No se pudo crear el negocio.'); return }
      setCreated(j as Created)
      setPassword('')
    } catch {
      setError('Error de conexión.')
    } finally {
      setBusy(false)
    }
  }

  if (created) {
    return (
      <div>
        <Link href="/businesses" className={styles.backLink}><ArrowLeft size={14} aria-hidden="true" /> Volver a Negocios</Link>
        <h1 className={styles.pageTitle}>Negocio creado</h1>
        <div className={`${styles.detailSection} ${own.credBox}`} data-testid="nuevo-resultado">
          <p className={styles.infoLabel}>Enlace público (no cambia aunque cambies de plantilla)</p>
          <p><a href={created.public_url} target="_blank" rel="noopener noreferrer" className={styles.actionLink} data-testid="nuevo-url">{created.public_url}</a></p>
          <p className={styles.infoLabel}>Usuario administrador</p>
          <p className={styles.infoValue} data-testid="nuevo-email">{created.admin_email}</p>
          <p className={styles.infoLabel}>Contraseña</p>
          <p className={`${styles.infoValue} ${own.secret}`} data-testid="nuevo-password">{created.admin_password}</p>
          <p className={styles.planStatusHint}>Cópiala ahora: no se vuelve a mostrar.</p>
          <p><Link href={`/businesses/${created.business_id}`} className={styles.actionLink}>Ver detalle del negocio →</Link></p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Link href="/businesses" className={styles.backLink}><ArrowLeft size={14} aria-hidden="true" /> Volver a Negocios</Link>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Nuevo negocio</h1>
        <p className={styles.pageSubtitle}>Crea el negocio, su usuario administrador y su catálogo con la plantilla elegida.</p>
      </div>

      <form onSubmit={e => void submit(e)} className={`${styles.detailSection} ${own.form}`} data-testid="nuevo-form">
        <div className={styles.planStatusField}>
          <label className={styles.infoLabel} htmlFor="nn-name">Nombre del negocio</label>
          <input id="nn-name" className={styles.planSelect} value={name} required minLength={2} maxLength={100}
            onChange={e => { setName(e.target.value); if (!slugTouched) setSlug(slugify(e.target.value)) }} />
        </div>
        <div className={styles.planStatusField}>
          <label className={styles.infoLabel} htmlFor="nn-slug">Slug (enlace /c/…)</label>
          <input id="nn-slug" className={styles.planSelect} value={slug} required
            onChange={e => { setTouched(true); setSlug(e.target.value.toLowerCase()) }} />
          {slug && !slugOk && <span className={styles.planStatusHint}>3 a 50 caracteres: minúsculas, números y guiones.</span>}
        </div>
        <div className={styles.planStatusField}>
          <label className={styles.infoLabel} htmlFor="nn-rubro">Rubro</label>
          <input id="nn-rubro" className={styles.planSelect} value={rubro} required maxLength={40} placeholder="restaurante, boutique, bodega…"
            onChange={e => setRubro(e.target.value)} />
        </div>

        <div className={styles.planStatusField}>
          <label className={styles.infoLabel} htmlFor="nn-template">Plantilla</label>
          <select id="nn-template" className={styles.planSelect} value={template} onChange={e => setTemplate(e.target.value as PlantillaKey)}>
            {TEMPLATES.map(t => <option key={t} value={t}>{TEMPLATE_LABELS[t]}</option>)}
          </select>
        </div>
        {template === 'carta' && (
          <>
            <div className={styles.planStatusField}>
              <label className={styles.infoLabel} htmlFor="nn-preset">Preset de la carta</label>
              <select id="nn-preset" className={styles.planSelect} value={preset} onChange={e => setPreset(e.target.value as CartaPresetKey)}>
                {CARTA_PRESET_OPTIONS.map(o => <option key={o.key} value={o.key} disabled={!o.available}>{o.available ? o.label : `${o.label} — Próximamente`}</option>)}
              </select>
            </div>
            <div className={styles.planStatusField}>
              <label className={styles.infoLabel} htmlFor="nn-style">Estilo de la carta</label>
              <select id="nn-style" className={styles.planSelect} value={style} onChange={e => setStyle(e.target.value as CartaStyleKey)}>
                {CARTA_STYLES.map(s => <option key={s} value={s}>{STYLE_LABELS[s]}</option>)}
              </select>
            </div>
          </>
        )}

        <div className={styles.planStatusField}>
          <span className={styles.infoLabel}>Precios en</span>
          <span className={styles.infoValue}>$ (USD)</span>
        </div>
        <div className={styles.planStatusField}>
          <label className={styles.infoLabel} htmlFor="nn-collect">Cobra en</label>
          <select id="nn-collect" className={styles.planSelect} value={collect} onChange={e => setCollect(e.target.value as CollectIn)}>
            {(Object.keys(COLLECT_LABELS) as CollectIn[]).map(k => <option key={k} value={k}>{COLLECT_LABELS[k]}</option>)}
          </select>
        </div>
        <label className={own.check}><input type="checkbox" checked={cashea} onChange={e => setCashea(e.target.checked)} /> Ofrecer Cashea</label>
        <label className={own.check}><input type="checkbox" checked={divisa} onChange={e => setDivisa(e.target.checked)} /> Ofrecer precio Divisa</label>

        <div className={styles.planStatusField}>
          <label className={styles.infoLabel} htmlFor="nn-aname">Usuario admin: nombre</label>
          <input id="nn-aname" className={styles.planSelect} value={adminName} required minLength={2} maxLength={100} onChange={e => setAdminName(e.target.value)} />
        </div>
        <div className={styles.planStatusField}>
          <label className={styles.infoLabel} htmlFor="nn-aemail">Usuario admin: correo</label>
          <input id="nn-aemail" type="email" className={styles.planSelect} value={adminEmail} required onChange={e => setAdminEmail(e.target.value)} />
        </div>
        <div className={styles.planStatusField}>
          <label className={styles.infoLabel} htmlFor="nn-apass">Contraseña (opcional)</label>
          <input id="nn-apass" type="text" className={styles.planSelect} value={password} minLength={8} maxLength={100} autoComplete="off" onChange={e => setPassword(e.target.value)} />
          <span className={styles.planStatusHint}>Vacía = se genera una y se muestra una sola vez.</span>
        </div>

        <div className={styles.planStatusActions}>
          <button type="submit" className={`${styles.actionLink} ${styles.actionBtn}`} disabled={busy || !slugOk}>
            {busy ? 'Creando...' : 'Crear negocio'}
          </button>
          {error && <span className={styles.planStatusMsg} role="alert">{error}</span>}
        </div>
      </form>
    </div>
  )
}
