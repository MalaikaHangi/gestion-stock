# Stock d’entreprise unique

L’application représente une entreprise et un stock unique. Aucun dépôt, transfert, partenaire, client, emplacement, unité, bon ou motif n’est demandé. Les identifiants techniques historiques restent en base pour conserver les documents déjà enregistrés.

La migration 003 additionne les quantités des anciens stocks. Les brouillons d’entrée et sortie sont rattachés au stock unique ; les brouillons de transfert sont annulés. Les documents validés et le registre restent conservés. La migration 004 permet de contrepasser leur effet net dans le stock unique.

L’administrateur ajoute, modifie, catégorise et supprime les articles. Un article déjà utilisé doit être désactivé pour préserver l’historique. Le SKU `ART-xxxxxxxx` est attribué par séquence PostgreSQL et reste inchangé après modification. Les API ignorent les anciennes sélections et refusent les nouveaux transferts.

L’inventaire physique compare la quantité attendue à la quantité comptée. Une correction confirmée par l’administrateur crée une entrée ou une sortie validée pour l’écart. Un comptage sans écart reste enregistré. La transaction verrouille le solde, refuse les lectures périmées et utilise une clé idempotente. Les 100 derniers comptages sont consultables par les deux rôles.

Les rapports journaliers, mensuels et annuels utilisent les journées UTC. PDF et Excel contiennent ouverture, entrées, sorties, clôture et valeur indicative. Les bibliothèques d’export se chargent à la demande.

Squelettes animés pendant les lectures, indicateurs de traitement, media queries et tables défilantes accompagnent les opérations. La connexion permet d’afficher le mot de passe. La déconnexion demande confirmation. Les mots de passe modifiés remplacent les valeurs initiales de bootstrap ; les variables Render ne réinitialisent pas les comptes existants.

Validation : compilation frontend/backend et cinq tests PostgreSQL/API/exports réussis sur une base Neon séparée. Ils couvrent permissions, SKU, idempotence, comptage périmé, quantités, sorties concurrentes, cellules Excel et PDF multipage. Le rendu visuel dans un navigateur n’a pas été vérifié durant cette intervention.
