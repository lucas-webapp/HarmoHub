# HarmoHub — mémoire de reprise (CLAUDE-HARMOHUB.md)

Mis à jour le 19/11/2026 (tests e2e : phase 5 terminée, 1 005 tests ; correction des bugs en cours). **Seul fichier où s'écrit l'état du chantier.** Volontairement COURT (chargé à chaque session) : le détail va dans `docs/dette-tests.md`, jamais ici. À lire avec `CLAUDE.md`.

| Besoin | Fichier (ne jamais lire en entier : `grep -n` puis `sed -n`) |
|---|---|
| Journal de chaque lot (mesures, sabotages, bancs réécrits) | `docs/dette-tests.md` |
| Décisions détaillées, lettres A à T (`grep -n "^\*\*[A-T]\. "`) | `docs/decisions-13-14-11.md` |
| Phrases exactes de l'utilisateur du 14/11 | `docs/commentaires-14-11.md` |
| Règles de la refonte, ancienne feuille de route | `docs/refonte.md`, `docs/refonte-sequenceur.md` |
| Fichiers partagés avec TabHub / TrainHub | `docs/fichiers-partages.md` |

## Suite à faire (lue par `/reprise` — à réécrire à la fin de CHAQUE lot)

**PROCHAINE ÉTAPE : CORRECTION DES BUGS TROUVÉS PAR LES TESTS E2E** (demandée par l'utilisateur le 19/11 : « établis toi-même le plan des corrections et commence »).
La phase 5 (15 modules, 1 005 tests, 61 bugs) est terminée. Le suivi est dans `tests/reports/bugs.md` : section « Bugs corrigés » en tête, détail de chaque bug dessous.
Méthode : corriger dans `script.js` / `paroles.js`, **retirer le `test.fail` du test concerné** (il rougit sinon : « Expected to fail, but passed »), incrémenter `?v=` dans `index.html`
(toutes les occurrences), lancer les modules touchés sur les 7 projets (`npx firebase emulators:exec --project demo-harmohub --only auth,firestore "npx playwright test <chemins> --reporter=list"`),
puis `CI=1 npm run test:e2e:avant-envoi`, commit, push. **Pas de balayage complet des bancs historiques sauf nécessité** (consigne de l'utilisateur du 19/11).
- **Corrigés les 19 et 20/11** (détail et tests : tableau « Bugs corrigés » de `tests/reports/bugs.md`) : P-01, P-02, P-03, P-05, P-06, P-07 ; Z-01 à Z-06 ; E-02 à E-07 ;
  F-01, F-02, F-03 ; D-01, D-02 ; R-01, R-02, R-03 ; G-02, G-03, G-04 ; L-02, L-03 ; E-01, V-01 ; A-01, A-02 ; M-01 ; S-01, S-03 ; T-01 à T-04 ; V-02. L'utilisateur a délégué les arbitrages
  le 20/11 (« je te laisse prendre les meilleures décisions pour tous ces points ») : chaque décision est notée « (décidé) » dans le tableau.
- **Reste à corriger** : G-01 (Firefox, premier clic sur une autre partie), L-01 (zone des numéros de mesure), L-04 (lecture depuis la case choisie partout). S-02, A-03, M-02, P-04 corrigés le 20/11.
- **Essai neutre du séquenceur fait le 20/11** : `tests/reports/2026-11-20-essai-sequenceur.md` (19 bugs ES-01 à ES-20, sans ES-06 : 8 gênants, 11 mineurs ; 17 améliorations ; 13 captures dans `tests/reports/essai-sequenceur/`). **En attente du choix de l'utilisateur** sur ce qu'on corrige d'abord.
- **Reportés** : P-08 (×N des paroles : écrire dans la structure sans recharger la page Paroles), Z-07 (deux onglets), Y-01 / Y-02 / Y-03 (synchro, `synchro-cloud.js` partagé), T-05 (constat), D-03, D-04 (WebKit), L-05 / L-06 (intermittents).
- **Piège appris le 20/11** : ne JAMAIS modifier un fichier servi pendant qu'un passage de tests tourne (le serveur sert le dépôt en direct) ; et ne pas remplacer `window.localStorage`
  (synchro-harmohub.js compare `this === window.localStorage`) : patcher `Storage.prototype`, comme lui.
- Rappel des anciens points : voir plus bas « À lui faire valider » et « Questions restées ouvertes ». `main` (version de secours) n'est touchée que sur accord explicite.

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
