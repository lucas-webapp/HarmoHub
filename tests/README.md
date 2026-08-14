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
