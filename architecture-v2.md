# Revue d’architecture et des choix techniques — V2

Revue du 15 novembre 2026, comparée à [la V1](architecture.md) du 8 novembre. Base : commit `51d92fa` et arbre de travail présent pendant la revue, y compris les changements non commités de checkout/consentement et d’export. Certains fichiers ont évolué pendant l’analyse : ce document décrit les chemins observés, pas un état immuable ni un déploiement vérifié. Les dates des migrations ne prouvent pas leur application.

P1 : risque important de cohérence ou d’exploitation. P2 : amélioration à planifier. Aucun P0 établi dans le périmètre examiné ; cela ne vaut pas certification de l’application.

## Architecture actuelle

Le monorepo conserve une séparation cohérente : SPA React Router dans `apps/web`, API Fastify dans `apps/api`, validations/types dans `packages/shared`, schéma et commandes SQL dans `supabase/migrations`. Le navigateur lit via Supabase et réalise certaines mutations RLS ; les écritures sensibles passent par Fastify. Les invariants transactionnels de messagerie et de modération de texte résident en PostgreSQL.

Changement majeur depuis la V1 : UploadThing est remplacé dans le chemin applicatif par un bucket Supabase Storage privé. Fastify décode les images avec Sharp, retire les métadonnées et stocke deux variantes WebP. Le navigateur obtient des URL signées soumises aux permissions Storage. Stripe et Resend restent des intégrations serveur.

Sources : [composition API](apps/api/src/app.ts), [build API](apps/api/scripts/build.mjs), [traitement des images](apps/api/src/lib/photos/process.ts), [règles Storage](supabase/migrations/20261114100000_photo_storage_bucket.sql).

## Suivi des constats V1

| Constat V1 | État V2 | Éléments observés |
|---|---|---|
| API compilée non exécutable | Corrigé dans le build | Esbuild inclut le package partagé ; CI démarre l’artefact et appelle `/health`. Le build complet passe localement. |
| Frontières d’écriture sensibles contournables | Corrigé pour les cas identifiés | Grants directs retirés pour les insertions de photos, messages, conversations et signalements ; contraintes SQL complémentaires. |
| Webhooks perdus après déduplication | Partiellement corrigé | Claim atomique, états et reprise après erreur ; projection SQL en erreur propagée. Restent concurrence entre événements et e-mails non durables, ci-dessous. |
| Premier message hors transaction | Corrigé dans le code/SQL | Paire canonique, fusion des doublons et `send_message_command` transactionnel, réservé au service role. |
| Export silencieusement tronqué | Corrigé pour les lectures stables | Pagination ordonnée avec total et remontée des erreurs ; listes explicites de colonnes. La cohérence sous modifications concurrentes reste limitée. |
| CI limitée à compilation | Nettement amélioré | Job Supabase local avec migrations et tests d’intégration ; smoke test de l’artefact ; plus de lockfile pnpm dans l’arbre examiné. Couverture Stripe réelle et navigateur encore absente. |

Sources : [écritures serveur](supabase/migrations/20261111090000_server_only_writes.sql), [webhook](apps/api/src/routes/stripe.ts), [pagination export](apps/api/src/lib/paginate.ts), [export](apps/api/src/lib/gdpr/export.ts), [CI](.github/workflows/ci.yml).

## Constats restant à traiter

### ARC-V2-01 — P1 — Plusieurs checkouts peuvent créer plusieurs abonnements

`POST /stripe/checkout` vérifie seulement les abonnements locaux `trialing`/`active`, puis crée une session Stripe sans clé d’idempotence ni réservation par utilisateur. Deux appels avant la projection du premier abonnement — y compris deux ouvertures successives avant paiement — peuvent chacun retourner un lien utilisable. Deux paiements peuvent alors créer deux abonnements. Une erreur de lecture de l’abonnement existant est également ignorée, ce qui laisse continuer le checkout.

