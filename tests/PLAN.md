# Plan des tests Playwright (`@playwright/test`) — HarmoHub

État : **phases 3 et 4 faites, phase 5 (couverture intégrale) prête à démarrer** — 16/11/2026.
Validation (phase 4) : le smoke passe sur les 7 projets dans la VM et en CI (PR n° 1, exécution 43948088655, 7 jobs verts) ; garde-fou éprouvé (requête de
production bloquée → test en échec, `test.fail` ; projet non `demo-` refusé) ; le sous-agent `testeur-e2e` a produit `tests/reports/latest.md` ;
vidéos du smoke : https://claude.ai/artifact/CK7d9FvPvuPuBD2TBV72xR (et artefacts `rapport-<projet>` de la CI). Prochain module : `grille` (P1). Pull request n° 1 fermée, branche fusionnée le 16/11.
**Reprise** : la phase 5 commence par `grille`, puis les autres P1 dans l'ordre du § 3 ; consignes dans `CLAUDE-HARMOHUB.md` (« Suite à faire »). Branche : `claude/harmohub-travail-Claude` (fusion de `tests/playwright-setup`
le 16/11 ; elle publie le site par GitHub Pages). **Pas de pull request** (décision du 16/11) : on pousse directement, la CI tourne à chaque envoi. On ne touche pas à `main` sans accord.
Ce fichier est la mémoire de ce chantier : le sous-agent `testeur-e2e` y lit l'état de chaque module ; après un `/clear`, c'est ici qu'on reprend.

### Décisions de l'utilisateur (16/11)
- Pas de dépôt partagé : TrainHub et TabHub ont **leurs propres dépôts** (`lucas-webapp/TrainHub`, `lucas-webapp/TabHub`). Seuls quelques fichiers
  sont recopiés de l'un à l'autre (`docs/fichiers-partages.md`). L'organisation « plusieurs applis dans un dépôt » ne s'applique donc pas ; le garde-fou,
  les fixtures et le sous-agent restent néanmoins **génériques** (§ 9).
