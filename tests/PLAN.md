# Plan des tests Playwright (`@playwright/test`) — HarmoHub

État : **phase 2 (plan), en attente de validation.** Rien n'est installé, l'appli n'a pas été modifiée.
Branche : `tests/playwright-setup`, partie de `claude/harmohub-travail-Claude` au commit `eb130ba`.
Ce fichier est la mémoire de ce chantier : le sous-agent `testeur-e2e` y lira l'état de chaque module, et l'état d'avancement s'y lira après un `/clear`.

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
| 1 | `demarrage` | l'appli s'ouvre, morceau vide, ajouter trois accords, les lire (`@smoke`) ; état hors ligne (Firebase indisponible) | P1 | `demarrage/ouverture.spec.js` | ☐ |
| 2 | `grille` | ajout rapide (saisie « C Am F G », `//`, `/basse`), ajout au clic (double-clic sur « + »), sélection, sélection multiple, copier / coller, glisser une case, supprimer, annuler / rétablir, parties (ajouter, renommer, dupliquer, supprimer, réordonner), menu du clic droit | P1 | `grille/*.spec.js` | ☐ |
| 3 | `accord` | fenêtre d'accord à trois onglets (Accord, Voicing, Rythme) : fondamentale, qualité, basse, durée, renversement / drop, onglet Rythme ; au téléphone, le panneau d'accord | P1 | `accord/*.spec.js` | ☐ |
| 4 | `lecture` | lecture / stop, boucle sur une plage, tempo (chevrons, saisie, tap), métronome, vitesse, mesure affichée, réglages de la barre de lecture | P1 | `lecture/*.spec.js` | ☐ |
| 5 | `sequenceur` | ouvrir / fermer, rythmes prédéfinis, poser / étirer / déplacer / supprimer une note, intensité, vue Accord / Piano, notes ajoutées (renommage), plein écran, copier / coller un rythme, formes personnelles | P1 | `sequenceur/*.spec.js` | ☐ |
| 6 | `fichiers` | nouveau morceau, enregistrer (dont « modifications non enregistrées »), liste et ouverture des morceaux, renommer, supprimer, doublons, export / import JSON, export MIDI, import MIDI, export PDF, rangement sur disque (`@disque`, Chromium et Edge) | P1 | `fichiers/*.spec.js` | ☐ |
| 7 | `synchro` | connexion par l'émulateur Auth, envoi du morceau, relecture sur un 2ᵉ appareil (2ᵉ contexte), conflit, coupure du réseau puis reprise, déconnexion, versions (historique, restauration) | P1 | `synchro/*.spec.js` | ☐ |
| 8 | `tonalite` | choix de la tonalité et du mode, suggestion, transposition, notation internationale | P2 | `tonalite/*.spec.js` | ☐ |
| 9 | `voicing` | popover de conduite des voix, échelles, partie active | P2 | `voicing/*.spec.js` | ☐ |
| 10 | `diagrammes` | tiroir clavier / guitare, doigtés (flèches, cadenas, « Mes doigtés »), fenêtre flottante, éditeur de manche | P2 | `diagrammes/*.spec.js` | ☐ |
| 11 | `structure` | onglet Structure : ajouter, réordonner, modifier les blocs, aperçu | P2 | `structure/*.spec.js` | ☐ |
| 12 | `paroles` | onglet Paroles (iframe) : écrire, accords au-dessus des paroles, glisser, annuler, export PDF des paroles | P2 | `paroles/*.spec.js` | ☐ |
| 13 | `parametres` | réglages (affichage, son, instrument, notation), persistance après rechargement | P3 | `parametres/*.spec.js` | ☐ |
| 14 | `mobile` | barre du haut et onglets au téléphone, panneau Lecture, bande Clavier / Guitare, « + Accord », « + Section », gestes tactiles (défilement, appui long) | P1 (sur les projets mobiles) | `mobile/*.spec.js` | ☐ |
| 15 | `robustesse` | états vides, morceau très long, stockage plein ou refusé, rechargement en cours d'édition, deux onglets ouverts | P3 | `robustesse/*.spec.js` | ☐ |

Tags : `@smoke`, `@critique` (parcours P1), `@<module>`, plus `@ordinateur` / `@mobile` (filtre par appareil) et `@disque`.

## 4. Matrice navigateurs / appareils

