-- Toggle de descripción del catálogo público (Configuración -> Empresa).
-- Default TRUE: negocios existentes con catalog_desc ya escrito la siguen mostrando
-- sin cambio de comportamiento visible al aplicar esta migración.
ALTER TABLE `businesses`
  ADD COLUMN `catalog_desc_enabled` BOOLEAN NOT NULL DEFAULT true;
