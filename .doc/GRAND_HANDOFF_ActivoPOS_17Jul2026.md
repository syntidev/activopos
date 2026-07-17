# GRAND HANDOFF — ActivoPOS
# Compilado: 17 Julio 2026, cierre de sesión | Por: Claude Web
# Fuentes: sesión completa de hoy · GRAND_HANDOFF_ActivoPOS_v2_14Jul2026.md · cimaad-protocol.md ·
# SYSTEM_MAP.md · ADN_ActivoPOS_v1.md
# Regla de lectura: prioridad real, no cronológica. P0 = bloquea negocio. P1 = bloquea confianza.
# P2 = mejora, sin urgencia. Ningún ítem se cierra por "el CLI dijo que ya está" — se cierra
# cuando Carlos lo vio funcionar en pantalla, con datos reales, flujo completo.

---

## 0. LEE ESTO ANTES DE HACER CUALQUIER COSA

Este documento ES el handoff Y el pase de bienvenida. No hay documento separado.

### Quién es Carlos — reglas de interacción

Carlos Bolívar — arquitecto de software, 20+ años en banca venezolana. No programa —
orquesta. Los CLIs ejecutan, Claude Web coordina.

- Usa voz-a-texto en móvil → typos normales → interpretar contexto, nunca corregir la persona
- Directo, sin halagos, sin rodeos, sin improvisación
- No acepta preguntas múltiples ni opciones para elegir — una pregunta, sí/no
- Si te equivocas, lo dirá con fuerza (a veces con groserías) — corrige y sigue, sin auto-flagelarte
- Vive en Venezuela → cortes eléctricos reales → sesiones se cortan sin aviso, trabaja de noche
  a veces por esto
- Cuando dice "ya" es ahora, sin más preguntas
- **Es la fuente de verdad** — si reporta un bug sin captura, se le cree y se verifica en código/
  browser directo, no se le pide "prueba que es así"

**Regla de oro:** CERO FACHADAS. Código que parece funcionar pero no funciona es el peor error
posible. Si algo no está completo, se dice antes de commitear — nunca se declara "listo" sin
verificación real (curl, SQL directo, click-through en browser).

**Regla nueva de hoy — evitar sobre-generación de prompts:** Claude Web NO genera un prompt
nuevo por cada mensaje de Carlos. Solo arma prompt cuando Carlos lo pide explícito, o cuando hay
coordinación real entre varios CLIs que lo requiere. Si un CLI le pregunta algo directo a Carlos,
Carlos le responde a ese CLI directo — Claude Web no necesita re-intermediar.

**Regla nueva de hoy — todo prompt lleva esta línea:** "Ejecuta EXACTO lo pedido, sin agregar,
quitar o interpretar libremente. Si algo no está claro, pregunta antes de asumir — no ejecutes a
medias ni cambies el alcance."

---

## 1. CÓMO ARRANCAR — OBLIGATORIO EN ESTE ORDEN

### Paso 1 — Leer:
```
CLAUDE.md (raíz del repo)                ← gobernanza absoluta, irrompible
.doc/SYSTEM_MAP.md                       ← estado real del sistema
.doc/ADN_ActivoPOS_v1.md                 ← reglas de negocio selladas
.doc/cimaad-protocol.md                  ← protocolo multi-agente, skills, commits
.doc/PLAN_MAESTRO_DeudaTecnica_12dias.md ← deuda técnica histórica aún viva
Este documento                           ← lo que se hizo/quedó pendiente hoy
```

### Paso 2 — Verificar repo local:
```powershell
cd C:\laragon\www\activopos
git log --oneline -25
git status
npx tsc --noEmit 2>&1 | Select-String "error" | Measure-Object
```

### Paso 3 — Verificar VPS:
```bash
ssh -i C:\Users\carbo\.ssh\id_ed25519 root@187.124.241.213
cd /var/www/activopos
git log --oneline -10
pm2 status
curl -I https://activopos.com
curl -I https://activopos.com/catalogo/multi-demo
```

**Primera tarea real de mañana: confirmar que el deploy de cierre de hoy (login + carrito
compartido + IVA desconectado + flex-wrap categorías + "Pedir Ahora") efectivamente llegó a
producción.** Carlos confirmó verbalmente que se ejecutó, commiteó y compiló, pero esta sesión
no cerró con una verificación cruzada de Claude Web contra el VPS real — es lo primero que hay
que confirmar, no asumir.

