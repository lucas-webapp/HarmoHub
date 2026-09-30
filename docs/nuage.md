# Le nuage : on n'enregistre plus, ça se fait

Retour utilisateur : *« L'enregistrement me semble trop aléatoire sur HarmoHub et TabHub. On va connecter
tous les documents à mon Firebase, comme c'est déjà le cas pour TrainHub. Conserve des exports/imports de
secours, de temps en temps je conserverai mes données sur un disque. »*

## Ce que ça fait

Connecté avec Google (bouton nuage de la barre du haut, à côté des Paramètres), chaque morceau est recopié
dans le compte dès qu'il change — 1,5 s après la dernière modification — et se retrouve sur les autres
appareils. Une pastille sur le bouton dit où ça en est : **verte** (tout est enregistré), **orange** (en
cours), **grise** (hors ligne), **rouge** (un problème, et la raison en infobulle). Elle n'apparaît qu'une
fois connecté. Sans Firebase — hors ligne, bloqué — HarmoHub fonctionne exactement comme avant : le nuage est
un plus, jamais une condition.

## L'enregistrement automatique du morceau ouvert

C'était la source directe du « trop aléatoire ». Jusqu'ici, modifier un morceau ne l'écrivait nulle part tant
qu'on n'appuyait pas sur *Enregistrer* (Ctrl+S) : un onglet fermé, un téléphone verrouillé, et le travail
était perdu. Désormais, **le morceau ouvert s'enregistre tout seul 1,5 s après la dernière modification**
(les frappes rapprochées font un seul enregistrement), et aussi :

- en **changeant de morceau** — sans demander « enregistrer ? » pour ce qui s'enregistrait déjà ;
- en **fermant la page** ;
- quand l'**onglet passe en arrière-plan** (le seul signal fiable sur iOS).

C'est **réglable** (fenêtre Nuage, case *Enregistrer automatiquement…*, activée par défaut). Désactivée, on
retrouve l'ancien comportement : seul *Enregistrer* met à jour le morceau — et donc le nuage. Le bouton
*Enregistrer* et Ctrl+S restent, et sont le seul geste qui écrit aussi le **fichier du disque** (le dossier de
rangement) : le dernier commit avait abandonné le rangement automatique, ce n'est pas revenu.

Un morceau jamais nommé n'est pas enregistré tout seul : il n'a pas d'identité à laquelle l'attacher. (Créer
un morceau demande un nom d'emblée, donc c'est rare.)

**Une seule porte.** Vingt-trois endroits posaient à la main le drapeau « modifié ». Ils passent tous par
`marquerModifie()`, et un banc vérifie qu'il n'en reste aucun en dehors — sinon un futur geste modifierait le
morceau sans programmer l'enregistrement, et le défaut d'origine reviendrait en silence.

## Comment c'est rangé, et pourquoi

Repris de TrainHub : connexion Google par fenêtre, SDK Firestore « compat » 10.13.2, chemin
`users/{uid}/apps/{slug}`, envoi différé de 1,5 s, pastille, avertissement à la fermeture pendant un envoi,
sauvegardes de secours locales avant tout remplacement, repli silencieux en mode local.

Différent :

- **Un document Firestore par morceau, plus un petit index** (`harmohub` et `harmohub__<id>`), tous frères dans
  la collection `apps`, sans sous-collection. TrainHub range tout l'état dans un seul document, et note lui-même
  la limite de 1 Mo ; une bibliothèque de morceaux y arrive. Plafond : 900 Ko par morceau, dit clairement s'il
  est dépassé (un morceau trop gros ne bloque pas les autres).
- **Le contenu est une chaîne JSON** : Firestore refuse les tableaux imbriqués et les `undefined`.
- **Aucune perte silencieuse.** La comparaison se fait morceau par morceau, à ce qui a été synchronisé la
  dernière fois, par une *empreinte du contenu* (la date d'enregistrement n'en fait pas partie : enregistrer
  deux fois sans rien changer n'envoie rien). Si les deux côtés ont changé, **le plus récent gagne et l'autre
  est gardé en copie** (« Titre (conflit 28/09 14:32) »). Un morceau jamais synchronisé ici mais présent dans
  le nuage : le nuage fait foi, la version locale est gardée à côté. Supprimer un morceau le marque supprimé
  dans l'index mais **laisse son contenu dans le nuage** ; un morceau supprimé ailleurs puis retravaillé ici
  revient. Une **suppression de masse** (stockage vidé, bogue : 3 morceaux ou plus, la moitié de la
  bibliothèque) est refusée et signalée en rouge ; les morceaux reviennent depuis le nuage.
- **Un morceau qu'on est en train de modifier n'est pas remplacé sous les doigts** : la mise à jour distante
  attend l'enregistrement, et le conflit est alors traité au grand jour (sinon la version de l'autre appareil
  serait écrasée sans copie).
- **Les dossiers voyagent** (union : un dossier n'est jamais retiré, il réapparaît vide plutôt que de faire
  disparaître des morceaux).
- **Hors ligne**, rien n'est envoyé sur la foi d'un instantané du cache qu'on prendrait pour un nuage vide.

## La sauvegarde de secours

Elle existait déjà : *Exporter / Importer toute la bibliothèque* (un seul fichier `.json`). La fenêtre Nuage
en donne deux boutons (*Tout exporter*, *Tout importer*) à l'endroit où l'on pense à la sauvegarde. L'import
passe par `importLibraryFile` — donc par ses décisions morceau par morceau — et par `saveSongs`, si bien qu'une
bibliothèque importée repart aussi dans le nuage. Les exports d'un morceau (`.json`, PDF, MIDI, MP3) sont
inchangés.

## À faire UNE fois dans la console Firebase

Le code ne peut pas le faire, et je n'y ai pas accès :

1. *Authentication > Sign-in method* : Google activé (déjà le cas pour TrainHub).
2. *Authentication > Settings > Authorized domains* : le domaine où HarmoHub est publié (déjà le cas s'il est
   sur le même domaine que TrainHub).
3. *Firestore > Rules* : une règle doit autoriser `users/{uid}/apps/{appId}` pour **tous** les identifiants,
   pas seulement `trainhub`. Si elle est déjà écrite ainsi, rien à faire ; sinon :

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{uid}/apps/{appId} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```

   Si elle nomme chaque app, elle refusera `harmohub__<id>` : la pastille passera au rouge avec « Firestore
   refuse l'accès : les règles de sécurité ne couvrent pas ce document ».

`firebase-config.js` reprend la configuration publique de TrainHub (même projet `lucas-apps`) avec
`FIREBASE_APP_SLUG = "harmohub"` ; `appId` est celui de TrainHub, sans conséquence pour l'authentification et
Firestore.

## Ce qui n'est pas synchronisé

Les réglages (volumes, zoom, etc.), le tampon de travail d'un morceau jamais nommé, et les fichiers du disque.

## Ce qui n'a pas été vérifié

**Rien n'a parlé au vrai Firebase** (il faudrait un compte Google). Les bancs `nuage_test.js` (ici) et
`nuage_moteur_test.js` (côté TabHub, le moteur `nuage.js` étant le même fichier) éprouvent la logique de
synchro sur un faux Firestore en mémoire, pas la configuration du projet — d'où la liste ci-dessus.

`nuage.js` est **le même fichier** dans HarmoHub et TabHub (`src/io/nuage.js` côté TabHub). Le corriger dans un
seul dépôt ferait diverger les deux : à recopier.
