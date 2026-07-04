CREATE DATABASE IF NOT EXISTS smartexpense
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'smartexpense_user'@'localhost'
  IDENTIFIED BY 'ChangeThisStrongPassword123!';

GRANT ALL PRIVILEGES ON smartexpense.* TO 'smartexpense_user'@'localhost';

FLUSH PRIVILEGES;
