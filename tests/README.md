# Bancs d'essai HarmoHub

158 bancs Playwright, écrits au fil des retours utilisateur. Chacun documente en tête le retour qui
l'a motivé : ils valent autant comme mémoire des décisions que comme filet de sécurité.

## Lancer

    npm i -g playwright && playwright install chromium   # une fois
    python3 -m http.server 8934                          # depuis la racine du dépôt
    node tests/ajout_modif_test.js                       # un banc
    tests/run_all_fast.sh                                # tout, en parallèle

`HARMOHUB_URL` remplace l'adresse par défaut (`http://localhost:8934`).

## Avant de « réparer » un banc rouge

Lire `docs/dette-tests.md`. Un banc rouge signifie l'une de deux choses OPPOSÉES : l'appli est
cassée, ou le banc décrit une fonctionnalité qui a changé/disparu à la demande. Les confondre coûte
cher dans les deux sens — ce document tient le journal de chaque cas tranché, avec la méthode : on
rejoue le banc sur le commit d'AVANT (via `git worktree`) servi sur un second port. S'il y échoue à
l'identique, ce n'est pas une régression.

Bancs connus rouges et pourquoi : voir `docs/dette-tests.md`, sections 11 à 14.

## Un piège d'outillage, deux fois rencontré

`pgrep -f` / `pkill -f` comparent le motif à la ligne de commande ENTIÈRE, y compris celle du shell
qui cherche et celle des scripts de lot qui citent les noms de bancs. Un `pkill -f "un_test.js"` tue
donc aussi le lot en cours, voire le serveur HTTP. Viser le PID, ou arrêter le lot par son
identifiant de tâche.

Comptez large sur les délais : un `goto` + `reload` coûte ~26 s dans un conteneur lent, et certains
bancs en font deux (ordinateur puis téléphone).

## Le nuage (Firebase)

`nuage_test.js` — HarmoHub + nuage, dans un vrai navigateur, avec un Firebase **injecté en mémoire**
(`_firebase_factice.js`) et le CDN de Google coupé (sur une machine qui a du réseau, le vrai SDK
écraserait le faux). Il couvre :

- **le bouton de la barre du haut** : « Se connecter » d'UN clic (pas de fenêtre intermédiaire), puis le
  prénom et la pastille ; le même bouton ouvre la fenêtre du compte une fois connecté ; son dessin calculé
  (la règle générique `button { min-width: 120px }` en aurait fait un rectangle de 120 px) et la barre du
  haut à 390 et 320 px ;
- **le garde-fou « tu travailles sans être connecté »** : la question à la première vraie modification
  (un accord ajouté au clavier, pas un appel direct) et pas avant ; le focus sur AUCUN bouton, Entrée / espace
  / Suppr sans effet sur la grille cachée ; Échap et le clic à côté valent « continuer » ; la fenêtre Google
  demandée DANS le clic (mesuré par `window.event`, qui n'existe que pendant la distribution d'un évènement) ;
  fenêtre refermée (aucun message, la question revient) ou bloquée (message qui dit quoi faire) ; connecté
  dans un autre onglet pendant la question ; session restaurée avec un Firebase lent (préalable vérifié :
  Firebase n'a PAS encore répondu au moment du geste) ; le dernier compte affiché au rechargement ; sans moteur ;
- **l'enregistrement automatique** du morceau ouvert (1,5 s, un seul envoi pour six modifications
  rapprochées, avant un changement de morceau, à la fermeture de la page), désormais réglable dans les
  **Paramètres** ; une garde structurelle (le drapeau « modifié » n'est posé qu'à un seul endroit) ;
- les morceaux et dossiers venus d'un autre appareil, la mise à jour du morceau ouvert — sauf pendant qu'on le
  modifie, et la version de l'autre appareil alors conservée —, la suppression (le contenu reste dans le
  nuage), la suppression de masse refusée, la sauvegarde de secours et l'import de bibliothèque qui repart
  dans le nuage, et l'application sans Firebase.

Sabotages de la source, tous détectés : douze pour la synchro et l'enregistrement automatique, dix-neuf pour
le bouton et le garde-fou (voir `docs/dette-tests.md`).

`css_equilibre_test.js` — **sans navigateur** : aucune accolade `}` en trop dans les feuilles de style. Une
accolade en trop ne produit aucune erreur : elle fait disparaître en silence la règle qui la suit.

Le moteur (`nuage.js`) a son propre banc, côté TabHub (`nuage_moteur_test.js`, sous Node, deux appareils :
117 vérifications, dont le garde-fou et la présentation du bouton). Voir `docs/nuage.md`.
