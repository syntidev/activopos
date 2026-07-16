# PLAN MAESTRO — Deuda Técnica + Roadmap ActivoPOS
# Consolidado 2026-07-12 | Fusiona PLAN_MAYOR_v2.md, HANDOFF_Sprint80-84,
# N8N_MONTHLY_REPORT_WORKFLOW.md, y los pendientes nuevos de esta sesión

---

## CÓMO LEER ESTE DOCUMENTO

Prioridad real, no cronológica. P0 bloquea negocio (dinero/clientes reales
en riesgo). P1 bloquea confianza (el sistema promete algo que no cumple).
P2 es mejora — no bloquea nada, se hace cuando haya aire.

**Regla de oro para todo lo de abajo:** ningún ítem se cierra por "el CLI
dijo que ya está" — se cierra cuando Carlos lo vio funcionar en pantalla,
con datos reales, en el flujo completo de principio a fin.

---

## P0 — BLOQUEA NEGOCIO REAL

### 1. Flujo de registro + SMTP + alerta de nuevo usuario
**Estado:** desconocido — nunca verificado end-to-end.
**Por qué es P0:** ahora mismo, si un visitante hace clic en "Empezar
gratis" en cualquiera de las 26 páginas de segmento que se pulieron esta
sesión, no sabemos qué pasa después. Toda la inversión de esta semana en
landing es inútil si el registro no funciona o si Carlos no se entera
de que alguien se registró.

**Necesita, en orden:**
1. Confirmar si existe configuración SMTP real (provider: Resend, SendGrid,
   Gmail SMTP, otro) — si no existe, elegir uno y configurarlo
2. Verificar/construir: correo de confirmación al usuario que se registra
3. Verificar/construir: alerta a Carlos (correo o notificación in-app) de
   nuevo negocio registrado
4. Probar el flujo completo con un registro real, de punta a punta

**Agente recomendado:** CLI-A (backend/infraestructura). No requiere skill
especial, pero SÍ requiere prueba real con envío de correo verificado
recibido — no solo "endpoint responde 200".

---

## P1 — CRÍTICO, TRATAMIENTO ESPECIAL

### 2. Usuarios y Roles — máxima atención, Opus + skill dedicado
**Carlos, textual:** *"Ya he pasado por este trauma antes y los agentes
saltan código y no parametrizan bien las funciones, solo hacen la
fachada."*

**Por qué este ítem es distinto a todos los demás de este documento:**
permisos mal implementados no fallan de forma visible — fallan en
silencio, dejando que un cajero vea reportes financieros que no debería,
o que un usuario sin permiso ejecute una acción destructiva. Es exactamente
el tipo de bug que "funciona en la demo" y falla con el primer cliente real.

**Tratamiento obligatorio, no negociable:**
- **Modelo:** Claude Opus específicamente para este ítem — no Sonnet, no
  el CLI de turno. Carlos ya lo pidió explícito.
- **Skill:** `engineering:code-review` como mínimo; considerar
  `engineering:testing-strategy` para diseñar los casos de prueba de
  permisos ANTES de tocar código (qué debe poder ver/hacer cada rol,
  como matriz explícita, no como intención implícita)
- **Protocolo anti-fachada específico para este ítem:**
  1. Antes de escribir código: listar la matriz completa rol × acción ×
     recurso (qué puede ver, crear, editar, eliminar cada rol, en cada
     módulo) — esto se revisa con Carlos ANTES de implementar
  2. Cada permiso se implementa con guard real en el backend (nunca solo
     ocultar el botón en el frontend — eso es fachada exacta)
  3. Test de intento de bypass: usuario con rol restringido intentando
     acceder al endpoint directamente (no por la UI) debe fallar
  4. CLI-C audita después, específicamente buscando: endpoints sin guard,
     UI que oculta pero no bloquea, roles con permisos implícitos no
     documentados

**Estado actual conocido** (de `HANDOFF_Sprint80-84`):
```
Roles definidos: super_admin | admin | cashier
Middleware: cashier → redirige a /pos ✅
Sidebar: oculta items a cashier ✅
Endpoints protegidos: 95+ guards ✅ (verificar si sigue vigente, es de hace días)
```
Esto es la base — pero "95+ guards" reportados no significa que estén
completos o correctos. Empezar por auditar lo que dice existir, no asumir.

**No se ejecuta como los demás ítems de este plan** — se agenda como
sesión dedicada, con Carlos presente para revisar la matriz de permisos
antes de que se escriba una sola línea.

---

## P1 — MÓDULOS CONSTRUIDOS PERO DESCONECTADOS

### 3. Módulo de Ayuda — construido, no cableado
**Estado:** existe como componente (panel lateral, 2 tabs: descripción de
flujo + FAQ del módulo), pero no está conectado/enlazado desde los módulos
reales del sistema.

**Necesita:**
1. Auditoría de qué existe realmente — CLI-C, solo lectura: ¿el componente
   del panel de ayuda existe en el código? ¿Tiene contenido cargado por
   módulo, o está vacío?
2. Si existe y solo falta cablear: agregar el trigger (botón/ícono "?")
   en cada módulo del sistema que abra el panel con el contenido
   correspondiente a ESE módulo específico
3. Si el contenido no existe: esto se vuelve tarea de redacción (Claude
   Web) antes que de código — no tiene sentido cablear un panel vacío

### 4. Bot de ayuda — desequilibrado, empeoró tras el último cambio
**Estado:** respondía solo con el primer tópico encontrado, dejando fuera
otros tópicos relevantes a la pregunta. Se modificó y "quedó peor" según
Carlos — incoherente ahora.

