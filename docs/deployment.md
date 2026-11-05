# Mise en ligne sur les projets existants

## Plan Render préparé le 5 novembre 2026

L’accès à `Daniel’s workspace` a été confirmé. L’inventaire Render ne contient aucun service ni base : le projet `gestionstock` est encore vide.

Le Blueprint définit un service `gestion-stock-api` gratuit, un service privé `gestion-stock-mysql` au plan `0.5c-512mb` et un disque de 1 Go monté sur `/var/lib/mysql`. Les services sont placés à Francfort, dans le même réseau privé. L’API reçoit l’adresse et les secrets MySQL par références entre services, sans URL contenant un mot de passe dans le dépôt. Les secrets sont générés par Render et conservés entre les synchronisations.

Coût de base estimé : 7 USD/mois de calcul MySQL + 0,25 USD/mois pour 1 Go de disque = 7,25 USD/mois, hors taxes et éventuels dépassements des quotas. Le tarif provient de https://render.com/pricing ; le plan et le coût doivent être confirmés dans l’aperçu Render avant application. L’API gratuite est soumise aux limites et mises en veille de cette offre.

La première synchronisation n’est pas appliquée sans autorisation explicite du plan et de son déploiement. `ALLOWED_ORIGINS` reste initialement vide, puis doit être renseigné avec l’origine publique Vercel confirmée. L’API sera ainsi fermée aux appels navigateur non autorisés pendant la configuration.

Le démarrage attend MySQL, applique les migrations, provisionne les droits limités du compte API et initialise l’administrateur. Ce compte dispose seulement de SELECT sur le registre et les soldes ; les écritures de stock passent par les procédures. Il dispose de SELECT/INSERT sur l’audit. Les droits de schéma sont réservés au compte de migration. Le provisionnement est idempotent et vérifié sur une base temporaire.

## État des accès et destinations

- Espace Vercel fourni : https://vercel.com/danielhangi77-2714
- Projet Vercel identifié via les statuts GitHub : `gestion-stock`.
- Un second projet `gestion-stock-1fo6` est également lié au dépôt ; son précédent statut est un échec. Ne pas créer de troisième projet. Ne pas supprimer le doublon avant confirmation de son usage.
- Projet Render fourni : https://dashboard.render.com/project/prj-dbm7i1psrm7s73fag0hg
- Le nom du service Render, son URL publique, sa connexion MySQL et ses variables restent à vérifier avec un accès authentifié.

Les fichiers ci-dessous sont prêts pour le déploiement. Ils ne représentent pas une confirmation de configuration des comptes distants.

## Vercel

Dans le projet `gestion-stock`, relier `MalaikaHangi/gestion-stock`, branche de production `main`.

Configuration recommandée avec **Root Directory = racine du dépôt** : `vercel.json` configure Vite, l’installation pnpm, la compilation `frontend` et la sortie `frontend/dist`. Définir `VITE_API_URL=https://URL-PUBLIQUE-DE-L-API.onrender.com` dans les environnements souhaités. Aucune URL locale n’est acceptée pour une compilation de production.

Si le projet existant utilise déjà `frontend` comme Root Directory, le fichier `frontend/vercel.json` conserve les réécritures SPA ; conserver la racine existante ou la déplacer explicitement après vérification. Ne pas combiner `Root Directory=frontend` avec `Output Directory=frontend/dist` : dans ce cas la sortie est `dist`.

Après liaison Git, Vercel lance un déploiement sur les nouveaux commits. Les origines de prévisualisation ne doivent pas être autorisées globalement dans CORS : ajouter seulement les origines effectivement utilisées.

## API Render

Rattacher le **service existant** au même dépôt et à `main`. Le nom `gestion-stock` de `render.yaml` doit correspondre au service réel avant toute synchronisation Blueprint ; sinon, le modifier pour éviter la création d’un doublon.

Paramètres à appliquer au service Node :

```text
Build Command:
npx --yes pnpm@11.25.0 install --frozen-lockfile && npx --yes pnpm@11.25.0 --filter backend build

Start Command:
node backend/scripts/start-hosted.mjs

Health Check Path:
/api/health
```

Racine du service : dépôt complet, et non `backend` seul, car le runner lit `sql/` à la racine. Utiliser Node 24.22.1. Pour Auto-Deploy, sélectionner **After CI Checks Pass** ; le workflow GitHub de vérification est inclus. Le compte GitHub doit être connecté à Render : une URL de dépôt public saisie sans intégration Git ne suffit pas à activer les déploiements automatiques.

Variables :

