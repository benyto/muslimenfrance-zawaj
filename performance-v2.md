# Revue de performance — V2

Revue du 15 novembre 2026, comparée à [la V1](performance.md). Base : commit `51d92fa` et modifications locales observées pendant la revue. Analyse du code, des migrations et du build ; aucune mesure de latence de production, aucun benchmark de charge ni `EXPLAIN ANALYZE` réalisé. P1 désigne un coût amplifié sur un parcours fréquent ; P2 une optimisation à mesurer et planifier.

## Suivi des constats V1

| Constat V1 | État V2 |
|---|---|
| Polling et relectures excessives de messagerie | Partiellement corrigé : intervalle passé de 15 à 60 secondes ; liste toujours entière et invalidation globale des messages conservée. |
| Réponse d’envoi attend Resend | Corrigé pour la latence : envoi d’e-mail détaché ; cooldown atomique par destinataire. Durabilité encore limitée. |
| Index et curseur de l’historique | Corrigé pour historique : index `(conversation_id, created_at DESC, id DESC)` et curseur composite ; index partiel des non-lus toujours absent. |
| Découverte par offset et tri sans départage | Inchangé dans la RPC actuelle. |
| Grille utilisant l’image originale | Corrigé : variantes WebP `thumb`/`display`, métadonnées retirées, plus de stockage de l’original ; signatures groupées côté client. |
| Budget par route et coût de présence | Mesures de build actualisées ci-dessous ; aucune validation sous charge. Heartbeat et timer par badge toujours présents. |

Sources : [conversations](apps/web/app/lib/queries/useConversations.ts), [inbox](apps/web/app/lib/realtime/useInboxSubscription.ts), [historique](apps/web/app/lib/queries/useConversationMessages.ts), [email et index](supabase/migrations/20261114090000_message_email_claims.sql), [traitement des photos](apps/api/src/lib/photos/process.ts), [signature groupée](apps/web/app/lib/photo-urls.tsx).

## Constats à traiter

### PERF-V2-01 — P1 — Chaque message entrant invalide encore tout l’historique actif

L’inbox appelle toujours `invalidateQueries(["messages"])` pour chaque message entrant non ignoré, avant même de vérifier si le fil est ouvert au bas de l’écran. Le fil dispose déjà de son propre abonnement INSERT qui ajoute la ligne au cache. Les requêtes actives peuvent ainsi relire leurs pages chargées pour une donnée déjà reçue. L’envoi invalide également l’historique du fil. Le coût croît avec le nombre de pages consultées.

Mettre à jour le cache du fil et son résumé depuis l’événement ou la réponse d’envoi, avec déduplication et ordre total ; limiter les relectures à une reconnexion ou une resynchronisation ciblée. Vérifier le nombre d’appels sur 1, 10 et 50 pages chargées pour un message entrant, un message sortant et un message d’un autre fil. La fenêtre abonnement/chargement initial doit rester couverte pour ne pas perdre d’événement.

Sources : [invalidation inbox](apps/web/app/lib/realtime/useInboxSubscription.ts), [mise à jour locale](apps/web/app/lib/queries/useConversationMessages.ts), [mutation d’envoi](apps/web/app/lib/queries/useSendMessage.ts).

### PERF-V2-02 — P2 — La boîte de réception est toujours non paginée

Le polling de secours ne fait plus qu’un appel par minute, mais `get_my_conversations` retourne tous les fils, avec recherche de photo et décompte des non-lus pour chacun. Sa réponse est également soumise au plafond PostgREST, ce qui peut devenir une limite fonctionnelle pour les comptes ayant beaucoup de conversations. La lecture des non-lus n’a pas d’index partiel dédié dans les migrations examinées.

Paginer par `(last_message_at, id)`, conserver un compteur global séparé si l’interface en a besoin et comparer les plans avec un index partiel `(conversation_id, recipient_profile_id) WHERE is_read = false`. Ne pas ajouter l’index sans mesurer son coût d’écriture. Mesurer p95 et lignes lues sur des comptes à 100, 1 000 et 5 000 fils.

Sources : [RPC actuelle](supabase/migrations/20261114110000_photos_use_storage.sql), fonction `get_my_conversations` ; [plafond REST](supabase/config.toml), [index messages](supabase/migrations/20261114090000_message_email_claims.sql).

