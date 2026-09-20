# PENDIENTE DE CONTENIDO — Slider de marca, catalogo-premium/onbike
# Fecha: 2026-09-20 | Responsable del contenido: Carlos Bolívar

## Estado
BLOQUEADO POR CONTENIDO REAL. No se inventa copy ni imágenes. El código del slider ya está listo
(contraste corregido, alternancia de lado por slide, CTA por slide); solo falta el contenido.

## Qué muestra hoy en producción (data de `landing_sections`, tenant 33)
| Slide | Título | Subtítulo | Problema |
|---|---|---|---|
| 1 | Gran Fondo Virgen del Valle · 200K | 10+ ediciones, 1000+ ciclistas, cada 8 de septiembre — evento gratuito | Narrativa de evento (se decidió quitarla junto con el link "200K" del nav). Sin imagen de fondo. |
| 2 | 17 años construyendo la manada | (comunidad MTB) | Inconsistente con el hero, que dice "15 años moviendo a Margarita". Sin imagen de fondo. |

Ambos slides usan el CTA "Ver catálogo" → /catalogo-premium/onbike/productos, así que no hay
alternancia de CTA real todavía.

## Qué necesita aportar Carlos (por cada slide, mínimo 2)
1. Título (marca/producto, no evento)
2. Subtítulo
3. Texto y destino del CTA (idealmente distinto por slide: p.ej. una marca vs. otra categoría)
4. Imagen de fondo real subida (el placeholder gris actual es lo que se ve sin imagen)
5. `text_theme` (claro/oscuro) según la imagen
6. Decidir la cifra correcta de años (15 vs 17) para que hero y slider coincidan

## Dónde se edita
Configuración → Landing (tabla `landing_sections`). Sin deploy.
Fallback hardcodeado si no hay secciones: constante de slides por defecto en
`src/app/catalogo-premium/[slug]/CatalogoGrid.tsx` (busca "Gran Fondo").

## Otros pendientes de contenido (mismo origen: falta dato real, no bug)
- Productos publicados: Destacados, riel por categoría y grid final muestran "Catálogo en construcción".
- Foto ambiente: la franja no tiene imagen subida.
- Footer: solo hay dato de Ubicaciones; Contacto (teléfono/Instagram/horario) y Síguenos aparecen
  automáticamente cuando se carguen en la configuración del negocio.
