-- Permet d'activer/désactiver ponctuellement la capacité d'un jour
-- normalement inactif (ex : un samedi travaillé alors que les samedis
-- sont désactivés par défaut), sans changer le réglage global.
CREATE TABLE `exceptionCapaciteJour` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `siteId` INTEGER NOT NULL,
    `date` DATE NOT NULL,
    `actif` BOOLEAN NOT NULL,

    INDEX `ExceptionCapaciteJour_siteId_idx`(`siteId`),
    UNIQUE INDEX `ExceptionCapaciteJour_siteId_date_key`(`siteId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `exceptionCapaciteJour` ADD CONSTRAINT `ExceptionCapaciteJour_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `site`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
