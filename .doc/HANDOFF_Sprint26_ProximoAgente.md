# HANDOFF — Sprint 26 → Próxima Sesión
# ActivoPOS | 2026-06-23
# Generado por: Claude Web (sesión de 14+ horas)
# Entregado a: próximo agente Claude Web

---

## LEE ESTO PRIMERO — ANTES DE HACER CUALQUIER COSA

```
1. CLAUDE.md (raíz del repo) — gobernanza completa
2. .doc/SYSTEM_MAP.md — v25 (el más reciente en repo)
3. .doc/ACTIVOPOS_MASTER_V2.md — §15 plan maestro Sprint 22-26
4. .doc/AGENTS.md — protocolo multi-agente
5. .doc/HANDOFF_Sprint22.md — bugs documentados en sesión
```

---

## INFRAESTRUCTURA

| Campo | Valor |
|---|---|
| Repo | syntidev/activopos |
| Rama | main |
| Local | C:\laragon\www\activopos |
| VPS IP | 187.124.241.213 |
| VPS Puerto | 3001 (local) / 80+443 (Nginx) |
| PM2 proceso | activopos (cluster mode) |
| Producción | https://activopos.com |
| DB | MariaDB local + VPS — Prisma 7 |
| Stack | Next.js 14 + TypeScript strict + CSS Modules + Prisma 7 + MariaDB |

## INICIO DE SESIÓN — SIEMPRE

```powershell
# Local
cd C:\laragon\www\activopos
git pull origin main
.\r.ps1
# Esperar "Ready on http://localhost:3000"
curl http://localhost:3000/api/rates/bcv
# Esperado: {"ok":true,"bcv":612.xx,"paralelo":791.xx,"rate":612.xx}
```

**CRÍTICO — JWT auth-state expira en 8h:**
```javascript
// Si tests fallan en masa, refrescar con:
node -e "const http=require('http'),fs=require('fs');const body=JSON.stringify({email:'admin@activopos.com',password:'admin123'});http.request({hostname:'localhost',port:3000,path:'/api/auth/login',method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}},res=>{const cookie=(res.headers['set-cookie']||[]).find(c=>c.includes('activopos_session'));const value=cookie.match(/activopos_session=([^;]+)/)[1];const expires=new Date(cookie.match(/Expires=([^;]+)/i)[1]).getTime()/1000;fs.writeFileSync('tests/.auth-state.json',JSON.stringify({cookies:[{name:'activopos_session',value,domain:'localhost',path:'/',expires,httpOnly:true,secure:false,sameSite:'Strict'}],origins:[]}));console.log('Auth state updated');}).end(body);"
```

## DEPLOY VPS — COMANDO COMPLETO

```bash
cd /var/www/activopos && git pull origin main && npm install && npx prisma generate && npx prisma migrate deploy && rm -rf .next && npm run build && pm2 restart activopos && pm2 save && sleep 5 && curl -s http://localhost:3003/api/rates/bcv
```

**Si hay conflicto en VPS:**
```bash
git config pull.rebase false && git checkout package-lock.json && git pull origin main
```

---

## ESTADO ACTUAL DEL SISTEMA

| Campo | Valor |
|---|---|
| Último sprint cerrado | Sprint 25 |
| Tests | 127/128 estables (1 skip T03 permanente) |
| Build | Limpio — 0 errores TypeScript |
| VPS | Sprint 25 desplegado — activopos.com activo |
| Migraciones aplicadas | 19 migraciones en DB |

---

## QUÉ SE COMPLETÓ EN ESTA SESIÓN (Sprints 17-26)

### Sprints 17-21 (al inicio de sesión)
- Tokens v4.0 — ADN visual ActivoPOS aprobado
- Sistema A+C glow → borde uniforme teal
- Módulo Fábrica — combos/fabricables con recetas
- Venta por peso — qty decimal
- Import masivo Excel
- Variantes de producto
- Modal PIN descuentos
- Overlay management completo
- SEC-01/02/04 resueltos

### Sprints 22-25 (esta sesión)
- CxC/CxP con due_date real — heurístico 30d eliminado
- Notificaciones — bus central tabla Notification
- Tasas paralelo + USDT en /api/rates/bcv
- PDF engine con estándar aprobado
- Badge sidebar notificaciones
- Multi-ticket DB-backed — drafts persisten
- Módulos opcionales activables (modules_enabled en Business)
- Stock threshold por producto
- Web Push backend con SSRF protegido
- Admin multitenant base /admin/businesses + /admin/stats
- CORE_MODULES protegidos (pos/caja/inventory no desactivables)
- Pedidos → botón Cobrar + botón Cancelar (Sprint 26)
- Botones muertos en /productos eliminados
- Onboarding con checklist operativo post-wizard
- Fix StockModal — nombre producto prominente
- PWA manifest corregido
- Sidebar blanco confirmado en CLAUDE.md

