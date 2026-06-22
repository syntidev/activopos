## 0. QUIÉN ES CARLOS Y CÓMO TRABAJAMOS

### Carlos Bolívar — Arquitecto de Software
- 20+ años en banca venezolana. Estratega, no programador.
- Usa voz-a-texto en móvil. Habrá typos — interprétalo bien, no lo corrijas.
- Directo. No acepta halagos. No acepta rodeos. No acepta improvisación.
- Trabaja con plan MAX — tokens ilimitados. No hay razón para cortar sesiones.
- Trabaja hasta cerrar. No se detiene hasta que el hilo está resuelto.

### Regla de oro — CERO FACHADAS
El error más grave que puede cometer un agente: crear código que parece funcionar pero no funciona.
Ejemplos prohibidos:
- Tablas en DB sin lógica conectada
- Botones que no hacen nada
- Endpoints que devuelven mock data
- UI que simula funcionalidad sin backend real
- Módulos "en construcción" sin advertir

Si algo no está completo, DECIRLO EXPLÍCITAMENTE antes de commitear.
Nunca dejar un hilo abierto sin documentarlo en este archivo.

### Cómo trabajamos
- 4 CLIs en paralelo con auto mode activado (Shift+Tab)
- CLI-A: Backend, APIs, Prisma, lógica de negocio
- CLI-B: Frontend, CSS Modules, componentes, animaciones
- CLI-C: Calidad, seguridad, auditoría — solo reporta, corrige solo P0
- CLI-D: Testing E2E, Playwright, verificación visual

### Lo que el agente DEBE hacer en cada sesión
1. Leer este archivo completo antes de cualquier acción
2. Verificar estado del servidor: `curl http://localhost:3000/api/rates/bcv`
3. Si hay hilo abierto en "Próxima acción" — ejecutarlo primero
4. No abrir nuevos frentes sin cerrar los actuales
5. Al terminar: actualizar sección "Estado actual" y "Próxima acción"

### VPS y accesos
- VPS: root@187.124.241.213
- Local: C:\laragon\www\activopos
- Puerto local: 3000 (o 3001 si ocupado)
- Puerto VPS: 3003
- Laragon debe estar corriendo antes de npm run dev

### Si el servidor falla
```powershell
Remove-Item -Recurse -Force .next
npm run dev
```
Esperar `✓ Ready` antes de abrir el browser. Siempre.

### El mandato
Avanzar hasta cerrar. Impulsar siempre hacia adelante.
Si Carlos se detiene, el agente propone el siguiente paso.
Si hay un bug, se resuelve en la misma sesión — no se deja para mañana.
Si hay una decisión pendiente, se señala con claridad y se espera — no se improvisa.
# ACTIVOPOS_MASTER.md
# Documento único de verdad — reemplaza todos los handoffs anteriores
# Última actualización: 17 Junio 2026
# Árbitro: Este archivo. Si hay conflicto con otro doc, este gana.

---

## 1. ESTADO ACTUAL

| Componente | Estado | Notas |
|---|---|---|
| Build local | ✅ Verde | rm -rf .next si falla |
| VPS producción | ✅ Verde | activopos.com |
| Catálogo digital | ✅ Live | activopos.com/catalogo/demo |
| Auth JWT | ✅ Seguro | fail-closed, HS256, rate limiting |
| BCV API | ✅ Live | 596.78 Bs |
| TypeScript | ✅ 0 errores | |
| Último commit | ✅ b0a912e | Sprint 7 completo |

**Primera acción obligatoria cada sesión:**
```bash
# Local
Remove-Item -Recurse -Force .next && npm run dev

# VPS
cd /var/www/activopos && git pull origin main && npx prisma migrate deploy && npm run build && pm2 restart activopos
```

---

## 2. EL ÁRBOL — Arquitectura completa

### RAÍZ (base de datos — ya existe)
`business_id` en todas las tablas. Multi-negocio en DB listo.
ActivoPOS ES multitenant en datos. NO ES multitenant en gestión todavía.

