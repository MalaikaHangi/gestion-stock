# Vérifications PostgreSQL

La compilation Next.js et Vite réussit après remplacement du pilote et du SQL MySQL par PostgreSQL. Les deux migrations sont appliquées sur une base de test Neon séparée. Les trois suites PostgreSQL passent sans échec : API et permissions, configuration TLS, atomicité et concurrence des mouvements. Elles utilisent une base Neon de test séparée de la production.

Les contrôles antérieurs sur MySQL appartenaient au prototype précédent et ne sont pas présentés comme preuve de compatibilité PostgreSQL.

Vercel : accès authentifié à l’équipe confirmé. Les journaux du déploiement précédent montrent l’absence de `VITE_API_URL`. Le framework a été corrigé vers Vite, Node 24 et sortie `frontend/dist`. Le domaine de production confirmé est `gestion-stock-green.vercel.app`.

Render : aucun service payant créé. Le Blueprint MySQL non appliqué est désactivé. Le fichier courant décrit seulement une API gratuite reliée à Neon Free.
