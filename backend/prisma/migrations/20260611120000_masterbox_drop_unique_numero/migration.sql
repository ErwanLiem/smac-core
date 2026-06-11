-- La numérotation MB-XXXX redémarre à 1 pour un client une fois que toutes ses
-- Master Box sont passées au statut EXPEDIEE : un même numéro peut donc être
-- réutilisé par un client à différents "tours" d'expédition. La contrainte
-- unique (siteId, clientValeur, numero) est donc remplacée par un index simple.
ALTER TABLE `masterBox` DROP INDEX `MasterBox_siteId_clientValeur_numero_key`;
ALTER TABLE `masterBox` ADD INDEX `MasterBox_siteId_clientValeur_numero_idx` (`siteId`, `clientValeur`, `numero`);
