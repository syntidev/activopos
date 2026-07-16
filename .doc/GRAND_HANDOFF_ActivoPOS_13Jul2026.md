# GRAND HANDOFF — ActivoPOS
# Compilado: 13 Julio 2026, noche | Por: Claude Web
# Fuentes: ROADMAP_v2.md · PLAN_MAESTRO_DeudaTecnica_12dias.md · SYSTEM_MAP.md (Sprint 78/113) ·
# HANDOFF_Sprint85-113 · HANDOFF_Cierre_Sesion_12-13Jul2026 · ADN_ActivoPOS_v1.md · MEMORY.md
# Regla de lectura: prioridad real, no cronológica. P0 = bloquea negocio. P1 = bloquea confianza.
# P2 = mejora, sin urgencia. Ningún ítem se cierra por "el CLI dijo que ya está" — se cierra
# cuando Carlos lo vio funcionar en pantalla, con datos reales, flujo completo.

---

## 0. LEER PRIMERO, EN ESTE ORDEN (obligatorio, sin excepción)

1. `CLAUDE.md` (raíz) — gobernanza absoluta, reglas irrompibles
2. `.doc/SYSTEM_MAP.md` — estado real del sistema, fuente de verdad de código
3. `.doc/sealed-architecture-decisions.md` — stack, paradigma de venta, monetario, business_id
4. `.doc/cimaad-protocol.md` — roles CLI, skills obligatorios, Graphify, commits
5. Este documento — todo lo pendiente compilado

**Regla del policía:** ningún módulo certificado se re-abre sin re-certificación completa tras
tocarlo. Ningún agente avanza a otro módulo sin certificar el anterior.

---

## 1. P0 — BLOQUEA NEGOCIO REAL (tratar primero, sin excepción)

### 1.1 Verificar E2E completo como cliente en producción
Flujo registro → producto → catálogo → venta → reporte. Ninguna fuente confirma que se haya
ejecutado y cerrado tras `HANDOFF_Sprint55-63` (que lo listaba como bloqueante). **No se ha
vuelto a verificar desde entonces.**

### 1.2 Limpieza de tenant de QA en producción
`QA Test Registro SPRINT50` sigue en producción — creado durante verificación E2E, sin
endpoint de auto-limpieza. Limpieza manual pendiente.

### 1.3 Wiring de tasa BCV activa — RIESGO MONETARIO
`RateContext`/tasa manual existen, pero **29 call-sites** de ventas/POS/catálogo siguen usando
`getBcvRate()` directo — el override manual del tenant NO afecta los cálculos reales de venta.
**Marcado explícitamente: requiere aprobación de Carlos antes de ejecutar** (no es solo un fix,
es una decisión de negocio sobre qué tasa se usa en transacciones reales).

---

## 2. P1 — CRÍTICO, TRATAMIENTO ESPECIAL (no se ejecuta como los demás ítems)

### 2.1 Usuarios y Roles — Opus + skill dedicado, Carlos presente antes de código
**Carlos, textual (documentado):** *"Ya he pasado por este trauma antes y los agentes saltan
código y no parametrizan bien las funciones, solo hacen la fachada."*

**Por qué es distinto a todo lo demás:** permisos mal implementados no fallan visible — fallan
en silencio (un cajero viendo reportes financieros que no debería, o ejecutando una acción
destructiva sin permiso). Es el tipo de bug que "funciona en la demo" y falla con el primer
cliente real.

**Protocolo obligatorio, no negociable:**
1. Modelo: **Opus específicamente**, no Sonnet, no el CLI de turno de siempre
2. Skill: `engineering:code-review` + `engineering:testing-strategy` (diseñar casos de prueba
   de permisos ANTES de tocar código)
3. **Antes de escribir una sola línea:** matriz completa rol × acción × recurso (qué puede ver,
   crear, editar, eliminar cada rol, en cada módulo) — **esto se revisa con Carlos antes de
   implementar, no se ejecuta a ciegas**
4. Cada permiso = guard real en backend (nunca solo ocultar botón en frontend = fachada)
5. Test de bypass: usuario con rol restringido intentando el endpoint directo (no por UI) debe
   fallar
6. CLI-C audita después: endpoints sin guard, UI que oculta pero no bloquea, permisos implícitos

**Estado conocido hoy** (de `HANDOFF_Sprint80-84`, verificar si sigue vigente, no asumir):
```
Roles definidos: super_admin | admin | cashier
Middleware: cashier → redirige a /pos ✅
Sidebar: oculta items a cashier ✅
Endpoints protegidos: 95+ guards ✅ (reportado hace días, re-auditar antes de confiar)

Cajero ve: POS, Pedidos, Caja, Clientes (lectura)
Cajero NO ve: Productos, Inventario, Finanzas, Reportes, Config
```

