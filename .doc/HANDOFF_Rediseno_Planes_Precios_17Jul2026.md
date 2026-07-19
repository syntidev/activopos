# HANDOFF — Rediseño de Planes y Precios ActivoPOS
# Generado: 17 Julio 2026 | Por: Claude Web (orquestador, sesión de estrategia comercial)
# Este documento es la fuente de verdad de las decisiones tomadas en esta sesión.
# Leer completo antes de generar cualquier prompt de CLI.

---

## 0. RESUMEN EJECUTIVO

Se rediseña la estructura de planes de ActivoPOS de 3 planes ($15/$25/$40, catálogo
solo desde el plan medio) a **2 planes** (Gratis + único plan pago), con catálogo
digital incluido desde el plan gratuito de conversión, ciclo de facturación con
descuento por permanencia, y precio en bolívares calculado en vivo a tasa **paralela**
(nunca BCV) para no erosionar el ingreso real en dólares.

Esto toca: schema/backend (CLI-A), landing pública (CLI-B), panel admin (Opus —
territorio exclusivo, sesión separada), métodos de pago (nuevo: Binance), y
documentación de referencia (`CLAUDE.md`, `SYSTEM_MAP.md`, `ACTIVOPOS_MASTER.md`,
`plan-limits.ts`).

---

## 1. DECISIONES CERRADAS EN ESTA SESIÓN

### 1.1 Estructura de planes (CERRADO)

| | Gratis | Negocio Activo (único plan pago) |
|---|---|---|
| Precio | $0 para siempre | $19/mes (ver ciclos abajo) |
| POS + venta | Básico, sin variantes complejas | Completo: variantes, multi-ticket, crédito, cotizaciones |
| Dual moneda BCV | ✅ | ✅ |
| Métodos de pago venezolanos | ✅ (incluye Binance — nuevo) | ✅ |
| Inventario | Hasta ~40 productos | Ilimitado + import Excel |
| Usuarios | 1 | Hasta 10 |
| Caja | Básica | Completa con cuadre |
| Pedidos (Kanban + WhatsApp) | ❌ | ✅ |
| Clientes y CxC | ❌ | ✅ |
| Proveedores y Compras | ❌ | ✅ |
| Finanzas (CxC/CxP/Gastos/P&L) | ❌ | ✅ completo |
| Reportes exportables | ❌ (solo pantalla) | ✅ Excel · **PDF: NO — DT-11 confirmado por auditoría, endpoint existe pero cero UI lo invoca** |
| **Catálogo digital + checkout WhatsApp** | ❌ | ✅ — diferenciador principal |
| Analytics básico | ❌ | ✅ (confianza MEDIA — profundidad de datos sin verificar) |
| ~~Temas de segmento (10)~~ | — | **ELIMINADO — no es un feature del cliente.** Auditoría confirma que son 8 (no 10) temas de las landing pages de MARKETING de ActivoPOS, no un selector para el catálogo del negocio cliente. El catálogo del cliente solo tiene 1 color libre (`business.theme_color`), sin presets ni gating de plan. |
| **Tema visual del catálogo (9 colores curados por segmento + modo oscuro/claro)** | Por decidir | ✅ — **CORRECCIÓN 17 jul, verificado en pantalla por Carlos:** SÍ existe, ya construido — 9 presets con nombre por rubro ("Ámbar Panadería") + selector oscuro/claro. Contradice el hallazgo original de CLI-C ("1 color libre, sin presets") — ver nota en §2.6. Cero código nuevo, solo falta el gate de plan. |
| KDS / analytics avanzado | ❌ | Disponible bajo pedido — **NO en vitrina pública** hasta confiar en sostenerlo |

**Nombres "Gratis" y "Negocio Activo" son de trabajo — no aprobados como naming final de marca.**

### 1.2 Precio y ciclos de facturación (CERRADO el número, PENDIENTE cuántos ciclos mostrar en público)

| Ciclo | Precio | Ahorro real vs. mensual | Badge sugerido |
|---|---|---|---|
| Mensual | $19 | — | — |
| Trimestral | $50 | 12.3% | -10% OFF |
| Semestral | $90 | 21.1% | -20% OFF |
| Anual | $156 | 31.6% | -30% OFF |

**Recomendación pendiente de confirmar por Carlos:** mostrar solo Mensual y Anual en
la vitrina pública (menos fricción de decisión); Trimestral/Semestral quedan
disponibles si el cliente pregunta por WhatsApp. No está cerrado — decidir antes de
que CLI-B lo construya.