| Projet | Profil Playwright | Tests | Dans la VM | En CI |
|---|---|---|---|---|
| `chromium` | Desktop Chrome 1440 × 900 | `@ordinateur` | ✔ (navigateur déjà là) | ✔ |
| `firefox` | Desktop Firefox | `@ordinateur` | ✘ téléchargement bloqué | ✔ |
| `webkit` | Desktop Safari | `@ordinateur` | ✘ téléchargement bloqué | ✔ (Linux ; option macOS ci-dessous) |
| `edge` | Desktop Edge, canal `msedge` | `@ordinateur` | ≈ via `packages.microsoft.com` (à confirmer à l'installation) | ✔ |
| `mobile-android` | Pixel 7 (Chromium, tactile) | `@mobile` | ✔ | ✔ |
| `mobile-iphone` | iPhone 15 (WebKit, tactile) | `@mobile` | ✘ | ✔ |
| `tablette` | iPad Pro 11 paysage (WebKit, tactile, ≥ 900 px) | `@ordinateur` | ✘ | ✔ |

- **Façon de travailler** : on développe sur `chromium`, puis on passe le module sur tout ce qui est disponible dans la VM avant de le déclarer fini. La matrice complète tourne en CI.
- **WebKit sur macOS** : un job `webkit-macos` facultatif, déclenché seulement à la demande (`workflow_dispatch`). Une minute macOS compte pour **10 minutes** du forfait GitHub (dépôt privé). Pour une suite estimée à 15 min, cela fait environ 150 minutes décomptées par passage. Je propose de ne pas le lancer sur chaque PR.

## 5. Modifications de l'appli (pour la rendre testable)

1. **Aucune n'est indispensable** : la route Playwright remplace `firebase-config.js` et sert le SDK local (§ 2).
2. *Proposée, facultative* : des `data-testid` sur les éléments sans rôle ni étiquette accessible : poignées du séquenceur (`#sq-poignee`, poignée de largeur), cases du séquenceur (`.sq-case`), cases de la grille (`.grid-cell`), poignée du tiroir, blocs de la barre de lecture. Elles ne changent ni le rendu ni le comportement. Je les liste précisément au moment de chaque module, et tu valides au cas par cas.
3. *Alternative à 1, si tu la préfères* : une bascule explicite `?emulateurs=1` dans `firebase-config.js` (fichier propre à HarmoHub, non partagé).

## 6. Risque lié aux règles Firestore

- Les règles ne sont **pas dans le dépôt** : je ne peux ni les lire ni les évaluer.
- Le projet `lucas-apps-479b9` est **partagé par trois applis** : une règle trop large exposerait les données de toutes à la fois.
- La clé d'API est publique (c'est normal pour Firebase). Seules les règles protègent les données.
- Le risque à vérifier : si les règles contiennent `allow read, write: if true` (ou une date d'expiration de mode test), **n'importe qui** peut lire ou effacer les morceaux de tout le monde. La forme sûre est `match /users/{uid}/{document=**} { allow read, write: if request.auth != null && request.auth.uid == uid; }`.
- Je ne change rien. Si tu copies les règles dans le dépôt (`firestore.rules`), l'émulateur les appliquera et un module de tests vérifiera qu'un autre utilisateur ne peut ni lire ni écrire chez toi.

## 7. Actions qui ne dépendent que de toi

1. **Ouvrir le réseau de l'environnement cloud** (claude.ai › Claude Code › Environnements › ton environnement › Réseau › Domaines autorisés) aux domaines suivants. C'est facultatif : sans eux, Firefox, WebKit, l'iPhone et l'iPad ne tournent qu'en CI.
   - `cdn.playwright.dev`
   - `playwright.download.prss.microsoft.com`
   - `playwright.azureedge.net`
   - si tu veux charger le SDK Firebase depuis son vrai CDN : `www.gstatic.com`
   - si tu veux entendre les vrais échantillons de piano : `tonejs.github.io`
2. **Règles Firestore** : copier les règles de la console (Firebase › `lucas-apps-479b9` › Firestore › Règles) dans un fichier `firestore.rules` à la racine du dépôt, ou me les coller dans le chat.
3. **GitHub Actions** : vérifier qu'Actions est activé sur `lucas-webapp/HarmoHub` (Settings › Actions › General › « Allow all actions »). Une CI sur pull request consomme des minutes du forfait.
4. **Fusionner** la pull request quand tu le jugeras bon. Je ne fusionne rien.

## 8. Questions

1. **Branche cible de la PR** : `main` est à `4bdeb9d`, **58 commits derrière** `claude/harmohub-travail-Claude`. Une PR de `tests/playwright-setup` vers `main` embarquerait toute la refonte. Viser `claude/harmohub-travail-Claude` à la place ? Et quelle branche publie le site (GitHub Pages) ?
2. **Firebase** : d'accord pour **zéro modification de l'appli** (route Playwright qui remplace `firebase-config.js` et sert le SDK local), plutôt qu'une bascule `?emulateurs=1` dans `firebase-config.js` ?
3. **Bancs existants** : on les garde tels quels à côté des nouveaux tests (je le recommande : ils sont la mémoire des décisions), sans les brancher sur la CI ? Ou faut-il les y lancer aussi (environ 19 min, Chromium seul) ?
4. **Couverture « intégrale »** : 15 modules × 7 projets, cela fait beaucoup de minutes de CI. Faut-il lancer toute la matrice sur chaque PR et seulement `@smoke` + `@critique` sur les projets lents (WebKit, Firefox) ? Je le recommande.
5. **Job WebKit sur macOS** : seulement à la demande (recommandé), ou jamais ?
