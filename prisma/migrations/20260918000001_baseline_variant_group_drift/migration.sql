-- variant_group se aplicó a la DB real vía `prisma db push` (sprint
-- variant_group, 2026-09-17), instrucción explícita del sprint para evitar el
-- entonces-roto shadow DB. schema.prisma ya refleja este estado real -- solo
-- el historial de migraciones estaba atrasado, igual que 20260917000002. Se
-- marca `--applied` en vez de ejecutarse -- ejecutarla de verdad fallaría con
-- "Duplicate column".
ALTER TABLE `product_variants` ADD COLUMN `variant_group` VARCHAR(30) NULL;