### CAPA 1 — Core operativo (Sprints 1-7, construido)
- ✅ POS — busca por nombre/SKU/barcode, agrega, cobra
- ✅ Inventario — CRUD, variantes, categorías, tabs
- ✅ Caja — apertura, cierre, historial
- ✅ Clientes — lista, CxC
- ✅ Pedidos — Kanban 4 estados
- ✅ Finanzas — CxC, CxP básico, Ingresos/Gastos
- ✅ Catálogo digital — /catalogo/[slug] público
- ✅ Configuración — temas, métodos de pago, ticket, IVA, PIN
- ✅ Dashboard — KPIs, charts, rendimiento por período

### CAPA 2 — Las 3 conversaciones (diferenciadores)

#### C1 — EL ÁRBOL COMPLETO (estrategia)
Lo que falta construir para competir:

**Obligatorio igualar a SOFI:**
- Onboarding fluido — negocio nuevo activa sin tocar código
- Grid inventario con imagen, costo y margen visible directo
- CRM cliente — historial, frecuencia, ticket promedio
- Exportación de reportes (PDF/Excel)

**Diferenciadores propios que nadie tiene:**
- Temas por segmento de negocio (Slate/Sage/Ember + dark/light)
- Multi-ticket paralelo con persistencia (draft en DB)
- Pago Móvil/Zelle/Binance como ciudadanos de primera clase
- "Tu panorama" — orientación financiera en lenguaje humano
- CxP simplificado — "Lo que debes" sin contabilidad formal

#### C2 — MODO VISUAL (decisión pendiente de Carlos)
**Pregunta sin responder:** ¿Dark o light como entrada?

Argumentos dark: fatiga visual reducida, diferenciación total vs competencia, ya construido
Argumentos light: competencia entra en light, percepción de "más fácil", adopción más rápida

**Opciones:**
A) Dark por defecto + toggle visible
B) Light por defecto + toggle visible
C) Onboarding pregunta la preferencia al activar

**Esta decisión bloquea el diseño del catálogo digital y la landing de marketing.**

#### C3 — WHATSAPP + IA (el multiplicador)
**Lo que ya existe:**
- `/api/orders/[id]/whatsapp` con template completo
- Mensaje empaquetado con datos de cobro + BCV real
- n8n instalado en n8n.syntiweb.com

**Lo que falta:**
- Bot que recibe comprobantes y confirma pagos
- IA de insights "Tu panorama" en lenguaje humano
- Flujo completo: catálogo → pedido → WhatsApp → comprobante → confirmación

**Esto convierte ActivoPOS en el único POS venezolano con flujo WhatsApp nativo.**

### CAPA 3 — Multitenant gestión (Sprint 8 — Opus)
Panel admin en `admin.activopos.com` dentro de synticorex.
Opus construye esto — es el único agente con contexto de tenants SYNTIweb.

Portar de synticorex:
- TenantResource Filament v5
- BillingController — flujo "reportar pago"
- Emails transaccionales (trial, vencimiento, activación)
- Impersonation admin→tenant
- Sistema de aliados (opcional en v1)

### CAPA 4 — Inteligencia (Sprint 9-10)
- "Tu panorama" — dashboard habla en lenguaje humano
- Insights por segmento (carnicería vs ferretería vs ropa)
- WhatsApp bot con IA
- CRM predictivo

### CAPA 5 — Escalabilidad (Sprint 11+)
- Sucursales múltiples
- Tienda online completa
- SENIAT (si el mercado lo demanda)

---

## 3. ORDEN DE CONSTRUCCIÓN

```
Sprint 8 (próximo):
  CLI-A: Multitenant onboarding script + campo businesses.segment completo
  CLI-B: C2 decidida → aplicar modo visual correcto globalmente
  CLI-C: Grid inventario con imagen/costo/margen
  CLI-D: CRM cliente — perfil con historial y métricas

Sprint 9:
  CLI-A: WhatsApp bot básico con n8n
  CLI-B: "Tu panorama" — componente de orientación financiera
  CLI-C: Exportación reportes PDF/Excel
  CLI-D: Multi-ticket paralelo con persistencia

Sprint 10 (Opus — sesión aislada):
  Admin panel Filament v5 en admin.activopos.com
```

---

## 4. DECISIONES SELLADAS — NO TOCAR

