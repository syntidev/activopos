# HANDOFF — Sprint 21 → Sprint 22
# ActivoPOS | 2026-06-21
# Sesión: Plan maestro + bugs encontrados en producción + decisiones de producto

---

## ANTES DE HACER CUALQUIER COSA

Lee en este orden:
1. CLAUDE.md (raíz)
2. .doc/SYSTEM_MAP.md — v21
3. .doc/ACTIVOPOS_MASTER_V2.md — sección §15 plan maestro
4. .doc/AGENTS.md

## INICIO DE SESIÓN

```powershell
.\r.ps1
curl http://localhost:3000/api/rates/bcv
# Esperado: {"rate":607.xx,"source":"bcv","ok":true}
npx playwright test --reporter=list
# Esperado: 80/80
```

---

## QUÉ SE COMPLETÓ EN SPRINT 21

- SEC-04: rate limiter PIN migrado de Map en memoria a tabla DB PinRateLimit
- Import masivo Excel: POST /api/products/import-excel + GET template
- Variantes: CRUD completo + stock independiente por variante
- Modal PIN descuentos: PinDescuentoModal con 4 cajas, shake en error, 429 handling
- UI-04 fix: botón Descuento en TicketPanel conectado a PinDescuentoModal
- VA-FIND fix: error 500 → 400 en variante no encontrada
- Overlay management completo: z-index tokens, scroll lock, sidebar dismiss on select
- Tokens v4.0: ADN visual ActivoPOS — diagnóstico ChatGPT implementado
- Daniel eliminado de toda la documentación
- Plan maestro Sprint 22-26 generado
- Tests: 80/80 pasando

---

## BUGS ENCONTRADOS EN PRODUCCIÓN — PRIORIDAD SPRINT 22

### BUG-01 — P0: Pago mixto no calcula vuelto
**Síntoma:** Al exceder el total en pago mixto (ej: total Bs 22.047 pero cajero
ingresa Bs 32.047), el sistema muestra "Cubierto" sin alertar el sobrante.
**Archivos probables:** src/app/(dashboard)/pos/CobroModal.tsx
**Fix requerido:**
- Calcular vuelto cuando monto ingresado > total
- Mostrar vuelto en tiempo real: "Vuelto: Bs. X,XX"
- NO bloquear — permitir cobro con vuelto
- Guardar monto_recibido y vuelto en Sale

### BUG-02 — P1: Pedidos móvil pantalla blanca
**Síntoma:** Primera carga de /pedidos en móvil → pantalla en blanco.
Al refrescar → kanban visible pero tapado por capa blanca.
**Causa probable:** Error JS en cold start + overlay/backdrop no desmontado
**Fix requerido:**
- Inspeccionar console.error en primera carga móvil
- Verificar z-index del overlay de NuevoPedidoModal en móvil
- Aplicar useScrollLock y verificar desmontaje correcto

### BUG-03 — P1: CxC usa heurístico 30 días sin due_date
**Archivo:** src/app/api/finanzas/resumen/route.ts:132
**Problema:** cxcVencidasCount cuenta ventas pendientes con created_at < now-30d
El modelo Sale no tiene campo due_date. Ventas con crédito 60 días se marcan
como vencidas incorrectamente.
**Fix requerido:** Agregar due_date a schema Sale (ver Bloque A infraestructura)

### BUG-04 — P2: parsePeriod() triplicado
**Archivos:** gastos/route.ts:28, resumen/route.ts:17, punto-equilibrio/route.ts:15
**Fix:** Extraer a src/lib/finanzas.ts

### BUG-05 — P2: raw SQL tasa BCV en finanzas
**Archivos:** gastos/route.ts:75, resumen/route.ts:177
**Problema:** Usan SELECT rate FROM dollar_rates con fallback '36.50' hardcodeado
**Fix:** Reemplazar con readCachedBcvRate() de src/lib/bcv.ts

---

## FEATURES SPRINT 22 — BLOQUE A: INFRAESTRUCTURA BASE

Estas deben ir ANTES que cualquier feature nueva.
Sin esto, CxC, notificaciones y crédito son fachadas.

### A1 — Schema: due_date + crédito reforzado
```prisma
model Sale {
  # Agregar:
  due_date       DateTime?  # fecha compromiso de pago
  credit_days    Int?       # días pactados: 7, 14, 21, 30 o custom
  credit_notes   String?    # notas del acuerdo
}
model Customer {
  # phone ya existe — hacerlo obligatorio en flujo crédito (validación UI)
}
```
Migración: add_sale_due_date