**Esto es un problema de diseño de búsqueda/matching, no un bug de una
línea.** Antes de tocar código de nuevo:
1. Auditar qué mecanismo usa hoy (¿keyword matching simple? ¿embedding/
   vector search? ¿llamada directa a NVIDIA NIM sin contexto de sistema?)
2. Definir el comportamiento esperado explícito: ¿debe devolver UN tópico
   más relevante, o combinar varios cuando la pregunta toca más de uno?
3. Si el mecanismo actual es keyword matching ingenuo, la solución real
   probablemente es RAG (retrieval-augmented generation) sobre el
   contenido real de ayuda — no un ajuste de threshold. Esto conecta
   directo con el ítem 6 de abajo (Tu día + IA/RAG) — vale la pena
   resolver ambos con la misma arquitectura de una vez, no dos veces.

### 5. Reporte financiero mensual — workflow diseñado, nunca probado
**Estado real, encontrado en la documentación:** existe un workflow
completo de n8n (`N8N_MONTHLY_REPORT_WORKFLOW.md`, Sprint 11) diseñado
para esto — cron el último día del mes, marca reportes pendientes,
espera generación lazy del PDF, construye link de WhatsApp, notifica.
**Pero nunca se verificó si está instalado, si corre, o qué contiene
el reporte generado.**

**Necesita:**
1. Confirmar si el workflow está instalado en `n8n.syntiweb.com` — si no,
   instalarlo según el documento
2. Confirmar que existen los 3 endpoints que el workflow llama:
   `POST /api/reports/monthly/mark-pending`,
   `GET /api/reports/monthly/pending`,
   `POST /api/reports/monthly/mark-notified`
3. Generar un reporte de prueba manualmente (no esperar al fin de mes)
   y revisar el PDF real — ¿tiene los datos correctos? ¿se ve bien?
4. Confirmar el banner en el dashboard ("Ya está disponible el reporte
   del mes") — verificar que lee el campo de notificación correcto
5. **Importante, ya documentado:** el envío de WhatsApp NO es automático
   todavía (requiere API oficial de Meta, planeado para más adelante) —
   hoy el flujo prepara el link, el dueño lo comparte manualmente. No es
   un bug, es el diseño actual — pero Carlos debe saberlo antes de asumir
   que se envía solo.

### 6. Mayoristas / Lista de Precios — estado por verificar
**Estado:** desconocido, pendiente de auditoría — Carlos no está seguro
si se desarrolló y no se cableó, o si nunca se construyó.

**Necesita:** auditoría simple de CLI-C antes de cualquier otra acción —
buscar en el código cualquier modelo/componente relacionado a "lista de
precio", "mayorista", "precio al mayor/detal" y reportar qué existe
realmente. No asumir ni de un lado ni del otro hasta ver el código.

---

## P2 — MEJORA, SIN URGENCIA

### 7. "Tu día" — asociar API de IA o RAG
Decisión pendiente de arquitectura: ¿LLM en vivo (NVIDIA NIM, ya usado
para el blog) generando el resumen diario en tiempo real, o RAG sobre
datos estructurados del negocio? Recomendación preliminar: dado que "Tu
día" hoy ya funciona con lógica de reglas/templates (confirmado en sesión
anterior) y funciona bien, esto es una mejora de profundidad, no un
arreglo urgente. Se conecta naturalmente con resolver el bot de ayuda
(ítem 4) con la misma arquitectura de IA, para no construir dos sistemas
de IA separados que hacen cosas parecidas.

### Heredados de `HANDOFF_Sprint80-84` (PLAN_MAYOR_v2), aún pendientes
- Fix build `blog/page.tsx` (verificar si sigue roto tras los cambios recientes)
- Admin mobile-first
- `/faq` `/planes` `/contacto` `/ayuda` — homologación visual (parcialmente
  resuelto en la sesión de Bento cálido, verificar qué falta)
- Sitemap dinámico con blog + segmentos
- `inputMode="numeric"` en campos numéricos, sistema-wide
- Módulo banco/métodos de pago compartibles
- Módulo suscripción — plan activo + alerta de vencimiento
- Dual brand header (logo del negocio junto al de ActivoPOS)
- CxP — Cuentas por Pagar
- Listas de precio detal/mayor (mismo ítem que #6 arriba, ya fusionado)
- Comisiones a personal
- P&L doble-cuenta compras (deuda técnica de Finanzas)
- `ProductModal` código muerto
- Proveedores sin `moduleKey` en sidebar
- IVA — decidir eliminar o dejar como badge

---

## ORDEN DE EJECUCIÓN RECOMENDADO

```
1. SMTP + registro + alerta          (P0 — bloquea todo lo demás)
2. Auditoría CLI-C: Ayuda, Bot,       (P1 — barato, aclara terreno antes
   Reporte mensual, Mayoristas         de invertir esfuerzo real)
   → reporte de qué existe de verdad
3. Usuarios y Roles                   (P1 — sesión dedicada, Opus, con
                                        Carlos presente para la matriz)
4. Ejecutar fixes de los 4 módulos    (según lo que confirme la auditoría
   del punto 2, uno por uno)           del punto 2)
5. P2 — cuando haya aire
```

No se arranca el punto 3 (Usuarios y Roles) en paralelo con nada más —
es el único ítem de este documento que requiere atención exclusiva.

---

*ActivoPOS · SYNTIdev · Plan maestro consolidado*
*Generado por Claude Web · Sesión 2026-07-12*