- Stack: Next.js 14 + TypeScript strict + CSS Modules + Prisma 7 + MariaDB
- CSS Modules únicamente — cero Tailwind
- Lucide React únicamente — cero emojis en UI
- Zod v4: usar `.issues` NO `.errors`
- Prisma 7: datasource url, NO datasourceUrl
- TypeScript strict — cero `any`
- business_id siempre desde getSession() — nunca del body
- Stock descuenta SOLO cuando status='paid'
- Sidebar siempre oscuro en dark Y light
- Sin multitenancy en UI en v1 — un negocio = una instalación activa
- Venta: qty × price — NUNCA monto→qty
- NUNCA tocar synticorex (SYNTIweb) ni syntimeat — son producción activa
- Fraunces como display typeface
- Opus construye el admin panel — ningún otro agente lo toca

---

## 5. REGLAS PARA TODOS LOS AGENTES

1. Lee este archivo ANTES de cualquier acción
2. Si hay conflicto con otro documento, este gana
3. No improvisar arquitectura — consultar decisiones selladas
4. No tocar synticorex ni syntimeat bajo ninguna circunstancia
5. Cada CLI tiene scope exclusivo — no invadir el de otro
6. Build limpio obligatorio antes de commit
7. Commit con bloque estándar al terminar cada tarea
8. Si algo no está claro, reportar — no asumir
9. C2 (modo visual) está PENDIENTE — no tomar decisiones de color hasta que Carlos decida
10. El Admin panel es territorio exclusivo de Opus

---

## 6. ANÁLISIS COMPETITIVO — REFERENCIA

| Competidor | Precio entrada | Fortaleza | Debilidad |
|---|---|---|---|
| SOFI | $15/mes | IA incluida, onboarding fácil | Sin dark, sin contexto VE, 1 usuario en Pro |
| Fina | ~$30/mes | Grid productos, diseño limpio | Sin dark, sin WhatsApp nativo |
| Venko | N/D | Reconocimiento de marca | Genérico, sin contexto VE |
| Control Total | N/D | Completo | Complejo, viejo |
| Negotiale | N/D | Verde, conocido | Sin POS real |

**Nuestro territorio:** Dark mode + contexto venezolano + WhatsApp nativo + temas por segmento

---

## 7. STACK Y ACCESOS

| Item | Valor |
|---|---|
| Local | C:\laragon\www\activopos |
| VPS | 187.124.241.213 |
| Producción | activopos.com |
| Catálogo demo | activopos.com/catalogo/demo |
| Admin (futuro) | admin.activopos.com |
| GitHub | syntidev/activopos |
| BCV API | ve.dolarapi.com/v1/dolares/oficial |
| Seeds | admin@activopos.com/admin123 · cajero@activopos.com/cajero123 |
| n8n | n8n.syntiweb.com (instalado, no conectado a ActivoPOS) |

---

## 8. PRÓXIMA ACCIÓN — UNA SOLA

**Resolver C2 (modo visual) antes de continuar.**

Esta decisión desbloquea el diseño del catálogo, la landing de marketing, y el onboarding. Sin ella los CLIs van a construir sobre una base visual que puede cambiar.

Carlos decide: A, B, o C (ver sección C2 arriba).


---

## 9. INTELIGENCIA COMPETITIVA — IDEAS CAPTURADAS

### Fina (fina.partner) — observaciones de reels

**Toggle Abrir/Cerrar Caja en el header** — Sprint 8 CLI-B
Un toggle visible desde cualquier pantalla. Sin navegar a Gestión de Caja.
- Caja cerrada: toggle apagado, POS no deja vender
- Caja abierta: toggle verde, modal mínimo con monto inicial
- Elimina "Gestión de Caja" del sidebar como operación — pasa a ser historial

**Grid de productos en el POS** — Sprint 8 CLI-B
Cards visuales con imagen, nombre, precio y badge "Agotado".
Toggle lista/grid: lista para volumen alto, grid para catálogo pequeño.
Fina solo tiene grid — nosotros tenemos ambos = diferenciador.