Créer/réutiliser un checkout ouvert par compte avec une réservation atomique, traiter les erreurs de lecture et définir la protection contre les abonnements multiples côté intégration Stripe. Vérifier deux appels simultanés, un renvoi après réponse perdue et l’exécution de deux liens. Ne pas se limiter à désactiver le bouton dans React.

Source : [route checkout](apps/api/src/routes/stripe.ts), lecture `existing` et `stripe.checkout.sessions.create`. Le consentement ajouté dans l’arbre de travail ne ferme pas cette course.

### ARC-V2-02 — P1 — La relecture Stripe ne sérialise pas les projections d’un même abonnement

La lecture de l’objet Stripe courant corrige les livraisons anciennes traitées séquentiellement. Cependant, le verrou `claim_webhook_event` est par identifiant d’événement. Deux événements différents d’un même abonnement peuvent être traités en parallèle : A lit l’état actif, B lit ensuite l’état annulé et l’écrit, puis A termine son upsert actif. Aucun verrou par abonnement ni garde de version ne rejette cette écriture devenue obsolète.

Sérialiser le traitement par abonnement avec une stratégie qui englobe la lecture Stripe et la projection, ou utiliser un mécanisme de réconciliation/version garantissant la convergence. Tester cet entrelacement avec un faux client Stripe contrôlable. Les tests actuels couvrent surtout la signature et le claim ; ils excluent explicitement les chemins qui relisent Stripe.

Sources : [projection et `currentSubscription`](apps/api/src/routes/stripe.ts), [claim par événement](supabase/migrations/20261115090000_webhook_event_state.sql), [tests webhook](apps/api/test/stripe-webhook.test.ts).

### ARC-V2-03 — P2 — Les e-mails sont rapides mais restent non durables

Les notifications de messages et de webhooks sont lancées sans attendre leur résultat. Cela retire Resend du temps de réponse, mais un arrêt du processus entre commit et envoi perd la notification. Pour Stripe, un événement déjà `processed` ne la rejouera pas. Si le marquage `processed` échoue, le handler renvoie néanmoins 200 et lance les e-mails ; une livraison ultérieure peut les répéter. Le commentaire « après enregistrement sûr » ne correspond donc pas à tous les chemins.

Si la livraison est requise, persister une tâche d’e-mail avec une clé unique, des tentatives et une reprise. Sinon documenter clairement cette garantie de meilleur effort. Le commit métier doit rester indépendant de la disponibilité de Resend.

Sources : [messages](apps/api/src/routes/messages.ts), [fin du webhook](apps/api/src/routes/stripe.ts).

### ARC-V2-04 — P2 — L’audit de modération peut manquer après une décision réussie

Les décisions sont écrites avant `insertAuditRow`, dont l’erreur est seulement journalisée. Une panne au second appel laisse la décision appliquée sans entrée d’audit. La minimisation des données du journal est une amélioration distincte et ne résout pas cette atomicité.

Mettre décision et audit dans une commande SQL transactionnelle pour les actions qui exigent une traçabilité complète, avec test de panne d’insertion du journal.

Source : [routes admin](apps/api/src/routes/admin.ts), `insertAuditRow` et appels après mutation.

## Vérifications effectuées et limites

- Node `24.19.0` : `npm run typecheck` et `npm run build` réussissent. Le build a nécessité l’autorisation d’ouvrir le port local de prérendu hors sandbox.
- 21 tests passent : `paginate.test.ts` et `email-templates.test.ts`, via `node --import tsx --test`.
- Les tests d’intégration Supabase n’ont pas été rejoués : Docker absent du PATH et aucun environnement de test local fourni. Le workflow et les tests ont été lus ; aucun résultat CI distant n’a été consulté.
- Aucun accès à des comptes réels, aucun appel Stripe/Resend réel ni vérification du déploiement, des anciennes ACL ou des migrations appliquées.
- L’essai initial sous Node `20.11.0` a échoué car inférieur au minimum déclaré ; ce n’est pas retenu comme défaut du projet.

Les points d’effacement et d’accès photo sont détaillés dans [sécurité V2](security-v2.md) ; les parcours de lecture dans [performance V2](performance-v2.md).
