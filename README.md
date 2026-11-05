# StockMaster — entrées et sorties de stock

Application en français destinée à fonctionner **en ligne** : interface React sur Vercel, API Next.js sur Render et base MySQL persistante. Les mouvements et utilisateurs sont enregistrés sur le serveur ; aucune base métier ni brouillon ne sont conservés dans le navigateur. Les anciennes données locales du prototype sont effacées à l’ouverture.

## Deux rôles

| Fonction | Administrateur | Responsable |
| --- | --- | --- |
| Consulter les articles et le stock | Oui | Oui |
| Créer/modifier/annuler des brouillons | Oui | Oui |
| Enregistrer et valider entrées, sorties, transferts | Oui | Oui |
| Consulter les opérations, leurs articles et leurs auteurs | Oui | Oui |
| Filtrer et exporter les états de stock | Oui | Oui |
| Contrepasser une opération validée | Oui | Non |
| Gérer les articles, catégories, unités, partenaires et dépôts | Oui | Non |
| Gérer les utilisateurs et leurs rôles | Oui | Non |
| Consulter l’audit et configurer l’organisation | Oui | Non |

Les contrôles sont exécutés dans l’API. Masquer un bouton ne constitue pas la protection. Un compte responsable ne peut pas accéder aux routes d’administration par appel direct. Les anciens comptes lecteurs sont désactivés, sans suppression de leurs traces historiques. Le dernier administrateur actif est protégé contre la désactivation ou le retrait de son rôle.

## Parcours principal

1. L’administrateur crée les catégories, unités, dépôts et articles.
2. Le responsable prépare une **entrée** ou une **sortie**, avec dépôt, motif, référence du bon et plusieurs lignes d’articles.
3. Le brouillon peut être consulté, modifié ou annulé. Il ne modifie pas le stock.
4. La validation applique toutes les lignes dans une transaction. Toute quantité insuffisante annule l’ensemble de la validation.
5. Le journal conserve référence, date, auteur, motif, articles, statut et correction éventuelle.

Les documents validés ne peuvent pas être modifiés ou annulés par les routes de brouillon. Une correction administrative crée une contrepassation liée à l’original. Elle conserve l’historique et refuse aussi le stock négatif.

Le journal est paginé et filtrable par type, statut, dépôt, période, article, SKU, référence ou bon. Le CSV du journal correspond explicitement à la page affichée. L’état de stock exportable calcule ouverture, entrées, sorties et clôture sur la période sélectionnée, avec des journées UTC. Les heures affichées utilisent le fuseau de l’organisation.

## Hébergement et push GitHub

Voir [le guide de déploiement](docs/deployment.md).

- `vercel.json` : compilation du frontend depuis la racine du dépôt.
- `render.yaml` : configuration à rattacher au service Render existant, après confirmation de son nom.
- `.github/workflows/verify.yml` : compilation et tests sur MySQL 8.4 à chaque push sur `main`.
- `backend/scripts/start-hosted.mjs` : migrations versionnées puis initialisation idempotente des comptes avant lancement de l’API.

Un push ne copie jamais une base de développement sur la base hébergée. Il applique uniquement les migrations SQL non encore exécutées. Les données et mots de passe existants sont conservés. Une erreur de migration empêche le démarrage de la nouvelle API.

Le déploiement réel exige que les projets Vercel/Render soient reliés à GitHub et que leurs variables d’environnement soient configurées. La présence de ces fichiers ne prouve pas à elle seule que les comptes distants ont été configurés.

## Variables hébergées

Frontend : `VITE_API_URL` doit être l’URL HTTPS publique du backend Render. Une compilation de production sans cette URL, ou avec `localhost`, est refusée.

Backend : `MYSQL_URL`, `MYSQL_MIGRATION_URL` (compte de migration si distinct), `MYSQL_SSL_CA` si requis par la base, `ALLOWED_ORIGINS` (origines exactes Vercel, séparées par des virgules). Au premier lancement : `ADMIN_EMAIL`, `ADMIN_PASSWORD`, et éventuellement `MANAGER_EMAIL`, `MANAGER_PASSWORD`. Les mots de passe initiaux comportent au moins 12 caractères et sont définis dans le gestionnaire de variables Render. Le bootstrap ne remplace jamais le mot de passe d’un compte existant.

Ne pas définir de secret MySQL dans les variables `VITE_*`. Les fichiers `.env` et `.local/` sont exclus de Git.

## Architecture et intégrité

`frontend/` : React, TypeScript, Vite et manifeste PWA. `backend/` : Next.js Route Handlers. `sql/` : migrations versionnées. `tests/` : tests du registre et des permissions. `docs/` : architecture, déploiement et vérifications.

Les quantités utilisent `DECIMAL(18,3)` ; les coûts `DECIMAL(18,4)`. Le registre signé des mouvements validés est la source de vérité. Les soldes sont actualisés dans la même transaction. Les références lisibles sont générées par un compteur verrouillé, par type et année UTC. Les transactions verrouillent les soldes dans l’ordre dépôt/produit. Les clés idempotentes protègent la création et la validation.

Les sessions utilisent un jeton aléatoire de 256 bits, haché en base et valable huit heures, conservé uniquement en mémoire dans le navigateur. Les mots de passe utilisent scrypt avec sel aléatoire. Modifier ou désactiver un utilisateur révoque ses sessions. Le service worker met en cache l’enveloppe de l’interface, jamais les réponses de l’API ; une connexion est obligatoire pour se connecter et enregistrer les opérations.

## Vérification pour le développement

Node.js 24 et pnpm 11.25.0 sont utilisés. Pour les tests, utiliser exclusivement une base MySQL isolée et migrée, puis définir `TEST_MYSQL_URL`. La suite lance sa propre API de test sur un port temporaire. Elle crée et supprime uniquement ses données de test.

```text
pnpm install --frozen-lockfile
pnpm --filter backend migrate
pnpm build
pnpm test
```

La compilation nécessite `VITE_API_URL`. La CI emploie une URL HTTPS fictive pour vérifier la compilation, sans effectuer de déploiement ni d’appel à cette URL. Les migrations nécessitent `MYSQL_MIGRATION_URL` ou `MYSQL_URL`.

Voir [les vérifications exécutées](docs/verification.md). Les inventaires physiques avec sessions de comptage et le scan caméra ne sont pas implémentés dans cette version. Le coût affiché sert à une valorisation indicative, sans méthode comptable FIFO ou CUMP.
