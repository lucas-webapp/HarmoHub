# HarmoHub — mémoire de reprise (CLAUDE-HARMOHUB.md)

Mis à jour le 23/11/2026 (tests e2e : phase 5 terminée, ~1 700 tests ; bugs et deux essais neutres du séquenceur corrigés ; nouvelle série de tests à venir). **Seul fichier où s'écrit l'état du chantier.** Volontairement COURT (chargé à chaque session) : le détail va dans `docs/dette-tests.md`, jamais ici. À lire avec `CLAUDE.md`.

| Besoin | Fichier (ne jamais lire en entier : `grep -n` puis `sed -n`) |
|---|---|
| Journal de chaque lot (mesures, sabotages, bancs réécrits) | `docs/dette-tests.md` |
| Décisions détaillées, lettres A à T (`grep -n "^\*\*[A-T]\. "`) | `docs/decisions-13-14-11.md` |
| Phrases exactes de l'utilisateur du 14/11 | `docs/commentaires-14-11.md` |
| Règles de la refonte, ancienne feuille de route | `docs/refonte.md`, `docs/refonte-sequenceur.md` |
| Fichiers partagés avec TabHub / TrainHub | `docs/fichiers-partages.md` |

## Suite à faire (lue par `/reprise` — à réécrire à la fin de CHAQUE lot)

**PROCHAINE ÉTAPE : NOUVELLE SÉRIE DE TESTS PLAYWRIGHT, demandée par l'utilisateur le 23/11** (il fait `/clear` puis `/reprise`). Il dira lesquels (ciblés par module, ou un nouvel essai neutre).
État de départ : tout est poussé sur `claude/harmohub-travail-Claude` (dernier commit `98db5b2` du 22/11), arbre propre, `avant-envoi` vert (309 passés), CI « Tests e2e » à chaque envoi.
- **Méthode d'un essai neutre** (a donné deux rapports de 19 constats chacun) : sous-agent généraliste à qui l'on INTERDIT de lire le code, les tests et les rapports ; il pilote Chromium par des scripts Playwright dans `/tmp`
  (vrais gestes : souris, clavier, toucher), consigne ce qui ne va pas ET ce qui pourrait s'améliorer, écrit un rapport dans `tests/reports/` avec captures dans un dossier voisin. Donner à l'agent les centres d'intérêt de l'utilisateur
  (le 20/11 : l'effet des notes ajoutées sur le nom de l'accord, déplacements / étirements / rythmes sans accrochage) et « pas besoin de son ». Ensuite : l'utilisateur tranche, on corrige, on teste, on pousse.
- **Cycle d'une correction** : corriger, **retirer le `test.fail`** du test qui l'attendait, incrémenter `?v=` dans `index.html` (toutes les occurrences), écrire le test (vrais gestes) et un **sabotage** qui le fait rougir (puis restaurer),
  lancer les modules touchés (7 projets si le code est partagé), `CI=1 npm run test:e2e:avant-envoi`, commit en français avec les lignes d'attribution, `git push origin HEAD:claude/harmohub-travail-Claude`, puis `tests/reports/bugs.md` (tableau « Bugs corrigés ») et cette section.
  Lancer les gros passages en tâche de fond (`run_in_background`), les guetter avec un Monitor, **ne jamais modifier un fichier servi pendant qu'ils tournent**. Un seul `emulators:exec` à la fois (ports 8080 / 9099).
- **Pièges de test appris** : `toContainText` lit aussi le texte CACHÉ (`display: none`) : pour « le nom est visible », cibler le `span` et `toBeVisible()` ; le son factice (Firefox) revient avec `bash scripts/setup-tests.sh` (le hook de reprise peut dire « pas de sortie audio » : le relancer) ;
  une barre qui déborde n'a pas le même seuil sur tablette (pointeur tactile) ; un test de géométrie se vérifie par sabotage sur au moins deux moteurs. Intermittents connus (verts seuls, à ne pas confondre avec une régression) : `robustesse/deux-onglets` (Z-07, rouge aussi sans changement),
  `lecture/boucle` « tout le morceau » (WebKit), `lecture-stop` « Compteur de mesure après Stop » (Chromium), `vitesse-metronome` (iPhone, sous charge).
- **Fait du 19 au 22/11** (détail : `tests/reports/bugs.md`, journal : `docs/dette-tests.md` « Session du 19 au 22/11 ») : 61 bugs de la phase 5 presque tous corrigés ou décidés ; essai neutre n° 1 (`tests/reports/2026-11-20-essai-sequenceur.md`, ES-01 à ES-20) puis n° 2 (`…-2.md`, EB-01 à EB-19) ;
  le séquenceur reconnaît l'accord d'après toutes les notes (renversements compris), propose / n'impose jamais, lasso, flèches, Alt + glisser, Ctrl+C / V de notes, menu d'une note (Copier, Dupliquer, double-clic), rythmes sur les accords sélectionnés, refus de dépôt montrés en rouge,
  arpèges et Ballade adaptés aux triades, rang des voix, graphies Am(add9) / Am(maj7).
