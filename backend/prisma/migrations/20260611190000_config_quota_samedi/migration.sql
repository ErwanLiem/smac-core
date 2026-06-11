-- Ajoute un réglage par site permettant d'activer ou non le quota de
-- production le samedi (désactivé par défaut, car les samedis sont
-- rarement travaillés).
ALTER TABLE `configProduction` ADD COLUMN `quotaSamediActif` BOOLEAN NOT NULL DEFAULT false;
