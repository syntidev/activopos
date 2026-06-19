# AGENTS.md — ActivoPOS
# Orquestación de agentes autónomos
# Versión: 2.0 | Junio 2026 | Carlos Bolívar — SYNTIdev

---

## PROYECTO

ActivoPOS — POS SaaS venezolano para PYMES.
Stack: Next.js 14 + TypeScript strict + CSS Modules + Prisma 7 + MariaDB
Local: `C:\laragon\www\activopos\`
VPS: root@187.124.241.213 | activopos.com | Puerto 3001

---

## LEER SIEMPRE PRIMERO (en este orden, sin saltarse ninguno)

1. `CLAUDE.md` — gobernanza, stack sellado, Principios Karpathy, reglas irrompibles
2. `.doc/SYSTEM_MAP.md` — estado actual del sistema generado desde código real
3. `.doc/ACTIVOPOS_MASTER.md` — árbitro único de verdad, roadmap, decisiones
4. `.doc/AGENTS.md` — este archivo, protocolo multi-agente

**Si no has leído los 4 archivos → cualquier acción que tomes es potencialmente destructiva.**

---

## ROLES DE AGENTES

| Agente | Rol              | Qué hace                                                    | Qué NO puede hacer                            |
|--------|------------------|-------------------------------------------------------------|-----------------------------------------------|
| CLI-A  | Backend          | API routes, Prisma, lógica de negocio, migraciones DB       | Tocar CSS, componentes UI, archivos de estilos|
| CLI-B  | Frontend         | Componentes, CSS Modules, design system, animaciones        | Tocar API routes, lógica de negocio, Prisma   |
| CLI-C  | Calidad          | Auditoría de seguridad, code review — SOLO reporta          | Corregir P1/P2/P3, proponer refactors         |
| CLI-D  | Features/Testing | Módulos nuevos, tests Playwright, certificación E2E         | Actuar sin que CLI-A/B hayan completado su scope|

**CLI-C corrige P0 únicamente (data leak entre tenants, bypass de auth). Todo lo demás lo documenta.**

---

## FLUJO DE TRABAJO — 5 PASOS, NINGUNO SALTABLE

```
1. Carlos / Claude Web describe la tarea con criterios de éxito verificables
         ↓
2. El agente declara sus supuestos, lee los archivos de doc relevantes
         ↓
3. El agente declara el plan en pasos con verificación por paso
         ↓
4. Carlos aprueba el plan (o ajusta) → el agente ejecuta
         ↓
5. El agente verifica cada criterio de éxito y reporta resultado real
         ↓
6. Carlos aprueba → el agente commitea con bloque estándar
```

**Saltarse el paso 2 o el paso 5 está prohibido.**
**Si el agente empieza a codificar sin declarar su plan → debe detenerse y declararlo.**

---

## SKILLS OBLIGATORIOS POR CLI

Sin estas skills declaradas al inicio del prompt → el prompt es inválido y no se ejecuta.

```
CLI-A: /code-review + /security-guidance + /software-architecture
CLI-B: /impeccable craft + /frontend-design + /ui-ux-pro-max
CLI-C: /code-review + /security-guidance
CLI-D: /playwright + /impeccable craft + /frontend-design
```

---

## PROTOCOLO KARPATHY POR AGENTE

### Antes de escribir código (todos los agentes)

El agente debe declarar explícitamente:

```
## Supuestos que estoy haciendo
- [Supuesto 1]: [base de por qué lo asumo]
- [Supuesto 2]: [base de por qué lo asumo]

## Archivos que voy a tocar
- [archivo] → [qué voy a cambiar y por qué]

## Plan de ejecución
1. [Paso] → verifico con: [check concreto y ejecutable]
2. [Paso] → verifico con: [check concreto y ejecutable]
3. [Paso] → verifico con: [check concreto y ejecutable]

## Criterios de éxito
- [Criterio 1]: [cómo se verifica sin abrir el código]
- [Criterio 2]: [cómo se verifica sin abrir el código]
```

**Si Carlos da un criterio débil ("que funcione") → el agente pide uno verificable antes de empezar.**

### Después de ejecutar (todos los agentes)

El agente debe reportar:

```
## Verificación de criterios
- [Criterio 1]: ✅ / ❌ [resultado real, no inferido]
- [Criterio 2]: ✅ / ❌ [resultado real, no inferido]

## Build status
npx tsc --noEmit → [0 errores / N errores]
npm run build → [Compiled successfully / error]

## Anomalías fuera de scope detectadas
- [1 línea por anomalía — reportar, NO corregir]
```

---

## CERTIFICACIÓN DE MÓDULOS — REGLA DEL POLICÍA

**Ningún agente avanza al siguiente módulo sin certificar el anterior.**
Criterios débiles ("que funcione") = módulo NO certificado.

### Orden de certificación (irrompible)
```
Productos → POS → Caja → Reportes → Finanzas → Catálogo → Analytics
```

### Criterios de certificación por módulo (todos requeridos)

1. **Datos reales inyectados** — no seed de prueba, datos que representen uso real
2. **Flujo E2E completo ejecutado** — no partes aisladas
3. **DB verificada** — query SQL que confirma que los registros son correctos
4. **Playwright pasa** — CLI-D corre los tests del módulo, todos en verde
5. **CLI-C audita** — sin P0 sin resolver
6. **Carlos aprueba visualmente** — ve la pantalla y da el OK

**Ejemplo de verificación DB para POS:**
```sql
-- Verificar que la venta se registró correctamente
SELECT s.id, s.status, s.sold_at, s.total_usd,
       p.stock AS stock_actual
