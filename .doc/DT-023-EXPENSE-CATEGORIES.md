# DT-023 — Expense Categories: Customizable Schema Design
# ActivoPOS | Sprint 13 | 2026-06-19

---

## Resumen

Los gastos actuales usan un campo `category` de texto libre. Los usuarios escriben "Alquiler", "alquiler", "ALQUILER" → tres valores distintos, sin normalización. No hay posibilidad de reportar por categoría de gasto de forma fiable.

**Requerimiento:** Permitir a cada negocio definir sus propias categorías de gasto (alta/edición/desactivación), y que todos los gastos referencien una categoría normalizada.

---

## Decisión de diseño

**No se añade esta feature en Sprint 13.** Este documento describe el esquema para Sprint 14+ cuando se priorice.

**Justificación del timing:**
- El módulo Finanzas fue certificado en Sprint 12 con `category` como texto libre
- Cambiar el esquema ahora requeriría migración de datos + UI + API — scope de un sprint completo
- Catálogo admin (Sprint 13) cierra el bloque Catálogo → Analytics es el próximo sprint

---

## Esquema propuesto

### Tabla `expense_categories`

```sql
CREATE TABLE expense_categories (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  business_id INT UNSIGNED NOT NULL,
  name        VARCHAR(80)  NOT NULL,
  color       VARCHAR(7)   NULL,        -- hex: "#059669" — para UI
  is_system   BOOLEAN      DEFAULT FALSE, -- no editable por el usuario
  active      BOOLEAN      DEFAULT TRUE,
  created_at  DATETIME(3)  DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_cat_biz_name (business_id, name),
  CONSTRAINT fk_exp_cat_biz FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);
```

### Modificación `expenses`

```sql
-- Agregar referencia opcional (nullable durante migración)
ALTER TABLE expenses
  ADD COLUMN category_id INT UNSIGNED NULL
    REFERENCES expense_categories(id) ON DELETE SET NULL;
```

Se mantiene `category` (texto libre) como fallback durante la migración. Una vez migrado, `category_id` puede volverse NOT NULL y `category` puede quedar deprecated.

### Prisma schema

```prisma
model ExpenseCategory {
  id          Int       @id @default(autoincrement())
  businessId  Int       @map("business_id")
  name        String    @db.VarChar(80)
  color       String?   @db.VarChar(7)
  isSystem    Boolean   @default(false) @map("is_system")
  active      Boolean   @default(true)
  createdAt   DateTime  @default(now()) @map("created_at")

  business    Business  @relation(fields: [businessId], references: [id])
  expenses    Expense[]

  @@unique([businessId, name])
  @@map("expense_categories")
}
```

---

## API design

| Endpoint                          | Método | Descripción                          | Auth  |
|-----------------------------------|--------|--------------------------------------|-------|
| `/api/finanzas/categorias`        | GET    | Lista categorías del negocio         | admin |
| `/api/finanzas/categorias`        | POST   | Crear categoría                      | admin |
| `/api/finanzas/categorias/[id]`   | PATCH  | Editar nombre / color / active       | admin |

`DELETE` → soft delete vía `active: false` (no eliminar — los gastos históricos referencian la categoría).

---

## Categorías de sistema (seed)

Al activar un negocio por primera vez, se crean estas categorías por defecto:

| Nombre              | Color     | Tipo de gasto típico       |
|---------------------|-----------|----------------------------|
| Alquiler            | `#6366f1` | Arrendamiento local        |
| Servicios públicos  | `#0ea5e9` | Agua, luz, teléfono        |
| Nómina              | `#f59e0b` | Sueldos y salarios         |
| Insumos             | `#10b981` | Materia prima, empaques    |
| Marketing           | `#ec4899` | Publicidad, redes sociales |
| Otros               | `#94a3b8` | Comodín — siempre activo   |

`is_system = true` para estas 6 → el usuario puede editar el nombre/color pero no desactivar "Otros".

---

## Migración de datos

Pasos al ejecutar en producción:

1. Crear tabla `expense_categories`
2. Seed de categorías de sistema por negocio activo
3. Para cada `expense` con `category` texto:
   - Buscar coincidencia exacta (case-insensitive) en `expense_categories`
   - Si existe → setear `category_id`
   - Si no existe → crear categoría nueva + setear `category_id`
4. Una vez migrado → `category_id NOT NULL` en `expenses`

**Riesgo:** El paso 3 puede crear categorías duplicadas si el texto libre es muy diverso. Solución: revisar manualmente los registros antes de aplicar NOT NULL.

---

## UI admin (solo borrador, no implementar aún)

```
[Configuración] → [Finanzas] → Categorías de gasto
  ┌──────────────────────────────────────────┐
  │ + Nueva categoría                        │
  │                                          │
  │ ● Alquiler        #6366f1   [•••] [✕]   │
  │ ● Servicios pub.  #0ea5e9   [•••] [✕]   │
  │ ● Nómina          #f59e0b   [•••] [✕]   │
  │ ● Insumos         #10b981   [•••] [✕]   │
  │ ● Marketing       #ec4899   [•••] [✕]   │
  │ ● Otros           #94a3b8   (sistema)   │
  └──────────────────────────────────────────┘
```

El campo `category` en el modal de gastos cambia de `<input text>` a `<select>` con las categorías activas.

---

## Criterios de éxito (para certificación futura)

- [ ] `GET /api/finanzas/categorias` devuelve ≥ 6 categorías para el negocio demo
- [ ] `POST` con nombre ya existente devuelve 409
- [ ] Gasto nuevo puede asignar category_id válido
- [ ] Reporte de gastos agrupa por `category.name` (no texto libre)
- [ ] Desactivar una categoría → no aparece en el select de nuevo gasto
- [ ] "Otros" no puede desactivarse (`is_system: true` protegido en API)

---

## Prioridad en backlog

| Sprint | Qué incluir                                              |
|--------|----------------------------------------------------------|
| 14     | Analytics (bloqueado) — DT-023 evaluar al final          |
| 15     | DT-023 implementación + migración de datos               |

---

*Documentado: 2026-06-19 | CLI-D Sprint 13 | Pendiente implementación*
