# RUNBOOK — Conceder el add-on KDS a los tenants de producción (Planes v2)
# Generado: 25 Noviembre 2026 | CLI-A | Estado: LISTO, NO EJECUTADO. Nada de esto se corrió contra el VPS.
# Script: `scripts/grant-addon.ts` (rama `feat/planes-v2`). No contiene ids fijos: los recibe por argumento.

## Por qué hace falta

En Planes v2 el KDS deja de ser libre: pasa a ser un derecho (plan Operación **o** add-on `kds` sobre un plan pago).
Los tenants que hoy lo usan se quedan sin acceso (`403 PLAN_LIMIT` y `/kds` → 404) en cuanto se despliega el código nuevo,
salvo que antes tengan el add-on. Ids de producción acordados: **4, 8, 33, 55**.

El script concede el add-on a esa lista **explícita**, es **dry-run por defecto**, **idempotente**, y deja un `ActivityLog`
`addon_updated` por negocio. Sin ids no hace nada (sale con error). Ninguna migración ni el build lo invocan.

## Orden dentro del deploy (receta de CLAUDE.md)

El script necesita que la columna `businesses.addons` exista y que el cliente Prisma esté generado. Va **entre `migrate deploy` y el restart**:

```
cd /var/www/activopos
git pull origin main                     # (cuando feat/planes-v2 esté en main, tras aprobación de Carlos)
npx prisma generate
npx prisma migrate deploy                # aplica 20261125000001_business_addons (columna addons, aditiva)
# ── AQUÍ: dry-run, revisar, y recién entonces la ejecución real (abajo) ──
touch /var/lock/activopos-deploy.lock
pm2 stop activopos
rm -rf .next
npm run build
pm2 restart activopos --update-env
pm2 save
rm -f /var/lock/activopos-deploy.lock
```

Mientras corre el código viejo, la columna `addons` es inocua (nadie la lee): conceder antes del restart no cambia nada para los clientes.

## Requisitos previos (verificar, no asumir)

1. **Los 4 negocios están en un plan de pago** (`negocio_activo` u `operacion`). Sobre `gratis` el add-on **no concede derecho**: el script los
   omite (`skipped_free`). Si alguno es `gratis`, primero se decide su plan desde el panel admin.
2. **Node simple, sin `ts-node`**: el script es `scripts/grant-addon.cjs` (CommonJS). Solo usa `@prisma/client` y `@prisma/adapter-mariadb`
   (dependencias de producción, ya instaladas) y lee los `.env` a mano (`.env.production` primero, luego `.env`, igual que Next en producción);
   no necesita `dotenv`, `ts-node` ni `tsconfig-paths`. Requiere el cliente Prisma generado (`npx prisma generate`, ya en la receta de arriba).
   Comprobación previa: `node -v` (cualquier Node ≥ 16 sirve) y `node -e "require('@prisma/client'); require('@prisma/adapter-mariadb'); console.log('ok')"`
   desde `/var/www/activopos`.
3. **Id de un super_admin de producción** para `--by` (queda en el `ActivityLog`). Se obtiene con:
   ```sql
   SELECT id, email FROM users WHERE role = 'super_admin';
   ```

## 1) Antes: ver quién tiene KDS en uso hoy (solo lectura)

```sql
SELECT b.id, b.name, b.catalog_plan, b.addons, COUNT(o.id) AS pedidos_kds
FROM businesses b
LEFT JOIN orders o ON o.business_id = b.id AND o.send_to_kds = 1
GROUP BY b.id
HAVING pedidos_kds > 0
ORDER BY pedidos_kds DESC;
```

Debe coincidir con 4, 8, 33, 55. Si aparece otro negocio con pedidos de cocina que no está en la lista, **parar y avisar a Carlos** antes de seguir.

Además, el KDS exige **derecho Y preferencia**: `kds` debe estar en `modules_enabled` del tenant (el valor por defecto de la columna NO lo incluye).
Si un tenant usa el KDS sin tenerlo en su lista, el add-on no le basta: tras el deploy recibiría `403 MODULE_DISABLED` hasta encenderlo en
Configuración > Módulos. Verificar antes:

```sql
SELECT id, name, catalog_plan, addons, FIND_IN_SET('kds', modules_enabled) > 0 AS kds_encendido
FROM businesses WHERE id IN (4,8,33,55);
```

Si alguno sale `kds_encendido = 0` y sí usa la cocina, avisar a Carlos: la preferencia la escribe el tenant, no este script.

## 2) DRY-RUN (no escribe nada)

```
cd /var/www/activopos
node scripts/grant-addon.cjs --addon kds --ids 4,8,33,55
```

(`npm run grant:addon -- --addon kds --ids 4,8,33,55` hace exactamente lo mismo.)

La primera línea de la salida dice **a qué base de datos se conecta** (`Base de datos: <host> / <nombre>`): verificar que es la de producción antes de seguir.
Por cada id imprime:

```
  #4  <nombre del negocio>
      plan: negocio_activo | subscription_active: sí | subscription_expires_at: 2026-12-31
      kds en modules_enabled: sí | add-ons actuales: []
      ⚠ <advertencias, si las hay>
      → would_grant  [] → [kds]
```

Advertencias posibles (cada una puede dejar al cliente sin KDS aunque tenga el add-on; **resolverlas antes del deploy**):

| Advertencia | Qué hacer |
|---|---|
| `plan gratis: el add-on NO concede derecho sobre gratis` | El script lo omite. Decidir su plan desde el panel admin |
| `suscripción suspendida` | Sin derecho hasta reactivarla |
| `suscripción vencida el AAAA-MM-DD` | Sin derecho hasta renovar |
| `kds apagado en modules_enabled` | El tenant debe encenderlo en Configuración > Módulos; el add-on no basta |

Resultado final por negocio (`→`):

| Resultado | Significa |
|---|---|
| `would_grant` | Lo concedería (plan de pago, aún sin el add-on) |
| `already` | Ya lo tiene: no cambia nada |
| `skipped_free` | Plan gratis: el add-on no concede derecho; resolver su plan primero |
| `not_found` | El id no existe en esta base: **parar y revisar los ids** |

Se sigue solo si los 4 salen `would_grant` (o `already`) y las advertencias están resueltas o aceptadas por Carlos.

## 3) EJECUCIÓN REAL

Reemplazar `<ID_SUPER_ADMIN>` por el id del paso de requisitos.

```
cd /var/www/activopos
node scripts/grant-addon.cjs --addon kds --ids 4,8,33,55 --apply --by <ID_SUPER_ADMIN>
```

Es seguro repetirlo: lo ya concedido sale `already` y no escribe ni registra de nuevo.

## 4) Verificación posterior (solo lectura)

```sql
SELECT id, name, addons FROM businesses WHERE id IN (4,8,33,55);
```

Esperado: `addons = 'kds'` en los 4 (la columna es un CSV; hoy `kds` es el único add-on).

Registro de la concesión (un `addon_updated` por negocio):

```sql
SELECT business_id, user_id, action, created_at, new_values
FROM activity_logs
WHERE action = 'addon_updated' AND business_id IN (4,8,33,55)
ORDER BY id DESC;
```

Comprobar además que **ningún otro negocio** recibió el add-on:

```sql
SELECT id, name, addons FROM businesses WHERE addons <> '' AND id NOT IN (4,8,33,55);
```

(debe devolver solo lo que ya tuviera un add-on antes de este deploy; sin filas si es la primera concesión).

## 5) Después del restart

- `/kds` abre y `GET /api/kds/orders` responde 200 para los 4 negocios (con `kds` en su preferencia de módulos).
- Un tenant sin plan Operación ni add-on recibe 403 `PLAN_LIMIT` en `/api/kds/orders` (comportamiento esperado de Planes v2).

## Revertir una concesión

El script solo concede. Para quitar un add-on se usa el panel admin (`PATCH /api/admin/tenants/[id]/plan` con `addons: []`, conjunto
absoluto), que también deja `ActivityLog`. Quitarlo no borra datos ni edita `modules_enabled`.