### A2 — Tabla Notification (bus central)
```prisma
model Notification {
  id           Int      @id @default(autoincrement())
  business_id  Int
  type         String   # credit_overdue | stock_low | order_new | cash_unclosed
  title        String
  body         String
  entity_type  String?  # sale | product | order
  entity_id    Int?
  channel      String   # in_app | push | whatsapp
  status       String   @default("pending") # pending | sent | read
  created_at   DateTime @default(now())
  read_at      DateTime?

  @@index([business_id, status])
  @@index([created_at])
}
```
Migración: add_notifications

### A3 — Tasa de cambio editable por transacción en POS
**Problema:** Binance/paralelo/Zinli no funcionan con tasa BCV fija
**Solución:** Campo de tasa editable inline en CobroModal por método USD
**API:** dolarapi.com ya integrado — agregar endpoint paralelo y USDT:
- ve.dolarapi.com/v1/dolares/paralelo
- ve.dolarapi.com/v1/dolares/cripto
**UI:** botón ✏️ junto a la tasa en cada método USD — editable inline sin salir del flujo
**DB:** Guardar tasa_aplicada + tasa_fuente en cada SalePayment

---

## FEATURES SPRINT 22 — BLOQUE B: MÓDULOS INCOMPLETOS

### B1 — CxC/CxP completo
**CxC:**
- Vista con filtro: Vigente / Por vencer (≤7 días) / Vencido
- Badge en sidebar con conteo de vencidos
- Alerta en Escritorio: card naranja si hay créditos vencidos
- Acción: registrar abono parcial (ya existe SaleAbono — conectar)

**CxP (nuevo):**
- Tabla Expense ya existe — agregar proveedor + due_date + estado
- Vista proveedores con saldos pendientes
- Filtro vigente/vencido

### B2 — Modal crédito reforzado
**Flujo actual:** venta a crédito no pide nada → bug
**Flujo correcto:**
1. Cajero selecciona "Venta a Crédito"
2. Si no hay cliente → obligatorio seleccionar/crear cliente
3. Si cliente no tiene teléfono → campo teléfono obligatorio
4. Modal fecha compromiso:
   - Presets: [7 días] [14 días] [21 días] [30 días]
   - Campo libre: "__ días"
   - Fecha calculada: "Vence el DD/MM/YYYY"
   - Campo notas opcional
5. Confirmar → crear Sale con due_date + credit_days + credit_notes

### B3 — Reportería PDF profesional
**Estándar aprobado en sesión 2026-06-21:**
- Header teal completo con badge blanco "Reporte Mensual/Diario"
- Línea naranja separadora ELIMINADA — solo borde blanco suave
- KPIs en 3 columnas con deltas vs período anterior
- Tabla zebra con header teal y border-bottom visible
- Barras proporcionales top productos — teal y navy únicamente
- Footer con paginación "Página N de N"
- @media print: header teal → borde izquierdo 4px teal, fondos → blancos
- Aplica a: reporte diario, reporte mensual, reporte finanzas, estado CxC

### B4 — Multi-ticket paralelo en POS
**Problema:** Un cliente espera mientras se atiende otro → pérdida de venta
**Solución:**
- Tabs en el POS: [Ticket 1] [Ticket 2] [+ Nuevo]
- Cada ticket es una Sale con status='draft' en DB
- Persiste al navegar — no se borra
- Máximo 5 tickets paralelos

---

## FEATURES SPRINT 23 — NOTIFICACIONES

### C1 — Web Push para pedidos entrantes
- Service Worker ya existe (DT-004 Sprint 14)
- Extender para recibir push de nuevos pedidos del catálogo
- El dueño recibe alerta aunque el POS esté cerrado
- Usar Web Push API nativa — NO Firebase

### C2 — Job alertas CxC vencidas
- Cron job diario (n8n o node-cron)
- Leer Sales donde due_date < hoy y status='pending'
- Crear Notification con type='credit_overdue'
- Badge en sidebar se actualiza

### C3 — WhatsApp notificaciones (fase 1)
- Twilio o Meta API para mensajes salientes
- Trigger: crédito vencido → mensaje al teléfono del cliente
- Template: "Hola {nombre}, tu deuda de ${monto} con {negocio} venció el {fecha}"

---

## FEATURES SPRINT 24 — PWA OFFLINE + CANALES

### D1 — PWA offline real
- Service Worker intercepta /api/pos/sales → guarda en IndexedDB si offline
- Al reconectar → sync queue → envía ventas pendientes
- Indicador visual: banner "Sin conexión — X ventas en cola"

