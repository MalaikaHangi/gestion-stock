# StockMaster — gestion des entrées et sorties

Application en français, hébergée en ligne : interface React sur Vercel, API Next.js sur Render gratuit et PostgreSQL sur **Neon Free**. Aucun service payant, disque payant ni base MySQL ne fait partie du déploiement.

## Deux rôles

| Fonction | Administrateur | Responsable |
| --- | --- | --- |
| Consulter les articles et le stock | Oui | Oui |
| Créer, modifier et annuler des brouillons | Oui | Oui |
| Valider les entrées, sorties et transferts | Oui | Oui |
| Consulter l’historique et exporter les états | Oui | Oui |
| Contrepasser un mouvement validé | Oui | Non |
| Gérer les articles et référentiels | Oui | Non |
| Gérer les utilisateurs, paramètres et audit | Oui | Non |

Les autorisations sont contrôlées par l’API. Les comptes utilisent des mots de passe scrypt et des sessions à jeton aléatoire, haché en base. Le jeton reste en mémoire dans le navigateur. Le dernier administrateur actif ne peut pas être désactivé ou rétrogradé.

## Opérations de stock

L’administrateur crée les catégories, unités, dépôts et articles. Le responsable enregistre ensuite un brouillon d’entrée ou de sortie avec motif, bon, dépôt et plusieurs articles. La validation met à jour toutes les lignes dans une même transaction PostgreSQL ; le moindre échec annule tout. Les sorties qui dépassent le stock disponible sont refusées.

Les brouillons peuvent être corrigés ou annulés sans effet sur le stock. Un document validé reste immuable dans l’API. Sa correction administrative crée une contrepassation liée à l’original, avec conservation de l’historique. Une contrepassation ne peut pas rendre le stock négatif.

Le journal est paginé et filtrable par type, dépôt, statut, période, article, SKU, motif ou bon. L’état de stock calcule ouverture, entrées, sorties et clôture sur des journées UTC. Les heures affichées suivent le fuseau de l’organisation. Les exports sont au format CSV ; celui du journal correspond explicitement à la page affichée.

## Hébergement gratuit

- Vercel : frontend Vite, projet `gestion-stock`.
- Render : API `gestion-stock-api`, plan explicitement `free`.
- Neon : projet `gestion-stock`, organisation sur le plan `free`, PostgreSQL 17.

Neon Free est annoncé sans limite de durée et sans carte bancaire, dans ses quotas. PostgreSQL gratuit sur Render expire après 30 jours ; il n’a donc pas été retenu pour le stockage durable du projet. Aucune évolution vers une offre payante n’est autorisée automatiquement. Les offres gratuites ont des limites de stockage, de calcul et des mises en veille : voir [le déploiement](docs/deployment.md).

Les anciennes ressources MySQL n’ont jamais été déployées sur Render. Leur Blueprint a été désactivé. La configuration courante ne contient qu’une API gratuite.

## Après un push

Le workflow GitHub utilise une vraie instance PostgreSQL 17 pour appliquer les migrations, compiler et tester les opérations critiques. Render peut déployer après les contrôles CI ; Vercel déploie le frontend via son intégration Git.

Le démarrage hébergé attend PostgreSQL, applique les migrations versionnées puis initialise les comptes absents. Un nouveau push ne remet pas la base à zéro et ne change pas les mots de passe existants. Les migrations PostgreSQL sont transactionnelles et protégées par un verrou ; leur checksum interdit de modifier silencieusement une version déjà appliquée.

## Configuration

Frontend : `VITE_API_URL` = URL HTTPS publique de l’API. La compilation de production refuse une URL locale ou absente.

Backend : `DATABASE_URL` = connexion PostgreSQL ; `DATABASE_MIGRATION_URL` = connexion directe pour les migrations, notamment si la connexion applicative utilise un pooler ; `ALLOWED_ORIGINS` = origines exactes du frontend, sans barre finale. `DATABASE_SSL_CA` est facultative pour une autorité TLS spécifique. Les connexions externes vérifient le certificat TLS.

Au premier lancement : `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `MANAGER_EMAIL`, `MANAGER_PASSWORD`. Les mots de passe générés par Render restent dans les variables du service, jamais dans Git. L’alias initial du responsable est `responsable@gestion-stock.local` ; l’administrateur peut modifier son e-mail dans Utilisateurs. Aucun e-mail n’est envoyé automatiquement.

## Développement et vérification

Node.js 24, pnpm 11.25.0. Les migrations sont dans `sql/postgres/`. Pour les tests, utiliser exclusivement une base PostgreSQL séparée et définir `TEST_DATABASE_URL`.

```text
pnpm install --frozen-lockfile
pnpm --filter backend migrate
pnpm build
pnpm test
```

La compilation exige `VITE_API_URL`. La CI utilise une adresse HTTPS fictive pour compiler sans déployer. Les tests de transactions et d’API sont ignorés si `TEST_DATABASE_URL` est absente ; leur réussite n’est revendiquée qu’après exécution sur une vraie base.

Les quantités et coûts sont des NUMERIC exacts. Le registre signé est la source de vérité ; les soldes sont actualisés dans la même transaction par les fonctions PostgreSQL de validation et de contrepassation. Les clés idempotentes empêchent les doubles validations. Les références métier sont attribuées par compteur transactionnel, par type et année UTC.

Le navigateur ne conserve aucune base métier ni brouillon local. Le service worker met en cache uniquement l’enveloppe de l’interface. Les opérations exigent une connexion au serveur. Les inventaires physiques avec sessions de comptage et le scan caméra ne sont pas encore implémentés ; la valorisation au coût renseigné reste indicative, sans FIFO ou CUMP.
