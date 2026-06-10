-- Ajoute le champ clientValeur sur les demandes de transfert pour isoler le dispatch par client
ALTER TABLE `demandeTransfert` ADD COLUMN `clientValeur` VARCHAR(191) NULL;
