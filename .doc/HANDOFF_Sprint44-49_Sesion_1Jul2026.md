# HANDOFF — Sesión 1-2 Julio 2026
# ActivoPOS | Sprints 44-49
# Estado: Pre-producción · Cliente demo previsto: 11 Julio 2026

---

## RESUMEN EJECUTIVO

Sesión de ~16 horas. Avance masivo en módulos críticos para el demo del cliente.
Sistema en ~82% del roadmap. Meta: 95% para el 11 de julio.

---

## LO QUE SE COMPLETÓ EN ESTA SESIÓN

### Módulo Registro (/registro)
- Wizard 7 pasos mobile-first para nuevos tenants anónimos
- Ruta separada de /onboarding (que es checklist post-login existente)
- Steps: cuenta → negocio + segmento → slug → pagos → horario → categorías → bienvenida
- Sub-segmentos venezolanos: bodega, carnicería, cafetería, heladería, etc. con emojis
- 24 bancos venezolanos en el selector de Pago Móvil
- Backend extendido: POST /api/onboarding/setup acepta categories[], paymentMethods[], segment, subSegment
- 3 P0 de seguridad corregidos: rate limit separado slug vs registro, warnings post-setup, email único global
- /registro en PUBLIC_PREFIXES del middleware

### Módulo Proveedores (/proveedores)
- Schema: Supplier, Purchase, PurchaseItem con PurchaseStatus enum
- CRUD completo proveedores con soft delete y búsqueda
- Compras con items en $transaction → incrementa InventoryEntry automáticamente
- entry_type='purchase' en InventoryEntry para distinguir compras de ajustes
- UI: directorio de proveedores + lista de compras con filtro por supplier
- Filtro URL ?supplier=ID con banner visual "Mostrando compras de: [Nombre]"
- Sidebar: enlace Proveedores con icono Truck entre Finanzas y Configuración
- Certificado por CLI-C: 0 P0, arquitectura tenant sólida

### Módulo Planes (/api/plan)
- PLAN_LIMITS: trial/inicio/pro/business con límites de productos/usuarios/catálogo/IA
- GET /api/plan: plan actual + métricas de uso reales
- POST /api/plan/check: verificar acción antes de ejecutar
- checkPlanLimit integrado en POST /api/products y POST /api/users
- Reutiliza campos existentes: catalog_plan, subscription_active, subscription_expires_at
- Agrega nuevos: ai_tokens_used_month, ai_tokens_limit_month
- Tab "Mi Plan" en Configuración: badge + barras de uso + features + alerta vencimiento

### Admin Panel expandido
- /businesses: tabla tenants con plan/status/métricas + suspender/activar
- /businesses/[id]: detalle completo del tenant
- /stats: KPIs globales + gráfico registros por día
- 3 nuevos endpoints /api/admin/tenants, /api/admin/tenants/[id], /api/admin/stats
- Guard super_admin en todos los endpoints y páginas

### Dashboard bienvenida
- Checklist "Primeros pasos" para tenants nuevos (< 7 días desde created_at)
- Items: logo, primer producto, catálogo activo, compartir link
- "Ocultar esto" persiste en localStorage
- created_at y catalog_active expuestos en GET /api/config/business

### Búsqueda en páginas (deuda pendiente cerrada)
- Finanzas: búsqueda en CxC, Gastos, CxP
- Pedidos: búsqueda por cliente, número, producto
- Reportes: búsqueda en tabs Día y Cierres

### SYSTEM_MAP + Auditoría de conectividad
- .doc/SYSTEM_MAP.md regenerado desde código real: 130+ endpoints, 32 modelos Prisma
- .doc/CONNECTIVITY_AUDIT_Jul2026.md: 6 flujos E2E verificados, 0 P0

---

## ANÁLISIS COMPETITIVO — PLANES Y PRECIOS

### La competencia real (datos verificados hoy):

| Competidor | Plan 1 | Plan 2 | Plan 3 | Catálogo |
|-----------|--------|--------|--------|---------|
| Negotiale | $10/mes | $20/mes | $30/mes | Desde $10 |
| Fina | $30/mes | $35/mes | — | No tiene |
| Cuadrelatam | $10/mes | $25/mes | $80/mes | No tiene |
| SOFI | Gratis | $15/mes | $29/mes | Desde $15 |