FROM sales s
JOIN sale_items si ON si.sale_id = s.id
JOIN products p ON p.id = si.product_id
WHERE s.id = [id_venta_de_prueba];
-- Esperado: status='paid', sold_at NOT NULL, stock = stock_inicial - qty
```

---

## DIAGNÓSTICO DE PROBLEMAS — PROTOCOLO ESTÁNDAR

Cuando se reporta un problema, el agente ejecuta en este orden:

### Paso 1 — Reproducir el error con datos reales
```bash
# No inferir — reproducir
curl -X POST http://localhost:3000/api/[endpoint] \
  -H "Content-Type: application/json" \
  -d '[payload real que genera el error]'
# Reportar el error exacto, no la interpretación
```

### Paso 2 — Aislar el scope del problema
```bash
# ¿Es de API? ¿De DB? ¿De UI?
npx prisma studio  # Verificar estado de DB directamente
# Mostrar la query que falla y el resultado real
```

### Paso 3 — Verificar invariantes del sistema
```sql
-- ¿sale.status='paid' con sold_at=null? (DT-002)
SELECT COUNT(*) FROM sales WHERE status='paid' AND sold_at IS NULL;

-- ¿dollar_rates sin business_id? (DT-001)
SELECT COUNT(*) FROM dollar_rates WHERE business_id IS NULL;

-- ¿SaleAbono sin cash_register_id? (DT-003)
SELECT COUNT(*) FROM sale_abonos WHERE cash_register_id IS NULL;
```

**Solo después de los 3 pasos el agente puede reportar un diagnóstico con certeza.**

---

## SEÑALES DE ALERTA — PARAR Y REPORTAR A CARLOS

Si cualquier agente detecta alguna de estas condiciones → PARAR inmediatamente y reportar:

- **Fachada detectada:** botón sin onClick, endpoint con mock data, UI con valores hardcodeados
- **business_id del body:** cualquier `req.body.business_id` o `searchParams.get('business_id')`
- **N+1 query:** cualquier query dentro de un loop o `.map()` sobre un resultado de Prisma
- **Cualquier `any` en TypeScript:** aunque sea en un archivo de terceros modificado
- **Migración que modifica columna existente** en lugar de agregar nueva
- **sold_at null en venta pagada:** `SELECT COUNT(*) FROM sales WHERE status='paid' AND sold_at IS NULL` > 0
- **CLI-B invadiendo scope de CLI-A** o viceversa
- **Agente proponiendo ejecutar sin declarar plan** primero

---

## PROTOCOLO DE SCOPE

Cada prompt de agente debe comenzar con:
```
# CLI-X — [SCOPE]
# Sprint: N | Fecha: YYYY-MM-DD
# Skills: /skill1 + /skill2 + /skill3
# Archivos a tocar: [lista]
# Archivos prohibidos: [lista]
```

Si el agente necesita algo fuera de su scope → reportarlo al final, NO improvisar.

---

## BLOQUE DE COMMIT ESTÁNDAR (obligatorio, sin excepciones)

```bash
git add .
git commit -m "tipo(scope): descripción concisa

- Modificado: [archivo] → [qué cambió exactamente]
- Creado: [archivo] → [propósito]
- Verificado: [qué check confirma que funciona — resultado real]
- Pendiente: [si hay algo relacionado sin resolver]

🤖 Agente: CLI-X | Sprint: N | Fecha: YYYY-MM-DD"
git push origin main
git log --oneline -3
```

**NUNCA `git add .` si hay archivos fuera del scope del agente en el working tree.**
**NUNCA hacer commit de código que no compiló.**
**NUNCA hacer commit en VPS — solo en local, luego pull en VPS.**

---

## PROTOCOLO DE DEPLOY VPS

```bash
cd /var/www/activopos
git pull origin main
npx prisma generate
npx prisma migrate deploy
rm -rf .next
npm run build
pm2 restart activopos
pm2 save
curl -s http://localhost:3003/api/rates/bcv
# Verificar: la respuesta incluye rate > 0
```

**NUNCA `git stash` en VPS — riesgo de perder trabajo del CLI.**
**Deploy solo después de que el build local compiló limpio.**

---

## ESTADO DE DEUDA TÉCNICA

| ID     | Severidad | Descripción                                      | Agente | Sprint |
|--------|-----------|--------------------------------------------------|--------|--------|
| DT-001 | P1        | `dollarRate.create` sin `business_id`            | CLI-A  | 10     |
| DT-002 | P1        | `sold_at` nullable — ventas paid sin fecha       | CLI-A  | 10     |
| DT-003 | P2        | `SaleAbono` sin `cash_register_id`               | CLI-A  | 10     |
| DT-004 | P2        | Service Worker ausente — PWA no instalable       | CLI-D  | 10     |
| DT-005 | P2        | `CashMovement` sin `business_id` como filtro     | CLI-A  | 10     |
| DT-006 | P3        | Emojis ⭐ en `CatalogoGrid.tsx`                  | CLI-B  | 10     |
| DT-007 | P3        | Tokens CSS hardcodeados (`rgba` raw, hex direct) | CLI-B  | 10     |

**Regla:** P1 se resuelve antes de certificar cualquier módulo. P2 antes del primer cliente.
