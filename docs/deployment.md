# Déploiement prévu

Cette étape prépare les sources ; elle ne constitue pas un déploiement de production validé.

## Frontend / Vercel

Importer le dépôt GitHub. Framework Vite, dossier racine `frontend`, commande de compilation `pnpm build`, sortie `dist`. Définir `VITE_API_URL=https://votre-api.onrender.com`. La valeur est publique et compilée dans le frontend ; reconstruire après modification.

## Backend / Render

Créer un Web Service Node depuis le dépôt, avec la racine du dépôt, commande build `pnpm install --frozen-lockfile && pnpm --filter backend build`, commande start `pnpm --filter backend start --hostname 0.0.0.0 --port $PORT`. Utiliser Node 24 et la version pnpm du package.json. Définir `MYSQL_URL`, `MYSQL_SSL_CA` si TLS avec autorité dédiée, `ALLOWED_ORIGINS=https://votre-frontend.vercel.app`. Health check : `/api/health`.

Les migrations doivent être lancées explicitement et une seule fois avant mise en service, dans un environnement ayant accès au même serveur MySQL. Ne pas les lancer à chaque démarrage d’instance.

## MySQL persistant

Render ne fournit pas automatiquement une base MySQL managée avec le backend. Choisir un fournisseur MySQL externe avec TLS, sauvegardes et accès réseau autorisé depuis Render, ou une instance MySQL sur un service privé Render avec disque persistant. Cette seconde option demande d’administrer soi-même MySQL et ses sauvegardes. Les services/disques choisis peuvent être payants ; confirmer l’offre dans le tableau de bord avant de les créer.

Créer un utilisateur de migration distinct du compte applicatif. Ce dernier doit avoir uniquement les privilèges nécessaires aux routes et à l’exécution des procédures, sans DDL ni accès aux autres bases. Les écritures de stock passent uniquement par la procédure ; éviter de fournir des privilèges directs sur `ledger` et `stock_balances`. Tester les droits et `SQL SECURITY DEFINER` avec l’administrateur MySQL.

Sauvegarder avec un outil MySQL cohérent (par exemple `mysqldump --single-transaction --routines`) et conserver des copies chiffrées hors instance. Tester la restauration sur une base isolée. Les instantanés d’un disque ne remplacent pas une sauvegarde logique testée. En cas de migration DDL interrompue, inspecter les objets existants avant relance : MySQL ne garantit pas un rollback transactionnel de toute une migration DDL. Le runner mémorise seulement les migrations terminées. Privilégier les migrations additives et un retour de version applicative compatible.

## Documentation officielle consultée le 5 novembre 2026

- Next.js : https://nextjs.org/docs/app/getting-started/installation (Node minimum 20.9, projet basé sur Node 24).
- Render / Next.js : https://render.com/docs/deploy-nextjs-app
- Render / MySQL : https://render.com/docs/deploy-mysql
- Render / disques : https://render.com/docs/disks
- Vercel / Vite : https://vercel.com/docs/frameworks/frontend/vite

À valider sur les comptes choisis : disponibilité régionale, offres, limites de connexion MySQL, domaines, TLS et sauvegardes. Aucun tarif supposé.
