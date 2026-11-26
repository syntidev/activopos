# Guía de activación del módulo Restaurante

Rama `feat/restaurante` · Fase R5 · 26 Nov 2026

El módulo se enciende por **negocio**. Tres cosas se combinan y NO se mezclan:

| Concepto | Dónde vive | Quién lo escribe |
|---|---|---|
| **Derecho** (el plan lo incluye) | `businesses.catalog_plan` = `operacion` (y suscripción vigente) | solo `super_admin` |
| **Preferencia** (el negocio lo quiere) | `businesses.restaurante_enabled` | el admin del negocio |
| **Estado de cuenta** | `subscription_active` / `subscription_expires_at` | `super_admin` / facturación |

Acceso efectivo = derecho **Y** preferencia **Y** suscripción vigente. Sin flag, el módulo no existe (404). Con flag pero sin derecho
(plan bajado, vencida o suspendida): la API responde `403 PLAN_LIMIT` y las pantallas dan 404.

## Camino 1 — por la aplicación (el normal)

1. **El `super_admin` da el derecho.** Panel admin → negocio → plan **Operación** (suscripción activa).
   API equivalente: `PATCH /api/admin/tenants/<id>/plan` con `{ "plan": "operacion", "status": "active" }`.
   Un negocio en `gratis` o `negocio_activo` recibe `403 PLAN_LIMIT` al intentar activar.
2. **El admin del negocio lo enciende.** Configuración → Módulos → tarjeta **Restaurante** → Activar. La casilla "Activar también Cocina (KDS)"
   suma `kds` a `modules_enabled`. API equivalente: `POST /api/restaurante/activacion` con `{ "enabled": true, "enable_kds": true }`.
3. **Aparece** el grupo RESTAURANTE del menú (Plano, Reportes, Configurar, Cocina) y la pestaña Configuración → Restaurante.

Apagarlo no borra nada (áreas, mesas, cuentas e historial se conservan). Se bloquea con `409 OPEN_ACCOUNTS` mientras haya cuentas de mesa abiertas.

## Camino 2 — por SQL (alternativa, con autorización de Carlos)

Úsalo solo si el panel no está disponible. Siempre en una transacción y con el id del negocio verificado primero.

```sql
-- 1) Verificar el negocio
SELECT id, name, catalog_plan, subscription_active, subscription_expires_at, restaurante_enabled, modules_enabled
FROM businesses WHERE id = <ID>;

-- 2) Derecho + preferencia + cocina
START TRANSACTION;
UPDATE businesses
SET catalog_plan = 'operacion',
    subscription_active = 1,
    restaurante_enabled = 1,
    modules_enabled = IF(FIND_IN_SET('kds', modules_enabled), modules_enabled, CONCAT(modules_enabled, ',kds'))
WHERE id = <ID>;
SELECT id, catalog_plan, restaurante_enabled, modules_enabled FROM businesses WHERE id = <ID>;  -- revisar
COMMIT;   -- o ROLLBACK
```

Apagar por SQL: `UPDATE businesses SET restaurante_enabled = 0 WHERE id = <ID>;` (solo si no hay cuentas abiertas:
`SELECT COUNT(*) FROM orders WHERE business_id = <ID> AND origin = 'table' AND account_status IN ('open','bill_requested');`).

## Puesta en marcha del negocio (primer día)

1. **Usuarios**: Configuración → Usuarios → roles **Mesonero** y **Cocinero** (solo admin, solo con el módulo activo). Tope de usuarios del plan: 10.
2. **Salón**: Configuración → Restaurante → Salón: áreas, mesas (en lote) y plano.
3. **Estaciones y ruteo**: Cocina, Barra… La primera queda por defecto. Cada categoría o producto se rutea a una estación; una categoría con
   "Requiere preparación" y sin estación cae a la estación por defecto. Asigna los cocineros a su estación.
4. **Modificadores**: "Sin cebolla", "Extra queso +$1.00" (por negocio, categoría o producto).
5. **Caja**: el cobro exige caja abierta (salvo `caja_mode = nocash`). Métodos de pago como en el POS.
6. **Probar**: abrir una mesa → enviar → cocina → servir → pedir cuenta → cobrar → liberar.

## Quién puede qué

| Rol | Plano y cuentas | Cobrar / propinas | KDS | Reportes | Configuración |
|---|---|---|---|---|---|
| admin | todo | sí (y reabrir cuentas) | todas las estaciones | sí | sí |
| cashier | sí | sí | no | no | no |
| waiter | abre, agrega, envía, sirve, pide cuenta, junta, transfiere mesa | **no** | no | no | no |
| kitchen | no | no | solo sus estaciones | no | no |