**"Recientes" en el POS** — Sprint 8 CLI-A
Los productos más usados aparecen primero sin buscar.
Implementar: últimos 8 productos vendidos en la sesión activa.

**Tabs de categorías horizontales en POS** — Sprint 8 CLI-B
Todo · Categoría1 · Categoría2 — scroll horizontal sin scrollbar visible.
Ya documentado para inventario — extender al POS también.

**"Invita y gana"** — NO implementar
Fina tiene CTA de referidos dentro del sidebar. Ruido visual.
ActivoPOS no lo necesita en v1.

### SOFI (sofiadmin.com) — análisis de pricing y funciones

**Pricing SOFI:**
- Gratis: 50 productos, 1 usuario, sin IA
- Pro $15/mes: ilimitado, 1 usuario, IA 500 consultas, WhatsApp
- Business $29/mes: usuarios ilimitados, IA ilimitada

**Trampas de SOFI que son oportunidades:**
- "1 usuario" en Pro — cajero + dueño = $29 obligatorio
- IA genérica, no contextual a Venezuela
- Sin dark mode
- WhatsApp como add-on, no como core

**SOFI Intelligence** — el diferenciador que más duele
Insights en lenguaje humano: "Considera aumentar precio de Jabón Azul — 100% más ventas esta semana"
Nuestro equivalente: "Tu Día" — narrativa de cierre de jornada
Sprint 9-10.

### Decisiones de diseño tomadas en esta sesión

**C2 RESUELTA:** Light mode como entrada por defecto. Dark disponible con toggle.
**Variante 3 aprobada:** Gradiente en borde (border-box) para cards secundarias en ambos modos.
**Hero card:** Siempre azul #2563EB — nunca cambia con el selector de tema.
**Selector de tema:** Solo cambia data-theme="light"|"dark" — NUNCA toca variables CSS inline.

### Plugins oficiales Claude Code — usar en todos los prompts

Proyecto:
- /ui-ux-pro-max (skills-dir)

Oficiales Anthropic (prioridad):
- /code-review
- /frontend-design
- /playwright
- /security-guidance
- /superpowers

Complementarios (siempre incluir en CLI-B):
- /impeccable craft — el estándar de polish, Emil Kowalski
- /ui-ux-pro-max
- /frontend-design


---

## 10. SKILLS Y PLUGINS — REGLA IRROMPIBLE

Todo prompt de CLI DEBE incluir los skills correspondientes antes de cualquier código.
Sin skills = prompt inválido. No se ejecuta.

### Plugins oficiales instalados (Claude Code)

**Proyecto:**
- `ui-ux-pro-max` — skills-dir (especializado ActivoPOS)

**Oficiales Anthropic:**
- `/code-review` — revisión de código
- `/frontend-design` — diseño frontend
- `/playwright` — testing E2E
- `/security-guidance` — auditoría de seguridad
- `/superpowers` — productividad general
- `/pyright-lsp` — verificación de tipos Python

### Skills complementarios instalados localmente

- `/impeccable craft` — estándar de polish Emil Kowalski — EL MÁS IMPORTANTE para CLI-B
- `/emil-design-eng` — filosofía de micro-interacciones y animaciones naturales
- `/software-architecture` — decisiones arquitecturales

### Asignación por CLI — OBLIGATORIA

**CLI-A (Backend):**
```
/code-review
/security-guidance
/software-architecture
```

**CLI-B (Frontend):**
```
/impeccable craft
/frontend-design
/ui-ux-pro-max
```

**CLI-C (Calidad):**
```
/code-review
/security-guidance
```

**CLI-D (Features/Testing):**
```
/playwright
/impeccable craft
/frontend-design
```

### Nota sobre /impeccable

Es el skill más citado en la comunidad de Claude Code.
No solo genera código bonito — genera interfaces que SE SIENTEN bien.
Micro-interacciones, timing de animaciones, feedback táctil.
Ningún plugin oficial lo reemplaza.
Siempre incluirlo en CLI-B y CLI-D.


---

## 11. SISTEMA DE TEMAS — 10 SEGMENTOS

### Base técnica (HTML activopos_temas.html — aprobado por Carlos)
4 temas base implementados como data-theme en tokens.css:
- `default` — Retail azul clásico
- `premium` — Dark profundo operativo  
- `calle` — Naranja urbano / carnicería
- `tropical` — Teal tech digital

