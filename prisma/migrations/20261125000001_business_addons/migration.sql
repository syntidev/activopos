-- Planes v2: add-ons contratados por negocio (CSV, hoy solo kds). Aditivo: sin DROP, filas existentes quedan en vacio.
ALTER TABLE `businesses` ADD COLUMN `addons` VARCHAR(200) NOT NULL DEFAULT '';