---

## 2. PROTOCOLO MULTI-AGENTE CIMAAD

| CLI | Rol | Skills obligatorios |
|---|---|---|
| CLI-A | Backend: APIs, Prisma, lógica de negocio, migraciones | `/instinct-status` `/code-review` `/security-review` `/api-design` `/software-architecture` `/database-migrations` `/deployment-patterns` `/ponytail ultra` |
| CLI-B | Frontend: componentes, CSS Modules, animaciones | `/instinct-status` `/impeccable craft` `/frontend-design:frontend-design` `/ui-ux-pro-max:ui-ux-pro-max` `/coding-standards` `/ponytail ultra` |
| CLI-C | Calidad: solo lee y reporta, corrige P0 únicamente | `/instinct-status` `/code-review` `/security-review` → agents: typescript-reviewer, security-reviewer |
| CLI-D | Features/Testing: módulos nuevos, Playwright E2E | `/instinct-status` `/e2e-testing` `/impeccable craft` `/frontend-design:frontend-design` → agent: e2e-runner |
| Opus (CLI-E) | Alto riesgo: seguridad, auth, dinero, arquitectura cross-cutting | Mismo set que CLI-A + reservado para lo que Claude Web marque explícito |
| Claude Web | Coordinador — genera prompts, sintetiza, NO ejecuta código | — |