### Sprint 26 — EN PROGRESO (commits en main, VPS NO actualizado con Sprint 26)
- POST /api/orders/[id]/cobrar — crea Sale desde pedido ✅
- POST /api/orders/[id]/cancelar ✅
- CobrarPedidoModal en OrderCard ✅
- MO-FIX02 parcial — middleware verifica modules_enabled desde JWT claim
- PU-FIX02 — push-notify.ts helper + orders llama fire-and-forget
- Multi-ticket fix — cierre de tab no-activo ahora persiste el activo

---

## BUG CRÍTICO ACTIVO — RESOLVER PRIMERO

### BUG-S26-01 — P0: /pedidos redirige a /escritorio

**Síntoma:** Al navegar a /pedidos el sistema redirige automáticamente a /escritorio.

**Causa identificada:** El middleware de Sprint 26 (MO-FIX02) lee `modules_enabled` del JWT claim. El JWT actual fue generado ANTES de ese cambio y no tiene el claim. El middleware hace fail-close en lugar de fail-open.

**Fix requerido — CLI-A:**
```typescript
// src/middleware.ts
// Cambiar el comportamiento cuando no existe el claim modules_enabled:
// ANTES: si no hay claim → bloquear
// DESPUÉS: si no hay claim → permitir (fail-open)

// Buscar la lógica de MODULE_ROUTES en middleware.ts
// Agregar guard:
const modulesEnabled = token?.modules_enabled as string | undefined
if (!modulesEnabled) {
  // JWT antiguo sin claim — fail-open, permitir todo
  return NextResponse.next()
}
```

**Solución inmediata** (sin tocar código): cerrar sesión y volver a hacer login genera un JWT nuevo con el claim. Pero el fix correcto es fail-open.

---

## BUGS Y DEUDA TÉCNICA PENDIENTE

### P0 — Bloqueantes producción

| ID | Descripción | Archivo | Fix |
|---|---|---|---|
| BUG-S26-01 | /pedidos redirige a /escritorio | middleware.ts | fail-open cuando no hay claim modules_enabled |

### P1 — Importantes

| ID | Descripción | Fix |
|---|---|---|
| S24-F1 parcial | Multi-ticket: tickets 2-5 no persisten el carrito al navegar — solo el ticket 1 | useDraftTabs.ts — PATCH al cambiar de tab |
| PU-FIX02 | Push web no enviado en pedidos catálogo — orders/route.ts llama createNotification pero no sendPush | orders/route.ts → llamar push-notify helper |
| S25-F2 | /businesses y /stats en admin no cubiertos por middleware SUPER_ADMIN_ONLY | middleware.ts → añadir rutas |
| AD04 | /admin/businesses/[id] detail page no existe — 404 | CLI-B crear página |

### P2 — Deuda técnica

| ID | Descripción |
|---|---|
| Botones muertos | Reporte en /productos — eliminado pero sin reemplazo funcional |
| Cambio contraseña | No existe UI para cambiar contraseña de usuario existente |
| Export Excel finanzas | Botón "próximamente" — endpoint existe desde Sprint 18 |
| Impresión etiquetas | Prometido, nunca implementado |
| Historial movimientos inventario | Tabla InventoryEntry existe sin UI de visualización |
| Rango fechas reportes | Solo día/mes — sin rango arbitrario |
| Historial caja anteriores | /caja/historial existe pero sin link visible desde /caja |
| PWA offline | Service Worker existe pero sin sync queue real |

---

## AUDITORÍA MACRO — RESULTADO (completada esta sesión)

CLI-C hizo auditoría funcional completa. Resultado por módulo:

| Módulo | Estado | Bloqueante |
|---|---|---|
| Inventario/Productos | ⚠️ PARCIAL | No — stock se puede ajustar con StockModal |
| POS | ✅ OPERA | — |
| Clientes/CRM | ✅ OPERA | — |
| Caja | ⚠️ PARCIAL | No — flujo del turno completo |
| Pedidos | ⚠️ PARCIAL* | Sí para negocios con catálogo — botón Cobrar implementado Sprint 26 pero BUG-S26-01 bloquea acceso |
| Finanzas | ⚠️ PARCIAL | No — core opera |
| Reportes | ✅ OPERA | — |
| Configuración | ✅ OPERA | — |
| Onboarding | ⚠️ PARCIAL | No — se puede saltar |

*Pedidos ahora tiene botón Cobrar implementado pero el módulo es inaccesible por BUG-S26-01

**Veredicto:** Un negocio puede operar con ActivoPOS en flujo básico (POS + Caja + Reportes). El flujo de catálogo WhatsApp → Cobrar Pedido está bloqueado por BUG-S26-01.

