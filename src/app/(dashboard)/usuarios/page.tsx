'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, ShieldCheck, User } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import type { UserRecord, UserRole } from '@/types'
import styles from './usuarios.module.css'

/* ── Helpers ─────────────────────────────────────────────── */

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')
}

const ROLE_LABEL: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin:       'Admin',
  cashier:     'Cajero',
}

/* ── Form interfaces ─────────────────────────────────────── */

interface NewUserForm {
  name:     string
  email:    string
  password: string
  role:     'admin' | 'cashier'
}

interface EditUserForm {
  name:      string
  email:     string
  role:      'admin' | 'cashier'
  is_active: boolean
}

/* ── Inner content ───────────────────────────────────────── */

function UsuariosContent() {
  const { toast } = useToast()

  const [users,      setUsers]      = useState<UserRecord[]>([])
  const [loading,    setLoading]    = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // New user modal
  const [showNew,  setShowNew]  = useState(false)
  const [newForm,  setNewForm]  = useState<NewUserForm>({ name: '', email: '', password: '', role: 'cashier' })
  const [newError, setNewError] = useState('')

  // Edit user modal
  const [editTarget, setEditTarget] = useState<UserRecord | null>(null)
  const [editForm,   setEditForm]   = useState<EditUserForm>({ name: '', email: '', role: 'cashier', is_active: true })
  const [editError,  setEditError]  = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/users')
      if (res.ok) {
        const j = await res.json() as { ok: boolean; users: UserRecord[] }
        if (j.ok) setUsers(j.users)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  /* ── Create ── */

  function openNew() {
    setNewForm({ name: '', email: '', password: '', role: 'cashier' })
    setNewError('')
    setShowNew(true)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (newForm.password.length < 6) {
      setNewError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    setSubmitting(true)
    setNewError('')
    try {
      const res = await fetch('/api/users', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: newForm.name, email: newForm.email, password: newForm.password, role: newForm.role }),
      })
      const j = await res.json() as { ok?: boolean; error?: string }
      if (res.ok && j.ok) {
        toast(newForm.role === 'admin' ? 'Administrador creado' : 'Cajero creado', 'success')
        setShowNew(false)
        await load()
      } else {
        setNewError(j.error ?? 'Error al crear usuario')
      }
    } catch {
      setNewError('Error de conexión')
    } finally {
      setSubmitting(false)
    }
  }

  /* ── Edit ── */

  function openEdit(u: UserRecord) {
    const role: 'admin' | 'cashier' =
      u.role === 'cashier' ? 'cashier' : 'admin'
    setEditTarget(u)
    setEditForm({ name: u.name, email: u.email ?? '', role, is_active: u.is_active })
    setEditError('')
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editTarget) return
    setSubmitting(true)
    setEditError('')
    try {
      const res = await fetch(`/api/users/${editTarget.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: editForm.name, email: editForm.email, role: editForm.role, is_active: editForm.is_active }),
      })
      const j = await res.json() as { ok?: boolean; error?: string }
      if (res.ok && j.ok) {
        toast('Usuario actualizado', 'success')
        setEditTarget(null)
        await load()
      } else {
        setEditError(j.error ?? 'Error al actualizar')
      }
    } catch {
      setEditError('Error de conexión')
    } finally {
      setSubmitting(false)
    }
  }

  /* ── Delete (soft) ── */

  async function handleDelete(u: UserRecord) {
    if (!window.confirm(`¿Eliminar a ${u.name}? El usuario perderá acceso al sistema.`)) return
    try {
      const res = await fetch(`/api/users/${u.id}`, { method: 'DELETE' })
      const j   = await res.json() as { ok?: boolean; error?: string }
      if (res.ok && j.ok) {
        toast('Usuario desactivado', 'success')
        await load()
      } else {
        toast(j.error ?? 'Error al eliminar', 'error')
      }
    } catch {
      toast('Error de conexión', 'error')
    }
  }

  /* ── Render ── */

  return (
    <div className={`${styles.page} page-container`}>

      {/* ── Header ── */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Usuarios</h1>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus size={15} aria-hidden="true" />}
          onClick={openNew}
        >
          Agregar usuario
        </Button>
      </div>

      {/* ── List ── */}
      {loading ? (
        <p className={styles.loading}>Cargando usuarios…</p>
      ) : users.length === 0 ? (
        <p className={styles.empty}>No hay usuarios en este negocio.</p>
      ) : (
        <ul className={styles.userList} role="list">
          {users.map(u => (
            <li key={u.id} className={styles.userCard}>

              <div
                className={`${styles.avatar} ${u.role === 'cashier' ? styles.avatarCashier : styles.avatarAdmin}`}
                aria-hidden="true"
              >
                <span className={styles.avatarInitials}>{getInitials(u.name)}</span>
              </div>

              <div className={styles.userInfo}>
                <div className={styles.userNameRow}>
                  <span className={styles.userName}>{u.name}</span>
                  <span className={`${styles.roleBadge} ${u.role === 'cashier' ? styles.roleCashier : styles.roleAdmin}`}>
                    {u.role === 'cashier'
                      ? <User size={10} aria-hidden="true" />
                      : <ShieldCheck size={10} aria-hidden="true" />}
                    {ROLE_LABEL[u.role]}
                  </span>
                  {!u.is_active && (
                    <span className={styles.inactiveBadge}>Inactivo</span>
                  )}
                </div>
                <p className={styles.userEmail}>{u.email ?? '—'}</p>
              </div>

              <div className={styles.userActions}>
                <button
                  className={styles.actionBtn}
                  onClick={() => openEdit(u)}
                  aria-label={`Editar a ${u.name}`}
                >
                  <Pencil size={13} aria-hidden="true" />
                  Editar
                </button>
                {u.role === 'cashier' && (
                  <button
                    className={styles.deleteBtn}
                    onClick={() => handleDelete(u)}
                    aria-label={`Eliminar a ${u.name}`}
                  >
                    <Trash2 size={13} aria-hidden="true" />
                    Eliminar
                  </button>
                )}
              </div>

            </li>
          ))}
        </ul>
      )}

      {/* ── New user modal ── */}
      <Modal
        open={showNew}
        onClose={() => setShowNew(false)}
        title="Agregar usuario"
        size="sm"
        footer={
          <div className={styles.modalFooter}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowNew(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              form="new-user-form"
              type="submit"
              loading={submitting}
            >
              Crear usuario
            </Button>
          </div>
        }
      >
        <form id="new-user-form" onSubmit={handleCreate} className={styles.form}>
          <Input
            label="Nombre completo"
            value={newForm.name}
            onChange={e => setNewForm(p => ({ ...p, name: e.target.value }))}
            placeholder="María López"
            required
            autoFocus
          />
          <Input
            label="Correo electrónico"
            type="email"
            value={newForm.email}
            onChange={e => setNewForm(p => ({ ...p, email: e.target.value }))}
            placeholder="maria@tutienda.com"
            required
          />
          <Input
            label="Contraseña de acceso"
            type="password"
            value={newForm.password}
            onChange={e => setNewForm(p => ({ ...p, password: e.target.value }))}
            hint="Mínimo 6 caracteres"
            required
          />
          <div className={styles.selectField}>
            <label className={styles.selectLabel} htmlFor="new-user-role">
              Rol
            </label>
            <select
              id="new-user-role"
              className={styles.select}
              value={newForm.role}
              onChange={e => setNewForm(p => ({ ...p, role: e.target.value as 'admin' | 'cashier' }))}
            >
              <option value="cashier">Cajero</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          {newError && <p className={styles.formError} role="alert">{newError}</p>}
        </form>
      </Modal>

      {/* ── Edit user modal ── */}
      <Modal
        open={editTarget !== null}
        onClose={() => setEditTarget(null)}
        title="Editar usuario"
        size="sm"
        footer={
          <div className={styles.modalFooter}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditTarget(null)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              form="edit-user-form"
              type="submit"
              loading={submitting}
            >
              Guardar
            </Button>
          </div>
        }
      >
        <form id="edit-user-form" onSubmit={handleEdit} className={styles.form}>
          <Input
            label="Nombre completo"
            value={editForm.name}
            onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
            required
            autoFocus
          />
          <Input
            label="Correo electrónico"
            type="email"
            value={editForm.email}
            onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))}
            required
          />
          <div className={styles.selectField}>
            <label className={styles.selectLabel} htmlFor="edit-user-role">
              Rol
            </label>
            <select
              id="edit-user-role"
              className={styles.select}
              value={editForm.role}
              onChange={e => setEditForm(p => ({ ...p, role: e.target.value as 'admin' | 'cashier' }))}
            >
              <option value="cashier">Cajero</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <label className={styles.toggleRow}>
            <input
              type="checkbox"
              checked={editForm.is_active}
              onChange={e => setEditForm(p => ({ ...p, is_active: e.target.checked }))}
            />
            <span className={styles.toggleLabel}>Usuario activo</span>
          </label>
          {editError && <p className={styles.formError} role="alert">{editError}</p>}
        </form>
      </Modal>

    </div>
  )
}

/* ── Page export ─────────────────────────────────────────── */

export default function UsuariosPage() {
  return (
    <ToastProvider>
      <UsuariosContent />
    </ToastProvider>
  )
}
