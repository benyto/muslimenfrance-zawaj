# Revue de sécurité — V2

Revue statique du 15 novembre 2026, comparée à [la V1](security.md). Base : commit `51d92fa` plus changements locaux présents pendant la revue, notamment checkout/consentement. Les fichiers ont continué à évoluer pendant l’analyse. Aucun test offensif contre des utilisateurs réels, aucune inspection des permissions déployées. « Corrigé » signifie que le correctif est présent dans le code et les migrations examinés, pas qu’il est déployé.

P1 : contrôle important ou risque significatif à traiter. P2 : durcissement à planifier. Aucun P0 établi dans les chemins examinés ; la suppression effective des anciennes copies publiques n’est pas vérifiée.

## Suivi de chaque constat V1

| Constat V1 | État V2 | Preuve / réserve |
|---|---|---|
| Photos privées accessibles par URL permanente | Corrigé dans le nouveau stockage ; migration historique à vérifier | Bucket privé, policy `can_read_photo_object`, URL signées de 10 minutes. Vérifier séparément la suppression des anciennes copies UploadThing. |
| Clé de photo étrangère utilisée pour supprimer un fichier | Corrigé dans le code/SQL | Clés générées serveur, unicité, aucune insertion/suppression client ; API vérifie le propriétaire. |
| Contournement PostgREST de la messagerie | Corrigé dans le code/SQL | Inserts directs révoqués ; commande SQL service role, vérification des profils et de l’abonnement. |
| Données du compte A conservées lors du passage à B | Correctif présent, validation navigateur restante | Annulation et purge du QueryClient à changement d’identité, montées dans la racine. Les clés privées restent majoritairement non partitionnées. |
| Signalements arbitraires et hors quota | Corrigé pour les scénarios V1 | Cible vérifiée, participation au message vérifiée, insert direct retiré, longueur SQL et unicité partielle des signalements ouverts. |
| « Bloquer » signifie seulement ignorer | Toujours présent, partiellement expliqué dans la confirmation | Libellé inchangé ; le texte précise ce que le demandeur ne verra plus, mais pas que l’autre peut toujours le voir et lui écrire. |
| Suppression sans nettoyage fichiers/abonnement | Partiellement corrigé | Annulation Stripe et suppression Storage précèdent Auth ; restent erreurs et courses décrites ci-dessous. |

Sources : [bucket privé et règle d’accès](supabase/migrations/20261114100000_photo_storage_bucket.sql), [photos API](apps/api/src/routes/photos.ts), [écritures serveur](supabase/migrations/20261111090000_server_only_writes.sql), [purge du cache](apps/web/app/lib/auth/useClearCacheOnIdentityChange.ts), [montage racine](apps/web/app/root.tsx), [signalements](apps/api/src/routes/reports.ts), [suppression](apps/api/src/routes/gdpr.ts).

## Constats

### SEC-V2-01 — P1 — Une erreur de lecture du profil laisse continuer l’effacement sans nettoyer ses photos

Dans `/gdpr/delete`, la lecture `ownProfile` récupère `data` mais ignore `error`. Si cet appel échoue, `ownProfile` est nul et toute la suppression Storage est sautée. Si l’appel Auth suivant réussit, les cascades retirent les références SQL et les fichiers restent stockés sans leur ligne de rattachement. L’échec est traité comme « pas de profil » alors que l’application ne sait pas si un profil existe.

Récupérer et vérifier `profileError` ; refuser de continuer tant que l’inventaire est inconnu. Ajouter un test injectant une erreur sur cette lecture, puis vérifier que l’utilisateur et les références restent présents et qu’Auth delete n’est pas appelé.

Source : [suppression, lecture `ownProfile`](apps/api/src/routes/gdpr.ts:110). Il s’agit d’un défaut de traitement d’erreur constaté par lecture, pas d’une fuite exécutée.

### SEC-V2-02 — P1 — L’effacement ne ferme pas les écritures concurrentes

L’effacement annule les abonnements connus, inventorie et retire les fichiers, puis supprime le compte. Aucun état de suppression ni verrou partagé avec `/photos` ou `/stripe/checkout` ne ferme les autres opérations. Un upload autorisé au même moment peut créer des objets après l’inventaire ; la cascade supprimera leur ligne, ou l’insertion échouera et dépendra d’un nettoyage compensatoire non durable. Un checkout créé pendant cette fenêtre peut également échapper à la liste initiale des abonnements.

