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
écraserait le faux). Il couvre : la connexion depuis la fenêtre, la pastille, l'**enregistrement
automatique** du morceau ouvert (1,5 s, un seul envoi pour six modifications rapprochées, avant un
changement de morceau, à la fermeture de la page, réglable), une garde structurelle (le drapeau « modifié »
n'est posé qu'à un seul endroit), les morceaux et dossiers venus d'un autre appareil, la mise à jour du
morceau ouvert — sauf pendant qu'on le modifie, et la version de l'autre appareil alors conservée —, la
suppression (le contenu reste dans le nuage), la suppression de masse refusée, la sauvegarde de secours et
l'import de bibliothèque qui repart dans le nuage, et l'application sans Firebase. Douze sabotages de la
source, tous détectés ; le dernier ne l'était pas d'abord (le scénario ne vérifiait que le tampon, pas ce que
la garde protège vraiment : la version distante).

Le moteur (`nuage.js`) a son propre banc, côté TabHub (`nuage_moteur_test.js`, sous Node, deux appareils).
Voir `docs/nuage.md`.
