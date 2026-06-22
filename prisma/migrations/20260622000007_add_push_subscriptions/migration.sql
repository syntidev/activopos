-- Create push_subscriptions table for Web Push notifications
CREATE TABLE `push_subscriptions` (
  `id`          INT NOT NULL AUTO_INCREMENT,
  `business_id` INT NOT NULL,
  `user_id`     INT NULL,
  `endpoint`    TEXT NOT NULL,
  `p256dh`      VARCHAR(255) NOT NULL,
  `auth_key`    VARCHAR(255) NOT NULL,
  `user_agent`  VARCHAR(500) NULL,
  `created_at`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `push_subscriptions_business_id_idx` (`business_id`),
  INDEX `push_subscriptions_user_id_idx` (`user_id`),

  CONSTRAINT `push_subscriptions_business_id_fkey`
    FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`),
  CONSTRAINT `push_subscriptions_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