### Dónde se ubica ActivoPOS:
- Funcionalidad similar a SOFI Business ($29) + Negotiale Pro ($20)
- Diferenciadores únicos: catálogo WhatsApp-native con pedidos reales, 10 temas de color, dark mode nativo, tenant layer sellado
- Gap crítico vs competencia: módulo de Proveedores ya resuelto en esta sesión ✅
- Gap menor: importación masiva Excel ya existe ✅

### Estructura de planes PROPUESTA (pendiente aprobación Carlos):
```
Inicio    — $9/mes   → POS + inventario + caja + 1 usuario + 50 productos
Pro       — $19/mes  → Todo + 5 usuarios + 500 productos + catálogo básico (vitrina)
Business  — $29/mes  → Todo + ilimitado + catálogo WhatsApp con pedidos + IA (futuro)
```

⚠️ PENDIENTE: Carlos debe aprobar esta estructura antes de implementar en UI pública

---

## MODO DE VENTA POS — ISSUE DOCUMENTADO

### El problema identificado:
El POS siempre muestra la misma interfaz de carrito sin importar el tipo de negocio.
Un taller mecánico no debería ver la misma UI que una bodega.

### Tipos de venta existentes (ya en el sistema):
- `sale_mode='unit'` → productos por unidad (bodega, retail)
- `sale_mode='weight'` → productos por peso (carnicería)
- `sale_mode='service'` → servicios sin stock (taller, gestoría, clínica)
- `sale_mode='combo'` → fábrica (descuenta componentes)

### La solución diseñada (NO ejecutada — pendiente aprobación):
El POS detecta el segmento del negocio y cambia su comportamiento:

```
segment = bodega/minimercado/retail → POS modo carrito (actual) + ticket térmico
segment = mecanica/belleza/juridico/salud → POS modo servicio + PDF carta
segment = restaurante/cafeteria → POS modo comida (carrito + mesa)
```

Configurable en: Configuración → Mi Negocio → Modo de venta (toggle manual)

### El gap de documentos:
- Cotizaciones → PDF carta (A4) ✅ existe
- Venta normal → ticket térmico ✅ existe
- Venta de servicio → debería generar PDF carta ❌ no existe
- Venta convertida de cotización → genera ticket térmico ❌ debería ser factura

### Encoding corrupto en PDF de cotizaciones:
Caracteres como `CotizaciÃ³n`, `VÃ¡lida` — tildes mal encodadas en jsPDF.
Fix pendiente en CLI-A.

---

## GAPS PENDIENTES (ordenados por prioridad)

### P0 — Bloquea demo del cliente:
Ninguno identificado ✅

### P1 — Resolver antes del 11 julio:

1. **Plan enforcement incompleto** — `access_catalog`, `access_ai`, `create_supplier`
   en PLAN_LIMITS pero sin guardia en ningún endpoint. Un trial puede usar todo.
   → CLI-A: integrar checkPlanLimit en catálogo público y proveedores

2. **entry_type en ventas** — ventas pagadas crean InventoryEntry sin `entry_type='sale'`
   → CLI-A: agregar entry_type='sale' en sales/route.ts, sales/[id]/pay, void, orders/cobrar

3. **Número de WhatsApp soporte** — botón "Contactar para cambiar plan" en TabPlan
   tiene `584XXXXXXXXX` placeholder → Carlos debe proporcionar el número real

4. **Encoding PDF cotizaciones** — caracteres corruptos con tildes
   → CLI-A: fix encoding jsPDF

5. **Verificar /registro E2E en producción** — flujo completo registro → dashboard
   funcionando sin bugs

### P2 — Post-demo:

6. **Modo de venta POS por segmento** — interfaz diferente para servicios vs productos
   → Requiere decisión de Carlos antes de ejecutar

7. **Factura PDF para ventas de servicio** — venta con productos service genera PDF carta
   → Depende de decisión sobre modo de venta