Introduire un cycle de suppression avec mise à l’écart du compte, refus des nouvelles opérations, suivi persistant des ressources distantes et réconciliation finale. Pour Stripe, traiter aussi les sessions de checkout encore ouvertes. Tester les entrelacements upload/effacement et checkout/effacement. Une révocation de session seule ne termine pas les requêtes déjà authentifiées.

Sources : [suppression](apps/api/src/routes/gdpr.ts), [upload](apps/api/src/routes/photos.ts), [checkout](apps/api/src/routes/stripe.ts). L’ancien défaut « aucun nettoyage » est donc corrigé, mais la garantie d’effacement sous concurrence reste incomplète.

### SEC-V2-03 — P2 — Le libellé « Bloquer » reste plus fort que le comportement

Le chat affiche toujours « Bloquer »/« Débloquer », en appelant `profile_ignores`. La confirmation explique correctement que l’acteur ne verra plus les messages et le profil ; elle ne dit pas que l’autre conserve ses possibilités de lecture et d’envoi. Le test d’intégration confirme explicitement ce choix unidirectionnel.

Employer « Ignorer » de façon cohérente, ou expliciter l’effet unidirectionnel dans la confirmation. Un blocage mutuel exige une décision produit et des règles serveur ; il ne doit pas être déduit du simple changement de libellé. La sévérité est ramenée à P2 car l’effet local est maintenant décrit au moment de confirmer.

Sources : [chat](apps/web/app/routes/messages/$profileId.tsx:253), [test d’ignore](apps/api/test/messages.test.ts), [décision SQL](supabase/migrations/20260808130000_retire_mutual_block.sql).

## Garanties et réserves des photos privées

La règle Storage vérifie le propriétaire, les modérateurs, l’approbation des profils/photos et le droit de voir une photo privée. Un chemin divulgué ne suffit plus à signer un nouveau lien. Les variantes suivent la même règle. Le serveur reconstruit les images et abandonne les métadonnées EXIF/GPS.

Une URL déjà signée reste une capacité temporaire : le retrait d’accès bloque les nouvelles signatures, pas nécessairement un lien encore valable ou une copie déjà téléchargée. Le TTL courant est de 10 minutes dans l’interface ; l’export du propriétaire délivre des liens de 7 jours. Ce sont deux usages distincts à documenter. Aucune solution ne reprend les copies déjà enregistrées par le destinataire.

Les migrations commentent un script `scripts/migration/09-photos-to-supabase-storage.ts`, absent de l’arbre examiné. Ce n’est pas une preuve que la migration a échoué, mais le dépôt ne permet pas de vérifier la purge d’UploadThing. Avant clôture opérationnelle du P0 historique, obtenir un inventaire des anciens fichiers et confirmer que leurs anciennes URL ne servent plus les photos.

Sources : [signature et TTL](apps/web/app/lib/photo-urls.tsx), [export](apps/api/src/lib/gdpr/export.ts), [migration Storage](supabase/migrations/20261114110000_photos_use_storage.sql), [traitement Sharp](apps/api/src/lib/photos/process.ts).

## Validation et prochaines vérifications

Les tests versionnés couvrent désormais droits intercomptes, signatures Storage, refus des inserts directs, signalements, exports et effacement. Ils n’ont pas été exécutés localement pendant cette V2 : Docker et stack Supabase locale indisponibles. Les 21 tests exécutés portent sur pagination et échappement des e-mails ; ils ne prouvent pas les autorisations SQL. Typecheck et build complets passent sous Node `24.19.0`.

Priorités : injecter les erreurs d’effacement, tester ses courses, puis valider A → B dans le navigateur avec une requête ancienne encore en vol et des URL photo en attente. Vérifier enfin migrations appliquées, bucket réellement privé, anciennes copies supprimées et proxy/CSP sur l’hébergement. Ces éléments de déploiement ne sont pas déclarés défaillants sans inspection.

La cohérence des abonnements et les trous de journalisation sont détaillés dans [architecture V2](architecture-v2.md).
