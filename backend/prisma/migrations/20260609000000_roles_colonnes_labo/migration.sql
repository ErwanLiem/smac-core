-- Migration: remplacer estStock/estTransfert/estFinal par roles JSON + ajouter colonnesLabo

-- 1. Ajouter la colonne roles sur statut
ALTER TABLE `statut` ADD COLUMN `roles` TEXT NOT NULL DEFAULT '[]';

-- 2. Migrer les données existantes vers le nouveau format JSON
UPDATE `statut` SET `roles` = '["estStock"]'     WHERE `estStock` = 1 AND `estTransfert` = 0 AND `estFinal` = 0;
UPDATE `statut` SET `roles` = '["estTransfert"]' WHERE `estStock` = 0 AND `estTransfert` = 1 AND `estFinal` = 0;
UPDATE `statut` SET `roles` = '["estFinal"]'     WHERE `estStock` = 0 AND `estTransfert` = 0 AND `estFinal` = 1;
-- Cas multi-rôles (rare mais sécurisé)
UPDATE `statut` SET `roles` = '["estStock","estTransfert"]' WHERE `estStock` = 1 AND `estTransfert` = 1 AND `estFinal` = 0;
UPDATE `statut` SET `roles` = '["estStock","estFinal"]'     WHERE `estStock` = 1 AND `estTransfert` = 0 AND `estFinal` = 1;
UPDATE `statut` SET `roles` = '["estTransfert","estFinal"]' WHERE `estStock` = 0 AND `estTransfert` = 1 AND `estFinal` = 1;
UPDATE `statut` SET `roles` = '["estStock","estTransfert","estFinal"]' WHERE `estStock` = 1 AND `estTransfert` = 1 AND `estFinal` = 1;

-- 3. Supprimer les anciennes colonnes booléennes
ALTER TABLE `statut` DROP COLUMN `estStock`;
ALTER TABLE `statut` DROP COLUMN `estTransfert`;
ALTER TABLE `statut` DROP COLUMN `estFinal`;

-- 4. Ajouter colonnesLabo dans configProduction
ALTER TABLE `configProduction` ADD COLUMN `colonnesLabo` LONGTEXT NULL;