### 1.3 Precio en bolívares (CERRADO el mecanismo)

- Se calcula con la **tasa paralela** (`ve.dolarapi.com/v1/dolares/paralelo`), **nunca
  con BCV** (`ve.dolarapi.com/v1/dolares/oficial`) — validado con el propio precedente
  de Carlos en syntiweb.com/planes (tasa aplicada ahí: 827.5 Bs/USD, consistente con
  paralela, no con BCV).
- Nunca se publica un número fijo en bolívares en la página — se calcula en vivo,
  igual que ya se hace en syntiweb.com/planes.
- No se etiqueta públicamente como "tasa BCV" si es paralela — usar lenguaje neutro
  ("tasa del día") o no nombrar la fuente.
- Este mecanismo es exclusivamente para el cobro de la **suscripción de ActivoPOS**.
  No cambia cómo el producto calcula USD/Bs para las ventas de los negocios clientes
  a sus propios clientes — eso sigue usando BCV, es decisión sellada aparte.

### 1.4 Métodos de cobro (NUEVO — decidido esta sesión)

- Se activa **Binance** (cuenta/ID) como método formal de cobro de la suscripción.
- Prioridad de cobro recomendada: USD real primero (Zelle, USDT/Binance, PayPal) — cero
  pérdida por brecha cambiaria. Pago Móvil (Bs) como alternativa, calculado a tasa
  paralela.
- Esto activa el pendiente ya documentado en el roadmap: **"BANCO / MÉTODOS DE COBRO
  MODULE"** (ya referenciado en `SYNTImeat` como patrón a reutilizar) — se sube de
  prioridad porque ahora es requisito directo para cobrar la propia suscripción, no
  solo un nice-to-have para que los negocios clientes compartan sus métodos de pago.

### 1.5 Tabla de comparación de features (CERRADO el patrón visual)

No lista vertical de features fila por fila (se cae, scroll largo). Formato aprobado:
plan Gratis como lista corta simple (6 ítems); plan pago agrupado por categorías
(Venta, Catálogo, Clientes, Proveedores, Finanzas, Equipo) en grid de 2 columnas
dentro de la misma card — referencia visual generada en esta sesión, pedir a Carlos
el screenshot del widget si el CLI necesita verlo antes de construir.

---

### 1.6 Homologación de ubicaciones (CERRADO)

Se confirmaron 3 ubicaciones con el diseño VIEJO de 3 planes ($15/$25/$40) todavía
en producción o en preview: `/planes`, páginas de segmento (`/para-[segmento]`), y
el main/home. **Las tres se homologan al modelo NUEVO de 2 planes con slider**
definido en esta sesión — ninguna homologa hacia el diseño viejo. Las tres deben
consumir `plan-limits.ts` como fuente única — no hardcodear precios ni planes por
separado en cada ruta, que fue exactamente la causa de la desincronización actual.

Se rescatan dos patrones del diseño viejo (imagen de referencia, sesión 17 jul),
independientes de la cantidad de planes:
- Subtítulo descriptivo de una línea bajo cada check (estilo Fina) — no solo el
  nombre de la función.
