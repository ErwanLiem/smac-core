-- La numérotation MB-XXXX est désormais une séquence par client : l'unicité doit
-- porter sur (siteId, clientValeur, numero) et non plus (siteId, numero)
ALTER TABLE `masterBox` DROP INDEX `MasterBox_siteId_numero_key`;
ALTER TABLE `masterBox` ADD UNIQUE INDEX `MasterBox_siteId_clientValeur_numero_key` (`siteId`, `clientValeur`, `numero`);
