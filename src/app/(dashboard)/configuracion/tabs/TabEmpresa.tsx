'use client'

import { useState, useEffect, useCallback } from 'react'
import { Building2, Upload, Store } from 'lucide-react'
import { Button }   from '@/components/ui/Button'
import { Input }    from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { ImageField } from '@/components/ui/ImageField'
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
  catalog_title:    string
  catalog_desc:     string
  catalog_desc_enabled: boolean
  catalog_default_currency: 'usd' | 'bs' | 'both'
  catalog_instagram: string
  catalog_hours:     string
}

const EMPTY_FORM: EmpresaForm = {
  name: '', legal_name: '', rif: '', address: '', city: '', state: '', phone: '', email: '', quotation_footer: '',
  pos_mode: 'ticket',
  catalog_title: '', catalog_desc: '', catalog_desc_enabled: true,
  catalog_default_currency: 'usd',
  catalog_instagram: '', catalog_hours: '',
}

export function TabEmpresa({ businessId: _businessId }: Props) {
  const { toast } = useToast()

  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [form, setForm]               = useState<EmpresaForm>(EMPTY_FORM)
  const [logoPath, setLogoPath]       = useState<string | null>(null)

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
        quotation_footer: b.quotation_footer ?? '',
        pos_mode: b.pos_mode ?? 'ticket',
        catalog_title:        b.catalog_title ?? '',
        catalog_desc:         b.catalog_desc ?? '',
        catalog_desc_enabled: b.catalog_desc_enabled ?? true,
        catalog_default_currency: b.catalog_default_currency ?? 'usd',
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
          catalog_title:        form.catalog_title.trim() || null,
          catalog_desc:         form.catalog_desc.trim() || null,
          catalog_desc_enabled: form.catalog_desc_enabled,
          catalog_default_currency: form.catalog_default_currency,
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

  // El logo se guarda al instante, tanto al subir como al quitar (comportamiento
  // previo al subir); ImageField muestra el error si esto rechaza.
  const saveLogo = async (url: string | null) => {
    const res = await fetch('/api/config/business', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ logo_path: url }),
    })
    if (!res.ok) throw new Error(url ? 'No se pudo guardar el logo.' : 'No se pudo quitar el logo.')
    setLogoPath(url)
    toast(url ? 'Logo guardado correctamente.' : 'Logo quitado.', 'success')
  }

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
          <ImageField
            label="Logo del negocio"
            hideLabel
            value={logoPath}
            onChange={saveLogo}
            uploadType="logo"
            removable
            layout="inline"
            boxClassName={styles.logoPreview}
            alt="Logo del negocio"
            emptyContent={form.name.slice(0, 2).toUpperCase() || 'AP'}
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
                  <strong>Factura de servicio (Carta)</strong>
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

      </div>

      {/* ── Catálogo público -- antes catalog_desc solo se escribía 1 vez en
          el wizard de /registro, sin ninguna UI de edición posterior
          (confirmado por diagnóstico). catalog_title tampoco tenía form. ── */}
      <div className={styles.formCard}>
        <h3 className={styles.formCardTitle}>
          <Store size={16} aria-hidden="true" />
          Catálogo público
        </h3>

        <div className={styles.formFields}>
          <Input
            label="Título del catálogo"
            value={form.catalog_title}
            onChange={set('catalog_title')}
            placeholder={form.name || 'Mi Negocio'}
            hint="Opcional — si lo dejas vacío, se usa el nombre del negocio"
          />

          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="catalog_desc">Descripción del catálogo</label>
            <textarea
              id="catalog_desc"
              className={styles.textarea}
              value={form.catalog_desc}
              onChange={set('catalog_desc')}
              placeholder="Ej: Encuentra de todo en un solo lugar: víveres, limpieza, charcutería y más."
            />
            <p className={styles.logoDropHint}>
              Si la dejas vacía, tus clientes ven un texto genérico según tu rubro.
            </p>
          </div>

          <div className={styles.toggleRow}>
            <div>
              <p className={styles.toggleLabel}>Mostrar descripción en el catálogo</p>
              <p className={styles.toggleHint}>Apágalo si prefieres solo tu portada, sin texto encima</p>
            </div>
            <button
              type="button"
              className={`${styles.toggleBtn} ${form.catalog_desc_enabled ? styles.toggleBtnOn : ''}`}
              onClick={() => setForm(prev => ({ ...prev, catalog_desc_enabled: !prev.catalog_desc_enabled }))}
              aria-pressed={form.catalog_desc_enabled}
              aria-label={form.catalog_desc_enabled ? 'Ocultar descripción del catálogo' : 'Mostrar descripción del catálogo'}
            >
              <span className={`${styles.toggleKnob} ${form.catalog_desc_enabled ? styles.toggleKnobOn : ''}`} />
            </button>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="catalog-currency">
              Moneda visible en el catálogo
            </label>
            <select
              id="catalog-currency"
              className={styles.select}
              value={form.catalog_default_currency}
              onChange={(e) => setForm(prev => ({
                ...prev,
                catalog_default_currency: e.target.value as EmpresaForm['catalog_default_currency'],
              }))}
            >
              <option value="usd">Solo divisas ($)</option>
              <option value="bs">Solo Bolívares (Bs.)</option>
              <option value="both">Ambas ($ y Bs.)</option>
            </select>
            <p className={styles.toggleHint}>
              Aplica al catálogo público y al mensaje de WhatsApp. No afecta el POS ni tus tickets.
            </p>
          </div>
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