---

## METODOLOGÍA APROBADA (desde Sprint 26)

**La metodología anterior estaba rota.** Se certificaba código sin validación visual. Nueva metodología:

```
CLI-A backend → CLI-B frontend → CARLOS aprueba visual en browser → CLI-D deploy VPS
CLI-C solo cuando Carlos lo pida explícitamente
Sin aprobación visual de Carlos → sin deploy
```

**Skills obligatorios por CLI:**
- CLI-A: /code-review + /security-review + /software-architecture
- CLI-B: /impeccable craft + /frontend-design + /ui-ux-pro-max
- CLI-C: /code-review + /security-review
- CLI-D: /webapp-testing + /impeccable craft

---

## DECISIONES DE PRODUCTO SELLADAS

| Decisión | Valor |
|---|---|
| Sidebar | Siempre blanco #FAFBFC — patrón Fina, borde derecho #E5E7EB |
| Login | Siempre dark navy — fachada de ActivoPOS |
| Fondo dashboard | #E8EEF4 — azul gris suave, no blanco puro |
| Brand color | #0EA5A4 teal — único color de marca dominante |
| CTA | #F97316 naranja — botones de venta, COBRA AHORA |
| Success | #16A34A verde — solo indicadores positivos, diferente al brand |
| Texto principal | #1E3A5F azul petróleo |
| Fuentes | Space Grotesk (display) + system-ui (body) |
| Reportería PDF | Header teal completo, badge blanco, zebra, @media print automático |
| Multi-tenant | Capa 1 ✅ (business_id en tablas) — Capa 2 Sprint 27+ (admin.activopos.com, Next.js, NO Laravel) |
| Tasas cambio | BCV automático + Paralelo + USDT desde dolarapi.com — editable inline en CobroModal |
| Posicionamiento | "ActivoPOS es tu sistema de control de ventas e inventario. No reemplaza tu facturación SENIAT — la complementa." |

---

## STACK SELLADO — NO NEGOCIABLE

```
Next.js 14 + TypeScript strict + CSS Modules + Prisma 7 + MariaDB
NO Laravel. NO Tailwind. NO Filament. NO MySQL genérico.
Lucide React únicamente para iconos.
business_id siempre desde getSession() — NUNCA del body.
Stock descuenta SOLO cuando status='paid'.
Precio siempre desde DB — nunca del body (SEC-01).
```

---

## ROADMAP SPRINT 27+

**Sprint 27 — estabilización y coherencia (PRIORIDAD)**
```
1. Fix BUG-S26-01 — middleware fail-open (P0)
2. Fix multi-ticket tickets 2-5 no persisten
3. Auditoría completa de modales — CLI-C dedicado
4. Export Excel finanzas — activar botón
5. Historial movimientos inventario — UI
6. Push send en pedidos catálogo
7. Admin detail page /admin/businesses/[id]
```

**Sprint 28 — onboarding y activación**
```
1. Wizard con pasos operativos reales
2. Tutorial primera venta
3. Cambio contraseña usuario existente
4. Impresión etiquetas precio
5. Rango fechas arbitrario en reportes
```

**Sprint 29+ — features nuevas**
```
- PWA offline real con IndexedDB sync queue
- KDS (pantalla de cocina) — módulo activable
- Canales de venta / listas de precio
- WhatsApp notificaciones — Twilio
- Landing page activopos.com con SEO por segmento
```

---

## COMPETIDORES ANALIZADOS

| Competidor | Mercado | Diferenciador ellos | Ventaja ActivoPOS |
|---|---|---|---|
| Fina | Venezuela | UI pulida, 158K Instagram | Mostrador-first, dual currency real |
| Negotiale | Venezuela | Facturación SENIAT | POS más completo |
| Control Total | Venezuela | ERP completo | Más simple y ágil |
| Venko | Venezuela | Precio bajo | Más features |
| Pulpos | México | SEO 30 páginas por segmento | Español venezolano + pagos locales |
| Comprapp | Venezuela | APK + offline + marketplace | POS mostrador real |
| Zenifi | Latam | Todo-en-uno $29, KDS, delivery | Dual currency + pagos venezolanos |
| Treinta | Colombia | App móvil simple | Más completo en inventario |

---

## LO QUE NO SE DEBE TOCAR

- `synticorex` — SYNTIweb en producción activa
- `syntimeat` — carnicería Chaguaramas en producción activa
- Rama main sin commit limpio
- git stash en VPS
- npx prisma migrate fresh en producción

---

*Generado: 2026-06-23 | Sesión de 14+ horas | Sprints 17-26*
*Carlos Bolívar — SYNTIdev — ActivoPOS*