- **Restent à corriger** (voir `bugs.md`) : G-01 (Firefox, premier clic sur une autre partie), L-04 (lecture depuis la case choisie, Firefox / WebKit / iOS) ; ES-18 (clavier sur C au chargement : risque pour les bancs), ES-20 (noms accessibles : les tests s'appuient sur `Note, croche N`) ;
  ES-17 (fenêtre de connexion : `compte-cloud.js` PARTAGÉ, ne pas y toucher). **Reportés** : P-08 (×N des paroles), Z-07 (deux onglets), Y-01 / Y-02 / Y-03 (synchro, `synchro-cloud.js` partagé), T-05, D-03, D-04 (WebKit), L-05 / L-06 (intermittents).
- **Améliorations du 2e essai** : toutes faites sauf deux, **à lui proposer** : « toute la partie » sur ordinateur (un bouton de plus dans une barre déjà serrée) et un décompte visible sur le séquenceur. Le curseur « main » sur une note est **refusé** (15/11). **Doubles croches et triolets : écartés** (20/11).
  Restent aussi des idées du 1er essai : vignette d'après la forme perso, indication « note de passage ». Décisions « sans changement » du 21/11 : EB-15 (grille rognée par « Ajouter section » : conforme à la décision du 15/11), EB-18 (curseur : flèche).
- **L'utilisateur a délégué les arbitrages** (20/11 : « je te laisse prendre les meilleures décisions ») : chaque décision est notée « (décidé) » dans `bugs.md`. Il a demandé de ne lancer le balayage complet des bancs historiques que si nécessaire.
- **Piège** : ne pas remplacer `window.localStorage` (`synchro-harmohub.js` compare `this === window.localStorage`) : patcher `Storage.prototype`, comme lui. `main` (version de secours) n'est touchée que sur accord explicite.

**À lui faire valider** (détail : `docs/dette-tests.md`, « Session du 15/11 (suite 9) » et « Session du 16/11 ») :
1. **Plein écran du séquenceur** : il ne vient que de la poignée du haut (jamais des douze lignes de départ). La vue Voix ne masque jamais la grille. La bulle d'accord se referme à l'entrée. Le plein écran n'est pas retenu d'une session à l'autre.
2. **Barres pendant la lecture** : le glissé choisit l'accord, et la vue ne change pas de ligne tant que la souris est sur les cases. S'il voit encore un défaut, lui demander son appareil (souris, pavé tactile, écran tactile) et ce qu'il voit.
3. **Téléphone** : proposition de renommer (quatre croches sur huit = note tenue), cycle d'intensité bouclé, règle et noms d'accords collés en haut quand les lignes défilent.
4. **Notes ajoutées** : même touche que les voix plus une croix, place à leur hauteur, renommage au clic (ordinateur seulement) et par le champ de la bande « Note libre ». Les dièses et bémols suivent la tonalité (`Eb` tapé s'affiche `D#` en do).
5. **Réglages anciens** : douze lignes visibles au départ en vue Piano, fenêtre de 5 demi-tons dessous / 1 octave dessus, en-tête de partie à gauche dès 1500 px avec 200 px de marge.

**Questions restées ouvertes** (à poser au bon moment) :
- variante « sans sélection, séquenceur vide » ;
- flèches ↑ ↓ à tige plutôt que chevrons ;
- limite à 3 lignes pour les rythmes ;
- mention drop / renversement dans les cases ;
- petit « + » bleu `.cell-ins` ;
- harmoniser l'anneau de lecture en boucle ;
- clavier de piano qu'on joue en glissant (non fait).

**Hors dépôt** : les toasts de TrainHub et TabHub ont le défaut de pilule à 999 px corrigé ici. C'est à corriger dans leurs dépôts (`list_repos` puis `add_repo`).

## Règles de travail en vigueur

- **Balayages (décision de l'utilisateur du 15/11, prime sur `CLAUDE.md`)** : « en moins de 40 minutes ». Avant un push, `bash tests/run_cible.sh` suffit (mots en argument pour élargir, `MAX_BANCS=` pour resserrer). Le balayage COMPLET (`run_all_fast.sh`, ~19 min, seul) ne se lance que sur demande.
- **Ligne de base de CE conteneur** (complet du 16/11, toutes identiques sur `20769d8`, avant L9) :
  - rouges : `probe_regle_voisins`, `editeur_notes_outils`, `seq_tiroir_barre_outils`, `seq_tiroir_flottant`, `sequenceur_toucher`, `mobile_scroll` ;
  - cinq plantages « Target page … has been closed » au choix d'un dossier : `export_integral`, `garde_fous_ecrasement`, `mode_simple`, `rangement_fichiers`, `suppression_disque` ;
  - sans verdict : `detune`, `instrument_stress`, `probe_cache_perime`, `smoke`.

  Les quatre autres rouges de la liste de `CLAUDE.md` sont verts ici. Tout autre rouge est une régression.
- **Sabotages** : sur une copie du site servie sur le port 8935 (jamais les fichiers du dépôt pendant qu'un balayage tourne). Un banc qui ne voit pas un sabotage est durci, pas le sabotage affaibli.
- **Avant tout envoi qui modifie l'appli** : `npm run test:e2e:avant-envoi` (`@smoke` et `@critique` sur Chromium) ; s'ils échouent, on ne pousse pas (en plus du balayage ciblé des bancs).
- **Branche** : travailler sur la branche locale `claude/harmohub-travail-Claude`, alignée sur `origin` (remise d'aplomb le 16/11), et pousser `git push origin HEAD:claude/harmohub-travail-Claude`. L'environnement cloud peut créer au démarrage une branche locale `claude/harmohub-local-conversation-…` (consigne de session) : sans utilité, on bascule sur `claude/harmohub-travail-Claude` (`git checkout -B claude/harmohub-travail-Claude origin/claude/harmohub-travail-Claude`) et le hook qui réclame de la pousser est à ignorer ; elle n'existe pas sur GitHub.
- **Ordinateur d'abord** : tout code ordinateur est gardé (`bulleDisponible()`, `modeTel()`, `min-width: 900px`). Au téléphone, seulement ce que l'utilisateur demande ou confie (« carte blanche »).
- **Libellés courts** (phrase complète en `title`), aucune phrase d'aide sous une fenêtre, notation internationale (Dm7, Cmaj7, C, Am, D dor).
- **Pièges** :
  - `min-width: 120px` hérité par les boutons des en-têtes de partie (surcharger) ;
  - après un redessin, `e.target.closest()` échoue (`e.composedPath()`) ;
  - toute popover se déclare dans `this._popups` ;
  - tout nouveau bloc CSS va en FIN de `style.css`.

## Commandes et méthode

- **Commandes** (`.claude/commands/`) :
  - `/reprise` : relit cet état et continue ;
  - `/silencieux` : aucun message entre les étapes, une réponse de cinq phrases à la fin ;
  - `/commentaires` : traite tous les commentaires de l'artefact d'un coup.
- **Artefact commentable** « HarmoHub essai Piano » : https://claude.ai/artifact/NZUhWsrVg4vL4oAAMeouEu (`ArtifactComments` sur `https://claude.ai/code/artifact/ae98c846-bd1d-426f-b2d8-22add8e70c36`).
  - Version 5 = avant L7 et L9. **Ne le republier qu'à la demande.**
  - La page = `index.html` sans enveloppe, `<title>HarmoHub essai Piano</title>`, script « Jeu de départ » inséré avant `<!-- BARRE DU HAUT`, `files` = fichiers qui ont changé.
  - Réponses signées « Claude · via l'utilisateur ». Ne jamais résoudre un fil soi-même.
  - Aucun commentaire en attente.

## Où on en est

- **Livrés** : la refonte complète (lots 1 à 10, ordinateur et téléphone), puis les retours de l'utilisateur des 14, 15 et 16/11 :
  - L8 : diagrammes guitare et piano, moteur des doigtés, « Mes doigtés » ;
  - L1 à L3 : séquenceur (tailles, notes, barre d'outils) ;
  - L4 : conduite des voix « Voicing » ;
  - L5 : barre du haut, grille, barre de lecture ;
  - L6 : fenêtre d'accord à trois onglets ;
  - L6bis : vue Piano ;
  - L7 : téléphone ;
  - L9 : plein écran, lecture, adaptation téléphone ;
  - L9d : notes ajoutées.
- **Derniers bancs ajoutés** : `sequenceur_plein` (51), `sequenceur_pendant_lecture` (34), `telephone_adaptations` (26), `telephone_regle_collee` (14), `sequenceur_notes_ajoutees` (31).
- **Dernier balayage complet** (16/11, après L9d) : 271 verts, 13 rouges, 4 sans verdict sur 288 suites, en 18 min 47 s. Aucune régression : les 11 rouges restants sont ceux de la ligne de base de ce conteneur, et les 2 bancs que L9d faisait rougir ont été réécrits puis sont repassés verts.
- **Tests e2e (16/11)** : `@playwright/test` + émulateurs Firebase (`demo-harmohub`), 7 projets (Chromium, Firefox, WebKit, Edge, Android, iPhone, iPad) tous disponibles dans la VM, CI « Tests e2e » à chaque envoi (verte), bancs historiques chaque dimanche, sous-agent `testeur-e2e`. Module `demarrage` ☑ (4 tests). Vidéos du smoke : https://claude.ai/artifact/CK7d9FvPvuPuBD2TBV72xR.
- **Ménage du 16/11** : retirés le code d'essai de l'aperçu (`docs/apercu-14-11/`), l'essai écarté de L9a (`docs/l9a-essai-une-ligne/`) et les anciens scripts `tests/cibler.sh` et `tests/run_all.sh` (remplacés par `run_cible.sh` et `run_all_fast.sh`). Tout reste dans l'historique git. Les sorties de bancs ignorées ont été effacées.
- **Branches distantes anciennes** (`claude/festive-cray-0rlnbw`, `claude/tabhub-app-setup-0plidk`, `sauvegarde/sequenceur-avant-refonte-ux`) : à supprimer seulement sur demande.
