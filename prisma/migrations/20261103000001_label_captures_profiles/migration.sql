-- Captura de etiquetas por perfil de marca. Solo columnas nuevas con default: las filas Safetti existentes quedan en profile='safetti'.
ALTER TABLE `label_captures`
    ADD COLUMN `profile` VARCHAR(20) NOT NULL DEFAULT 'safetti',
    ADD COLUMN `style` VARCHAR(24) NOT NULL DEFAULT '',
    ADD COLUMN `size_us` VARCHAR(8) NOT NULL DEFAULT '',
    ADD COLUMN `size_eu` VARCHAR(8) NOT NULL DEFAULT '',
    ADD COLUMN `size_uk` VARCHAR(8) NOT NULL DEFAULT '',
    ADD COLUMN `size_jp` VARCHAR(8) NOT NULL DEFAULT '';