**Skill nuevo agregado hoy, incluir de ahora en adelante en TODO prompt:**
`full-output-enforcement` — entrega completa, sin recortes ni placeholders ("...resto sigue
igual" prohibido).

### Reglas de scope (irrompibles)
- CLI-B nunca toca APIs ni lógica de negocio
- CLI-A nunca toca CSS ni componentes UI
- Bug fuera de scope → documentar en 1 línea, NO corregir sin autorización
- Agentes en paralelo SOLO en archivos no conflictivos — verificar `git status` antes de
  commitear si hubo trabajo simultáneo (patrón usado repetidamente hoy con éxito)

### Graphify — obligatorio antes de tocar archivos
```
graphify query "[qué conecta X con Y]"
graphify explain "[componente]"
graphify update .   ← al finalizar, post-commit
```

### Deploy — secuencia estándar (usada ~8 veces hoy, siempre funcionó)
```bash
cd /var/www/activopos
git fetch origin
git reset --hard origin/main
npm install --legacy-peer-deps
npx prisma generate
npx prisma db push          # NUNCA migrate deploy en VPS
rm -rf .next
npm run build
fuser -k 3003/tcp           # limpia procesos zombie del puerto (causó 502 hoy)
pm2 restart activopos --update-env
sleep 5
curl -I https://activopos.com
```

**Lección de hoy:** después de `pm2 restart`, el primer `curl` puede devolver
`x-nextjs-cache: STALE` — es normal, esperar 10-15s y repetir antes de asumir que algo falló.

**Lección de hoy #2:** si el sitio devuelve `502`, verificar puerto zombie ANTES que cualquier
otra cosa: `fuser -k 3003/tcp` casi siempre lo resuelve — un crash-loop de PM2 puede dejar un
proceso huérfano ocupando el puerto.

### Commits
```bash
git add [archivos específicos — nunca git add . ciego]
git commit -m "tipo(scope): descripción

- Modificado: [archivo] → [qué cambió]
- Verificado: [check específico real]

Agente: CLI-X | Fecha: YYYY-MM-DD"
git push origin main
```

---

## 3. REGLAS DE NEGOCIO SELLADAS (no reabrir sin autorización explícita)

- Stack: Next.js 14 + TypeScript strict + CSS Modules + Prisma 7 + MariaDB — CERO Tailwind
- `business_id` siempre de `getSession()`, nunca del body
- Precio del servidor siempre — anti price-tampering
- Stock descuenta solo con `status='paid'` o `'credit'`
- Venta: `qty × price`, nunca `monto → qty`
- Debt anchors en USD, Bs se calcula dinámico desde tasa activa al momento de display/pago
- Login: dark navy **solo como acento** (franja superior), NO fondo dominante — decisión de
  hoy, reemplaza la regla vieja de "navy sólido"
- Onboarding/registro: misma estética clara que login — confirmado hoy, 6ta vez que Carlos lo
  pidió, es definitivo
- Catálogo: siempre light mode, `--biz-color` del tenant
- Paleta: Persian Blue `#0038BD` primario · Ámbar `#EF8E01` **solo CTA, máx 2 por página** ·
  Navy `#0D1B2E` **solo Hero + Footer + acento de login** · Sand `#FBF3E7`
- Ghost icon (marca de agua sutil) es firma de marca obligatoria en TODA card de contenido —
  regla documentada hoy en `DESIGN_SYSTEM.md §3`, con excepción para stat-grids muy densos
- Módulo social: **sin `business_id`** — es contenido de marca ActivoPOS, no multi-tenant
  (decisión revertida explícitamente hoy tras error de diseño inicial)
- SENIAT nunca aparece en ningún contexto de marca/marketing
- Voseo prohibido — tuteo venezolano únicamente

---

## 4. CERRADO Y VERIFICADO HOY (17 julio) — no reabrir sin motivo real

### Seguridad
- `price_tier` guard verificado con bypass curl real (403 confirmado)
- `JWT_SECRET` rotado, verificado en 4 capas (firma, rechazo de secrets viejos, login real,
  integridad de otras keys)
- DT-03 (Proveedores moduleKey) cerrado y confirmado visualmente
- DT-18 (tasa BCV / "árbitro") — 20 call-sites migrados `getBcvRate()`→`getActiveRate()`,
  ejecutado por Opus, **certificado independientemente por CLI-C** con evidencia SQL propia
  (tasa manual $780.86 vs BCV $725.747, aislamiento entre tenants confirmado)
- IVA: toggle desconectado en 6 archivos (código preservado, comentado, no borrado) — commit
  `df49f60`. Bug colateral encontrado y corregido: línea "IVA (0%): $0.00" se imprimía siempre
  en tickets reimpresos, sin condicional

### Módulo social — completo, A→E + UI
- Fase A: storage a Cloudinary (reemplaza filesystem local, causa raíz del bug de imágenes
  invisibles resuelta de origen)
- Fase B: motor de texto→HTML (Nemotron/Gemini), tipografía Fraunces+DM Sans corregida
- Fase C: Puppeteer→PNG→Cloudinary, libs de Chromium instaladas y verificadas en VPS real
- Fase D: calendario de contenido (CRUD, import/export Excel, sin `business_id`)
- Fase E: publicación real vía Buffer GraphQL, multi-canal (Instagram `6a5721ed80cc80cdcab9209c`
  + Facebook `6a5730b680cc80cdcab9804d`), personal key nueva, verificado con post real en cola
- UI wiring completo: generador conectado a B→C→E, botón Publicar con modal, distinción visual
  Carrusel HTML vs Imagen
- 26 presets de escena (personaje/lugar/acción) con fenotipo y género corregidos y variados
  (52 filas, 2 por segmento, selección aleatoria) — foco en comercio popular venezolano real,
  no perfiles profesionales fuera de target
- 3 presets de estilo (Default, Alto contraste Persian Blue+Ámbar, Claro editorial)
- Puente Calendario→Generador (pre-fill de campos al click "Usar")
- CRUD de borrado del historial de "Generados"
- Dirección de escena real (personaje/escena/acción como campos del formulario) + selector de
  dimensiones (1:1/4:5/3:4/9:16, auto-formateo por tipo de contenido) + preview mobile
- Bug de fondo resuelto: Service Worker con caché nunca invalidada desde Sprint 24 —
  `CACHE_NAME v1→v2` + reload automático al tomar control (causa real de "no aparecen los
  presets" que costó ~15 prompts diagnosticar)
- Plantilla Excel del calendario sincronizada al schema real (sin vestigios de Socialia)
- 9 posts iniciales generados y cargados para la cuenta en cero (mix post/carrusel/reel/story,
  dolor+beneficio, sin precios, anclados a features reales)

### Marketing / Landing
- Consolidación 14→8 secciones, cero mensaje perdido (mapeado explícito), nueva página
  `/como-funciona`, links nav/footer que apuntaban a ancla inexistente corregidos
- Sección PAIN nueva, cada dolor con feature real de respaldo verificable
- Facebook agregado en footer, contacto, JSON-LD, llms.txt (link real:
  facebook.com/activopos)
- FeatureListBentoSection: fix de overflow interno (min-height vs height fija), conversión a
  masonry real (patrón ladrillo/stretcher bond, offset permanente vía margin-left negativo)
- `/planes` unificado al mismo componente `PricingSection` de home — elimina duplicación y
  link circular
- Ámbar limitado a 2 CTA reales por página (badge "Más popular" es excepción documentada,
  no CTA)
- Morado eliminado por completo del sitio (era vestigio de paleta SYNTIweb)

### Login / Registro / Auth
- Login rediseñado: card flotante, fondo claro, navy solo como franja de acento, mosaico con
  BCV en vivo (celda prioritaria) + fotos reales de `public/segments/` + tips reales del
  producto (verificados contra código, no inventados) — aprobado por Carlos
- `/registro` unificado a la misma estética (causa raíz: usaba tokens del dashboard oscuro en
  vez de tokens de marketing — corregido sin tocar el sistema de tokens del dashboard)
- Nav: botón duplicado "Iniciar sesión"/"Ingresar" apuntando ambos a `/login` fuera de páginas
  de segmento — corregido (ternario `isSegmentPage` colapsado)
- Redirect automático a dashboard si usuario ya logueado cae en `/login` o `/registro`

### Catálogo público
- Checkout dejó de fallar en silencio — errores reales (409 stock, red, falta de teléfono)
  ahora visibles al cliente
- Feedback visual del carrito: 3 estados (vacío atenuado, badge con conteo, bump fuerte al
  agregar)
- Fallback de imagen en círculos de categoría sin foto (usa producto destacado)
- **Bug arquitectónico real encontrado y resuelto:** el carrito solo existía dentro de
  `CatalogoGrid` (home) — las rutas `/productos` y `/p/[id]` no tenían carrito en absoluto.
  Refactor completo: `CartContext` + provider compartido en layout de `catalogo/[slug]/`,
  persistido en localStorage, `CartDrawer`/`CartHeaderButton` extraídos y reutilizados en las
  3 rutas — commit `4a7c349`
- Botón "Pedir Ahora" corregido (según reporte verbal de Carlos: corrido, commiteado,
  compilado — **pendiente de que Claude Web lo confirme contra código/VPS real mañana**, no
  fue verificado cruzado en esta sesión)
- Fix de `flex-wrap: nowrap → wrap` en categorías (confirmado con JS directo en el DOM de
  producción que el problema era real) — commit `2d2683d`

---

## 5. P0 — PENDIENTE, BLOQUEA NEGOCIO REAL

### 5.1 Confirmar que el deploy de cierre de hoy llegó completo a producción
Carlos reportó verbalmente que el fix de "Pedir Ahora" se corrió, commiteó y compiló — nunca
se verificó cruzado contra el VPS en esta sesión. Primera tarea de mañana.

### 5.2 Usuarios y Roles — matriz completa de permisos
**Carlos, textual, sesión anterior:** *"Ya he pasado por este trauma antes y los agentes saltan
código y no parametrizan bien las funciones, solo hacen la fachada."*
No se tocó en la sesión de hoy (verificado: ningún prompt de hoy mencionó roles/permisos más
allá del guard de `price_tier` ya certificado). Requiere Opus específicamente, con matriz de
permisos explícita revisada por Carlos ANTES de tocar código — no delegar a un CLI de turno.

### 5.3 Sistema de facturación/suscripción — pieza nueva grande, acordada para mañana
Carlos quiere: un tenant propio de ActivoPOS dentro del mismo sistema (dogfooding), cada
tenant-cliente = "Cliente" (aprovecha CxC existente), cada Plan = "Producto" (aprovecha
catálogo), registro de pago manual como "Venta" (sin cobro automático — Carlos confirmó
explícito que NO va a implementar pasarela de pago), recibo por correo en vez de ticket físico
(mismo patrón SMTP/PDF que ya usa el reporte mensual), correos automáticos de vencimiento
(aprovechando `subscription_expires_at` ya existente en schema).

### 5.4 Flujo de registro + SMTP + alerta de nuevo usuario
Nunca verificado end-to-end en ninguna sesión — si alguien se registra hoy desde la landing, no
hay confirmación de que Carlos se entere ni de que el usuario reciba correo real.

### 5.5 IVA — decisión de negocio pendiente sobre implementación real
El toggle quedó desconectado (visualmente oculto, riesgo fiscal eliminado), pero **no existe
implementación real de cobro de impuesto** (no hay columna en `Sale`/`SaleItem`, no hay reporte
de IVA recaudado). Si Carlos decide que algún cliente sí necesita cobrar IVA de verdad, es
construcción desde cero, no reactivar el toggle existente.

---

## 6. P1 — CRÍTICO, TRATAMIENTO ESPECIAL

### 6.1 Deuda contable real (Finanzas) — de `PLAN_MAESTRO_DeudaTecnica_12dias.md`, aún viva
- `Gasto` sin `purchase_id` — deuda huérfana si se anula la compra
- Compra a crédito no suma stock — requiere decisión de modelo de negocio antes de código
- Doble conteo COGS/OPEX en compras a crédito — utilidad neta puede estar subestimada
- `access_catalog`/`access_ai` sin guardia de plan completa (trial se salta el límite en 2 de 5
  acciones)

### 6.2 Configuración → Catálogo, campos sin UI de edición post-registro
`catalog_desc` (y probablemente `catalog_title`, `catalog_hours`, `catalog_instagram`) solo se
escriben una vez durante el registro — sin formulario de edición posterior. Carlos confirmó
que se debe construir: campo editable + toggle de activación + fallback automático basado en
segmento cuando esté vacío. **No se confirmó si se ejecutó en esta sesión** — verificar contra
código antes de asumir cualquiera de las dos cosas.

### 6.3 Selector de variantes en `ProductoDetalle` — solo 1 dimensión
Bug preexistente encontrado hoy durante el refactor del carrito: un producto con Talla+Color no
puede tener ambas seleccionadas a la vez (seleccionar Color pisa Talla). `CatalogoGrid` sí
maneja combinación de variantes correctamente; `ProductoDetalle` nunca lo tuvo. No tocado, fuera
de scope de la tarea que lo encontró.

### 6.4 Homologación visual completa — parcial, verificar qué falta
Se corrigió: FeatureList (ghost icons, overflow, masonry), Pain (ámbar en vez de Sand por
petición explícita, daltonismo mencionado y luego descartado como motivo real), footer wordmark
(contraste subido). **No confirmado si se completó:** estrellas de rating en catálogo, cards
2-columnas en mobile del catálogo (el prompt se mandó, resultado no llegó a confirmarse en esta
sesión), homologación de `/contacto`, `/nosotros`, blog.

---

## 7. P2 — MEJORA, SIN URGENCIA

- Export de Finanzas muestra "¡Listo!" con `setTimeout`, no confirma descarga real
- CxC: conteo de facturas trunca a 100, diverge del total mostrado
- Tenant `QA Test Registro SPRINT50` sigue en producción sin limpiar
- Encoding roto en PDF de cotizaciones — nunca confirmado como resuelto
- Import del calendario social ignora la columna `content_engine` real (siempre queda
  `'manual'` en DB, sin importar lo que diga el Excel) — reportado, no corregido
- `seed-scene-presets.ts` — verificar que quedó 100% sincronizado con los 26 reales tras las
  últimas correcciones de género (se hizo una vez, puede haber quedado desactualizado con la
  última ronda de cambios de género explícito)
- Auditoría IVA reveló 21 archivos con referencias reales a IVA — confirmar que los 6
  modificados hoy cubren todos los puntos de exposición visual, no quedó ninguno suelto

---

## 8. HALLAZGOS DE INFRAESTRUCTURA — anotados, sin acción pendiente inmediata

- `root` sin password en MariaDB, compartida entre 3 proyectos del VPS (activopos,
  protegecolitas, sportbar) — riesgo lateral, decisión antigua, no revisitada
- Secret JWT viejo sigue en historial de git — `git filter-repo` es destructivo, decisión de
  Carlos pendiente, no urgente (secret ya rotado, valor viejo es inservible)
- `dotenv@17.4.2` imprime un tip aleatorio al cargar `.env` que menciona un dominio no oficial
  — confirmado que es solo un `console.log` del paquete real, sin código de red, no tratado
  como amenaza

---

## 9. LO QUE CARLOS PIDIÓ EXPLÍCITO PARA MAÑANA (en sus palabras, resumido)

1. Flujo del registro + automatización de correos (bienvenida, vencimiento de plan)
2. Sistema completo de facturación/cobro/upgrade de plan, de inicio a fin
3. Tenant propio de ActivoPOS para modelar suscripciones (ver P0 5.3 arriba)
4. Revisión flujo por flujo de todo el sistema, backend vs frontend, para identificar qué más
   falta antes de considerar el producto realmente listo para monetizar

---

**Fin del handoff. Próxima sesión: empezar por el Paso 3 de la sección 1 (verificar VPS real),
luego atacar 5.1 antes que cualquier cosa nueva.**
