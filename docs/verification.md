# Vérifications de la version centrée sur les mouvements

Mise à jour hébergement : quatre suites réussies, comprenant la configuration MySQL par références Render. Le Blueprint a passé le schéma JSON officiel Render. Le test d’initialisation vérifie aussi l’absence de droits DDL et d’écriture directe sur le registre pour le compte API. La validation du plan Render et le déploiement effectif sont suivis séparément.

Exécutées sur le poste de développement, avec une base MySQL de test isolée ; aucune vérification de production n’est revendiquée.

- Compilation frontend Vite et contrôle TypeScript : réussis, avec une URL HTTPS fictive d’API pour le build.
- Compilation backend Next.js 16.4.5 et contrôle TypeScript : réussis.
- Les quatre migrations ont été appliquées et vérifiées sur une base vierge.
- Trois suites de tests réussies, aucun test ignoré : découpage SQL, API avec permissions, transactions MySQL.
- Initialisation d’une base vierge vérifiée avec les quatre migrations ; un deuxième lancement conserve les deux comptes et leurs mots de passe. La base temporaire de ce contrôle a été supprimée ensuite.

## Scénarios exercés

- Entrée 100, sortie 30, stock 70 ; sortie 71 refusée.
- Transfert 20 sans modification du total global.
- Deux sorties simultanées de 8 sur un stock 10 : une seule réussit.
- Échec de la deuxième ligne : la première ligne est annulée par rollback.
- Validation répétée : aucune duplication.
- Contrepassation refusée au responsable, permise à l’administrateur, idempotente et rapprochée du registre.
- Création de brouillon protégée par clé idempotente ; réemploi avec un autre contenu refusé.
- Responsable refusé sur les routes utilisateurs et création d’articles.
- Modification d’un document validé refusée ; validation d’un brouillon annulé refusée.
- État de stock et filtres du journal cohérents après entrée, sortie et correction.
- Cycle de catégories refusé ; suppression d’un article utilisé refusée.
- Désactivation du responsable : session immédiatement révoquée.

## Limites de vérification et déploiement

Le contrôle visuel automatique n’a pas été effectué : le navigateur a refusé l’accès à localhost lors de la première étape et l’accès à Chrome n’a pas été autorisé lors de cette étape. Aucun contournement n’a été tenté.

GitHub a confirmé un statut Vercel réussi pour l’ancienne version `3193c27` du projet `gestion-stock`, et un statut en échec pour `gestion-stock-1fo6`. Les nouveaux réglages et déploiements doivent être vérifiés avec les intégrations Vercel et Render connectées. Les comptes distants, URL de l’API et base hébergée n’ont pas encore été inspectés.
