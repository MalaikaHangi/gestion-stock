# Vérifications de la première étape

- Compilation TypeScript frontend : réussie.
- Build Vite frontend : réussi ; production générée dans `frontend/dist` (non versionné).
- `git diff --check` : réussi.
- Test d’intégration MySQL : réussi sur MySQL 8.4.13, base locale isolée `gestion_stock_test`.
- Vérification visuelle navigateur : non effectuée ; accès à localhost refusé par la politique du navigateur.
- Backend Next.js 16.4.5 : compilation de production et vérification TypeScript réussies.
- API locale : santé, refus d’accès anonyme, connexion administrateur, origine CORS autorisée, catalogue et révocation de session vérifiés.
- Migrations : schéma et procédure appliqués sur les deux bases locales.
- Signature Authenticode du serveur MySQL : valide, Oracle America, Inc.

Le test MySQL utilise uniquement une base isolée dédiée et migrée. Il crée puis supprime ses jeux de données. Ne jamais définir `TEST_MYSQL_URL` sur une base de production. Depuis la racine, après installation backend :

```powershell
$env:TEST_MYSQL_URL='mysql://test:mot-de-passe@localhost:3306/gestion_stock_test'
node --test tests/*.test.mjs
```

Scénarios couverts par le test écrit : entrée 100, sortie 30, refus de 71, transfert 20, validation répétée et deux sorties concurrentes de 8 sur un solde de 10. Les tests de permissions, contrepassation, inventaires et migration vierge restent à compléter.
