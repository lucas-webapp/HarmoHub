# HarmoHub — consignes de travail

Application web (HTML / JS / CSS, sans build) pour composer des grilles d'accords. **Tout se dit et s'écrit en français** : échanges, commentaires, messages
de commit, journal.

## Où en est le chantier

La **refonte de l'interface** suit `docs/refonte.md` (règles, décisions de fond, feuille de route). Maquette validée : https://claude.ai/artifact/AMrn1tzDEBfmVij2fdfiBp
(fichier `project/Grille2.dc.html`). Chaque lot est journalisé dans `docs/dette-tests.md`.

- **Livrés** : lots 1 à 8 (fondations, barre de lecture, barre du haut, onglets, grille, bulle + inspecteur, ajout unique + barre de sélection, Clavier / Guitare).
- **Reprise** : lire `docs/reprise.md` en premier (état, plan du lot suivant, points ouverts).
- **En cours** : lot 9 (éditeur de notes — risque très élevé, découpage dans `docs/reprise.md`) : **9a et 9b livrés** (ouvrir / fermer / étendre ; barre d'outils), prochain 9c (calque Voix). Puis lot 10 (téléphone).
- **Ligne de base du balayage** (`bash tests/run_all_fast.sh`) : 235 suites, **5 rouges** déjà là avant la refonte et à ne pas confondre avec une régression
  (`probe_clic_accord_voisin`, `probe_defilement_tactile`, `probe_regle_voisins`, `probe_seq_finitions`, `seq_notes_libres_clavier`) et **7 « sans verdict »**
  (`ctx_nav_scroll`, `detune`, `guitar_lock_click`, `instrument_stress`, `item1_hzoom_out`, `probe_cache_perime`, `smoke`). Dernier balayage (lot 9b) : 225 verts ; `glock_unlock_and_switch` y est intermittent, aussi avant le lot (voir `docs/reprise.md`).
  Toute suite rouge ou ajout de rouge hors de cette liste est une régression : on la traite avant de pousser.
- **Dettes connues pour le lot 10** : sur téléphone (< 900 px) rien n'a bougé depuis le lot 6 ; 19 bancs sont joués à 860 px parce qu'ils éprouvent le mode
  « Ajout » de la carte Accord, qui n'existe plus que là (liste dans `docs/dette-tests.md`, lot 6c).

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
5. Journal dans `docs/dette-tests.md`, case du lot cochée dans `docs/refonte.md`, commit, push.

Serveur de test : les bancs attendent `http://localhost:8934` (`python3 -m http.server 8934` depuis la racine ; `tests/watchdog.sh` le relance au besoin).
Navigateur : Playwright et Chromium sont préinstallés, ne rien réinstaller.

## Règles de fond (détail dans `docs/refonte.md`)

- **Rien ne régresse.** Un banc qui cliquait sur un élément disparu est **réécrit** pour le nouveau geste, **jamais supprimé**.
- **Les logos existants sont repris tels quels** ; une icône n'est créée que pour une fonction qui n'en a pas.
- **Gabarit** : boutons de 32 px (ordinateur) ou 44 px (bloc de lecture et téléphone), arrondi 7 px, 12 px pour ce qui flotte, quatre familles de couleur de
  `style.css`, jamais d'aplat vert vif, un groupe segmenté pour un choix parmi moins de huit. Un nouveau bouton qui sort de la jauge fait rougir `gabarit_boutons`.
- **Sélection bleue, lecture verte, plage à boucler orange.** Notation internationale des tonalités.
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
