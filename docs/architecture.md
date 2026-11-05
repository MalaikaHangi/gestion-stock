# Architecture PostgreSQL

Le navigateur appelle uniquement l’API HTTPS. Next.js accède à PostgreSQL via `pg` ; aucune URL de base ni aucun secret n’est transmis au frontend. L’API utilise un pool limité à cinq connexions ; migrations et initialisation utilisent une connexion directe dédiée.

| Parent | Enfant | Relation |
| --- | --- | --- |
| roles | users | 1 → N, administrateur ou responsable |
| users | sessions, documents, audit | 1 → N |
| categories | categories | parent facultatif, cycles interdits par l’API |
| categories, units | products | 1 → N |
| warehouses | locations | 1 → N |
| products, warehouses | stock_balances | N ↔ N |
| documents | document_lines, ledger | 1 → N |
| documents | documents | contrepassation unique liée à l’original |

Les identifiants sont SERIAL, les quantités NUMERIC(18,3), les coûts NUMERIC(18,4), les dates TIMESTAMPTZ. Les quantités restent des chaînes décimales dans les réponses pour préserver leur précision ; les calculs d’affichage monétaire sont indicatifs.

`validate_document` et `reverse_document` sont des fonctions PL/pgSQL. Un appel s’exécute dans une transaction PostgreSQL ; une exception annule l’ensemble de l’opération. Aucun COMMIT n’est effectué au milieu d’une fonction. Les documents sont verrouillés, puis les soldes dans l’ordre dépôt/produit. Une ligne manquante de solde est créée avant verrouillage. Les fonctions vérifient le rôle, le statut, l’idempotence et l’absence de stock négatif.

`next_reference` utilise un UPSERT sur un compteur par type et année UTC. La contrainte d’unicité complète ce verrouillage ; aucune utilisation de MAX(id)+1. Les références ne sont pas tronquées après six chiffres. Les identifiants techniques peuvent avoir des trous.

Le registre est la source de vérité. Le solde courant et les écritures signées sont conservés dans la même transaction. Une entrée initiale est un mouvement ordinaire, sans double comptage. Un transfert inscrit un débit et un crédit atomiques. Une correction inscrit l’opposé à la date de contrepassation, sans effacer les écritures antérieures.