### 10 segmentos objetivo (Sprint 9 — CLI-A)
Cada segmento tiene su data-theme propio con variables completas:

| Segmento | Key | Color brand | Industria |
|---|---|---|---|
| Retail & Comercio | default | #2563EB azul | Tiendas generales |
| Premium Operativo | premium | #2563EB azul dark | Negocios premium |
| Calle Premium | calle | #EA580C naranja | Carnicerías, abastos |
| Tech & Digital | tropical | #14B8A6 teal | Tecnología |
| Clínica & Salud | clinica | #10B981 verde menta | Farmacias, clínicas |
| Ferretería | ferreteria | #D97706 amarillo oscuro | Ferreterías, construcción |
| Servicios & Oficina | oficina | #6366F1 índigo | Oficinas, servicios pro |
| Gastronomía | restaurante | #DC2626 rojo cálido | Restaurantes, food |
| Moda & Joyería | joyeria | #B45309 dorado | Joyerías, ropa |
| Farmacia | farmacia | #059669 verde limpio | Farmacias, bienestar |

### Implementación
- `businesses.theme` guarda el key del segmento
- `layout.tsx` lee el tema y aplica `data-theme` al `<html>`
- `tokens.css` tiene un bloque `[data-theme="X"]` por cada segmento
- El selector en Configuración → Tema Visual muestra los 10 con preview
- El inline script en layout.tsx permite override del usuario via localStorage

---

## 12. LANDING SEO POR SEGMENTO — Aprobada post-lanzamiento

### Estrategia
Una página de aterrizaje por segmento para captura orgánica.
Modelo: Pulpos tiene `/pos-para-carniceria`, `/pos-para-ferreterias`, etc.

### URLs objetivo para ActivoPOS
- activopos.com/para-carniceria
- activopos.com/para-ferreterias
- activopos.com/para-restaurantes
- activopos.com/para-clinicas
- activopos.com/para-farmacias
- activopos.com/para-joyerias
- activopos.com/para-tecnologia
- activopos.com/para-servicios
- activopos.com/para-tiendas-de-ropa
- activopos.com/para-abastos

### Contenido por página
- Hero con captura del sistema en el tema del segmento
- Beneficios específicos para esa industria
- Testimonios del segmento (cuando existan)
- CTA directo a registro/contacto
- Schema.org SoftwareApplication markup
- Keywords long-tail del segmento + Venezuela

### Este desarrollo es independiente del POS
- Stack: Next.js (mismo repo) o sitio estático separado
- No tiene dependencia con el dashboard
- Se construye cuando haya al menos 2-3 clientes reales por segmento
- **Estrategia aprobada Sprint 21 — ejecutar post-lanzamiento con clientes reales**

---

## 13. CATÁLOGO DIGITAL — FLUJO COMPLETO (Sprint 8, completado)

### Flujo aprobado (modelo LLEVA.app)
1. Cliente navega `/catalogo/[slug]`
2. Ve productos con buscador en tiempo real + tabs de categorías
3. Hace clic en producto → modal con galería + variantes + qty
4. Agrega al carrito → drawer lateral "Mi Pedido"
5. "Finalizar por WhatsApp" → modal "Antes de enviar"
   - Nombre (requerido)
   - WhatsApp cliente (requerido)
   - Referencia/Sector (opcional)
   - Método de pago (dropdown)
6. POST `/api/catalog/[slug]/order` → crea Order en DB
7. WhatsApp se abre con mensaje empaquetado + BCV real
8. El pedido aparece en el Kanban del negocio bajo source='catalog'

### Seguridad implementada
- Precios vienen del servidor (DB), nunca del cliente
- Price tampering imposible (Zod descarta price_usd del body)
- Endpoint público agregado a PUBLIC_PREFIXES del middleware

### Diferenciador vs FINA y SOFI
- Carrito completo empaquetado en WhatsApp (ellos solo producto individual)
- Precio en Bs calculado con BCV en tiempo real al momento del envío
- Pedido registrado en DB automáticamente sin intervención del negocio

