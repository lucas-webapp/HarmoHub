# Le nuage : on n'enregistre plus, ça se fait

Retour utilisateur : *« L'enregistrement me semble trop aléatoire sur HarmoHub et TabHub. On va connecter
tous les documents à mon Firebase, comme c'est déjà le cas pour TrainHub. Conserve des exports/imports de
secours, de temps en temps je conserverai mes données sur un disque. »*

## Ce que ça fait

Connecté avec Google (le bouton de la barre du haut), chaque morceau est recopié dans le compte dès qu'il
change — 1,5 s après la dernière modification — et se retrouve sur les autres appareils. Sans Firebase —
hors ligne, bloqué — HarmoHub fonctionne exactement comme avant : le nuage est un plus, jamais une condition.

## Le bouton, et le garde-fou

**Un bouton à part, voyant, dans la barre du haut** (retour utilisateur : *« un bouton à part plus voyant
avec mon nom ou Google »*). Il dit où l'on en est sans rien ouvrir :

- **« Se connecter »**, avec le G de Google, en ambre, quand personne n'est connecté — le seul état qui
  demande quelque chose, donc le seul qui se voit de loin ;
- **le prénom**, avec une pastille d'état, une fois connecté : verte (tout est enregistré), orange (en
  cours), grise (hors ligne), rouge (un problème, la raison en infobulle) ;
- **« Hors ligne »** quand le nuage n'existe pas ici (Firebase bloqué, hors ligne au chargement).

**Un clic suffit.** Déconnecté, le bouton ouvre Google tout de suite — dans le geste du clic, pas après une
attente : un navigateur (Safari, iPhone surtout) refuse sinon d'ouvrir la fenêtre. Connecté, il ouvre la
fenêtre du compte (le compte, la sauvegarde de secours). Refermer la fenêtre Google n'est pas une erreur :
aucun message. Sur téléphone, le bouton ne garde que son rond (le G, ou l'initiale). Au rechargement, le
dernier compte connu s'affiche tout de suite, plutôt qu'un « Se connecter » qui clignoterait le temps que
Firebase réponde.

**Le garde-fou « tu travailles sans être connecté »** (retour utilisateur : *« une confirmation si je
commence à travailler alors que je ne suis pas connecté »*). À la première modification faite sans être
connecté, une question : *Me connecter avec Google* ou *Continuer sans me connecter*. La modification qui
l'a déclenchée est appliquée : la question ne la bloque ni ne la perd. Les règles, chacune gardée par un
banc :

- **Une fois par séance.** « Continuer » éteint la question jusqu'au prochain chargement (ou jusqu'à ce
  qu'on se connecte puis se déconnecte) ; Échap ou un clic à côté valent « continuer ». Une question qui
  reviendrait à chaque touche se fermerait sans être lue, et ne garderait plus rien.
- **À la première *modification*, pas à l'ouverture.** Celui qui vient seulement lire ou écouter n'est pas
  interrompu ; ouvrir les Paramètres ou charger un morceau ne comptent pas. Toutes les modifications du
  morceau ouvert passent par `marquerModifie()` (voir plus bas), et celles de la bibliothèque (créer,
  renommer, importer…) par `saveSongs` : ce sont les deux portes qui préviennent le moteur.
- **Jamais à quelqu'un qui est connecté.** Cela demande d'attendre Firebase : au chargement, il y a un
  court moment où l'on ne sait pas encore si une session est restaurée. Une modification faite à ce moment
  attend la réponse, et ne pose la question que si personne n'est connecté.
- **Jamais quand le nuage n'existe pas ici.** Proposer de se connecter serait proposer ce qui ne peut pas
  marcher ; le bouton dit alors « Hors ligne ».
- **Sans rien activer par mégarde.** La question surgit pendant qu'on travaille : le focus va à la boîte,
  pas à un bouton, et le clavier n'agit plus sur la grille cachée derrière. La frappe suivante (Entrée,
  espace, Suppr) ne peut donc ni choisir une réponse avant d'avoir été lue, ni modifier un accord.
- **Fenêtre Google refermée sans se connecter** : la modification suivante redemande (il avait dit vouloir
  se connecter, ce n'est pas fait). Connecté dans un autre onglet pendant que la question est à l'écran :
  elle se referme d'elle-même.

## L'enregistrement automatique du morceau ouvert

C'était la source directe du « trop aléatoire ». Jusqu'ici, modifier un morceau ne l'écrivait nulle part tant
qu'on n'appuyait pas sur *Enregistrer* (Ctrl+S) : un onglet fermé, un téléphone verrouillé, et le travail
était perdu. Désormais, **le morceau ouvert s'enregistre tout seul 1,5 s après la dernière modification**
(les frappes rapprochées font un seul enregistrement), et aussi :

- en **changeant de morceau** — sans demander « enregistrer ? » pour ce qui s'enregistrait déjà ;
- en **fermant la page** ;
- quand l'**onglet passe en arrière-plan** (le seul signal fiable sur iOS).

C'est **réglable** (Paramètres > *Enregistrement*, activé par défaut — une préférence, donc rangée avec les
préférences, et atteignable même sans être connecté). Désactivé, on
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

`firebase-config.js` reprend la configuration publique du projet `lucas-apps` (celle de TrainHub) avec
`FIREBASE_APP_SLUG = "harmohub"` ; `appId` est celui de l'application web créée dans la console Firebase pour
ce projet (et non plus celui de TrainHub). Il ne sert ni à l'authentification ni à Firestore — seuls
`apiKey`, `authDomain` et `projectId` comptent — mais il identifie l'app. S'il y a une application web par
site, c'est une ligne à changer dans chaque `firebase-config.js`.

## Ce qui n'est pas synchronisé

Les réglages (volumes, zoom, etc.), le tampon de travail d'un morceau jamais nommé, et les fichiers du disque.

## Ce qui n'a pas été vérifié

**Rien n'a parlé au vrai Firebase** (il faudrait un compte Google). Les bancs `nuage_test.js` (ici) et
`nuage_moteur_test.js` (côté TabHub, le moteur `nuage.js` étant le même fichier) éprouvent la logique de
synchro, le bouton et le garde-fou sur un faux Firebase en mémoire, pas la configuration du projet — d'où la
liste ci-dessus. Deux choses que seul le vrai Google peut confirmer : que la fenêtre de connexion s'ouvre bien
sur iPhone quand elle est demandée depuis le bouton ou depuis la question (le banc prouve qu'elle est
demandée *dans* le clic, c'est la condition ; pas que Safari l'accepte), et que le domaine publié est dans les
domaines autorisés (sinon le message dit lequel régler).

`nuage.js` est **le même fichier** dans HarmoHub et TabHub (`src/io/nuage.js` côté TabHub). Le corriger dans un
seul dépôt ferait diverger les deux : à recopier.