### PERF-V2-03 — P2 — La découverte conserve offset, tri instable et calcul d’âge

La dernière définition de `search_profiles` trie uniquement par `updated_at DESC`, puis applique `LIMIT/OFFSET`. Deux profils au même horodatage n’ont pas d’ordre garanti, les mises à jour déplacent les pages et les offsets élevés augmentent le travail. Les filtres d’âge utilisent toujours `date_part('year', age(birthdate))`.

Évaluer un curseur `(updated_at, id)` et des bornes sur `birthdate`, avec index adapté aux profils approuvés/non supprimés. Tester les anniversaires et années bissextiles avant toute réécriture. La pagination par curseur réduit les déplacements sans fournir à elle seule un instantané figé de la recherche.

Sources : [RPC actuelle](supabase/migrations/20261114110000_photos_use_storage.sql), fonction `search_profiles` ; [client découverte](apps/web/app/lib/queries/useDiscoverProfiles.ts).

### PERF-V2-04 — P2 — Export complet en mémoire et sans instantané cohérent

`fetchAll` résout le plafond de lignes et remonte les erreurs, mais l’export accumule chaque table puis sérialise le résultat complet. Le total exact est recalculé à chaque page. Un compte volumineux mobilise donc mémoire, requêtes et connexion HTTP pendant tout le traitement. Des suppressions/inserts concurrents peuvent déplacer les offsets ; une longueur conforme au dernier total ne démontre pas à elle seule l’absence de doublons ou d’omissions.

Mesurer durée et mémoire sur un historique important. Si nécessaire, utiliser une tâche d’export avec borne de lecture cohérente et téléchargement temporaire ; à plus petite échelle, un curseur stable et une stratégie explicite face aux modifications concurrentes suffisent souvent. Ne pas présenter le correctif de pagination comme une garantie d’instantané transactionnel.

Sources : [pagination](apps/api/src/lib/paginate.ts), [assemblage export](apps/api/src/lib/gdpr/export.ts).

### PERF-V2-05 — P2 — Le décodage des images n’a pas de budget de concurrence global

Les fichiers sont bornés à 12 Mo et 50 millions de pixels ; chaque upload produit deux variantes en parallèle. La limite de 30 uploads/minute/utilisateur contrôle le débit, pas le nombre de transformations simultanées entre utilisateurs. Une rafale peut mettre en concurrence de nombreux buffers et décodages natifs. Ce risque concerne désormais l’API puisque le traitement n’est plus délégué à UploadThing.

Mesurer RSS, durée de traitement et retard de boucle événementielle sous uploads simultanés ; établir ensuite une limite de transformations en vol et une réponse de saturation contrôlée. Les seuils doivent venir des ressources du serveur, pas d’une estimation de la taille compressée seule.

Sources : [upload et limites](apps/api/src/routes/photos.ts), [décodage/variantes](apps/api/src/lib/photos/process.ts).

## Build et présence

Build complet réussi sous Node `24.19.0`, après autorisation du port de prérendu hors sandbox. Tailles de fichiers individuels, sans additionner arbitrairement les dépendances chargées par chaque route :

| Artefact | Gzip V1 | Gzip V2 |
|---|---:|---:|
| `entry.client` | 57,78 kB | 57,79 kB |
| `supabase-client` | 52,24 kB | 52,29 kB |
| Route `me` | 47,65 kB | 36,98 kB |
| CSS racine | Non relevé | 37,62 kB |

Le fichier de la route profil est plus petit ; cela ne prouve pas une baisse identique du poids total du parcours, car les chunks partagés et les ressources réellement chargées doivent être mesurés dans le navigateur.

Le heartbeat écrit encore chaque minute sur `profiles` quand l’onglet est visible et le partage activé. Chaque badge crée un timer de 30 secondes, même sans timestamp. Une horloge partagée peut réduire ces timers ; une table de présence séparée ne se justifie qu’après mesure du volume d’écritures et du WAL. [Présence](apps/web/app/lib/realtime/usePresence.ts).

21 tests unitaires ciblés passent (pagination et templates d’e-mail), et le typecheck passe. Aucun chiffre de ce document ne constitue une mesure de production. Les risques de livraison des e-mails sont décrits dans [architecture V2](architecture-v2.md).
