# Première étape et modèle relationnel

> Mise à jour : la version actuelle ajoute les deux rôles administrateur/responsable, les référentiels administrables, les brouillons multilignes, les corrections par contrepassation, l’audit, les états par période et le déploiement hébergé. Le détail historique ci-dessous décrit les fondations ; les parcours actuels sont documentés dans le README.

Le périmètre de cette première étape est la consultation du catalogue et la saisie/validation de documents IN, OUT et TRANSFER. Les inventaires et contrepassations n’ont pas encore de commande métier exposée : ils sont réservés dans le modèle mais refusés par la procédure actuelle.

| Parent | Enfant | Cardinalité / rôle |
| --- | --- | --- |
| roles | users | 1 → N, rôle obligatoire |
| users | sessions, documents, audit | 1 → N, auteur et traçabilité |
| categories | categories | 1 → N, parent facultatif ; édition hiérarchique à implémenter avec prévention des cycles |
| categories, units | products | 1 → N, classification et unité |
| warehouses | locations | 1 → N, localisation physique |
| warehouses, products | stock_balances | N ↔ N, solde accélérant la lecture |
| documents | document_lines | 1 → N, produit unique dans un document |
| documents | ledger | 1 → N, mouvements signés validés |
| partners | documents | 1 → N facultatif |
| documents | documents | lien de contrepassation future, original unique |

Les clés techniques sont BIGINT UNSIGNED AUTO_INCREMENT. Les références lisibles sont indépendantes et générées pendant validation, par compteur annuel transactionnel. Le stock à une date est la somme de `ledger.quantity WHERE occurred_at <= date`. Ne jamais additionner séparément un stock initial : l’ouverture est une entrée du registre. Le solde d’ouverture d’une période exclut les mouvements de la période ; la clôture les inclut.

Les produits ont une quantité minimale par défaut ; un seuil spécifique par dépôt existe dans `stock_balances.minimum`. Le tableau de bord actuel cumule tous les dépôts et utilise le seuil produit global ; les alertes par dépôt sont une étape suivante.

Validation : verrouillage du document, contrôle de l’état et du rôle, création/verrouillage des soldes dans l’ordre dépôt/produit, vérification de chaque quantité, écriture du registre et des soldes, référence, audit, commit. Toute erreur provoque rollback. Les interblocages restent possibles et sont retournés au client ; les brouillons peuvent être retentés avec la même clé idempotente. Aucun appel réseau externe à l’intérieur de la transaction.

La prochaine étape doit compléter les opérations métier, ajouter des triggers de protection des documents validés, des permissions granulaires et un schéma OpenAPI, puis exercer les critères de concurrence sur MySQL. L’API actuelle ne propose aucune modification de document validé.