- Firebase : route de test **sans modifier l'appli** → réalisée par un petit serveur de test (`scripts/serveur-test.cjs`) qui substitue le SDK et
  la configuration à la volée (plus simple qu'une route Playwright, et utilisable aussi par `playwright-cli`).
- Bancs historiques : gardés tels quels, hors de la CI des PR, dans un workflow à part (à la demande + chaque dimanche).
- Matrice : à chaque envoi = tout sur chromium + `@smoke|@critique` sur les six autres projets (au départ « à chaque PR » ; plus de PR depuis le 16/11) ; matrice complète à la demande et chaque lundi ; WebKit macOS à la demande.
- Règles Firestore copiées de la console dans `firestore.rules` (émulateur seulement, jamais déployées).

## 1. Reconnaissance (16/11/2026)

✔ = vérifié dans la VM. ≈ = supposé.

### Environnement
- ✔ Node 22.23, npm 10.9, pnpm et yarn présents, Java 21 (OpenJDK 21.0.12) : suffisant pour `firebase-tools` récent, qui exige Java 21.
- ✔ Playwright 1.63 est installé **en global** (`/opt/node22/lib/node_modules/playwright`), avec **Chromium seul** (`/opt/pw-browsers/chromium-1243`). Absents : `@playwright/test`, `playwright-cli`, `firebase-tools`, `.claude/settings.json`, `.claude/agents/`, `.claude/skills/`. Seuls existent `.claude/commands/` (`reprise`, `silencieux`, `commentaires`).
- ✔ **Réseau** (proxy de la session ; « 403 au CONNECT » = bloqué) :

| Domaine | Rôle | État |
|---|---|---|
| `registry.npmjs.org` | paquets npm (`@playwright/test`, `firebase-tools`, `firebase`) | ouvert |
| `storage.googleapis.com` | archives des émulateurs Firebase (`firebase-preview-drop/emulator/…`) | ouvert |
| `packages.microsoft.com` | dépôt apt de Microsoft Edge | ouvert (≈ suffisant pour `playwright install msedge`) |
| `cdn.playwright.dev`, `playwright.download.prss.microsoft.com`, `playwright.azureedge.net` | téléchargement de Firefox et WebKit par Playwright | **BLOQUÉS** |
| `www.gstatic.com` | SDK Firebase chargé par l'appli (`firebasejs/10.13.2/…-compat.js`) | **BLOQUÉ** |
| `tonejs.github.io` | échantillons de piano de Tone.js | **BLOQUÉ** (l'appli bascule sur son synthé de secours) |
| `firestore.googleapis.com`, `identitytoolkit.googleapis.com` | **PRODUCTION** Firebase | **joignables** : le garde-fou est indispensable |
| `github.com` | git | ouvert |

### Application
- ✔ **Mémoire** : `CLAUDE.md` importe `@CLAUDE-HARMOHUB.md` par la syntaxe d'import, donc ce fichier est chargé aussi pour un sous-agent. Les autres fichiers (`docs/refonte.md`, `docs/dette-tests.md`…) sont cités par simple consigne de lecture : un sous-agent risque de les ignorer. Il n'en a pas besoin pour tester en boîte noire.
- ✔ **Stack** : HTML, CSS et JavaScript **sans build**, sans `package.json`, sans framework, sans TypeScript. Ce n'est pas un monorepo. Il n'y a pas de rendu côté serveur : n'importe quel serveur statique fait l'affaire (aujourd'hui `python3 -m http.server 8934`). Deux pages : `index.html` (l'appli) et `paroles.html` (chargée dans une `<iframe>` par l'onglet Paroles). Les versions des fichiers servis sont fixées par `?v=` dans `index.html`.
- ✔ **Firebase** :
  - pas de `firebase.json`, pas de `.firebaserc`, pas de `firestore.rules` dans le dépôt, aucun émulateur configuré ;
  - le SDK **compat 10.13.2** est chargé depuis `www.gstatic.com` (`index.html` et `paroles.html`) ;
  - configuration dans `firebase-config.js` (variable globale `FIREBASE_CONFIG`) : projet de production **`lucas-apps-479b9`**, **partagé avec TrainHub et TabHub** ; les données de chaque appli sont rangées sous `users/{uid}/apps/{slug}`, avec le slug `harmohub` ;
  - l'initialisation se fait dans `synchro-cloud.js`, fonction d'init vers la ligne 330 (`firebase.initializeApp(FIREBASE_CONFIG)`, puis `firebase.auth()` et `firebase.firestore()`) ;
  - ce fichier est **partagé avec TabHub et TrainHub** : on ne doit pas le modifier (`docs/fichiers-partages.md`).
- ✔ **Services utilisés** : Firestore (documents et écoutes `onSnapshot` dans `synchro-cloud.js`, `synchro-formes.js`, `synchro-doigtes.js` ; `synchro-harmohub.js`, `synchro-paroles.js`, `synchro-versions.js` ≈ passent par le même socle) et **Auth avec connexion Google** (`GoogleAuthProvider` + `signInWithPopup`). **Il y a donc bien une connexion utilisateur**, facultative : sans elle, l'appli fonctionne en local (`localStorage`). Ni Storage, ni Functions, ni Analytics, ni Remote Config.
- ✔ **Autres stockages** : `localStorage` (tout le morceau, les réglages) et l'API **File System Access** (`showDirectoryPicker`, dans `fichiers.js`) pour le rangement des fichiers sur le disque. Le PWA a un `manifest.json` mais pas de service worker.
- ✔ **Tests existants** : **288 « bancs »** maison (`tests/*_test.js`, harnais `tests/_harness.js`) :
  - ce sont des scripts Node qui pilotent Playwright directement, sans `@playwright/test`, avec de vrais gestes ;
  - ils tournent sur Chromium seul, à 1440 px (ordinateur) et à 390 px (téléphone tactile) ;
  - les balayages se lancent avec `tests/run_all_fast.sh` (complet, environ 19 min) et `tests/run_cible.sh` (ciblé) ;
  - ils neutralisent Firebase (requêtes vers `gstatic` et `googleapis` interrompues), et 8 d'entre eux utilisent un **faux Firestore** en Node (`tests/_firebase_faux.js`) ;
  - ligne de base actuelle : 11 rouges connus, listés dans `CLAUDE-HARMOHUB.md` ;
  - il n'y a **aucune CI** (pas de `.github/`).
- ✔ **Inventaire fonctionnel** : voir § 3.
- ✔ **Ce qui complique les tests** :
  - une interface au geste (glisser des poignées, glisser des notes, molette, appui long, tactile) ;
  - deux mises en page radicalement différentes de part et d'autre de 900 px ;
  - le son (Web Audio, Tone.js) ;
  - les popups Google (connexion) ;
  - File System Access, que **seul Chromium et Edge** connaissent : Firefox et Safari passent par un repli téléchargement ;
  - l'`iframe` des Paroles ;
  - les PDF générés (jsPDF, html2canvas) ;
  - les fichiers MIDI ;
  - des dates (historique des versions) ;
  - l'interface est en français uniquement ;
  - le verre dépoli (`backdrop-filter`) est rendu différemment selon les moteurs.
- ≈ **Règles Firestore** : elles ne sont pas dans le dépôt, mais dans la console du projet partagé. D'après le commentaire de `firebase-config.js`, elles seraient de la forme `match /users/{uid}/apps/{appId}`. Je ne peux pas les évaluer sans le fichier (voir § 6).

## 2. Constat → conséquence → choix proposé

| Constat | Conséquence pour les tests | Choix proposé |
|---|---|---|
| Aucun `package.json`, site statique sans build | `@playwright/test` et `firebase-tools` n'ont pas de place où s'installer | Ajouter un `package.json` **réservé aux tests** (dépendances de développement seulement). Il n'est pas servi à l'utilisateur et ne change rien au site. Le serveur de l'appli pour les tests est `npx http-server` (ou `python3 -m http.server`) dans le `webServer` de Playwright |
| Le SDK Firebase vient de `www.gstatic.com`, bloqué dans la VM | L'appli ne peut pas parler à l'émulateur dans la VM | Servir **le même SDK compat 10.13.2** depuis le paquet npm `firebase@10.13.2` : une route Playwright répond aux URL `gstatic` avec les fichiers de `node_modules/firebase/` (mêmes octets, aucun téléchargement externe). En CI on garde la même route, pour que la VM et la CI testent la même chose |
| Projet de production joignable depuis la VM | Une erreur de configuration écrirait dans la vraie base, **partagée avec deux autres applis** | **Triple barrière** : (1) le `projectId` des tests est `demo-harmohub` ; (2) un `globalSetup` refuse de démarrer si l'émulateur ne répond pas ou si le projet n'est pas `demo-` ; (3) une fixture commune interrompt toute requête vers `firestore.googleapis.com`, `identitytoolkit.googleapis.com`, `securetoken.googleapis.com`, `firebaseinstallations.googleapis.com` et `*.firebaseapp.com`, **et fait échouer le test** |
| L'init Firebase est dans `synchro-cloud.js`, partagé avec deux applis | Y ajouter `useEmulator` changerait trois applis | **Aucune modification de l'appli** : en test, une route Playwright remplace `firebase-config.js` par `tests/e2e/support/firebase-config.test.js`. Ce fichier pose `FIREBASE_CONFIG` sur `demo-harmohub` (fausse clé d'API) et enveloppe `firebase.initializeApp` pour brancher `auth().useEmulator(...)` et `firestore().useEmulator(...)` avant toute requête. Repli si tu préfères un réglage visible dans l'appli : `firebase-config.js` lirait `?emulateurs=1` (une modification de 5 lignes, **non partagée**) |
| Connexion Google par `signInWithPopup` | La vraie fenêtre Google est hors de portée | L'émulateur Auth fournit sa propre page de connexion (comptes fictifs). Les parcours synchro deviennent : « se connecter avec un compte fictif, écrire, relire sur un 2ᵉ contexte = 2ᵉ appareil » |
| 288 bancs maison, Chromium seul, avec un faux Firestore | Doublon possible ; ils restent la référence des gestes fins | On **ne les touche pas** et on ne les migre pas. Les tests `@playwright/test` vont dans `tests/e2e/` (séparés : `run_all_fast.sh` ne lit que `tests/*_test.js`) et visent les **parcours** sur toute la matrice. Les gestes très fins restent couverts par les bancs |
| Deux mises en page (< 900 px et ≥ 900 px) | Un même test ne peut pas viser les deux | Un test porte le tag `@ordinateur` ou `@mobile`. Les projets d'appareils filtrent par `grep` / `grepInvert` : l'iPad en paysage (≥ 900 px) passe les tests ordinateur avec le toucher, en portrait (< 900 px) les tests mobile |
| File System Access : Chromium et Edge seulement | Le rangement sur disque ne se teste pas partout ; 5 bancs plantent déjà dans ce conteneur au choix d'un dossier | Tests `@disque` limités à Chromium et Edge, avec `showDirectoryPicker` simulé par un `addInitScript` sur un répertoire OPFS (vrai stockage du navigateur) ; sur les autres navigateurs, on teste le repli (téléchargement) |
| Son (Tone.js), échantillons bloqués dans la VM | La lecture ne s'entend pas ; on ne peut vérifier que l'état | On vérifie l'état visible (bouton Lecture, mesure qui avance, tête de lecture) et non le son. Les échantillons sont interrompus partout (même comportement en VM et en CI) |
| Gestes de glisser et poignées | `getByRole` ne suffit pas pour une poignée | Les sélecteurs passent par `getByRole` / `getByLabel` quand l'élément a un rôle ou une étiquette (la plupart des boutons ont un `aria-label` en français), sinon `getByTestId`. Je proposerai des `data-testid` pour les poignées et les cases (§ 4) |
| Interface en français, accords en notation internationale | — | Les sélecteurs par texte sont en français (« Lecture », « Séquenceur ») ; pas de multilingue à gérer |
| Versions et horodatage | Rendu dépendant de l'heure | `page.clock` fige la date dans les tests d'historique |
| Verre dépoli, `backdrop-filter`, rendus différents selon les moteurs | Les captures d'écran comparées seraient fragiles | Pas de comparaison de captures au pixel ; des mesures (positions, tailles), comme les bancs |
| Firefox et WebKit non téléchargeables dans la VM | La matrice complète ne tourne pas ici | Dans la VM : `chromium`, `mobile-android` (Chromium émulé) et ≈ `edge`. En CI : tout (§ 4) |

## 3. Inventaire fonctionnel → modules

Priorité : **P1** = parcours principal, **P2** = fonctionnalité importante, **P3** = secondaire. Statut : ☐ à faire, ◐ en cours, ☑ fait.

| # | Module (`tests/e2e/<module>/`) | Parcours à tester | Prio. | Fichier prévu | Statut |
|---|---|---|---|---|---|
| 1 | `demarrage` | l'appli s'ouvre, morceau vide, ajouter trois accords, les lire (`@smoke`) ; garde-fou production ; état hors ligne (Firebase indisponible) | P1 | `demarrage/parcours-principal.spec.ts`, `demarrage/garde-fou.spec.ts`, `demarrage/hors-ligne.spec.ts` | ☑ 16/11 : 4 tests, 16 / 16 réussis sur les 7 projets (garde-fou : chromium seul) |
| 2 | `grille` | ajout rapide (saisie « C Am F G », `//`, `/basse`), ajout au clic (double-clic sur « + »), sélection, sélection multiple, copier / coller, glisser une case, supprimer, annuler / rétablir, parties (ajouter, renommer, dupliquer, supprimer, réordonner), menu du clic droit | P1 | `grille/*.spec.ts` | ◐ 16/11 : 93 tests (78 ordinateur, 15 téléphone, 32 `@critique`) ; `@critique` 136 / 136 sur les 7 projets ; module complet 403 réussis / 17 échoués = 4 bugs ouverts (G-01 à G-04, `tests/reports/bugs.md`) ; passe à ☑ quand G-01 à G-03 sont corrigés ou arbitrés. Non couvert : appui long et glisser au doigt |
| 3 | `accord` | fenêtre d'accord à trois onglets (Accord, Voicing, Rythme) : fondamentale, qualité, basse, durée, renversement / drop, onglet Rythme ; au téléphone, le panneau d'accord | P1 | `accord/*.spec.ts` | ◐ 17/11 : 49 tests (40 ordinateur, 9 téléphone, 16 `@critique`) ; module complet 217 réussis sur les 7 projets (dont 3 échecs attendus × 5 ordinateurs = bugs A-01 à A-03, `tests/reports/bugs.md`) ; passe à ☑ quand A-01 à A-03 sont corrigés ou arbitrés. Non couvert : glisser le bord d'une case pour la durée, vue Piano de la bulle |
| 4 | `lecture` | lecture / stop, boucle sur une plage, tempo (chevrons, saisie, tap), métronome, vitesse, mesure affichée, réglages de la barre de lecture | P1 | `lecture/*.spec.ts` | ◐ 17/11 : 58 tests (51 ordinateur, 27 téléphone dont 20 communs, 18 `@critique` ordinateur / 16 téléphone) ; module complet sur les 7 projets : tout vert, échecs attendus inclus = 4 bugs avec test (L-01 à L-04) + L-05 intermittent sans test (`tests/reports/bugs.md`) ; passe à ☑ quand L-01 à L-03 sont corrigés ou arbitrés. Pas de saisie au clavier du tempo dans l'appli (chevrons, molette, glisser, TAP). Non couvert : appui long au doigt (boucle, chevrons), tracé de plage au doigt, son (factice) |
| 5 | `sequenceur` | ouvrir / fermer, rythmes prédéfinis, poser / étirer / déplacer / supprimer une note, intensité, vue Accord / Piano, notes ajoutées (renommage), plein écran, copier / coller un rythme, formes personnelles | P1 | `sequenceur/*.spec.ts` | ☐ |
| 6 | `fichiers` | nouveau morceau, enregistrer (dont « modifications non enregistrées »), liste et ouverture des morceaux, renommer, supprimer, doublons, export / import JSON, export MIDI, import MIDI, export PDF, rangement sur disque (`@disque`, Chromium et Edge) | P1 | `fichiers/*.spec.ts` | ☐ |
| 7 | `synchro` | connexion par l'émulateur Auth, envoi du morceau, relecture sur un 2ᵉ appareil (2ᵉ contexte), conflit, coupure du réseau puis reprise, déconnexion, versions (historique, restauration) | P1 | `synchro/connexion-google.spec.ts` (+ à venir) | ◐ deux modes (16/11) |
| 8 | `tonalite` | choix de la tonalité et du mode, suggestion, transposition, notation internationale | P2 | `tonalite/*.spec.ts` | ☐ |
| 9 | `voicing` | popover de conduite des voix, échelles, partie active | P2 | `voicing/*.spec.ts` | ☐ |
| 10 | `diagrammes` | tiroir clavier / guitare, doigtés (flèches, cadenas, « Mes doigtés »), fenêtre flottante, éditeur de manche | P2 | `diagrammes/*.spec.ts` | ☐ |
| 11 | `structure` | onglet Structure : ajouter, réordonner, modifier les blocs, aperçu | P2 | `structure/*.spec.ts` | ☐ |
| 12 | `paroles` | onglet Paroles (iframe) : écrire, accords au-dessus des paroles, glisser, annuler, export PDF des paroles | P2 | `paroles/*.spec.ts` | ☐ |
| 13 | `parametres` | réglages (affichage, son, instrument, notation), persistance après rechargement | P3 | `parametres/*.spec.ts` | ☐ |
| 14 | `mobile` | barre du haut et onglets au téléphone, panneau Lecture, bande Clavier / Guitare, « + Accord », « + Section », gestes tactiles (défilement, appui long) | P1 (sur les projets mobiles) | `mobile/*.spec.ts` | ☐ |
| 15 | `robustesse` | états vides, morceau très long, stockage plein ou refusé, rechargement en cours d'édition, deux onglets ouverts | P3 | `robustesse/*.spec.ts` | ☐ |

Tags : `@smoke`, `@critique` (parcours P1), `@<module>`, plus `@ordinateur` / `@mobile` (filtre par appareil) et `@disque`.

## 4. Matrice navigateurs / appareils

| Projet | Profil Playwright | Tests | Dans la VM | En CI |
|---|---|---|---|---|
| `chromium` | Desktop Chrome 1440 × 900 | `@ordinateur` | ✔ (navigateur déjà là) | ✔ |
| `firefox` | Desktop Firefox | `@ordinateur` | ✔ (16/11 : le téléchargement passe maintenant) | ✔ |
| `webkit` | Desktop Safari | `@ordinateur` | ✔ (idem) | ✔ (Linux ; option macOS ci-dessous) |
| `edge` | Desktop Edge, canal `msedge` | `@ordinateur` | ✔ (installé via `packages.microsoft.com`) | ✔ |
| `mobile-android` | Pixel 7 (Chromium, tactile) | `@mobile` | ✔ | ✔ |
| `mobile-iphone` | iPhone 15 (WebKit, tactile) | `@mobile` | ✔ | ✔ |
| `tablette` | iPad Pro 11 paysage (WebKit, tactile, ≥ 900 px) | `@ordinateur` | ✔ | ✔ |

Constat du 16/11 : `cdn.playwright.dev` répond désormais depuis la VM (Firefox 1543 et WebKit 2359 se sont installés), alors qu'il renvoyait 403 en phase 1.
`setup-tests.sh` essaie et le dit si c'est de nouveau bloqué ; dans ce cas ces projets ne tournent qu'en CI.
**Sortie audio** : sans carte son, Firefox laisse l'AudioContext « suspended » et la lecture ne démarre jamais (Chromium et WebKit simulent une sortie).
`setup-tests.sh` et la CI démarrent une sortie PulseAudio factice. Ce n'est pas un défaut de l'appli (un vrai utilisateur a une carte son).

- **Façon de travailler** : on développe sur `chromium`, puis on passe le module sur tout ce qui est disponible dans la VM avant de le déclarer fini. La matrice complète tourne en CI.
- **WebKit sur macOS** : job `webkit-macos`, seulement à la demande (case à cocher du workflow). Le dépôt est **public** : les minutes GitHub Actions des runners standard, macOS compris, y sont **gratuites** (le facteur × 10 ne vaut que pour un dépôt privé).

## 5. Modifications de l'appli (pour la rendre testable)

1. **Aucune n'est indispensable** : la route Playwright remplace `firebase-config.js` et sert le SDK local (§ 2).
2. *Proposée, facultative* : des `data-testid` sur les éléments sans rôle ni étiquette accessible : poignées du séquenceur (`#sq-poignee`, poignée de largeur), cases du séquenceur (`.sq-case`), cases de la grille (`.grid-cell`), poignée du tiroir, blocs de la barre de lecture. Elles ne changent ni le rendu ni le comportement. Je les liste précisément au moment de chaque module, et tu valides au cas par cas.
3. *Alternative à 1, si tu la préfères* : une bascule explicite `?emulateurs=1` dans `firebase-config.js` (fichier propre à HarmoHub, non partagé).

## 6. Risque lié aux règles Firestore

Règles fournies par l'utilisateur le 16/11 et copiées dans `firestore.rules` (appliquées par l'émulateur, **jamais déployées**) : seul un utilisateur
connecté lit et écrit `users/{son uid}/apps/{appli}`. Le risque d'une base ouverte **ne s'applique pas**. Aucun test ne dépend d'un accès non connecté :
le test `synchro/connexion-google.spec.ts` vérifie au contraire qu'un inconnu reçoit **403** sur le document d'un compte.

## 7. Ce que couvrent DÉJÀ les bancs historiques (ne pas écrire en double)

288 bancs (`tests/*_test.js`, Chromium, 1440 px et 390 px tactile), écrits au fil des retours de l'utilisateur ; chacun dit en tête le retour qui l'a motivé.
Ils éprouvent surtout les **gestes fins et les mesures au pixel** ; les nouveaux tests visent les **parcours**, sur **tous les navigateurs**.

| Module | Bancs (≈ nombre) | Ce qu'ils tiennent déjà | Ce qui reste aux tests e2e |
|---|---|---|---|
| `sequenceur` | ≈ 59 (`seq_*`, `sequenceur_*`) | tailles, poignées, notes (poser, étirer, déplacer, Suppr), intensité, vue Piano, plein écran, lecture pendant l'édition, notes ajoutées | les parcours sur Firefox / WebKit / Edge / iPhone / iPad |
| `grille`, `accord` | ≈ 38 (`grid_*`, `ajout_*`, `bulle_*`, `case_*`, `accord_*`) | ajout rapide, `//` et `/basse`, ajout au clic, bulle à trois onglets, copier / coller, glisser, sélection | parcours multi-navigateurs, annuler / rétablir de bout en bout |
| `diagrammes` | ≈ 37 (`guitar_*`, `manche_*`, `piano_*`, `vues_*`, `glock_*`) | doigtés, cadenas, « Mes doigtés » (avec faux Firestore), tiroir | parcours, et « Mes doigtés » contre l'émulateur |
| `fichiers` | ≈ 28 (`export_*`, `import_*`, `midi_*`, `pdf_*`, `rangement_*`, `song_*`) | export / import JSON, MIDI, PDF, rangement disque (5 plantent dans ce conteneur, ligne de base) | repli téléchargement sur Firefox / Safari, parcours |
| `mobile` | ≈ 20 (`telephone_*`, `mobile_*`) | rangée du haut, panneaux, bande du bas, gestes tactiles | iPhone (WebKit) et Android, absents des bancs |
| `paroles` | ≈ 17 (`paroles_*`) | écriture, glisser, annuler, export | parcours multi-navigateurs |
| `lecture` | ≈ 14 (`play_*`, `tempo_*`, `metro_*`, `boucle_*`, `live_*`) | transport, tempo, métronome, boucle, mise à jour en direct | lecture sous Firefox / WebKit (sortie audio factice) |
| `voicing` | ≈ 10 (`voicing_*`, `vl_*`) | popover, échelles | parcours |
| `synchro` | 7 + 8 avec le faux Firestore (`synchro_*`, `versions_cloud`, `compte_cloud`) | fusion, envoi, reprise après panne, refus du vrai Firestore (`undefined`, tableaux imbriqués, 1 Mo) | **le vrai SDK contre l'émulateur**, les **règles de sécurité**, la connexion Google (émulateur Auth) |
| `structure`, `tonalite`, `parametres` | ≈ 3 + 2 + quelques-uns | — | presque tout |
| transversal | ≈ 32 (`verre*`, `gabarit_*`, `barre_*`, `probe_*`, `meta_*`, `sentinelle_*`) | lisibilité du verre, jauge des boutons, gardiens des bancs | — (rester dans les bancs) |

**Aucun banc ne contacte la production** (vérifié le 16/11) : les 22 qui touchent au réseau Firebase interrompent `gstatic` / `googleapis` ou servent un faux SDK ;
les 266 autres chargent l'appli avec la vraie configuration mais **sans jamais se connecter** — mesure faite avec le vrai SDK (servi depuis npm) et toutes les
requêtes Google interceptées : **0 tentative** vers Firebase pendant le chargement, les rechargements et 6 s d'attente, à 1440 px et à 390 px. Dans la VM, `gstatic`
étant bloqué, le SDK ne se charge même pas.

## 8. Ce qui reste à la charge de l'utilisateur

1. Décider s'il faut remettre `main` (version de secours) à jour : Claude n'y touche pas sans son accord.
2. Si les règles Firestore changent dans la console, les recopier dans `firestore.rules` (l'émulateur doit appliquer les mêmes).
3. GitHub Actions est **actif** sur le dépôt (571 exécutions de « pages build and deployment ») : rien à faire.

## 9. À réutiliser dans TrainHub et TabHub (leurs propres dépôts)

**Commun, à recopier tel quel** : `tests/e2e/support/emulateurs.ts` (projet `demo-`, domaines de production, remise à zéro, comptes fictifs),
`tests/e2e/support/global-setup.ts`, `tests/e2e/support/fixtures.ts` (garde-fou ; seule la fonction `ouvrirAppli` décrit l'appli), `.claude/agents/testeur-e2e.md`,
la structure de `.claude/settings.json` (hook + interdictions), `scripts/setup-tests.sh`, `.github/workflows/e2e.yml`.
**Propre à chaque appli** : `tests/e2e/support/appli.ts` (graine de données, ressources externes coupées), `scripts/serveur-test.cjs` (pages HTML qui chargent
le SDK, nom de `firebase-config.js`, slug `harmohub` → `trainhub` / `tabhub`, port), `firebase.json` (services utilisés), `package.json` (version du SDK chargée
par le site), le projet `demo-<appli>`, le nom de session `playwright-cli`, et la section « Tests » de `CLAUDE.md`.
Le projet Firebase de production est PARTAGÉ par les trois applis : le garde-fou bloque ses domaines quel que soit le slug.