### 2.2 access_catalog / access_ai sin guardia real (DT-02)
Solo 2 de 5 acciones de `checkPlanLimit()` están invocadas en endpoints reales
(`create_product`, `create_user`). Un trial puede usar catálogo e IA sin restricción real.

### 2.3 Stock agregado no resincroniza tras venta de variante (DT-09)
**Estado real al cierre de hoy (13 Jul): CERRADO.** Commit `5697c29` — verificado con venta
real, `net_inventory` se mueve correctamente. No re-abrir sin evidencia nueva de regresión.

### 2.4 Documentación interna contradictoria (DT-13)
`.doc/CLAUDE.md` (v3.0) coexiste con `CLAUDE.md` raíz (v3.1+) y contradice reglas activas
(ej. dirección del sidebar). Riesgo real: un agente lee el archivo viejo y aplica reglas
obsoletas. **Fix trivial, sin riesgo — candidato ideal para ejecución nocturna autónoma.**

---

## 3. P1 — MÓDULOS CONSTRUIDOS PERO DESCONECTADOS

### 3.1 Módulo de Ayuda — existe, no cableado a todos los módulos
Componente (panel lateral, descripción de flujo + FAQ) existe pero no está enlazado desde
todos los módulos reales. Necesita auditoría CLI-C primero (¿existe contenido real por módulo
o está vacío?), luego cableado si el contenido existe.

### 3.2 Bot de ayuda — diagnóstico completo, fix nunca ejecutado
**Auditado hoy (13 Jul) por CLI-C, causa raíz confirmada:** `botReply()` en
`src/app/(dashboard)/ayuda/page.tsx:214-224` usa `score > bestScore` (estrictamente mayor) —
en empate, la primera regla del array gana siempre. Además duplica conteo por singular/plural
de la misma keyword, inflando empates.

**Fix especificado, NUNCA ejecutado** (confirmado por `git log`, cero commits con "botayuda"):
deduplicar conteo por raíz semántica + desempate por longitud de keyword matcheada (no por
posición en el array). Ver Sección 6.1 para el prompt completo, listo para pegar.

### 3.3 GET /api/reports/export-pdf — huérfano (DT-11)
Implementado y funcional, pero ninguna UI lo invoca. Reportes solo dispara export a Excel.

### 3.4 Reporte mensual — banner de notificación
**Estado real: CERRADO hoy.** `DashboardReportAlert.tsx` + endpoints `my-notification`/
`mark-seen` ya existen y están verificados con datos reales. No re-abrir.

---

## 4. P2 — DEUDA TÉCNICA MENOR (sin urgencia, ejecutar cuando haya espacio)

| ID | Descripción |
|---|---|
| DT-03 | `Proveedores` sin `moduleKey` en el sistema de toggle de módulos por plan |
| DT-05 | `RateLimiterMemory` no cluster-safe — pendiente Redis en producción |
| DT-08 | Deploy VPS usó `db push` en vez de `migrate deploy` — riesgo de drift, no reverificado |
| DT-10 | Formulario de producto no oculta "Stock Inicial" cuando `hasVariants=true` |
| — | Encoding de tildes en PDF de cotizaciones — sin confirmación de fix desde `HANDOFF_44-49` |
| — | `products/import`/`import-excel` crean `InventoryEntry` con `entry_type` default, no explícito |

---

## 5. P2 — FEATURES DEL PLAN MAYOR, NO INICIADAS

