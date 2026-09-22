-- Cartelera de campaña rotativa: marca cuál Collection es "la cartelera del
-- momento" (grid premium 1+4 del catálogo público). Aditivo: todas las
-- colecciones existentes quedan en false, o sea el comportamiento actual no
-- cambia hasta que un admin active una. "Solo una activa por negocio" lo
-- garantiza la API (transacción), no la base.

-- AlterTable
ALTER TABLE `collections` ADD COLUMN `is_cartelera_activa` BOOLEAN NOT NULL DEFAULT false;
