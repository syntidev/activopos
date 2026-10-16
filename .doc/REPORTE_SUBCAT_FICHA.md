REPORTE - SUBCATEGORIA VISIBLE Y NAVEGABLE DESDE LA FICHA
Fecha: 2026-10-16 | Sin cambio de esquema, sin deploy

COMMITS (uno por punto)
Punto 1  aa83370  Ficha (clasico y premium): recorrido "Volver al catalogo > CATEGORIA > SUBCATEGORIA" con enlaces
Punto 2  1a34d01  Listado acepta ?categoria= y ?sub= iniciales; valores inexistentes se ignoran
Punto 3  32de567 + 243f860  Chips por clave normalizada; "Todas" conserva la categoria
                  (32de567 salio con error tsc por iterar un Map en target ES5; 243f860 lo corrige con Array.from)
Punto 4  23925a6  Guardado con trim + espacios colapsados; vacio = null

QUE CAMBIO
- src/lib/subcategory.ts (nuevo): productosHref, cleanSubcategory, subcategoryKey, subcategoryChips.
- ProductoDetalle.tsx (x2) + p/[id]/page.tsx (x2): prop subcategory; categoria y subcategoria son enlaces. Sin subcategoria solo cambia que la categoria ahora es enlace (mismo estilo; productoDetalle.module.css x2: sin subrayado, subrayado en hover como "Volver").
- productos/page.tsx (x2): leen searchParams.sub -> initialSub.
- CatalogoGrid.tsx (x2): categoria/sub iniciales validadas contra el catalogo; el reset de sub al cambiar categoria ya no corre en el montaje (ref de categoria previa); activeSub guarda la clave normalizada; "Todas" solo hace setActiveSub(null).
- api/products/route.ts y api/products/[id]/route.ts: transform zod (max 60 intacto). Se toco tambien [id] porque es la ruta de edicion; sin ella solo el alta limpiaba.

VERIFICACION LOCAL (negocio 87, app :3019, navegador Playwright)
Original: subcategory NULL en los 4 productos. Temporal: ids 925 y 926 = "SRAM", 927 = "sram " (via SQL, sin pasar por API), 928 sin sub (control).
- Clasico: ficha 925 muestra "Volver > Correas Reloj > SRAM"; enlaces ...?categoria=Correas%20Reloj y ...&sub=SRAM. Clic -> listado con categoria y chip SRAM activos, 3 productos (925, 926, 927), UN solo chip SRAM. "Todas" -> chip Todas activo, sigue en Correas Reloj.
- Premium: ficha 927 muestra "> Correas Reloj > sram". Abrir ?categoria=Correas%20Reloj&sub=sram%20 -> un chip "SRAM" (escritura mas frecuente), activo, 3 productos. "Todas" -> activo, categoria mantenida.
- Ficha 928 (sin sub): recorrido con solo categoria.
Restaurado a NULL; SELECT confirma 925-928 NULL y 0 productos con subcategoria en el negocio 87.

GATE
npx tsc --noEmit 0 | npm run test:consistency 78/78 OK | npm run build EXIT=0, Compiled successfully

NO PROBADO
- Valores inexistentes en la URL (categoria=NoExiste, sub=inexistente): solo se confirmo HTTP 200 sin error; no se miro visualmente que el listado quede sin filtro.
- Guardado por API (trim/colapso/vacio->null): solo tsc; no hay prueba HTTP autenticada. Los valores de prueba entraron por SQL.
- Desktop 1280 / mobile 375 visual: no revisado; falta tu aprobacion visual del recorrido (puede envolver a 2 lineas en mobile con subcategoria larga).
- Home en modo browse (no /productos): "Todas" ya no limpia la categoria; no probado ahi.
- Sin deploy.