| Variable | Valeur / usage |
| --- | --- |
| MYSQL_URL | Connexion de l’API à la base MySQL persistante |
| MYSQL_MIGRATION_URL | Connexion disposant des droits de migration et de création des routines ; repli sur MYSQL_URL si absente |
| MYSQL_SSL_CA | Autorité TLS si requise ; la validation du certificat reste activée |
| ALLOWED_ORIGINS | URL HTTPS exacte du frontend Vercel, sans barre finale ; plusieurs origines séparées par virgules |
| ADMIN_EMAIL / ADMIN_PASSWORD | Initialisation du premier administrateur, 12 caractères minimum pour le mot de passe |
| MANAGER_EMAIL / MANAGER_PASSWORD | Initialisation facultative du premier responsable |
| PORT | Fournie par Render, utilisée automatiquement |

Les comptes existants ne sont jamais réinitialisés par un push. Après création initiale, retirer les variables de mots de passe de bootstrap si elles ne sont plus nécessaires. Ne pas exécuter le seed de démonstration sur la production.

## Migrations automatiques de la base hébergée

Le script de démarrage s’exécute en trois étapes : migrations, bootstrap idempotent, lancement Next.js. La migration acquiert un verrou MySQL nommé et enregistre les versions et étapes appliquées. Deux démarrages concurrents ne migrent donc pas simultanément la même base. Toute erreur interrompt le lancement.

Sur une offre Render proposant les commandes **pre-deploy**, il est possible de déplacer `node backend/scripts/migrate.mjs && node backend/scripts/bootstrap.mjs` dans cette phase puis de lancer Next.js seul au démarrage. La version fournie fonctionne aussi avec la phase de démarrage, sans imposer l’achat d’une offre uniquement pour le pre-deploy. Elle nécessite l’accès à la base depuis le service.

MySQL exécute des commits implicites pour beaucoup de DDL. Le suivi d’étapes facilite les reprises, mais ne transforme pas une migration DDL en transaction : inspecter toute migration interrompue, notamment si la coupure survient entre une instruction et l’enregistrement de son étape. Ne pas modifier une ancienne migration déjà appliquée ; en ajouter une nouvelle. Tester d’abord sur une base de test et sauvegarder avant les changements de schéma.

## Base MySQL sur Render

Vérifier d’abord si une instance MySQL persistante existe déjà dans le projet. Un projet Render ou un service Node ne crée pas automatiquement MySQL. Une base Render PostgreSQL n’est pas interchangeable avec MySQL.

Pour héberger MySQL sur Render, l’option documentée est un service privé Docker MySQL avec disque persistant monté sur `/var/lib/mysql`, dans la même région et le même workspace que l’API. L’API utilise son nom réseau privé et le port 3306. Ne pas ouvrir MySQL publiquement. Les données doivent rester sur ce disque entre les déploiements.

La création de nouveaux services et disques peut être payante ; aucune nouvelle infrastructure n’est créée automatiquement par les fichiers de ce dépôt. Vérifier l’instance et l’offre existantes avant toute création. Un fournisseur MySQL externe avec TLS reste possible si le projet dispose déjà d’une telle base.

Séparer le compte de migration du compte applicatif. Pour `stock_level`, MySQL peut demander des privilèges supplémentaires quand le journal binaire est activé ; fournir le compte administratif approprié pour la migration, sans désactiver globalement la protection des créateurs de fonctions. Les routines sont les seuls chemins d’écriture du registre et des soldes. En production, retirer au compte API les droits DDL et les droits directs de modification de `ledger` et `stock_balances` ; conserver `EXECUTE` et les droits CRUD nécessaires sur les autres tables. Vérifier les privilèges et le DEFINER des routines sur l’instance choisie.

Sauvegarder avec un outil MySQL, par exemple `mysqldump --single-transaction --routines`, dans un stockage indépendant et chiffré. Tester la restauration dans une base isolée. Les instantanés de disque ne remplacent pas une sauvegarde logique MySQL vérifiée.

## Vérification finale attendue sur les services

Confirmer : CI GitHub réussie ; Vercel et Render déployés sur le même commit ; API `/api/health` en succès ; connexion administrateur et responsable ; réception puis sortie avec quantité correcte ; refus d’une sortie excessive ; historique conservé après un nouveau push ; connexion effective à la base hébergée.

## Références officielles

- https://vercel.com/docs/git
- https://vercel.com/docs/frameworks/frontend/vite
- https://render.com/docs/deploys
- https://render.com/docs/blueprint-spec
- https://render.com/docs/deploy-mysql
- https://render.com/docs/disks
