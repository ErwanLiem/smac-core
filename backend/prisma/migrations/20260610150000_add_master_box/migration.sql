-- CreateTable
CREATE TABLE `masterBox` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `siteId` INTEGER NOT NULL,
    `numero` VARCHAR(191) NOT NULL,
    `clientValeur` VARCHAR(191) NULL,
    `statut` VARCHAR(191) NOT NULL DEFAULT 'EN_ATTENTE',
    `userId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MasterBox_siteId_fkey`(`siteId`),
    UNIQUE INDEX `MasterBox_siteId_numero_key`(`siteId`, `numero`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ligneMasterBox` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `masterBoxId` INTEGER NOT NULL,
    `inventaireId` INTEGER NOT NULL,

    INDEX `LigneMasterBox_masterBoxId_fkey`(`masterBoxId`),
    INDEX `LigneMasterBox_inventaireId_fkey`(`inventaireId`),
    UNIQUE INDEX `LigneMasterBox_inventaireId_key`(`inventaireId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `masterBox` ADD CONSTRAINT `MasterBox_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `site`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ligneMasterBox` ADD CONSTRAINT `LigneMasterBox_masterBoxId_fkey` FOREIGN KEY (`masterBoxId`) REFERENCES `masterBox`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ligneMasterBox` ADD CONSTRAINT `LigneMasterBox_inventaireId_fkey` FOREIGN KEY (`inventaireId`) REFERENCES `inventaire`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

