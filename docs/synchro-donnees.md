# Ce qui est enregistré où — HarmoHub et le cloud

Mise à jour du 29/10/2026. Demande : « je veux que tout soit stocké en ligne pour retrouver mes données en changeant d'ordinateur. »

## En deux phrases

Connecté avec Google, **tout ce qui est une donnée ou une préférence de l'utilisateur est au cloud** et se retrouve sur un autre
ordinateur. Ce qui décrit l'écran ou l'appareil lui-même reste sur l'appareil, volontairement.

## Où va quoi

| Donnée | Document Firestore | Fusion | Remarque |
|---|---|---|---|
| Morceaux : accords, rythmes, **structure** (occurrences, répétitions), **commentaires de structure**, tonalité, tempo, instrument, zoom du morceau | `users/{uid}/apps/harmohub` | morceau par morceau, le plus récent gagne ; le perdant d'une édition concurrente est rangé dans « Archives » | la structure et les commentaires font partie du morceau |
| Dossiers, suppressions (pour ne pas ramener un morceau effacé) | `users/{uid}/apps/harmohub` | par nom, le plus récent gagne | |
| **Réglages** (son, métronome, affichages de la grille, exports PDF, rythme de départ, mise en page de la feuille de structure) | `users/{uid}/apps/harmohub` (champ `reglages`) | **réglage par réglage**, le plus récent gagne | un appareil neuf recharge une fois la page pour les appliquer |
| **Paroles** (texte de chaque partie + accords posés, une session par morceau) | `users/{uid}/apps/harmohub-paroles` | session par session, le plus récent gagne ; la perdante est rangée à part et un bandeau propose de la restaurer | envoyées par la page Paroles elle-même |

Les règles de sécurité du projet (`users/{userId}/apps/{appId}`) couvrent les deux documents : aucune modification de la console.
Chaque document a sa propre limite de 1 Mio.

## Ce qui reste volontairement sur l'appareil

- **L'écran** : zooms de la grille, du séquenceur et du conducteur de voix, hauteur du tiroir du séquenceur, volet latéral replié, piano et
  guitare affichés. Un téléphone n'a pas l'écran d'un ordinateur.
- **L'effet verre** et sa couleur (`harmohub.glass*`) : « une option par appareil ».
- **Le dossier de rangement sur disque** : une autorisation du navigateur, impossible à transporter.
- **Les repères de sauvegarde et de rappel**, l'état de la synchro, le morceau ouvert, la fenêtre de connexion (« ne plus proposer »).
- **Les préférences de la page Paroles** (taille du texte, enchaînement des accords) et son « dernier morceau ouvert » : dépendants de l'écran,
  et la structure du morceau vient de HarmoHub.
- Le brouillon en cours d'édition (`myProgression`) : un état par appareil, sinon l'écran changerait de morceau sous les doigts de quelqu'un.

La liste exacte des réglages synchronisés est `REGLAGES_SYNCHRONISES` dans `synchro-harmohub.js` : une clé de plus = une ligne.

## Les sauvegardes sur disque

Elles contiennent maintenant aussi les **paroles** (champ `paroles` de l'enveloppe) : bibliothèque entière, ou un seul morceau. Importer
un fichier restaure les paroles des morceaux réellement importés, **sans jamais écraser une version plus récente** ; la version d'ici qui est
remplacée est rangée (même rangement que la synchro). Les anciens fichiers, sans paroles, s'importent comme avant.

Limite : « recharger un morceau depuis le dossier de rangement » (le bouton du gestionnaire de fichiers) ne restaure pas les paroles ; l'import
d'un fichier, lui, oui.

## Limites connues

- Le moteur de synchro n'a été éprouvé que contre un **Firebase simulé** : les règles de sécurité réelles, la vraie fenêtre Google (surtout sur
  Safari et dans l'app du Dock) ne se vérifient que sur de vrais appareils.
- Une copie de l'appli restée ouverte avec l'ancien code, qui réécrit le document de la bibliothèque, **effacerait le champ `reglages`** (elle
  ne le connaît pas) : il se reconstitue à la prochaine synchro d'un appareil à jour qui a ses valeurs. Rechargez les anciens onglets.
- Les paroles d'un morceau supprimé restent au cloud (aucune suppression n'est propagée pour elles) : c'est volontaire, un nettoyage automatique
  qui se tromperait coûterait plus cher que quelques Ko.
- Deux appareils qui modifient les mêmes paroles ou le même réglage hors ligne : la date la plus récente gagne (horloge de chaque appareil).
  Une horloge très décalée peut donc faire gagner la mauvaise, d'où le rangement de la version perdante.
- Pas encore de sauvegarde automatique côté serveur (le plan gratuit de Firebase n'en propose pas) : les exports sur disque restent le filet.
