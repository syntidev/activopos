'use client'

import { useState, useEffect, useCallback } from 'react'
import { Users, Plus, UserCheck, UserX } from 'lucide-react'
import { Button }   from '@/components/ui/Button'
import { Input }    from '@/components/ui/Input'
import { Badge }    from '@/components/ui/Badge'
import { Modal }    from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import type { UserRecord, UserRole } from '@/types'
import styles from '../configuracion.module.css'

interface Props {
  businessId:    number
  currentUserId: number
}

interface NewUser {
  name:     string
  email:    string
  password: string
  role:     'admin' | 'cashier'
}

const EMPTY_USER: NewUser = { name: '', email: '', password: '', role: 'cashier' }

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin:       'Admin',
  cashier:     'Cajero',
}

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
}

export function TabUsuarios({ businessId: _businessId, currentUserId }: Props) {
  const { toast } = useToast()

  const [users, setUsers]         = useState<UserRecord[]>([])
  const [loading, setLoading]     = useState(true)
  const [addOpen, setAddOpen]     = useState(false)
  const [newUser, setNewUser]     = useState<NewUser>(EMPTY_USER)
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError]   = useState('')

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/users')
      if (!res.ok) throw new Error()
      const body = await res.json() as { ok: boolean; users: UserRecord[] }
      setUsers(body.users)
    } catch {
      toast('Error al cargar los usuarios.', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { void fetchUsers() }, [fetchUsers])

  const handleToggleActive = async (user: UserRecord) => {
    if (user.id === currentUserId) {
      toast('No puedes desactivarte a ti mismo.', 'error')
      return
    }
    const next = !user.is_active
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: next } : u))
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ is_active: next }),
      })
      if (!res.ok) throw new Error()
      toast(next ? 'Usuario activado.' : 'Usuario desactivado.', 'success')
    } catch {
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: user.is_active } : u))
      toast('Error al actualizar el usuario.', 'error')
    }
  }

  const handleAddUser = async () => {
    if (!newUser.name.trim())            { setAddError('El nombre es obligatorio.');                            return }
    if (!newUser.email.trim())           { setAddError('El correo es obligatorio.');                            return }
    if (!newUser.password)               { setAddError('La contraseña es obligatoria.');                        return }
    if (newUser.password.length < 6)     { setAddError('La contraseña debe tener al menos 6 caracteres.');      return }

    setAddSaving(true)
    setAddError('')
    try {
      const res  = await fetch('/api/users', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name:     newUser.name.trim(),
          email:    newUser.email.trim().toLowerCase(),
          password: newUser.password,
          role:     newUser.role,
        }),
      })
      const body = await res.json() as { error?: string; user?: UserRecord }
      if (!res.ok) { setAddError(body.error ?? 'Error al crear el usuario.'); return }
      setUsers(prev => [...prev, body.user!].sort((a, b) => a.name.localeCompare(b.name)))
      setNewUser(EMPTY_USER)
      setAddOpen(false)
      toast('Usuario creado correctamente.', 'success')
    } catch {
      setAddError('Error de conexión. Intenta de nuevo.')
    } finally {
      setAddSaving(false)
    }
  }

  const activeUsers  = users.filter(u => u.is_active)
  const adminCount   = activeUsers.filter(u => u.role === 'admin').length
  const cashierCount = activeUsers.filter(u => u.role === 'cashier').length

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <Users size={24} className={styles.spinner} aria-hidden="true" />
        <span>Cargando...</span>
      </div>
    )
  }

  return (
    <div className={styles.configSection}>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>Usuarios</h2>
        <p className={styles.pageSubtitle}>Gestiona el equipo con acceso al sistema</p>
      </div>

      {/* ── Summary cards ── */}
      <div className={styles.usersSummary}>
        <div className={styles.summaryCard}>
          <span className={styles.summaryCount}>{adminCount}</span>
          <span className={styles.summaryLabel}>Administradores activos</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryCount}>{cashierCount}</span>
          <span className={styles.summaryLabel}>Cajeros activos</span>
        </div>
      </div>

      {/* ── Users table ── */}
      <div className={styles.formCard}>
        <div className={styles.tableTopBar}>
          <Button variant="secondary" leftIcon={<Plus size={16} />} onClick={() => setAddOpen(true)}>
            Agregar usuario
          </Button>
        </div>

        <table className={styles.usersTable}>
          <thead className={styles.usersThead}>
            <tr>
              <th className={styles.usersTh}>Usuario</th>
              <th className={styles.usersTh}>Rol</th>
              <th className={styles.usersTh}>Estado</th>
              <th className={`${styles.usersTh} ${styles.tableActionsCol}`}></th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className={styles.usersRow}>
                <td className={styles.usersTd}>
                  <div className={styles.userCell}>
                    <div className={styles.userAvatar} aria-hidden="true">
                      {getInitials(user.name)}
                    </div>
                    <div>
                      <p className={styles.userName}>
                        {user.name}
                        {user.id === currentUserId && (
                          <span className={styles.currentUserTag}>(tú)</span>
                        )}
                      </p>
                      {user.email && <p className={styles.userEmail}>{user.email}</p>}
                    </div>
                  </div>
                </td>
                <td className={styles.usersTd}>
                  <Badge variant={user.role === 'admin' ? 'info' : 'neutral'} size="sm">
                    {ROLE_LABELS[user.role]}
                  </Badge>
                </td>
                <td className={styles.usersTd}>
                  <Badge variant={user.is_active ? 'success' : 'danger'} size="sm">
                    {user.is_active ? 'Activo' : 'Inactivo'}
                  </Badge>
                </td>
                <td className={styles.usersTd}>
                  <div className={styles.userActions}>
                    <button
                      type="button"
                      className={`${styles.actionBtn} ${user.is_active ? styles.actionBtnDanger : ''}`}
                      onClick={() => void handleToggleActive(user)}
                      disabled={user.id === currentUserId}
                      aria-label={user.is_active ? `Desactivar ${user.name}` : `Activar ${user.name}`}
                      title={user.id === currentUserId ? 'No puedes modificar tu propia cuenta' : undefined}
                    >
                      {user.is_active
                        ? <UserX     size={16} aria-hidden="true" />
                        : <UserCheck size={16} aria-hidden="true" />
                      }
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Add User Modal ── */}
      <Modal
        open={addOpen}
        onClose={() => { setAddOpen(false); setNewUser(EMPTY_USER); setAddError('') }}
        title="Nuevo Usuario"
        size="md"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => { setAddOpen(false); setNewUser(EMPTY_USER); setAddError('') }}
              disabled={addSaving}
            >
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleAddUser} loading={addSaving}>
              Crear usuario
            </Button>
          </>
        }
      >
        <div className={styles.modalForm}>
          <Input
            label="Nombre completo *"
            placeholder="Juan Pérez"
            value={newUser.name}
            onChange={(e) => setNewUser(p => ({ ...p, name: e.target.value }))}
            maxLength={255}
          />
          <Input
            label="Correo electrónico *"
            type="email"
            placeholder="juan@empresa.com"
            value={newUser.email}
            onChange={(e) => setNewUser(p => ({ ...p, email: e.target.value }))}
            maxLength={255}
          />
          <Input
            label="Contraseña *"
            type="password"
            placeholder="Mínimo 6 caracteres"
            value={newUser.password}
            onChange={(e) => setNewUser(p => ({ ...p, password: e.target.value }))}
            maxLength={72}
            hint="El usuario podrá cambiarla después"
          />

          <div className={styles.fieldGroup}>
            <span className={styles.label}>Rol</span>
            <div className={styles.roleOptions}>
              <button
                type="button"
                className={`${styles.roleOption} ${newUser.role === 'cashier' ? styles.roleOptionActive : ''}`}
                onClick={() => setNewUser(p => ({ ...p, role: 'cashier' }))}
              >
                <span className={styles.roleOptionTitle}>Cajero</span>
                <span className={styles.roleOptionHint}>POS, Caja, Clientes</span>
              </button>
              <button
                type="button"
                className={`${styles.roleOption} ${newUser.role === 'admin' ? styles.roleOptionActive : ''}`}
                onClick={() => setNewUser(p => ({ ...p, role: 'admin' }))}
              >
                <span className={styles.roleOptionTitle}>Administrador</span>
                <span className={styles.roleOptionHint}>Acceso completo</span>
              </button>
            </div>
          </div>

          {addError && <p className={styles.errorMsg} role="alert">{addError}</p>}
        </div>
      </Modal>
    </div>
  )
}
