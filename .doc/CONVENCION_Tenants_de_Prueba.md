# CONVENCIÓN — Tenants de prueba por CLI y servidor de cada spec
# Generado: 26 Noviembre 2026 | CLI-A | Regla: cada CLI escribe SOLO en su tenant y apunta explícitamente a SU servidor.

## Quién usa qué

| CLI | Tenant / base | Nombre y prefijo | Dónde se resuelve |
|---|---|---|---|
| CLI-A | **216** | "ZZ A Pruebas", prefijo `ZZA`, slug `zza-pruebas` | `ownBusiness()` en `tests/helpers/own-business.ts` (por slug, no por id fijo) |
| CLI-B | **217** | "ZZ B Pruebas", prefijo `ZZB`, slug `zzb-pruebas` | `ensureOwnBusiness()` en `tests/helpers/own-business.ts` |
| CLI-D | **267** | "ZZ D Pruebas", prefijo `ZZD`, slug `zzd-pruebas` (admin 212, cajero 213) | `tests/d-tenant.ts` (`BUSINESS_ID = 267`, con `assertOwnTenant()`) |
| CLI-KDS | **`activopos_kds`** | (nombre indicado por Carlos; confirmar si es una base de datos aparte o un tenant) | — |

**Ningún spec corre contra el negocio 87 (OnBike Margarita):** son datos del cliente real. Desde `fix/tests-heredados` los specs P0 y `pos-core`
usan el 267.

## Reglas

1. **Cada CLI escribe solo en su tenant.** Nunca modificar datos de otro prefijo. De otro negocio solo se LEE (p. ej. un id de cliente ajeno).
2. **`E2E_BASE_URL` siempre explícita.** Varias carpetas corren su propio `next dev` (hoy `:3001` es el de la carpeta A y `:3000` suele ser de otra),
   todas contra la **misma base de datos**. Un puerto por defecto puede apuntar al servidor de otra carpeta, con otro código y otras reglas.
   Ejemplo: `E2E_BASE_URL=http://localhost:3001 npx playwright test tests/planes-v2.spec.ts`.
   `tests/planes-v2.spec.ts` ya **falla al cargar con un mensaje claro** si no está definida (porque modifica plan, add-ons y suscripción de un tenant).
3. **El tenant lo decide el helper, no la carpeta desde donde se lanza la spec.** `ownBusiness()` resuelve el 216 por slug aunque la spec se ejecute
   desde `activopos-b`. Correr desde tu carpeta una spec "de otra letra" escribe igual en el tenant de ESA letra.
4. **No correr dos veces a la vez una spec que muta un tenant.** Las specs de planes cambian `catalog_plan`, `addons` y `subscription_*` del tenant
   y las demás specs dependen de ese estado (Finanzas, crédito, KDS). El 26-nov dos ventanas ejecutaron `planes-v2.spec.ts` sobre el mismo tenant
   y se pisaron (estados cruzados en la matriz); antes de lanzar una spec que muta el plan, comprobar que nadie más la está corriendo:
   `Get-CimInstance Win32_Process | ? { $_.CommandLine -match 'test\s+tests[\\/]planes' }`.
5. **Cada spec restaura el estado BASE de su tenant, no "lo que encontró".** Una corrida fallida puede dejar el tenant en un estado raro (el 216
   quedó en `gratis` y suspendido); restaurar eso envenena a las specs siguientes. Estado base del 216: `negocio_activo`, suscripción activa, sin
   vencimiento, sin add-ons.
6. **Prefijos en los datos de prueba** (`ZZA `, `ZZB `, `ZZD `…) y limpieza por prefijo al final de cada spec.

## Servidores de desarrollo

| Carpeta | Puerto habitual | Nota |
|---|---|---|
| `activopos` (CLI-A) | 3001 | `NODE_OPTIONS=--dns-result-order=ipv4first npx next dev -p 3001`; se cierra al terminar las pruebas |
| `activopos-b` (CLI-B) | (el suyo) | no asumir el puerto: preguntar o leer su `E2E_BASE_URL` |
| `tests/d-tenant.ts` (CLI-D) | 3000 por defecto | su `BASE` cae a `http://localhost:3000` si no se define `E2E_BASE_URL` |