- Sucursales / multi-branch — **rompe decisión de arquitectura sellada v1** ("No tenant/branch
  separation in v1"). Requiere sesión de arquitectura dedicada, no ejecución directa.
- **Cuentas por Pagar (CxP)** — módulo real pendiente, espejo funcional de CxC (que ya existe y
  está certificado). Candidato fuerte para construcción autónoma nocturna — spec clara,
  patrón ya probado en el sistema (ver Sección 6.2).
- Comisiones a personal
- Dual brand header (logo del negocio + ActivoPOS)
- Módulo banco/métodos de pago compartibles (referencia: ya existe en SYNTImeat)
- Módulo de suscripción — plan activo + alerta de vencimiento en dashboard
- `inputMode="numeric"` en todos los campos numéricos del sistema (estándar, no aplicado global)
- Admin panel mobile-first
- Sitemap dinámico con blog + segmentos
- P&L doble-cuenta de compras en Finanzas (deuda técnica de diseño, no bug puntual)
- `ProductModal.tsx` código muerto (solo se abre por flujo scanner, nunca en creación normal)

---

## 6. DOS TAREAS LISTAS PARA EJECUCIÓN AUTÓNOMA NOCTURNA (sin preguntas, sin bloqueo mutuo)

Ambas trabajan en archivos completamente distintos — cero riesgo de choque entre CLIs.
Ninguna de las dos requiere que Carlos responda nada a mitad de la tarea.

### 6.1 CLI-A #1 — Bot de ayuda (fix ya diagnosticado, solo falta ejecutar)

```
/instinct-status
/code-review + /ponytail ultra

CONTEXTO: auditoría ya realizada (13 Jul), causa raíz confirmada, sin
necesidad de investigar de nuevo.

src/app/(dashboard)/ayuda/page.tsx:214-224 — función botReply():
- score > bestScore (estrictamente mayor) → en empate, la primera
  regla del array gana siempre
- Conteo duplica por singular/plural de la misma keyword

Caso reproducido: "cómo veo mis clientes y mis reportes de ventas"
responde solo Clientes, ignorando "reportes de ventas" explícito.

TAREA:
1. Deduplicar conteo por raíz semántica — si BOT_RULES tiene
   ['cliente','clientes'] en la misma regla, cuenta como 1 punto
   si matchea cualquiera, no 2. Revisar las 25 reglas del array por
   este mismo patrón.
2. Desempate: score = suma de longitud de caracteres de las keywords
   matcheadas (no cantidad de keywords) — favorece matches largos/
   específicos sobre coincidencias cortas genéricas, sin lógica
   adicional de desempate.
3. Verificar que el fix de 'pro' dentro de 'producto' (límite de
   palabra) sigue vigente y no se pisa con este cambio.

VERIFICAR con casos reales:
- "cómo veo mis clientes y mis reportes de ventas" → debe responder
  Reportes o mencionar ambos, no solo Clientes
- Probar 3-4 preguntas más que toquen 2 tópicos a la vez

npx tsc --noEmit → 0 errores
npm run build → limpio

git add src/app/(dashboard)/ayuda/page.tsx
git commit -m "fix(ayuda): corrige empate de keywords por desempate de especificidad

🤖 Agente: CLI-A | Sprint: BotAyuda-1 | Fecha: 2026-07-13"
git push origin main
```

### 6.2 CLI-A #2 — Cuentas por Pagar (CxP), espejo de CxC existente

```
/instinct-status
/code-review + /api-design + /software-architecture + /database-migrations
+ /ponytail ultra

CONTEXTO: CxC (Cuentas por Cobrar) ya existe, certificado, funcional
— usarlo como plantilla exacta para construir CxP (Cuentas por Pagar),
que hoy no existe como módulo real (solo se menciona en Finanzas como
línea de dato, sin CRUD ni vista propia).

PASO 0 — GRAPHIFY (obligatorio):
graphify explain "CxC"
graphify path "CxC" "finanzas"

PASO 1 — LEER antes de escribir:
- Modelo Prisma de CxC/Sale/Client (para clonar el patrón hacia
  Supplier/Purchase)
- src/app/api/finanzas/cxc (o ruta real) — endpoints existentes
- Componente de UI de CxC en Finanzas — layout, filtros, badge sidebar

TAREA — Construir CxP completo, mismo patrón que CxC:
1. Modelo: si no existe, campo due_date + status en Purchase (crédito
   a proveedor), reusar PurchaseStatus si ya cubre 'credit'
2. Endpoint GET /api/finanzas/cxp — filtros vigente/por vencer/vencido,
   mismo criterio que CxC
3. UI: tab "Por Pagar" en Finanzas (ya existe el placeholder según
   AUDIT_FINANZAS_conectividad.md — verificar si es solo buscador sin
   campo supplier detrás, y conectarlo real)
4. Badge en sidebar si hay CxP vencidas (mismo patrón que CxC)
5. business_id siempre desde getSession(), nunca del body

VERIFICAR con datos reales:
- Crear una compra a crédito con proveedor real → aparece en CxP
- Marcar como vencida (due_date pasado) → badge se activa
- Filtros vigente/por vencer/vencido funcionan con datos reales

npx tsc --noEmit → 0 errores
npm run build → limpio

git add [archivos correspondientes — rutas exactas, nunca git add .]
git commit -m "feat(finanzas): implementa CxP completo, espejo funcional de CxC

🤖 Agente: CLI-A | Sprint: CxP-1 | Fecha: 2026-07-13"
git push origin main
```

**Mañana:** revisar ambos commits, deploy conjunto, verificación visual tuya de las dos piezas
antes de seguir avanzando.

---

## 7. LO QUE NO SE TOCA ESTA NOCHE, BAJO NINGUNA CIRCUNSTANCIA

- **Usuarios y Roles (implementación de código)** — la matriz se puede diseñar y documentar
  esta noche por Opus (ver 2.1), pero **ningún guard se escribe sin que Carlos revise la matriz
  primero**. Si Opus tiene tiempo esta noche, su tarea es SOLO producir el documento de matriz
  rol×acción×recurso, no tocar código.
- **Sucursales** — decisión de arquitectura, no ejecución.
- **Wiring de tasa BCV (29 call-sites)** — requiere aprobación explícita de Carlos, es una
  decisión de negocio sobre dinero real.

---

*Compilado 13 Julio 2026, noche — Claude Web. Próxima sesión: leer este documento completo
antes de retomar cualquier pendiente.*
