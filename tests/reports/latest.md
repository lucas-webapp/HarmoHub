# Rapport e2e — module `fichiers` (17/11/2026)

## Résumé
- Testé : nouveau morceau, enregistrer, « modifications non enregistrées » (4 choix), liste « Mes morceaux » (ouvrir, renommer, dupliquer, supprimer, dossiers), export et import JSON (conflits), export et import MIDI, export PDF, export intégral, rangement sur disque (Edge), repli téléchargement.
- Résultat : 93 tests écrits (87 ordinateur, 80 téléphone dont 74 communs, 43 `@critique`). Module complet sur les 7 projets : 559 réussis, 36 ignorés, 0 échoué (échecs attendus inclus : 3 bugs, F-01 à F-03). `CI=1 npm run test:e2e:envoi` entièrement vert (chromium 348 réussis ; 6 autres projets `@smoke|@critique` 685 réussis).
- Suite conseillée : arbitrer F-01 (export JSON d'un morceau modifié) et F-03 (export intégral sans sauvegarde), puis module suivant `synchro`.

## Environnement
- Émulateurs Auth 9099 et Firestore 8080 (`demo-harmohub`) et appli servie en mode test sur 127.0.0.1:8936, lancés par moi pour explorer, puis arrêtés avant `envoi` (qui lance les siens). Tous arrêtés à la fin.
- Exploration `playwright-cli` puis scripts Playwright (Chromium, Edge, Firefox, WebKit) : aucune requête vers la production Firebase. Garde-fou : 0 requête bloquée dans les tests.

## Résultats par projet (module complet)
- chromium : 87 tests, 78 réussis, 9 ignorés (`@disque`, `test.fixme` F-04).
- edge : 87 tests, tous réussis (dont les 10 `@disque`).
- firefox, webkit, tablette : 87 tests, 78 réussis, 9 ignorés (pas de File System Access dans ces navigateurs).
- mobile-android, mobile-iphone : 80 tests, tous réussis.
- Échecs attendus (`test.fail`, vérification intacte) : F-01 (2 tests) et F-02 sur tous les projets ; F-03 sur les ordinateurs (et le test passe en échec attendu aussi sur les téléphones, car le défaut ne dépend pas de l'appareil).

## Problèmes (détail dans `tests/reports/bugs.md`)
- **F-01 gênant, tous** : un morceau modifié mais non enregistré s'exporte en JSON avec sa dernière version ENREGISTRÉE.
  1. Ouvrir un morceau enregistré, le modifier (état « Non enregistré »). 2. Menu du nom › « Exporter… » › « Ce morceau », ou « Nouveau morceau » › « Exporter en JSON et continuer ». 3. Lire le fichier.
  Attendu : les modifications de l'écran. Observé : la version enregistrée ; avec « Exporter en JSON et continuer » le travail est perdu en silence. Avis : bug de l'appli. Trace : `test-results/fichiers-nouveau-enregistr-…-Exporter-en-JSON-et-continuer-…`.
- **F-03 gênant, ordinateurs** : « Export intégral » sans dossier de rangement ne livre pas la sauvegarde JSON, pourtant cochée.
  1. Morceau enregistré, menu « Fichiers » › « Export intégral du morceau ». 2. Cases par défaut › « Exporter ».
  Attendu : 4 fichiers. Observé : 3 fichiers et « échec : Sauvegarde du morceau » (console : `pas-de-dossier`). Avis : bug de l'appli. Trace : `test-results/fichiers-pdf-export-…-livre-aussi-la-sauvegarde-JSON-…`.
- **F-02 mineur (à arbitrer), tous** : supprimer le morceau ouvert laisse ses accords dans la grille sous le titre « Nouveau morceau ». Trace : `…liste-morceaux-…-F-02-…`.
- **F-04 environnement, Chromium headless de la VM** : exporter vers le dossier de rangement simulé, pour un morceau enregistré, fait mourir le navigateur (« Target page, context or browser has been closed »), comme les 5 bancs historiques. Edge passe tous les mêmes tests. Les 9 tests concernés sont en `test.fixme` sur `chromium` seulement (`E2E_DISQUE_CHROMIUM=1` pour réessayer).
Les quatre tests en échec attendu restent en `test.fail` : retirer le `test.fail` le jour de la correction.

## Instabilités
- Aucune sur les 559 exécutions du module ni sur `envoi` (0 test rejoué).
- Limite du navigateur de test (pas un bug de l'appli, vérifié sur une page vide) : sous Chromium et Edge, le nom de fichier proposé à un téléchargement devient « download » dès qu'il contient une lettre accentuée (« Démo »). Firefox et WebKit gardent « Été ». Les tests qui lisent le nom de fichier utilisent donc des noms sans accent (« Demo ») ; le nom accentué n'est pas vérifié sous Chromium.
- Le sélecteur de fichiers natif (`showOpenFilePicker`, utilisé par « Importer une bibliothèque » sous Chromium et Edge) et le sélecteur de dossier sont hors de portée de Playwright : remplacés par un faux dans le test (le fichier lu est le vrai, le code d'import est celui de l'appli). Aucune vérification retirée ni affaiblie.

## Observations (pas des bugs)
- Un morceau neuf s'appelle « Nouveau morceau » et n'est dans aucune liste. « Enregistrer » demande le nom (Entrée valide, Échap abandonne) ; ensuite il ré-enregistre sans demander (message « Morceau enregistré »). Ctrl+S fait de même (ordinateur).
- « Nouveau morceau » ouvre une fenêtre « Titre du morceau / Dossier » ; « Dupliquer » ajoute « Nom (2) », « (3) » sans quitter le morceau ouvert.
- Renommer en un nom déjà pris est accepté (deux « Alpha (2) ») ; un nom vide est ignoré. À arbitrer vu le ménage des doublons déjà fait côté import.
- L'export « Ce morceau » et celui de la liste sont des « sauvegardes de bibliothèque » (`kind: library-backup`) à un seul morceau. Import : un morceau déjà présent (même id ou même titre) ouvre « Ce morceau existe déjà » (écraser / garder les deux / ignorer, ou « Partout »), la version la plus récente est cochée d'office.
- Export intégral avec toutes les cases décochées : « Exporter » ferme la fenêtre sans message ni fichier.
- Sans nom de morceau, l'export MIDI et PDF est refusé (« Nomme d'abord ton morceau… »). Import MIDI : s'ajoute à la suite de la grille, état « Non enregistré », annulable ; un fichier non MIDI est refusé avec un message.
- Sous Edge : le dossier de rangement reçoit `MIDI/`, `PDF/Accords/`, `PDF/Structure/`, `Morceaux/`, `Bibliotheque/`, et `_versions/` garde l'ancienne version à chaque réexport ; il est retenu après rechargement.
- Non couvert : export MP3 (audio), historique du morceau (module `synchro`), sélecteur natif de dossier et de fichier, nom de fichier accentué sous Chromium, rangement sur Chromium (F-04), appui long et gestes tactiles de la liste.

## Tests ajoutés (`tests/e2e/fichiers/`, 93 tests, tous `@fichiers`)
- `aide-fichiers.ts` : aides (bibliothèque de départ, menus, téléchargements, import, dossier simulé, lecteur et fabricant de MIDI).
- `nouveau-enregistrer.spec.ts` : 19 tests (11 `@critique`) : nouveau, enregistrer, Ctrl+S, quatre choix de « Modifications non enregistrées », menu du nom.
- `liste-morceaux.spec.ts` : 17 tests (10 `@critique`) : liste, ouvrir, renommer, dupliquer, supprimer (confirmation, Ctrl+Z), dossiers, F-02.
- `export-import-json.spec.ts` : 20 tests (9 `@critique`) : export d'un morceau ou de la bibliothèque, import, trois choix de conflit, fichiers invalides, aller-retour, F-01.
- `midi.spec.ts` : 11 tests (7 `@critique`) : export relu octet par octet, import, aller-retour, refus.
- `pdf-export.spec.ts` : 10 tests (5 `@critique`) : fenêtre d'options, PDF valide, export intégral, F-03.
- `rangement-disque.spec.ts` : 10 tests (6 `@critique`, `@disque`) : dossier simulé, MIDI, PDF, versions, intégral, bibliothèque, « Ne plus ranger », rechargement ; repli sans File System Access.
- `telephone.spec.ts` : 6 tests (4 `@critique`, `@mobile`) : menus et fenêtres dans l'écran, toucher.
- Sélecteurs CSS faute de mieux : `#tb-titre`, `#tb-etat`, `#toast`, `.file-row`, `.file-name`, `#new-folder-input`, `.tb-titre-saisie`. `data-testid` utiles : `file-row` (avec le nom du morceau), `toast`, `etat-morceau`.