8. **Desnormalización business_id** — tablas hijas (SaleItem, SalePayment, etc.)
   sin business_id propio — defensa en profundidad IDOR

9. **Conectar Compras con CxP** — compras de proveedores deberían generar deuda en CxP

---

## ARCHIVOS CLAVE MODIFICADOS ESTA SESIÓN

```
src/app/registro/                              ← NUEVO — wizard 7 pasos
src/app/api/onboarding/setup/route.ts         ← extendido con segment/categories/payments
src/app/api/suppliers/route.ts                ← NUEVO
src/app/api/suppliers/[id]/route.ts           ← NUEVO
src/app/api/purchases/route.ts                ← NUEVO
src/app/api/purchases/[id]/route.ts           ← NUEVO
src/app/(dashboard)/proveedores/              ← NUEVO
src/app/api/plan/route.ts                     ← NUEVO
src/app/api/plan/check/route.ts               ← NUEVO
src/lib/plan-guard.ts                         ← NUEVO
src/lib/plan-limits.ts                        ← NUEVO
src/app/(dashboard)/configuracion/tabs/TabPlan.tsx ← expandido
src/app/(dashboard)/escritorio/page.tsx       ← welcome checklist
src/app/(admin)/businesses/page.tsx           ← expandido
src/app/(admin)/businesses/[id]/page.tsx      ← NUEVO
src/app/(admin)/stats/page.tsx                ← expandido
src/app/api/admin/tenants/route.ts            ← NUEVO
src/app/api/admin/tenants/[id]/route.ts       ← NUEVO
src/app/api/admin/stats/route.ts              ← NUEVO
src/middleware.ts                             ← /registro en PUBLIC_PREFIXES
prisma/schema.prisma                          ← Supplier, Purchase, PurchaseItem, entry_type, ai_tokens
.doc/SYSTEM_MAP.md                            ← regenerado Sprint 44
.doc/CONNECTIVITY_AUDIT_Jul2026.md            ← NUEVO
```

---

## ESTADO DEL ROADMAP

```
Bloque 0: Cierre SYNTImeat          ✅ 100%
Bloque 1: Extracción reglas          ✅ 100%
Bloque 2: Rediseño visual            ✅ 100%
Bloque 3: Tenant Layer               ✅ 100% (123 endpoints sellados)
Bloque 4: Módulos                    ✅ 85% (proveedores ✅, planes ✅, modo servicio ⏳)
Bloque 5: Catálogo + Admin           ✅ 90% (catálogo ✅, admin ✅, registro ✅)
Bloque 6: Deploy producción          ⏳ 70% (VPS activo, falta wildcard DNS)
Bloque 7: Lanzamiento                ⏳ 20% (falta demo cliente, primeros pagos)
```

**Progreso global: ~82%**
**Meta: 95% para el 11 de julio**

---

## PARA EL PRÓXIMO AGENTE — ARRANCAR ASÍ

```
1. Lee: CLAUDE.md → .doc/SYSTEM_MAP.md → .doc/CONNECTIVITY_AUDIT_Jul2026.md
2. Verifica estado del repo: git log --oneline -10
3. Deploy pendiente si hay commits nuevos:
   cd /var/www/activopos && git pull origin main && npx prisma generate && npx prisma db push && rm -rf .next && npm run build && pm2 restart activopos
4. Primera tarea: P1 #1 — plan enforcement (access_catalog, access_ai, create_supplier)
5. Segunda tarea: P1 #2 — entry_type='sale' en ventas pagadas
6. Tercera tarea: P1 #4 — encoding PDF cotizaciones
```

---

## DECISIONES PENDIENTES DE CARLOS

1. ¿Aprueba la estructura de planes Inicio $9 / Pro $19 / Business $29?
2. ¿Cuál es el número de WhatsApp de soporte de ActivoPOS?
3. ¿El modo de venta POS por segmento es prioridad antes o después del demo?
4. ¿El catálogo en plan trial está completamente abierto o tiene restricciones?

---

*Generado: 2 Julio 2026 | ActivoPOS — SYNTIdev*
*Sesión: 1-2 Julio 2026 | Sprints 44-49*
