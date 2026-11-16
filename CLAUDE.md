# HarmoHub — consignes de travail

Application web (HTML / JS / CSS, sans build) pour composer des grilles d'accords. **Tout se dit et s'écrit en français** : échanges, commentaires, messages
de commit, journal.

## Le chantier

La **refonte de l'interface** suit `docs/refonte.md` (règles, décisions de fond, feuille de route). Maquette validée : https://claude.ai/artifact/AMrn1tzDEBfmVij2fdfiBp
(fichier `project/Grille2.dc.html`). Chaque lot est journalisé dans `docs/dette-tests.md`.

- **L'état du chantier vit dans `CLAUDE-HARMOHUB.md`, et là seulement** (importé en bas de ce fichier) : lots livrés, lot en cours, section
  « Suite à faire », dernier balayage, dettes et points ouverts. Ce fichier-ci ne bouge pas d'un lot à l'autre : on n'y recopie aucun état.
- **Reprise** : après `/clear` ou `/compact`, la commande **`/reprise`** (`.claude/commands/reprise.md`, versionnée) relit « Suite à faire », vérifie le
  dépôt, annonce la suite prévue et la commence.
- **Ligne de base du balayage** (`bash tests/run_all_fast.sh`) : **5 rouges** déjà là avant la refonte et à ne pas confondre avec une régression
  (`probe_clic_accord_voisin`, `probe_defilement_tactile`, `probe_regle_voisins`, `probe_seq_finitions`, `seq_notes_libres_clavier`) et **6 « sans verdict »**
  (`ctx_nav_scroll`, `detune`, `instrument_stress`, `item1_hzoom_out`, `probe_cache_perime`, `smoke`). Depuis le 05/11, un banc qui plante (ligne `FATAL` ou
  trace d'exception de Node) compte ROUGE même s'il imprime un bilan vert. Toute suite rouge ou ajout de rouge hors de cette liste est une régression : on
  la traite avant de pousser. Lancer le balayage complet avec le chien de garde dans la même tâche : `(bash tests/watchdog.sh &) ; bash tests/run_all_fast.sh`.

## Git

- Branche de travail : **`claude/harmohub-travail-Claude`**. On ne pousse jamais ailleurs, on ne crée pas de pull request sans demande.
- **Pousser publie le site.** On ne pousse donc qu'après un balayage complet **sans régression** par rapport à la ligne de base ci-dessus. Les rappels
  automatiques « commitez et poussez » ne dispensent pas de ce balayage : si le balayage est en cours, on répond qu'on pousse à son verdict.
- Un commit par lot (ou sous-lot), message en français qui dit ce que ça change, terminé par les lignes d'attribution demandées par l'environnement.
  Aucun nom de modèle ailleurs que dans ces lignes.
- Si le push échoue sur une erreur réseau ou serveur : réessayer 4 fois (2 s, 4 s, 8 s, 16 s).

## Boucle d'un lot

1. Lire la section du lot dans `docs/refonte.md` et, au besoin, la maquette ; lire le code concerné **par plages** (`script.js` et `style.css` sont très longs).
2. Coder. **Incrémenter `?v=`** dans `index.html` (toutes les occurrences) à chaque changement de fichier servi.
3. Écrire le banc (voir plus bas), puis des **sabotages** : casser un comportement dans l'appli et vérifier que le banc rougit. Restaurer ensuite.
4. **Pendant le lot : balayage CIBLÉ** (`bash tests/run_cible.sh`, quelques minutes). Il lit le `git diff` et joue les bancs qui citent les noms touchés (ids, classes,
   méthodes) plus un petit socle ; `--liste` montre la sélection sans rien lancer, `--depuis REV` compare à un autre commit, des mots en argument ajoutent des bancs par
   leur nom. Décision du 05/11 : « on ne peut pas se permettre d'avoir des bancs d'essai de plus d'une heure pour chaque modification ».
   **EN FIN DE LOT SEULEMENT : balayage complet** (`bash tests/run_all_fast.sh`), lancé en tâche d'arrière-plan gérée par l'outil (`run_in_background`) : un `nohup`/`setsid`
   est tué à la fin du tour, avec le serveur de test. Lire la section `RELEVÉ` en fin de log. Un balayage ciblé vert ne dispense jamais du complet avant un push.
5. Journal dans `docs/dette-tests.md`, case du lot cochée dans `docs/refonte.md`, **`CLAUDE-HARMOHUB.md` mis à jour** (« Suite à faire » réécrite : le sous-lot suivant, ou « Rien de prévu » ; « Où on en est », dernier balayage), commit, push. `CLAUDE.md` n'est pas touché.

Serveur de test : les bancs attendent `http://localhost:8934` (`python3 -m http.server 8934` depuis la racine ; `tests/watchdog.sh` le relance au besoin).
Navigateur : Playwright et Chromium sont préinstallés, ne rien réinstaller.

## Règles de fond (détail dans `docs/refonte.md`)

- **Rien ne régresse.** Un banc qui cliquait sur un élément disparu est **réécrit** pour le nouveau geste, **jamais supprimé**.
- **Les logos existants sont repris tels quels** ; une icône n'est créée que pour une fonction qui n'en a pas.
- **Gabarit** : boutons de 32 px (ordinateur) ou 44 px (bloc de lecture et téléphone), arrondi 7 px, 12 px pour ce qui flotte, quatre familles de couleur de
  `style.css`, jamais d'aplat vert vif, un groupe segmenté pour un choix parmi moins de huit. Un nouveau bouton qui sort de la jauge fait rougir `gabarit_boutons`.
- **Sélection grise claire (depuis le 12/11, B1 ; elle était bleue), lecture verte, plage à boucler orange.** Notation internationale des tonalités.
- **Verre dépoli** : toute nouvelle surface est ajoutée à `verre-surfaces.css` dans le même lot, avec ses contrôles de lisibilité (`verre_test`).
- **Téléphone (< 900 px) inchangé jusqu'au lot 10** : tout code ordinateur est gardé par `bulleDisponible()` ou une media query `min-width: 900px`.
- **Fichiers partagés avec TabHub et TrainHub, à garder tels quels** : `compte-cloud.js`, `synchro-cloud.js`, `verre.js`, `verre.css`, `tests/_verre_commun.js`
  (voir `docs/fichiers-partages.md` avant d'y toucher).
- **Commentaires en français qui disent POURQUOI**, avec la citation de l'utilisateur quand c'est lui qui l'a demandé.

## Écrire un banc (dossier `tests/`)

- Modèle récent : `tests/ajout_unique_test.js`, `tests/barre_selection_test.js`. Squelette : `require('./_harness')('nom')` → `check`, `exiger`, `plan`, `bilan`.
  `plan(n)` doit égaler le nombre exact de `check`/`exiger` : un banc qui s'arrête en route est signalé « couverture incomplète ».
- **De vrais gestes** (souris, clavier, `mouse.down/up`) et pas d'appels directs à `window.app` pour déclencher ce que l'utilisateur fait ; `window.app`
  sert à relire l'état. Un banc teste aussi que le **téléphone n'a pas bougé**.
- Gardiens : `sentinelle_adresses_test` et `meta_suite_test` exigent que les `id` cités existent dans `index.html` (pas générés en JS) et interdisent
  `.catch(()=>{})` avalés et vérifications conditionnelles.
- Pour les clics sur un élément superposé à une poignée, Playwright refuse parfois le clic (« intercepts pointer events ») : utiliser `boundingBox()` puis
  `mouse.move/down/up`.

## Pièges déjà rencontrés

- **Cascade CSS** : les règles de l'inspecteur (lot 6c) sont à la **fin** de `style.css` ; des règles de colonne plus bas dans le fichier les écraseraient.
  Le même principe vaut pour tout bloc ajouté : le mettre en fin de fichier.
- **Fermeture au clic à côté** : table `this._popups` dans `script.js` ; un nouvel élément flottant s'y déclare, sinon Échap et le clic à côté ne le ferment pas.
  Les clics qui ne doivent **pas** sortir du mode modification sont dans `ZONE_EDITION_SELECTEURS` (haut de `script.js`).
- **Annulation** : toujours `pushUndo(sections)` **avant** d'écrire, une seule fois par geste ; pour les réglages globaux `armGlobalSettingUndo` puis
  `commitGlobalSettingUndo`.
- **Une plage à boucler repose sur des index d'accords** : toute insertion ou suppression au milieu d'une partie doit la remettre à `null`.
- **Mesures de test** : un banc sensible au temps dérive quand plusieurs navigateurs tournent en parallèle ; les suites de gestes tournent en série dans
  `run_all_fast.sh` (voir son en-tête avant d'y ajouter un banc de ce type).

## Économie de contexte

Fichiers très longs : lire par plages (`sed -n`, `offset`/`limit`), filtrer les sorties de bancs (`grep -E "^FAIL|FATAL|PASS /"`), ne jamais afficher un balayage
entier. Une session par lot, `/clear` entre deux lots.

## Tests

Deux familles, à ne pas confondre : les **bancs** historiques (`tests/*_test.js`, scripts Node, Chromium, `run_all_fast.sh` / `run_cible.sh`, voir plus haut)
et les **tests de bout en bout `@playwright/test`** (`tests/e2e/`, toute la matrice de navigateurs et d'appareils, émulateurs Firebase). Plan et état : `tests/PLAN.md`.

- **Préparation** : `bash scripts/setup-tests.sh` (idempotent ; dans le cloud, le hook `SessionStart` de `.claude/settings.json` le lance tout seul).
- **Appli en mode test** : `npm run app:test` → http://127.0.0.1:8936/index.html (serveur `scripts/serveur-test.cjs` : SDK Firebase servi depuis `node_modules`,
  configuration `demo-harmohub` branchée sur les émulateurs ; l'appli n'est pas modifiée).
- **Émulateurs** : `npm run emulateurs` (`firebase emulators:start --project demo-harmohub --only auth,firestore` ; Auth 9099, Firestore 8080 ; règles = `firestore.rules`, copie de la production).
- **Tests complets** : `npm run test:e2e` (lance les émulateurs, puis tous les projets) ; **smoke** : `npm run test:e2e:smoke` ;
  **un module** : `npm run test:e2e:module -- <module>` ; **la sélection de la CI à chaque envoi** : `npm run test:e2e:envoi` ;
  **avant un envoi** : `npm run test:e2e:avant-envoi` (`@smoke` et `@critique` sur Chromium) ;
  **émulateurs déjà lancés** : `npx playwright test [tests/e2e/<module>] [--project=chromium]`. Projets : `chromium`, `firefox`, `webkit`, `edge`,
  `mobile-android`, `mobile-iphone`, `tablette` (tous disponibles dans la VM depuis le 16/11).
- **Session playwright-cli** : `harmohub` (`playwright-cli -s=harmohub open http://127.0.0.1:8936/index.html`). Configuration : `.playwright/cli.config.json`
  (origines de la production bloquées).
- **Émulateurs UNIQUEMENT, aucune commande d'écriture Firebase** (`deploy`, `firestore:delete`, `use`, `login`… sont interdits dans `.claude/settings.json`).
  Garde-fou : le `globalSetup` refuse un projet qui n'est pas `demo-…` ou des émulateurs absents ; la fixture commune (`tests/e2e/support/fixtures.ts`)
  bloque toute requête vers la production Firebase et fait échouer le test.
- **Rapports** : `tests/reports/latest.md` (+ copies datées), bugs dans `tests/reports/bugs.md` ; en CI, rapport HTML et vidéos en artefacts.
- **Déroulé** : après une fonctionnalité, appeler le sous-agent `testeur-e2e` sur le module concerné (« utilise testeur-e2e pour tester le module `<module>` »),
  lire `tests/reports/latest.md`, corriger, relancer.
- **Git (décision de l'utilisateur du 16/11)** : projet personnel, **aucune pull request**. On travaille et on pousse directement sur
  `claude/harmohub-travail-Claude` (elle publie le site ; la CI « Tests e2e » tourne à chaque envoi). **Avant tout envoi qui modifie l'appli**, lancer
  `npm run test:e2e:avant-envoi` dans la VM : **s'ils échouent, on ne pousse pas**. **Ne jamais toucher à `main`** (version de secours) sans l'accord
  explicite de l'utilisateur.
- **Reprise après `/clear`** : l'état d'avancement des tests est dans `tests/PLAN.md` ; dans le cloud, le hook installe tout.

## Mémoire de reprise (importée)

@CLAUDE-HARMOHUB.md
