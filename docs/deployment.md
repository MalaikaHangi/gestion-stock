# Déploiement gratuit : Vercel, Render et Neon

## Choix confirmé

La contrainte est de ne créer **aucun service payant**. Le plan MySQL privé et disque persistant n’a pas été appliqué. Le plan gratuit de remplacement a été approuvé puis déployé le 5 novembre 2026. Le Blueprint `exs-dbm8ekl9el5s7391dkbg` est maintenant en synchronisation automatique.

PostgreSQL gratuit sur Render expire après 30 jours. Neon Free annonce une offre sans limite de durée et sans carte bancaire, avec 1 Go de stockage et 100 CU-heures mensuelles par projet au 5 novembre 2026. L’organisation Neon sélectionnée est bien au plan `free`. Les quotas et éventuelles mises en veille doivent être respectés ; aucune offre payante ni aucun dépassement facturable ne sont activés par ce dépôt.

Références : https://render.com/docs/free et https://neon.com/pricing.

## Ressources

- Vercel : équipe `danielhangi77-2714`, projet principal `gestion-stock`, domaine confirmé `gestion-stock-green.vercel.app`.
- Render : `Daniel’s workspace`, service `srv-dbm8r4d6e07s73bggdg0`, plan `free`, région Francfort. API : https://gestion-stock-api-ovp8.onrender.com.
- Neon : projet `gestion-stock`, région AWS Francfort, PostgreSQL 17. La base `gestion_stock` est dédiée à l’application ; `gestion_stock_test` est séparée pour les contrôles automatisés.

Le projet Vercel `gestion-stock-1fo6` est un doublon existant. Son ancienne configuration produisait un statut GitHub en échec à chaque push (absence de `VITE_API_URL`). Ses paramètres Vite/Node 24 et son URL API ont été alignés sur le projet principal ; son redéploiement a réussi et les deux statuts Vercel sont maintenant verts. L’adresse officielle demeure `gestion-stock-green.vercel.app`.

## Vercel

Framework Vite, Node 24, racine du dépôt. `vercel.json` définit l’installation pnpm, la compilation du frontend et la sortie `frontend/dist`. `VITE_API_URL=https://gestion-stock-api-ovp8.onrender.com` est configurée en production et preview, puis intégrée au bundle déployé.

Le déploiement précédent échouait précisément parce que cette variable était absente. Les réglages du projet ont été corrigés de Next.js vers Vite. La protection Vercel n’est pas modifiée par les fichiers de ce dépôt.

## Render

`render.yaml` ne contient qu’un service Web Node `gestion-stock-api`, au plan `free`. Aucun disque, service privé ou autre ressource payante.

```text
Build:
npx --yes pnpm@11.25.0 install --frozen-lockfile && npx --yes pnpm@11.25.0 --filter backend build

Start:
node backend/scripts/start-hosted.mjs

Health check:
/api/health
```

Le service gratuit peut se mettre en veille après inactivité ; le premier accès peut être lent. Le health check confirme le processus, sans réveiller continuellement la base gratuite. Le démarrage contrôle la connexion et les migrations avant d’exposer l’API.

Variables : `DATABASE_URL`, `DATABASE_MIGRATION_URL` (directe), `ALLOWED_ORIGINS=https://gestion-stock-green.vercel.app`, et les identifiants initiaux des deux comptes. Les mots de passe sont générés par Render. Le bootstrap ne les remplace jamais sur un compte déjà présent. Les variables de base PostgreSQL sont des secrets, uniquement côté serveur.

Première connexion : administrateur `danielhangi77@gmail.com` et responsable `responsable@gestion-stock.local`. Leurs mots de passe initiaux sont respectivement `ADMIN_PASSWORD` et `MANAGER_PASSWORD`, consultables dans la page Environment du service Render. L’administrateur peut ensuite modifier les comptes dans l’application.

Un push sur `main` déclenche Vercel et les tests GitHub. Render est configuré pour attendre les checks. Le 5 novembre 2026, l’utilisateur a confirmé avoir relié et autorisé le dépôt GitHub dans Render. Un nouveau push de documentation sert à vérifier le déclenchement automatique ; cette autorisation seule ne constitue pas une preuve de déploiement. La mise à jour initiale du stock unique avait été déclenchée manuellement après réussite de la CI. Le démarrage applique les migrations PostgreSQL et préserve les données existantes.

## Migrations et sauvegardes

Le runner utilise une connexion directe, un verrou consultatif PostgreSQL et une transaction pour chaque fichier SQL. Les versions et checksums sont enregistrés. Toute erreur provoque rollback et interrompt le démarrage. Ajouter un nouveau fichier de migration pour toute évolution ; ne pas modifier une migration déjà appliquée.

La base gratuite ne remplace pas une politique de sauvegarde : exporter régulièrement avec `pg_dump` via la connexion directe et tester `pg_restore` sur une base isolée. Les identifiants doivent rester dans un gestionnaire de secrets, sans apparaître dans les arguments, journaux ou fichiers versionnés.

## Vérification réelle

Le statut d’un Blueprint n’est pas une preuve de disponibilité de l’application. Vérifier séparément : déploiement API `live`, frontend Vercel `READY`, connexion des deux rôles, entrée puis sortie, refus d’une quantité excessive et conservation des données après un autre déploiement. Les étapes exécutées sont consignées dans `docs/verification.md`.
