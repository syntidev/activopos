'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Building2, Upload } from 'lucide-react'
import { Button }   from '@/components/ui/Button'
import { Input }    from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import type { BusinessConfig } from '@/types'
import styles from '../configuracion.module.css'

interface Props { businessId: number }

type PosMode = 'ticket' | 'invoice'

interface EmpresaForm {
  name:             string
  legal_name:       string
  rif:              string
  address:          string
  city:             string
  state:            string
  phone:            string
  email:            string
  quotation_footer: string
  pos_mode:         PosMode
  catalog_instagram: string
  catalog_hours:     string
}

const EMPTY_FORM: EmpresaForm = {
  name: '', legal_name: '', rif: '', address: '', city: '', state: '', phone: '', email: '', quotation_footer: '',
  pos_mode: 'ticket',
  catalog_instagram: '', catalog_hours: '',
}

export function TabEmpresa({ businessId: _businessId }: Props) {
  const { toast } = useToast()
  const fileRef   = useRef<HTMLInputElement>(null)

  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [uploading, setUploading]     = useState(false)
  const [form, setForm]               = useState<EmpresaForm>(EMPTY_FORM)
  const [logoPath, setLogoPath]       = useState<string | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [isDragging, setIsDragging]   = useState(false)

  const fetchConfig = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/config/business')
      if (!res.ok) throw new Error()
      const body = await res.json() as { ok: boolean; business: BusinessConfig }
      const b    = body.business
      setForm({
        name:       b.name       ?? '',
        legal_name: b.legal_name ?? '',
        rif:        b.rif        ?? '',
        address:    b.address    ?? '',
        city:       b.city       ?? '',
        state:      b.state      ?? '',
        phone:      b.phone      ?? '',
        email:      b.email      ?? '',
        // el formulario no puede pre-poblarse; el guardado sí funciona vía PATCH.
        quotation_footer: '',
        pos_mode: b.pos_mode ?? 'ticket',
        catalog_instagram: b.catalog_instagram ?? '',
        catalog_hours:     b.catalog_hours ?? '',
      })
      setLogoPath(b.logo_path)
    } catch {
      toast('Error al cargar los datos de la empresa.', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { void fetchConfig() }, [fetchConfig])

  const set = (field: keyof EmpresaForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }))

  const handleSave = async () => {
    if (!form.name.trim()) { toast('El nombre del negocio es obligatorio.', 'error'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/config/business', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name:       form.name.trim(),
          legal_name: form.legal_name.trim() || null,
          rif:        form.rif.trim()        || null,
          address:    form.address.trim()    || null,
          city:       form.city.trim()       || null,
          state:      form.state.trim()      || null,
          phone:      form.phone.trim()      || null,
          email:      form.email.trim()      || null,
          // Sin || null: el schema no tiene .nullable() para este campo — enviar null
          // aquí produciría 400 "Datos inválidos". String vacío sí es válido y permite borrar el texto.
          quotation_footer: form.quotation_footer.trim(),
          pos_mode: form.pos_mode,
          catalog_instagram: form.catalog_instagram.trim().replace(/^@+/, '') || null,
          catalog_hours:     form.catalog_hours.trim() || null,
        }),
      })
      if (!res.ok) throw new Error()
      toast('Datos de empresa guardados.', 'success')
    } catch {
      toast('Error al guardar.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) { toast('Solo se aceptan imágenes PNG, JPG o WebP.', 'error'); return }
    if (file.size > 2 * 1024 * 1024)    { toast('El archivo no puede superar 2 MB.', 'error');          return }

    const prevPreview = logoPreview

    const reader = new FileReader()
    reader.onload = (e) => setLogoPreview(e.target?.result as string)
    reader.readAsDataURL(file)

    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('type', 'logo')
      const uploadRes = await fetch('/api/upload/image', { method: 'POST', body: fd })
      if (!uploadRes.ok) { toast('Error al subir la imagen.', 'error'); setLogoPreview(prevPreview); return }
      const { url } = await uploadRes.json() as { url: string }

      const patchRes = await fetch('/api/config/business', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ logo_path: url }),
      })
      if (!patchRes.ok) { toast('Error al guardar el logo.', 'error'); setLogoPreview(prevPreview); return }
      setLogoPath(url)
      toast('Logo guardado correctamente.', 'success')
    } catch {
      toast('Error de conexión al subir el logo.', 'error')
      setLogoPreview(prevPreview)
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  const displayLogo = logoPreview ?? logoPath

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <Building2 size={24} className={styles.spinner} aria-hidden="true" />
        <span>Cargando...</span>
      </div>
    )
  }

  return (
    <div className={styles.configSection}>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>Empresa</h2>
        <p className={styles.pageSubtitle}>Logo y datos fiscales del negocio</p>
      </div>

      {/* ── Logo ── */}
      <div className={styles.formCard}>
        <h3 className={styles.formCardTitle}>
          <Upload size={16} aria-hidden="true" />
          Logo del Negocio
        </h3>

        <div className={styles.logoArea}>
          <div className={styles.logoPreview}>
            {displayLogo
              ? <img src={displayLogo} alt="Logo del negocio" />
              : (form.name.slice(0, 2).toUpperCase() || 'AP')
            }
          </div>

          <div
            className={`${styles.logoDropZone} ${isDragging ? styles.logoDropZoneActive : ''}`}
            role="button"
            tabIndex={0}
            aria-label="Subir logo"
            onClick={() => !uploading && fileRef.current?.click()}
            onKeyDown={(e) => { if (!uploading && (e.key === 'Enter' || e.key === ' ')) fileRef.current?.click() }}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true)  }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <Upload size={20} aria-hidden="true" />
            <p className={styles.logoDropText}>
              {uploading ? 'Subiendo...' : logoPreview ? 'Cambiar imagen' : 'Arrastra o haz clic para subir'}
            </p>
            <p className={styles.logoDropHint}>PNG, JPG hasta 2 MB</p>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className={styles.logoFileInput}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }}
            aria-hidden="true"
            tabIndex={-1}
          />
        </div>
      </div>

      {/* ── Datos empresariales ── */}
      <div className={styles.formCard}>
        <h3 className={styles.formCardTitle}>
          <Building2 size={16} aria-hidden="true" />
          Información Empresarial
        </h3>

        <div className={styles.formFields}>
          <Input label="Nombre del negocio *" value={form.name}       onChange={set('name')}       placeholder="Mi Empresa C.A." />
          <Input label="Razón social"         value={form.legal_name} onChange={set('legal_name')} placeholder="Mi Empresa C.A." hint="Opcional" />
          <Input label="RIF"                  value={form.rif}        onChange={set('rif')}        placeholder="J-00000000-0"    hint="Opcional" />
        </div>

        <div className={styles.formDivider} />

        <div className={styles.formFields}>
          <Input label="Dirección" value={form.address} onChange={set('address')} placeholder="Av. Principal, Local 1" hint="Opcional" />

          <div className={styles.fieldGroup} role="radiogroup" aria-label="Tipo de documento de venta">
            <span className={styles.label}>Tipo de documento de venta</span>
            <div className={styles.posModeOptions}>
              <label className={`${styles.posModeOption} ${form.pos_mode === 'ticket' ? styles.posModeOptionActive : ''}`}>
                <input
                  type="radio"
                  name="pos_mode"
                  value="ticket"
                  checked={form.pos_mode === 'ticket'}
                  onChange={() => setForm(prev => ({ ...prev, pos_mode: 'ticket' }))}
                  className={styles.posModeRadio}
                />
                <span>
                  <strong>Ticket térmico (58mm)</strong>
                  <small>Para tiendas y retail</small>
                </span>
              </label>
              <label className={`${styles.posModeOption} ${form.pos_mode === 'invoice' ? styles.posModeOptionActive : ''}`}>
                <input
                  type="radio"
                  name="pos_mode"
                  value="invoice"
                  checked={form.pos_mode === 'invoice'}
                  onChange={() => setForm(prev => ({ ...prev, pos_mode: 'invoice' }))}
                  className={styles.posModeRadio}
                />
                <span>
                  <strong>Factura de servicio (A4)</strong>
                  <small>Para talleres, clínicas, gestorías</small>
                </span>
              </label>
            </div>
          </div>

          <div className={styles.fieldRow}>
            <Input label="Ciudad" value={form.city}  onChange={set('city')}  placeholder="Caracas" hint="Opcional" />
            <Input label="Estado" value={form.state} onChange={set('state')} placeholder="Miranda" hint="Opcional" />
          </div>
        </div>

        <div className={styles.formDivider} />

        <div className={styles.fieldRow}>
          <Input label="Teléfono" value={form.phone} onChange={set('phone')} placeholder="0412-0000000" hint="Opcional" />
          <Input label="Correo"   type="email" value={form.email} onChange={set('email')} placeholder="info@empresa.com" hint="Opcional" />
        </div>

        <div className={styles.formDivider} />

        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="quotation_footer">Condiciones de cotización</label>
          <textarea
            id="quotation_footer"
            className={styles.textarea}
            value={form.quotation_footer}
            onChange={set('quotation_footer')}
            placeholder="Ej: Precios válidos por 3 días. Forma de pago: transferencia o efectivo."
          />
        </div>

        <div className={styles.formDivider} />

        <div className={styles.formFields}>
          <Input
            label="Instagram (opcional)"
            value={form.catalog_instagram}
            onChange={set('catalog_instagram')}
            placeholder="@mitienda o mitienda"
            hint="Solo el nombre de usuario, sin @"
          />

          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="catalog_hours">Horario de atención</label>
            <textarea
              id="catalog_hours"
              className={styles.textarea}
              value={form.catalog_hours}
              onChange={set('catalog_hours')}
              placeholder="Lun-Vie 08:00-18:00 · Sab 09:00-14:00 · Dom Cerrado"
            />
            <p className={styles.logoDropHint}>Texto libre. Tus clientes lo verán en la info del catálogo.</p>
          </div>
        </div>

        <div className={styles.saveRow}>
          <Button variant="primary" onClick={handleSave} loading={saving}>
            Guardar cambios
          </Button>
        </div>
      </div>
    </div>
  )
}
