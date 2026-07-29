-- Persistencia real del editor de capas de contenido social. Hoy el editor
-- (compose/route.ts) es efímero: el fondo crudo (background_url) y el mockup
-- de teléfono exacto (device_variant, hoy elegido al azar por selectDevice)
-- solo viven en memoria del cliente entre la generación y el sellado -- si
-- se recarga la página, se pierden y reabrir el editor deja de funcionar.
--
-- layer_override sigue el mismo patrón que SocialPost.hashtags: columna Json
-- sin tipado fuerte en Prisma, casteada en TypeScript al LayerOverride real
-- (compose.ts). Guarda el mismo shape que ya arma buildOverride() en el
-- frontend -- no se inventa un shape nuevo.
--
-- updated_at es nueva en esta tabla (SocialAsset no la tenía) -- necesaria
-- para saber cuándo se re-selló un asset por última vez desde el editor.
ALTER TABLE `social_assets`
  ADD COLUMN `background_url` VARCHAR(500) NULL,
  ADD COLUMN `device_variant` VARCHAR(40) NULL,
  ADD COLUMN `layer_override` JSON NULL,
  ADD COLUMN `updated_at` DATETIME(3) NULL;