---

## 14. DECISIONES SPRINT 21 — SELLADAS

### Frase de posicionamiento (aprobada Sprint 21)

> "ActivoPOS es tu sistema de control de ventas e inventario. No reemplaza tu facturación SENIAT — la complementa."

- Usar en landing, onboarding, materiales de venta, y documentación pública
- No mezclar con terminología SENIAT/fiscal — ActivoPOS NO es un sistema de facturación
- Contexto: el venezolano tiende a confundir POS con sistema de facturación tributaria; esta frase destruye esa confusión de entrada

### Estándar de reportería (aprobado Sprint 21)

- **Header:** teal (`var(--color-brand)`) en todos los reportes exportados
- **Print:** `@media print` implementado — reportes renderizan correctamente al imprimir/PDF
- **Colorimetría sellada:** los reportes usan únicamente tokens del sistema visual; cero hex hardcodeados
- Este estándar aplica a: `/reportes`, `/finanzas`, y cualquier módulo futuro con exportación

### SEO por segmento (estrategia aprobada Sprint 21)

- Estrategia de landing pages por segmento documentada en §12 de este documento
- **Decisión:** ejecutar post-lanzamiento, cuando haya al menos 2-3 clientes reales por segmento
- No bloquear desarrollo del POS por esta estrategia — son caminos paralelos

*Decisiones registradas: 2026-06-22 | Sprint 21 | CLI-D*

---

## 15. PLAN MAESTRO SPRINT 22-26

### Bloque A — Infraestructura base (Sprint 22)
- A1: due_date en Sale + crédito reforzado (migración add_sale_due_date)
- A2: Notification tabla central — bus de alertas (migración add_notifications)
- A3: Tasa editable por transacción en CobroModal (BCV + paralelo + USDT)

### Bloque B — Módulos incompletos (Sprint 22-23)
- B1: CxC/CxP completo con filtros vigente/por vencer/vencido + badge sidebar
- B2: Modal crédito con presets 7/14/21/30 días + due_date obligatorio
- B3: Reportería PDF estándar aprobado (header teal, @media print, colorimetría sellada)
- B4: Multi-ticket paralelo en POS (Sale status='draft', máx 5 tabs)

### Bloque C — Notificaciones (Sprint 23)
- C1: Web Push pedidos entrantes (SW ya existe — extender)
- C2: Job alertas CxC vencidas (n8n o node-cron diario)
- C3: WhatsApp notificaciones — Twilio, template crédito vencido

### Bloque D — PWA offline + Canales (Sprint 24)
- D1: PWA offline real (IndexedDB + sync queue al reconectar)
- D2: Listas de precio por canal (retail / wholesale / catalog)

### Bloque E — Admin multitenant (Sprint 25)
- Capa 1 ya existe: business_id en todas las tablas — multitenant en datos ✅
- Capa 2 (falta): admin.activopos.com — Filament v5 en repo separado
- Territorio exclusivo: Opus. Ningún otro agente lo toca.

### Bloque F — Polish + Temas cliente (Sprint 26)
- 10 temas venezolanos implementados server-side por business.theme
- Tu Día: narrativa inteligente de cierre de jornada
- Auditoría WCAG completa

### Bugs documentados Sprint 22 (prioridad de ejecución)
| ID     | Sev | Descripción                                               |
|--------|-----|-----------------------------------------------------------|
| BUG-01 | P0  | Pago mixto no calcula vuelto — CobroModal.tsx             |
| BUG-02 | P1  | Pedidos móvil pantalla blanca — NuevoPedidoModal z-index  |
| BUG-03 | P1  | CxC heurístico 30 días sin due_date — resumen/route.ts:132|
| BUG-04 | P2  | parsePeriod() triplicado en finanzas — extraer a lib/     |
| BUG-05 | P2  | raw SQL tasa BCV con fallback '36.50' hardcodeado         |

### Posicionamiento sellado
"ActivoPOS es tu sistema de control de ventas e inventario.
No reemplaza tu facturación SENIAT — la complementa."

*Plan registrado: 2026-06-21 | Sesión Claude Web + CLI-D | Sprint 22-26*

