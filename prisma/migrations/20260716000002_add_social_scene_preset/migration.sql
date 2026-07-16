CREATE TABLE `social_scene_presets` (
  `id`          INT          NOT NULL AUTO_INCREMENT,
  `name`        VARCHAR(120) NOT NULL,
  `personaje`   TEXT         NULL,
  `escena`      TEXT         NULL,
  `accion`      TEXT         NULL,
  `created_at`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
