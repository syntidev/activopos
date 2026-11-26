# Checklist de deploy — módulo Restaurante en el VPS

Rama `feat/restaurante` · Fase R5 · 26 Nov 2026 · **No ejecutado.** Todo deploy requiere autorización explícita de Carlos.

## Reglas

- **`db push` NO.** Deja drift sin migración y bloquea las siguientes (lección de CLAUDE.md). Solo `migrate deploy`.
- **Nunca `git stash` en el VPS.**
- **`pm2 stop` solo no basta:** el healthcheck (cron */5) reinicia la app si la web no da 200. Se crea el lock **antes** de `pm2 stop` y se borra
  **después** de `pm2 restart`, siempre (también si el build falló).
- Orden de ramas: `feat/planes-v2` ya está en `main`; `feat/restaurante` entra a `main` solo con aprobación visual de R5 y de Carlos.

## 0. Antes de tocar el VPS (en local / revisión)

- [ ] `npx tsc --noEmit` → 0 · `npm run build` → 0 · specs de restaurante verdes · `npm run test:consistency` en un tenant propio (nunca el 87)
- [ ] `git log origin/main..feat/restaurante` revisado; rama al día con `origin/main` (merge sin force)
- [ ] **Hueco conocido en `main`:** `Sale.cargo_pct` está en el schema pero **no tiene migración**. En el VPS la columna existe por `db push` histórico;
      verifícalo antes: `SHOW COLUMNS FROM sales LIKE 'cargo_pct';` Si falta, `/pay` y `/cargo` fallan: resolverlo con una migración de `main` ANTES.
- [ ] Respaldo de la base: `mysqldump` de `activopos` (fecha en el nombre) y comprobar que el archivo no está vacío

## 1. Migraciones (orden estricto)

Las migraciones nuevas del módulo, todas aditivas:

| Migración | Qué hace |
|---|---|
| `20261124000001_restaurante_base` | `businesses.restaurante_enabled`, roles `waiter`/`kitchen`, `orders.origin = 'table'`, áreas, mesas, mobiliario |
| `20261125000001_restaurante_cuenta` | cuenta de mesa en `orders`/`order_items`, estaciones, `user_stations`, modificadores, `table_events` |
| `20261126000001_restaurante_cobro` | `sales.table_order_id`, `sale_items.order_item_id`, `sale_tips`, `order_tables` |

(Más `20261124000002_client_credit` y `20261125000001_business_addons`, que vienen de `main`.)

```bash
cd /var/www/activopos
git fetch origin && git merge origin/main --no-ff      # (o el procedimiento acordado); NUNCA git stash
npm ci
npx prisma generate

# UNA SOLA VEZ, solo si `migrate status` aún las muestra pendientes: esos objetos YA existen en el VPS por `db push` histórico.
# Ejecutarlas falla con P3018 "Duplicate column" y bloquea todo lo que sigue. Se marcan aplicadas SIN ejecutarlas:
npx prisma migrate resolve --applied 20260920000001_baseline_brands_catalog_template
npx prisma migrate resolve --applied 20260920000002_add_reservas
npx prisma migrate status        # debe listar SOLO las migraciones nuevas como pendientes (nada de "failed")

npx prisma migrate deploy        # aplica las pendientes en orden
npx prisma migrate status        # "Database schema is up to date!"
```

Si `migrate status` marca otra migración antigua como pendiente cuya estructura ya existe: comprobar con `npx prisma migrate diff` que no hay
diferencias y marcarla con `migrate resolve --applied <nombre>`. **Nunca** `migrate reset` ni `db push`.

## 2. Build y reinicio con el lock del healthcheck

```bash
touch /var/lock/activopos-deploy.lock     # pausa el healthcheck
pm2 stop activopos
rm -rf .next
npm run build
pm2 restart activopos --update-env
pm2 save
rm -f /var/lock/activopos-deploy.lock     # SIEMPRE, también si el build falló
curl -s http://localhost:3003/api/rates/bcv   # BCV responde
```

## 3. Verificación (sin tocar datos de clientes)

- [ ] `pm2 status`: `activopos` online, sin reinicios nuevos
- [ ] Un negocio SIN el módulo: POS, Pedidos, KDS de siempre y Caja funcionan igual
- [ ] Un negocio de prueba en plan `operacion` con el módulo activado (ver `GUIA_Activacion.md`): plano → abrir mesa → enviar → KDS → pedir cuenta → cobrar → cerrar
- [ ] Caja: el efectivo esperado suma la propina en efectivo y no la de tarjeta
- [ ] Tenants que usan el KDS hoy (4, 8, 33, 55) con su add-on concedido (ver `RUNBOOK_grant_addon_kds_produccion.md`)

## 4. Rollback

- Código: volver al commit anterior (`git checkout <sha>` en una rama de rescate, nunca `git stash`), `npm ci`, `prisma generate`, repetir el paso 2.
- Datos: las migraciones del módulo son **aditivas**; el código viejo ignora las columnas y tablas nuevas, así que no hace falta revertir el schema.
  Para apagar el módulo en un negocio: `UPDATE businesses SET restaurante_enabled = 0 WHERE id = <ID>;`
- Solo restaurar el `mysqldump` si algo corrompió datos, y con autorización de Carlos.
