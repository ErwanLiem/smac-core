-- Migration: suppression de la config colonnesLabo (page "Inventaire labo" remplacée par "Suivi PDA Labo")

ALTER TABLE `configProduction` DROP COLUMN `colonnesLabo`;