- Fila de métodos de pago con íconos debajo de las cards ("Cobra como ya le cobras
  a tu cliente").

**Nota sin cerrar:** el ícono de Binance en esa fila de métodos de pago es un
feature del PRODUCTO (el negocio cliente cobra a sus propios clientes en Binance)
— distinto de la cuenta Binance propia de ActivoPOS para cobrar la suscripción
(sección 1.4). Confirmar cuál de las dos ya existe en el sistema y cuál sigue
pendiente antes de que CLI-B construya esa fila.



1. **Backend / Schema** (CLI-A)
2. **Landing pública `/planes`** (CLI-B)
3. **Panel Admin** (Opus — exclusivo, sesión separada, NO CLI-A/B)
4. **Métodos de pago** (CLI-A backend + CLI-B settings UI)
5. **Documentación** (actualizar AL CIERRE, no antes)

---

## 2.5 FASE 0 — AUDITORÍA DE FUNCIONES REALES (CLI-C, ANTES DE TOCAR CÓDIGO)

**Por qué esta fase existe:** la tabla de features de la sección 1.1 y 1.5 se construyó
a partir de `ADN_ActivoPOS_v1.md` y documentación de proyecto, no de una verificación
directa del código en este sprint. Ya hay al menos un riesgo conocido: `GET
/api/reports/export-pdf` está implementado pero **huérfano — ninguna UI lo invoca**
(DT-11, documentado desde `GRAND_HANDOFF_13Jul2026`, sin confirmación de cierre desde
entonces). Publicar "Reportes Excel y PDF" en el plan pago sin verificar esto es
prometer una función que el cliente no puede usar — fachada, prohibida por principio.

**Regla:** ningún feature entra al copy final de `/planes` sin confirmación de CLI-C
con archivo, línea y confianza declarada (ALTA/MEDIA/BAJA), igual que cualquier otra
certificación.

```
# MEMORIA — ejecutar PRIMERO antes de cualquier tarea
/instinct-status
/emil-design-eng

Ejecuta

/code-review max
/web-quality-audit
/ecc:typescript-reviewer
agents: typescript-reviewer

PASO 0 — GRAPHIFY:
graphify query "reportes export pdf excel catalogo finanzas proveedores enforcement"
graphify explain "plan-guard.ts"

PASO 1 — Para cada feature listado en la sección 1.1 de
HANDOFF_Rediseno_Planes_Precios_17Jul2026.md, verificar en código real (no en
documentación) si:
  a) El endpoint/función existe
  b) Tiene una UI real que lo invoca (no solo el endpoint funcional)
  c) Funciona end-to-end con datos reales, no solo en teoría

Prioridad de verificación — estos ya tienen sospecha de gap conocido:
  - GET /api/reports/export-pdf (DT-11 — huérfano según último reporte)
  - access_catalog / access_ai enforcement en plan-guard.ts (DT-02 — histórico sin
    enforce confirmado)
  - KDS (Kitchen Display System) — YA EXCLUIDO de vitrina pública por decisión de
    Carlos, no requiere verificación urgente para este sprint, pero documentar
    estado real para la próxima vez que se reconsidere

PASO 2 — Entregar tabla con columnas: Feature | Archivo:línea | UI conectada (sí/no) |
Funciona end-to-end (sí/no) | Confianza (ALTA/MEDIA/BAJA)

PASO 3 — NO CORREGIR NADA — CLI-C es solo lectura. Si encuentra un gap, lo reporta
para que Carlos decida: se corrige antes de publicar el plan, o se saca esa función
del copy hasta que esté lista.

Este reporte se entrega a Claude Web para actualizar la sección 1.1 y 1.5 de este
documento ANTES de generar los prompts finales de CLI-A y CLI-B.
```

### 2.6 RESULTADOS DE LA FASE 0 (ejecutada 17 jul 2026 por CLI-C)

**Estado general:** la mayoría de los features de §1.1 están ALTA confianza, UI
conectada, funcionan E2E — el rediseño se apoya en una base sólida. Tres hallazgos
requieren decisión antes de continuar:

1. **`plan-limits.ts` sigue en el modelo VIEJO** (4 tiers: trial/inicio/pro/business,
   $15/$25/$40) — confirma que CLI-A no ha ejecutado su parte todavía. Esperado,
   no es un problema, es el estado correcto para esta etapa.

2. **DT-11 (export-pdf) sigue abierto, confirmado con código real** — el endpoint
   `api/reports/export-pdf/route.ts` es una implementación real, no un stub, pero
   cero UI lo invoca en todo `src/`. Ya corregido en la tabla §1.1: el plan pago
   promete "Reportes Excel" con confianza, y marca PDF como pendiente hasta que
   se conecte un botón real.

3. **"Temas de segmento (10)" era un error de origen, no solo un número mal
   contado** — ya eliminado de §1.1. Lo que existe son 8 temas de las landing
   pages de MARKETING de ActivoPOS por rubro (carnicería, ferretería, etc.), sin
   relación con lo que un negocio cliente puede personalizar en SU catálogo. El
   catálogo del cliente solo tiene un color libre, sin presets, sin gating de
   plan. Esta fila no puede repararse con un ajuste de copy — describía un feature
   que no existe.

**Corrección a favor — un riesgo que resultó no serlo:**
DT-02 (`access_catalog` "histórico sin enforce confirmado") — la auditoría verificó
código real y **SÍ está enforced**, tanto en dashboard como en la página pública del
catálogo (revalida plan en cada carga vía `isCatalogLive()`). Se cierra como
resuelto, ya no es un riesgo para el copy del plan.

**Binance — las dos cosas distinguidas, con resultado real:**
- Binance como método de cobro DEL NEGOCIO CLIENTE (para que ellos le cobren a
  SUS clientes): ya existe y funciona (`Step4Pagos.tsx`, `TabCobros.tsx`,
  `payment-methods route.ts`).
- Binance de ActivoPOS (para que Carlos cobre la suscripción): **no existe en
  absoluto — cero archivos.** Confirma que la sección 1.4 de este documento es
  trabajo nuevo real, no una simple "activación" como se planteó originalmente en
  la conversación de estrategia. Recalibrar expectativa de esfuerzo en el prompt
  de CLI-A.

**Decisiones que le tocan a Carlos antes de que CLI-A/CLI-B continúen:**
- PDF: ¿se conecta la UI antes de publicar "Reportes Excel y PDF", o el plan
  publica solo "Reportes Excel" hasta que PDF esté listo?
- ~~Temas de segmento: fila eliminada del copy~~ **RESUELTO 17 jul** — ver nota
  abajo, sí existe como "Tema visual del catálogo", entra al plan pago.

**CORRECCIÓN 17 jul — hallazgo de CLI-C incompleto en un punto:** Carlos verificó
en pantalla (captura de configuración de catálogo, cuenta admin) que SÍ existe un
selector de 9 colores curados con nombre por segmento ("Ámbar Panadería") + modo
oscuro/claro — esto contradice el reporte original de CLI-C ("1 color libre, sin
presets, sin gating de plan"). Posible causa: el audit puede haber revisado un
componente distinto al que renderiza esta pantalla, o el grep no cubrió el archivo
correcto — no se investiga la causa ahora, prioridad es la decisión de negocio.

**Estado real, por verificación visual directa (gana sobre el reporte de CLI-C
por Regla del Policía):** el selector de 9 colores + modo oscuro/claro EXISTE y
está construido. Lo único pendiente es el **gating de plan** — hoy no está claro
si está disponible en Gratis o solo en cuentas pagas, porque solo se probó en
cuenta admin. Se verifica naturalmente cuando CLI-A termine de tocar
`plan-guard.ts` en este mismo sprint (sección 3, PASO 2).

**Decisión de Carlos:** cerrar esta feature a **Negocio Activo únicamente** — no
requiere construcción nueva, solo enforcement. Se agrega a §1.1 y al alcance de
CLI-A.

---

## 3. PROMPT — CLI-A (BACKEND)

```
# MEMORIA — ejecutar PRIMERO antes de cualquier tarea
/instinct-status
/emil-design-eng

Ejecuta

/code-review max
/security-review
/api-design
/software-architecture
/database-migrations
/coding-standards
/ponytail ultra

PASO 0 — GRAPHIFY (obligatorio antes de tocar un archivo):
graphify query "plan enforcement business subscription pricing"
graphify explain "plan-guard.ts"
graphify path "businesses" "plan-guard.ts"

PASO 1 — LEE ANTES DE ASUMIR:
- prisma/schema.prisma — campo(s) actuales de plan en `businesses`
- src/lib/plan-guard.ts completo
- src/lib/plan-limits.ts (fuente única de precios — confirmar si existe y si ya
  está desactualizado vs. lo que sigue)
- Cualquier lugar que lea getBcvRate()/getActiveRate() como referencia de patrón,
  para replicar la misma arquitectura de fallback con la tasa PARALELA

NO ASUMAS nombres de campo ni valores de enum — repórtalos exactos antes de proponer
el cambio.

PASO 2 — CAMBIOS A IMPLEMENTAR (declarar supuestos antes de tocar código):

1. Redefinir los valores de plan de 3 niveles a 2: "gratis" y "negocio_activo"
   (o los nombres exactos de enum que ya existan, adaptados). Decidir y declarar
   si se requiere migración de datos para tenants existentes en los 3 planes viejos.

2. Actualizar plan-guard.ts / checkPlanLimit() con los límites de la sección 1.1
   de este documento: productos (~40 en gratis, ilimitado en pago), usuarios (1 vs
   10), y CONECTAR el enforcement pendiente de access_catalog y access_ai (deuda
   técnica ya documentada, nunca cerrada).

3. Nuevo helper de tasa paralela — mismo patrón de fallback chain que ya existe
   para BCV, pero apuntando a ve.dolarapi.com/v1/dolares/paralelo. Exponer como
   función server-side reutilizable para calcular precio en Bs de la suscripción
   en tiempo real. NO cachear más de unas horas — la tasa se mueve a diario.

4. **Binance de ActivoPOS — CONFIRMADO POR AUDITORÍA CLI-C: no existe ningún
   archivo, es trabajo nuevo real, no una activación rápida.** Agregar campo de
   cuenta/ID Binance al módulo de métodos de pago de la propia ActivoPOS (esto es
   cobro de LA SUSCRIPCIÓN, no confundir con el Binance que el negocio cliente ya
   tiene funcionando para SUS propias ventas — ese no se toca).

5. Si el sistema no soporta hoy ciclos de facturación distintos a mensual, declarar
   qué campo(s) nuevos hacen falta en `businesses` (ej. billing_cycle,
   plan_expires_at ya existe — confirmar si alcanza o requiere ajuste).

6. **NUEVO 17 jul:** Confirmar dónde vive el selector de "Tema Visual" del
   catálogo (9 colores curados + modo oscuro/claro, ya construido — ver captura
   de referencia en §2.6) y AGREGAR el gate de plan: exclusivo de Negocio Activo,
   bloqueado en Gratis. No requiere construir UI nueva, solo enforcement en
   plan-guard.ts + el check correspondiente en el componente que renderiza esa
   pantalla.

PASO 3 — CERTIFICAR con datos reales (no solo build limpio):
- Query real mostrando un tenant en plan gratis con el límite de producto 41
  bloqueado de verdad
- Query real mostrando el cálculo de precio en Bs con la tasa paralela actual
- Confirmar acceso a catálogo/finanzas/proveedores bloqueado en gratis y
  desbloqueado en pago, con prueba real, no solo revisión de código

git add [archivos específicos]
git commit -m "feat(planes): rediseño a 2 planes + tasa paralela + Binance

🤖 Agente: CLI-A | Sprint: N | Fecha: 2026-07-17"
git push origin main
git log --oneline -3
```

---

## 4. PROMPT — CLI-B (FRONTEND PÚBLICO)

```
# MEMORIA — ejecutar PRIMERO antes de cualquier tarea
/instinct-status
/emil-design-eng

Ejecuta

/impeccable craft
/frontend-design:frontend-design
/ui-ux-pro-max:ui-ux-pro-max
/coding-standards
/ponytail ultra

PASO 0 — GRAPHIFY:
graphify query "planes page pricing cards planes/page.tsx"
graphify explain "planes/page.tsx"

PASO 1 — ESPERAR a que CLI-A esté certificado (sección 3 de este doc) antes de
construir — el frontend consume plan-limits.ts y el helper de tasa paralela que
CLI-A debe entregar primero. No hardcodear precios ni límites en el componente.

PASO 2 — REDISEÑO de src/app/(marketing)/planes/page.tsx:

1. De 3 cards a 2 (Gratis + Negocio Activo), según tabla sección 1.1 de este doc.
2. Selector de ciclo de facturación como **slider arrastrable** (`<input
   type="range">`, no botones/tabs) de Mensual a Anual — el precio, el tachado de
   "sería $X" y el badge de ahorro se actualizan en vivo mientras se arrastra.
   Referencia visual aprobada por Carlos en sesión de estrategia (widget
   `activopos_seccion_final_planes`, 17 jul 2026). Mostrar los 4 puntos
   (Mensual/Trimestral/Semestral/Anual) como marcas del slider — ver 1.2 para si
   los 4 quedan visibles o se reduce a 2.
3. Toggle USD $ / Bs., con el valor en Bs calculado en vivo contra el helper de
   tasa paralela de CLI-A — igual patrón visual que ya existe en syntiweb.com/planes
   (toggle simple, switch, dos labels).
4. Nueva tabla de comparación agrupada por categoría (Venta, Catálogo, Clientes,
   Proveedores, Finanzas, Equipo) — NO lista vertical fila por fila. Ver 1.5.
5. Badge "Más popular" en el plan pago, CTA en --ap-amber (uso #2 de 2 permitidos
   en la página — confirmar que no hay otro CTA amber ya usado en /planes).
6. Auditar y corregir CUALQUIER precio viejo hardcodeado en otras rutas — ya se
   confirmó divergencia entre archivos locales (index.html/landing.html mostraban
   $9/$19/$29, desactualizado) y /recursos (mostraba $15/$25/$40 por error, P0
   documentado en HANDOFF_Auditoria_Marketing). Este rediseño es la oportunidad de
   centralizar TODO en plan-limits.ts, cero duplicación de números.

PASO 3 — Verificación visual obligatoria (Regla del Policía):
- Desktop 1280px y mobile 375px, sin overflow horizontal
- Toggle de ciclo y toggle Bs funcionando con datos reales del backend
- Captura de pantalla antes de pedir aprobación — "commiteado" no es "aprobado"

git add [archivos específicos]
git commit -m "feat(planes): landing 2 planes + toggle ciclo + toggle Bs

🤖 Agente: CLI-B | Sprint: N | Fecha: 2026-07-17"
git push origin main
git log --oneline -3
```

---

## 5. PANEL ADMIN — TERRITORIO EXCLUSIVO DE OPUS

**No delegar a CLI-A ni CLI-B. Regla sellada: "El Admin panel es territorio
exclusivo de Opus."**

Alcance para la sesión de Opus (separada, después de que CLI-A y CLI-B estén
certificados en producción):

- `/businesses` y `/businesses/[id]` deben reflejar los 2 planes nuevos, no los 3
  viejos — el selector de plan del admin, los badges de plan en la tabla de
  tenants, y cualquier filtro.
- `/stats` — cualquier KPI o gráfico que agrupe/cuente por plan debe actualizarse
  al nuevo esquema de 2 planes.
- Migración de tenants existentes en los 3 planes viejos a los 2 nuevos — esto es
  una decisión de negocio (¿a cuál de los 2 planes nuevos migra cada uno de los 3
  viejos?), Carlos debe decidir el mapeo antes de que Opus ejecute.

---

## 6. DOCUMENTACIÓN A ACTUALIZAR (AL CIERRE, NO ANTES)

- `CLAUDE.md` (raíz) — si menciona los 3 planes o precios viejos
- `.doc/SYSTEM_MAP.md`
- `ACTIVOPOS_MASTER.md` / `ACTIVOPOS_MASTER_V2.md`
- `plan-limits.ts` — confirmar que quedó como fuente única, sin duplicados
- Cualquier HANDOFF activo que cite $15/$25/$40 o la estructura de 3 planes

No actualizar documentación hasta que CLI-A + CLI-B + Opus estén certificados y
Carlos haya dado aprobación visual — documentar algo que puede cambiar en el camino
genera el mismo problema de divergencia que ya se encontró en esta sesión
(archivos con precios viejos sirviendo de referencia sin que nadie lo note).

---

## 7. ORDEN DE EJECUCIÓN (REGLA DEL POLICÍA — NO SALTAR)

1. CLI-A: backend completo, certificado con datos reales
2. CLI-B: frontend público, solo después de (1) certificado
3. Opus: panel admin, solo después de (1) y (2) en producción y verificados por
   Carlos en pantalla
4. CLI-C: auditoría del flujo completo (registro → selección de plan → enforcement
   real de límites → cobro) antes de declarar cerrado
5. Documentación: al final, no antes

---

## 8. VERIFICACIÓN VISUAL FINAL — CARLOS DEBE CONFIRMAR EN PANTALLA

- `/planes` en producción: 2 planes, toggle de ciclo, toggle Bs con tasa en vivo
- Un registro real termina en plan Gratis con los límites aplicados de verdad
  (no solo visual — intentar crear el producto 41 y que falle)
- Un upgrade real a Negocio Activo desbloquea catálogo/finanzas/proveedores/
  exportables de verdad
- Tema visual del catálogo (9 colores + modo oscuro/claro) bloqueado en Gratis,
  disponible en Negocio Activo — pendiente desde 17 jul, se prueba con el mismo
  cambio de plan-guard.ts de CLI-A
- Panel admin (Opus) muestra el plan correcto por tenant, sin rastro de los 3
  planes viejos
- Pago de prueba vía Binance completado de punta a punta

---

## 9. PENDIENTES SIN CERRAR — DECIDIR ANTES DE EJECUTAR

1. ¿Vitrina pública muestra 4 ciclos o solo Mensual/Anual? (sección 1.2)
2. Naming final de los planes — "Gratis" y "Negocio Activo" son nombres de trabajo
3. Mapeo de migración: tenants en los 3 planes viejos → cuál de los 2 planes nuevos
4. Confirmar si `plan-limits.ts` ya existe como fuente única o hay que crearlo
   *(respondido por auditoría 17 jul: existe, pero en el modelo viejo de 4 tiers —
   CLI-A lo actualiza, no lo crea desde cero)*
5. **NUEVO (Fase 0):** PDF de reportes (DT-11) — ¿se conecta la UI antes de
   publicar, o el plan sale con solo "Reportes Excel" hasta que esté listo?
6. **NUEVO (Fase 0):** "Temas de segmento" se eliminó del copy por no ser un
   feature real del cliente — ¿se construye un selector de tema real para el
   catálogo del cliente en el futuro, o queda fuera del plan pago para siempre?