### D2 — Canales de venta / listas de precio
- Tabla PriceList: name, type (retail/wholesale/catalog), discount_pct
- Producto puede tener precio diferente por canal
- POS selector de canal al iniciar turno
- Catálogo usa precio del canal 'catalog'

---

## FEATURES SPRINT 25 — ADMIN MULTITENANT

### Aclaración importante:
**Capa 1 (ya existe):** business_id en todas las tablas — el sistema ya es multitenant.
Si mañana hay 10 clientes, el código actual los soporta sin cambios.

**Capa 2 (falta):** Panel admin.activopos.com donde Carlos gestiona todos los tenants.
- Ver todos los negocios registrados
- Plan activo / inactivo / trial
- Métricas agregadas (ventas totales, usuarios activos)
- Impersonar un tenant para soporte
- Territorio exclusivo: Filament v5 en repo separado

---

## FEATURES SPRINT 26 — POLISH + TEMAS CLIENTE

- Los 10 temas venezolanos implementados server-side por business
- Brasa Viva, Tierra Dorada, Aguamarina, Medianoche, etc.
- Tu Día narrativa inteligente (placeholder activo desde Sprint 14)
- Auditoría WCAG completa

---

## INTELIGENCIA COMPETITIVA — NOTAS SESIÓN

### Comprapp (comprapp.net)
- App en desarrollo con APK nativa y modo offline (Firebase)
- NO es competidor directo — es marketplace B2C, no POS mostrador
- Lo que sí tomar en serio: modo offline → plan Sprint 24

### Pulpos (pulpos.com)
- 30 páginas SEO por segmento — rankea primero en Google VE para carnicería
- Estrategia ActivoPOS: páginas /pos-para-carniceria-venezuela etc.
- Diferenciador: español venezolano + dual currency + SENIAT complementario
- Páginas de comparación: ActivoPOS vs Fina, vs Negotiale, vs Control Total
- NOTA: No referenciar como publicidad — capturar usuarios insatisfechos

### Posicionamiento aprobado (inamovible):
"ActivoPOS es tu sistema de control de ventas e inventario.
No reemplaza tu facturación SENIAT — la complementa."

---

## DECISIONES DE PRODUCTO TOMADAS EN SESIÓN

1. Estándar reportería PDF aprobado — colorimetría sellada:
   - Teal #0EA5A4 → marca y estructura
   - Verde #16A34A → valores positivos únicamente
   - Naranja #F97316 → alertas y valores de atención
   - Azul petróleo #1E3A5F → barras secundarias
   - Badge "Reporte X" → blanco sobre teal (NO naranja)
   - @media print → automático sin acción del usuario

2. Tasas de cambio — modelo aprobado:
   - Cada método USD tiene tasa editable inline con ✏️
   - Fuentes: BCV (automático) + Paralelo (dolarapi) + USDT Binance (dolarapi)
   - Tasa se guarda por transacción en historial
   - Sin configuración previa — cajero edita en el momento

3. Sistema de notificaciones — arquitectura aprobada:
   - Bus central: tabla Notification en DB
   - NO Firebase — Web Push nativo + WhatsApp via Twilio
   - Canal in_app siempre | push y whatsapp opcionales por negocio

4. Multi-ticket paralelo — aprobado para Sprint 23:
   - Sale con status='draft' en DB
   - Máximo 5 tickets
   - Persiste al navegar

5. CxC/CxP — requerimiento completo definido:
   - due_date obligatorio en flujo crédito
   - phone obligatorio si payment_method='credit'
   - Modal presets: 7/14/21/30 días + campo libre

---

## PRIORIDAD ABSOLUTA SPRINT 22

Orden de ejecución:
1. BUG-01 pago mixto vuelto (P0 — en producción ahora)
2. BUG-02 pedidos móvil pantalla blanca (P1)
3. BUG-03 + BUG-04 + BUG-05 deuda técnica finanzas (P2)
4. A1 schema due_date + A2 Notification tabla
5. A3 tasa editable inline en POS
6. B1 CxC/CxP completo
7. B2 Modal crédito reforzado

---

## TESTS ACTUALES
- 80/80 Playwright pasando
- Archivos: tests/sprint20-security.spec.ts (5) + tests/sprint21-import-variantes.spec.ts (8)
- Sprint 22 target: 88/88

---

*Generado: 2026-06-21 | HEAD: post Sprint 21 | Entregado por: Claude Web + CLI-D*
*Sesión de 10+ horas — plan maestro, bugs producción, decisiones producto*
