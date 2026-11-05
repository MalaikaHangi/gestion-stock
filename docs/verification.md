# Vérifications PostgreSQL

La compilation Next.js et Vite réussit après remplacement du pilote et du SQL MySQL par PostgreSQL. Les deux migrations sont appliquées sur une base de test Neon séparée. Les trois suites PostgreSQL passent sans échec : API et permissions, configuration TLS, atomicité et concurrence des mouvements. Elles utilisent une base Neon de test séparée de la production.

Les contrôles antérieurs sur MySQL appartenaient au prototype précédent et ne sont pas présentés comme preuve de compatibilité PostgreSQL.

Vercel : accès authentifié à l’équipe confirmé. Les journaux du déploiement précédent montrent l’absence de `VITE_API_URL`. Le framework a été corrigé vers Vite, Node 24 et sortie `frontend/dist`. Le domaine de production confirmé est `gestion-stock-green.vercel.app`.

Déploiement du 5 novembre 2026, commit `c9aea0c` : Vercel `dpl_5axK2wFm1sZfrsJTEeFB6FD7fGnA` est `READY` et Render `dep-dbm8r556e07s73bggfmg` est `live`. Aucun service payant créé. Le Blueprint gratuit est en synchronisation automatique et l’API au plan `free`.

Contrôles HTTP réels : site de production 200, API `/api/health` 200, bundle frontend contenant l’URL Render exacte. Les deux comptes initiaux ont été créés au démarrage.

Contrôles authentifiés en production par sessions temporaires de vérification : stock, documents et catalogue accessibles aux deux rôles ; utilisateurs accessibles à l’administrateur et refusés au responsable (403) ; visite anonyme refusée (401), CORS du domaine Vercel et déconnexion confirmés. Sessions de vérification révoquées ; aucun mouvement ni article créé dans la base de production. Les mots de passe initiaux générés par Render n’ont pas été extraits ni affichés.

Limite : le rendu et les clics dans un navigateur n’ont pas été vérifiés, l’accès navigateur ayant été refusé précédemment. Les scénarios d’écriture et de concurrence ont été exécutés via l’API compilée sur la base Neon de test séparée.
