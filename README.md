# StockMaster — gestion-stock

Application de gestion des stocks en français. Première étape du projet : tableau de bord React responsive, API Next.js, authentification et registre MySQL transactionnel.

## État réel

L’aperçu utilise des données de démonstration explicitement signalées. Aucune donnée réelle n’est envoyée avant connexion. Le mode connecté nécessite une base MySQL et un compte initialisé.

Implémenté : inventaire avec recherche et filtre, alertes, export CSV, connexion, consultation des dépôts, création de brouillons, validation des entrées/sorties/transferts, refus du stock négatif, clés idempotentes, journal des documents, manifeste et cache de la PWA, préparation locale d’un brouillon par utilisateur.

À compléter avant production : CRUD complet des référentiels, permissions granulaires, inventaires physiques, contrepassations, scan caméra et rapports par période. Les migrations et le test de concurrence ont été exercés sur MySQL 8.4.13 local. Cette étape reste une version de développement.

## Installation locale

Prérequis : Node.js 24 LTS, pnpm 11 et MySQL 8.4/InnoDB. Depuis la racine :

```powershell
pnpm install
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

Créer une base `gestion_stock` en UTF-8 (`utf8mb4`) et renseigner `MYSQL_URL`. Pour les commandes de migration et de seed, utiliser les variables d’environnement du terminal (les scripts ne chargent pas automatiquement `.env`) :

```powershell
$env:MYSQL_URL='mysql://stock:mot-de-passe@localhost:3306/gestion_stock'
pnpm --filter backend migrate
$env:ADMIN_EMAIL='votre-adresse@example.com'
$env:ADMIN_PASSWORD='un-mot-de-passe-long-et-unique'
pnpm --filter backend seed
pnpm dev
```

Frontend : http://localhost:5173 ; backend : http://localhost:3000. `pnpm build` compile les deux applications.

Si Defender bloque les écritures dans Documents, autoriser les exécutables Git et Node concernés dans l’accès contrôlé aux dossiers ; conserver la protection activée.

### MySQL local sans service Windows

Les scripts Windows peuvent préparer MySQL 8.4.13 dans `%LOCALAPPDATA%\StockMaster`, avec une écoute limitée à `127.0.0.1:3307`. Aucune règle de pare-feu et aucun service système ne sont ajoutés. Le téléchargement minimal utilise des plages HTTP de l’archive officielle et vérifie chaque fichier avec son CRC ZIP ; l’autre méthode télécharge l’archive complète et vérifie son MD5 officiel.

```powershell
node scripts/inspect-mysql-archive.mjs
node scripts/download-mysql-minimal.mjs
node scripts/setup-mysql-local.mjs
```

Cette préparation crée `gestion_stock` et `gestion_stock_test` ainsi qu’un compte **de développement** ayant les droits de migration sur ces deux bases. Le compte de production devra avoir des droits réduits. `backend/.env` contient l’accès local et le mot de passe du compte applicatif `admin@stockmaster.local`, à créer ensuite avec le seed. Les identifiants sont exclus de Git.

Après préparation, exécuter successivement :

```powershell
node scripts/local-db-task.mjs migrate
node scripts/local-db-task.mjs migrate-test
node scripts/local-db-task.mjs seed
node scripts/local-db-task.mjs test
```

Les migrations locales utilisent le compte administrateur MySQL pour créer la fonction SQL sans réduire les protections du serveur. Le seed initial est à lancer une seule fois. Les fichiers locaux de cette installation ont déjà été préparés pendant le développement ; ne pas relancer le seed sur ces mêmes données.

Pour redémarrer le serveur local ultérieurement : `node scripts/start-mysql-local.mjs`. Les migrations et le seed restent à exécuter après cette préparation. Ne pas relancer setup lorsqu’un serveur occupe déjà le port 3307.

## Architecture et règles

`frontend/` : React, TypeScript et Vite, sans secret. `backend/` : Next.js Route Handlers, connexion MySQL côté serveur. `sql/` : migrations ordonnées. `docs/` : architecture et déploiement.

Les quantités utilisent DECIMAL(18,3), les coûts DECIMAL(18,4). Les données API conservent ces décimaux sous forme de chaînes ; les calculs financiers d’affichage sont indicatifs. Les dates métier sont enregistrées en UTC ; affichage prévu Africa/Johannesburg.

Le registre `ledger` constitue la source de vérité. Les soldes sont mis à jour dans la même transaction par `validate_document`. Les documents brouillons n’affectent pas le stock. La procédure possède sa transaction : aucun appel à l’intérieur d’une transaction applicative. Les références métier ont un compteur verrouillé par type et année UTC. Un rollback restitue le compteur transactionnel ; les identifiants techniques peuvent avoir des trous.

Les sessions utilisent un jeton aléatoire de 256 bits, haché en base, valable 8 heures. Le navigateur garde le jeton en mémoire uniquement. Les mots de passe utilisent scrypt et un sel aléatoire. L’API exige le rôle gestionnaire ou administrateur pour écrire. La limitation des tentatives par compte est persistante ; une protection par IP au niveau du proxy reste à configurer. CORS utilise une liste d’origines explicite, sans cookies interdomaines.

Le service worker ne met pas en cache les requêtes API. Le catalogue consulté est enregistré séparément par utilisateur et effacé à la déconnexion ; il peut être ancien hors connexion. Les brouillons locaux ne sont pas synchronisés automatiquement. Aucune validation hors connexion.

## API de cette étape

| Méthode | Route | Accès |
| --- | --- | --- |
| GET | `/api/health` | Public, état base |
| POST | `/api/auth` | Connexion |
| DELETE | `/api/auth` | Révocation du jeton courant |
| GET | `/api/catalog` | Utilisateur connecté |
| POST | `/api/catalog` | Gestionnaire, création de produit |
| GET | `/api/documents` | Utilisateur connecté, 100 derniers documents |
| POST | `/api/documents` | Gestionnaire, création brouillon |
| POST | `/api/documents/:id/validate` | Gestionnaire, en-tête `Idempotency-Key` requis |

## Déploiement

Voir [docs/deployment.md](docs/deployment.md). Aucun déploiement ni service payant n’est créé par ces fichiers.
